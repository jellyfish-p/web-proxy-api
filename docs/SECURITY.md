# 安全规范

本文档定义了 Web Proxy API 项目的安全最佳实践和规范。

## 目录

- [安全原则](#安全原则)
- [认证和授权](#认证和授权)
- [数据保护](#数据保护)
- [输入验证](#输入验证)
- [API 安全](#api-安全)
- [密码安全](#密码安全)
- [会话管理](#会话管理)
- [日志安全](#日志安全)
- [依赖安全](#依赖安全)
- [部署安全](#部署安全)
- [安全检查清单](#安全检查清单)

## 安全原则

### 核心原则

1. **最小权限原则**: 只授予必要的权限
2. **纵深防御**: 多层安全防护
3. **默认安全**: 默认配置应该是安全的
4. **失败安全**: 失败时应该拒绝访问
5. **保持简单**: 简单的系统更容易保护

### 安全优先级

```
P0 - 关键: 立即修复
  - 远程代码执行
  - SQL 注入
  - 认证绕过

P1 - 高: 24 小时内修复
  - XSS 攻击
  - CSRF 攻击
  - 敏感信息泄露

P2 - 中: 1 周内修复
  - 信息泄露
  - 权限提升
  - 拒绝服务

P3 - 低: 下个版本修复
  - 配置问题
  - 最佳实践违反
```

## 认证和授权

### API Key 认证

```typescript
// ✅ 正确: 安全的 API Key 验证
export async function validateApiKey(event: H3Event): Promise<boolean> {
  const authHeader = getHeader(event, 'authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: 'Missing or invalid authorization header'
    });
  }
  
  const apiKey = authHeader.substring(7);
  
  // 使用常量时间比较防止时序攻击
  const config = getConfig();
  for (const validKey of config.keys) {
    if (timingSafeEqual(
      Buffer.from(apiKey),
      Buffer.from(validKey)
    )) {
      return true;
    }
  }
  
  throw createError({
    statusCode: 401,
    message: 'Invalid API key'
  });
}

// ❌ 错误: 不安全的比较
if (apiKey === validKey) {
  return true;
}
```

### Session 认证

```typescript
// ✅ 正确: 安全的 Session 管理
import { randomBytes } from 'crypto';

export async function createSession(userId: string): Promise<string> {
  // 生成安全的随机 session ID
  const sessionId = randomBytes(32).toString('hex');
  
  // 存储 session（使用加密）
  await storeSession(sessionId, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 小时
  });
  
  return sessionId;
}

export async function validateSession(event: H3Event): Promise<string> {
  const sessionId = getCookie(event, 'session_id');
  
  if (!sessionId) {
    throw createError({
      statusCode: 401,
      message: 'No session found'
    });
  }
  
  const session = await getSession(sessionId);
  
  if (!session) {
    throw createError({
      statusCode: 401,
      message: 'Invalid session'
    });
  }
  
  // 检查过期
  if (session.expiresAt < Date.now()) {
    await deleteSession(sessionId);
    throw createError({
      statusCode: 401,
      message: 'Session expired'
    });
  }
  
  return session.userId;
}

// ❌ 错误: 使用可预测的 session ID
const sessionId = `${userId}_${Date.now()}`;
```

### 权限检查

```typescript
// ✅ 正确: 细粒度权限控制
export async function requirePermission(
  event: H3Event,
  permission: string
): Promise<void> {
  const userId = await validateSession(event);
  const user = await getUser(userId);
  
  if (!user.permissions.includes(permission)) {
    throw createError({
      statusCode: 403,
      message: 'Insufficient permissions'
    });
  }
}

// 使用
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'tokens:delete');
  // 继续处理
});
```

## 数据保护

### 敏感数据加密

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ✅ 正确: 加密敏感数据
const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 字节

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // 返回 iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// 使用
const encryptedPassword = encrypt(password);
const decryptedPassword = decrypt(encryptedPassword);
```

### 密码哈希

```typescript
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ✅ 正确: 使用 scrypt 哈希密码
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const [salt, key] = hash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  
  return timingSafeEqual(keyBuffer, derivedKey);
}

// ❌ 错误: 使用简单的哈希
const hash = crypto.createHash('md5').update(password).digest('hex');
```

### 数据脱敏

```typescript
// ✅ 正确: 脱敏敏感信息
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.substring(0, 3)}***@${domain}`;
}

export function maskToken(token: string): string {
  if (token.length <= 10) {
    return '***';
  }
  return `${token.substring(0, 10)}...`;
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

// 使用
console.log('Email:', maskEmail('user@example.com')); // use***@example.com
console.log('Token:', maskToken('sk-1234567890abcdef')); // sk-1234567...
console.log('Phone:', maskPhone('13812345678')); // 138****5678
```

## 输入验证

### 请求验证

```typescript
// ✅ 正确: 严格的输入验证
import { z } from 'zod';

const ChatRequestSchema = z.object({
  model: z.string().min(1).max(100),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(10000),
  })).min(1).max(100),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(4096).optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  // 验证输入
  const result = ChatRequestSchema.safeParse(body);
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request',
      data: result.error.errors
    });
  }
  
  // 使用验证后的数据
  const validatedData = result.data;
  // 处理请求...
});
```

### SQL 注入防护

```typescript
// ✅ 正确: 使用参数化查询
const users = await db.query(
  'SELECT * FROM users WHERE email = ?',
  [email]
);

// ❌ 错误: 字符串拼接
const users = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

### XSS 防护

```typescript
// ✅ 正确: 转义 HTML
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, m => map[m]);
}

// 使用
const safeContent = escapeHtml(userInput);

// Vue 模板中自动转义
<template>
  <div>{{ userInput }}</div> <!-- 自动转义 -->
  <div v-html="sanitizedHtml"></div> <!-- 需要手动清理 -->
</template>
```

### 路径遍历防护

```typescript
// ✅ 正确: 验证文件路径
import { resolve, normalize, relative } from 'path';

export function validateFilePath(
  basePath: string,
  userPath: string
): string {
  const normalizedPath = normalize(userPath);
  const fullPath = resolve(basePath, normalizedPath);
  const relativePath = relative(basePath, fullPath);
  
  // 确保路径在 basePath 内
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid file path');
  }
  
  return fullPath;
}

// ❌ 错误: 直接使用用户输入
const filePath = path.join(basePath, userInput);
```

## API 安全

### 速率限制

```typescript
// ✅ 正确: 实现速率限制
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): void {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || record.resetAt < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return;
  }
  
  if (record.count >= limit) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests',
      data: {
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      }
    });
  }
  
  record.count++;
}

// 使用
export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, 'authorization')?.substring(7);
  rateLimit(apiKey || getClientIP(event), 100, 60000);
  // 继续处理...
});
```

### CORS 配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Max-Age': '86400',
        },
      },
    },
  },
});
```

### CSRF 防护

```typescript
// ✅ 正确: CSRF Token 验证
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateCsrfToken(
  event: H3Event,
  expectedToken: string
): void {
  const token = getHeader(event, 'x-csrf-token');
  
  if (!token || !timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  )) {
    throw createError({
      statusCode: 403,
      message: 'Invalid CSRF token'
    });
  }
}
```

### 请求大小限制

```typescript
// ✅ 正确: 限制请求体大小
export default defineEventHandler(async (event) => {
  const contentLength = getHeader(event, 'content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw createError({
      statusCode: 413,
      message: 'Request entity too large'
    });
  }
  
  // 继续处理...
});
```

## 密码安全

### 密码策略

```typescript
// ✅ 正确: 强密码验证
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain number');
  }
  
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 密码重置

```typescript
// ✅ 正确: 安全的密码重置
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await getUserByEmail(email);
  
  // 不要泄露用户是否存在
  if (!user) {
    return; // 静默失败
  }
  
  // 生成安全的重置令牌
  const resetToken = randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // 存储哈希后的令牌
  await storeResetToken(user.id, hashedToken, Date.now() + 3600000); // 1 小时
  
  // 发送邮件（包含原始令牌）
  await sendResetEmail(email, resetToken);
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  // 验证密码强度
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // 哈希令牌进行比较
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  const resetRecord = await getResetToken(hashedToken);
  
  if (!resetRecord || resetRecord.expiresAt < Date.now()) {
    throw new Error('Invalid or expired reset token');
  }
  
  // 更新密码
  const hashedPassword = await hashPassword(newPassword);
  await updateUserPassword(resetRecord.userId, hashedPassword);
  
  // 删除重置令牌
  await deleteResetToken(hashedToken);
  
  // 使所有现有 session 失效
  await invalidateUserSessions(resetRecord.userId);
}
```

## 会话管理

### 安全的 Cookie 设置

```typescript
// ✅ 正确: 安全的 Cookie 配置
export function setSecureCookie(
  event: H3Event,
  name: string,
  value: string
): void {
  setCookie(event, name, value, {
    httpOnly: true,        // 防止 JavaScript 访问
    secure: true,          // 仅 HTTPS
    sameSite: 'strict',    // CSRF 防护
    maxAge: 24 * 60 * 60,  // 24 小时
    path: '/',
  });
}

// ❌ 错误: 不安全的 Cookie
setCookie(event, 'session', sessionId);
```

### Session 固定防护

```typescript
// ✅ 正确: 登录后重新生成 session
export async function login(
  event: H3Event,
  username: string,
  password: string
): Promise<void> {
  // 验证凭据
  const user = await validateCredentials(username, password);
  
  // 删除旧 session
  const oldSessionId = getCookie(event, 'session_id');
  if (oldSessionId) {
    await deleteSession(oldSessionId);
  }
  
  // 创建新 session
  const newSessionId = await createSession(user.id);
  setSecureCookie(event, 'session_id', newSessionId);
}
```

## 日志安全

### 安全日志记录

```typescript
// ✅ 正确: 安全的日志记录
export function secureLog(level: string, message: string, data?: any): void {
  const sanitizedData = data ? sanitizeLogData(data) : undefined;
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    data: sanitizedData,
  }));
}

function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  const sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'secret',
    'authorization',
  ];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

// ❌ 错误: 记录敏感信息
console.log('User login:', { username, password, token });
```

## 依赖安全

### 依赖审计

```bash
# 定期检查依赖漏洞
bun audit

# 更新依赖
bun update

# 检查过时的依赖
bun outdated
```

### 依赖锁定

```bash
# 使用 lock 文件
bun.lock  # Bun
package-lock.json  # npm
yarn.lock  # Yarn

# 提交 lock 文件到版本控制
git add bun.lock
git commit -m "chore: update dependencies"
```

### 最小化依赖

```typescript
// ✅ 正确: 只导入需要的部分
import { readFile } from 'fs/promises';

// ❌ 错误: 导入整个库
import * as fs from 'fs';
```

## 部署安全

### 环境变量

```bash
# ✅ 正确: 使用环境变量存储敏感信息
export ADMIN_PASSWORD="strong-password"
export ENCRYPTION_KEY="32-byte-hex-key"
export DATABASE_URL="postgresql://..."

# ❌ 错误: 硬编码敏感信息
const password = "admin123";
```

### HTTPS 配置

```nginx
# ✅ 正确: 强制 HTTPS
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 现代 SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

### 安全响应头

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
          'Content-Security-Policy': "default-src 'self'",
        },
      },
    },
  },
});
```

### 文件权限

```bash
# ✅ 正确: 限制文件权限
chmod 600 config.yaml          # 只有所有者可读写
chmod 600 accounts/*.json      # 账号文件
chmod 700 /opt/web-proxy-api   # 应用目录

# ❌ 错误: 过于宽松的权限
chmod 777 config.yaml
```

## 安全检查清单

### 开发阶段

- [ ] 所有输入都经过验证
- [ ] 使用参数化查询
- [ ] 敏感数据已加密
- [ ] 密码使用强哈希算法
- [ ] 实现了速率限制
- [ ] 添加了 CSRF 防护
- [ ] 日志不包含敏感信息
- [ ] 错误消息不泄露信息

### 部署阶段

- [ ] 使用 HTTPS
- [ ] 配置了安全响应头
- [ ] 环境变量存储敏感信息
- [ ] 文件权限正确设置
- [ ] 防火墙已配置
- [ ] 依赖已更新到最新版本
- [ ] 启用了日志记录
- [ ] 配置了监控和告警

### 运维阶段

- [ ] 定期更新依赖
- [ ] 定期审计日志
- [ ] 定期备份数据
- [ ] 定期安全扫描
- [ ] 监控异常活动
- [ ] 及时应用安全补丁

## 安全事件响应

### 发现漏洞

1. **不要公开披露**: 先私下报告
2. **联系维护者**: 发送邮件到 security@example.com
3. **提供详情**: 包括复现步骤和影响范围
4. **等待响应**: 给维护者时间修复

### 报告模板

```markdown
## 漏洞描述
简要描述漏洞。

## 影响范围
- 受影响的版本
- 潜在影响

## 复现步骤
1. 步骤 1
2. 步骤 2
3. 步骤 3

## 建议修复方案
如果有的话。

## 联系方式
你的联系方式。
```

## 相关资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [开发规范](DEVELOPMENT_STANDARDS.md)
- [部署指南](DEPLOYMENT.md)

---

最后更新: 2026-01-31
