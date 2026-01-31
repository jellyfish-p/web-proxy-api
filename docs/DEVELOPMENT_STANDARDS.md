# 开发规范文档

本文档定义了 Web Proxy API 项目的开发标准和最佳实践。所有开发者都应遵循这些规范以确保代码质量和项目一致性。

## 目录

- [项目原则](#项目原则)
- [目录结构规范](#目录结构规范)
- [命名规范](#命名规范)
- [TypeScript 规范](#typescript-规范)
- [错误处理](#错误处理)
- [日志规范](#日志规范)
- [配置管理](#配置管理)
- [性能优化](#性能优化)
- [安全规范](#安全规范)

## 项目原则

### 1. 项目隔离原则

**核心理念**: 每个 AI 服务提供商作为独立项目，互不干扰。

```
✅ 正确做法:
server/projects/deepseek/
  ├── handler.ts          # 项目处理器
  └── utils/              # 项目专用工具
      ├── accounts.ts
      ├── api.ts
      └── wasm.ts

❌ 错误做法:
server/utils/
  ├── deepseek-utils.ts   # 不要在通用目录放项目特定代码
  └── openai-utils.ts
```

### 2. 单一职责原则

每个模块、函数应该只做一件事，并做好这件事。

```typescript
// ✅ 正确: 职责单一
async function loginWithEmail(email: string, password: string) {
  // 只负责邮箱登录
}

async function loginWithMobile(mobile: string, password: string) {
  // 只负责手机号登录
}

// ❌ 错误: 职责混乱
async function login(identifier: string, password: string, type: string) {
  if (type === 'email') {
    // 邮箱登录逻辑
  } else if (type === 'mobile') {
    // 手机号登录逻辑
  }
  // 职责不清晰
}
```

### 3. 依赖倒置原则

高层模块不应依赖低层模块，两者都应依赖抽象。

```typescript
// ✅ 正确: 依赖接口
interface ProjectHandler {
  handleRequest(request: ChatRequest): Promise<Response>;
  getSupportedModels(): string[];
}

// ❌ 错误: 直接依赖具体实现
import { deepseekHandler } from './projects/deepseek/handler';
```

## 目录结构规范

### 项目根目录

```
web-proxy-api/
├── accounts/              # 账号文件（按项目分类）
│   └── [project-name]/   # 每个项目独立目录
├── app/                   # Nuxt 应用前端
│   ├── components/       # Vue 组件
│   ├── composables/      # 组合式函数
│   ├── middleware/       # 路由中间件
│   └── pages/            # 页面路由
├── docs/                  # 项目文档
├── public/                # 静态资源
├── server/                # 服务器端代码
│   ├── api/              # API 路由
│   ├── assets/           # 服务器资源
│   ├── plugins/          # Nitro 插件
│   ├── projects/         # AI 项目实现
│   └── utils/            # 通用工具函数
├── config.yaml           # 主配置文件
└── package.json
```

### Server 目录详解

```
server/
├── api/
│   ├── v0/                    # 管理 API (内部使用)
│   │   └── management/       # 管理面板 API
│   └── v1/                    # 公开 API (OpenAI 兼容)
│       ├── models.get.ts     # 获取模型列表
│       └── chat/
│           └── completions.post.ts
├── assets/                    # 服务器资源文件
│   ├── tokenizer.json        # Tokenizer 配置
│   └── [project]_wasm/       # WASM 文件
├── plugins/                   # Nitro 插件
│   ├── config.ts             # 配置加载
│   ├── tokenizer.ts          # Tokenizer 初始化
│   └── register-[project].ts # 项目注册
├── projects/                  # 项目实现
│   └── [project-name]/       # 每个项目独立目录
│       ├── handler.ts        # 必需: 项目处理器
│       └── utils/            # 可选: 项目工具函数
└── utils/                     # 通用工具（不含项目特定逻辑）
    ├── config.ts             # 配置管理
    ├── auth.ts               # 认证工具
    ├── project-registry.ts   # 项目注册表
    └── tokenizer.ts          # Token 计数
```

## 命名规范

### 文件命名

```
✅ 正确:
- kebab-case: user-service.ts, chat-handler.ts
- API 路由: models.get.ts, completions.post.ts

❌ 错误:
- camelCase: userService.ts
- PascalCase: ChatHandler.ts
- snake_case: user_service.ts
```

### 变量和函数命名

```typescript
// ✅ 正确: camelCase
const userName = 'John';
const apiKey = 'sk-xxx';
function getUserInfo() {}
async function fetchData() {}

// ❌ 错误
const UserName = 'John';        // PascalCase
const api_key = 'sk-xxx';       // snake_case
function GetUserInfo() {}       // PascalCase
```

### 类和接口命名

```typescript
// ✅ 正确: PascalCase
class UserService {}
interface ChatRequest {}
type ModelConfig = {};

// ❌ 错误
class userService {}            // camelCase
interface chatRequest {}        // camelCase
```

### 常量命名

```typescript
// ✅ 正确: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT = 30000;

// ❌ 错误
const maxRetryCount = 3;        // camelCase
const ApiBaseUrl = 'xxx';       // PascalCase
```

### 项目命名

```typescript
// ✅ 正确: 小写，连字符分隔
server/projects/deepseek/
server/projects/openai/
server/projects/claude-ai/

// ❌ 错误
server/projects/DeepSeek/       // 大写
server/projects/open_ai/        // 下划线
```

## TypeScript 规范

### 类型定义

```typescript
// ✅ 正确: 明确的类型定义
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
}

// ❌ 错误: 使用 any
interface ChatRequest {
  model: any;
  messages: any[];
  options?: any;
}
```

### 函数签名

```typescript
// ✅ 正确: 完整的类型注解
async function handleChatRequest(
  request: ChatRequest,
  apiKey: string
): Promise<ChatResponse> {
  // 实现
}

// ❌ 错误: 缺少类型
async function handleChatRequest(request, apiKey) {
  // 实现
}
```

### 空值处理

```typescript
// ✅ 正确: 使用可选链和空值合并
const token = account?.token ?? '';
const proxyUrl = config?.proxy_url ?? null;

// ❌ 错误: 不安全的访问
const token = account.token || '';
const proxyUrl = config.proxy_url;
```

### 类型守卫

```typescript
// ✅ 正确: 使用类型守卫
function isEmailAccount(account: Account): account is EmailAccount {
  return 'email' in account;
}

if (isEmailAccount(account)) {
  // TypeScript 知道这里 account 是 EmailAccount
  console.log(account.email);
}

// ❌ 错误: 类型断言
const email = (account as EmailAccount).email;
```

### 泛型使用

```typescript
// ✅ 正确: 合理使用泛型
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function fetchApi<T>(url: string): Promise<ApiResponse<T>> {
  // 实现
}

// ❌ 错误: 过度使用泛型
interface Response<T, U, V> {
  data: T;
  meta: U;
  extra: V;
}
```

## 错误处理

### 错误类型定义

```typescript
// ✅ 正确: 自定义错误类
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class AuthenticationError extends ApiError {
  constructor(message: string) {
    super(message, 401, 'AUTH_FAILED');
  }
}
```

### 错误处理模式

```typescript
// ✅ 正确: 完整的错误处理
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    // 验证输入
    if (!body.model) {
      throw createError({
        statusCode: 400,
        message: 'Model is required'
      });
    }
    
    // 处理请求
    const result = await processRequest(body);
    return result;
    
  } catch (error) {
    // 记录错误
    console.error('[API Error]', error);
    
    // 返回友好的错误信息
    if (error instanceof ApiError) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message
      });
    }
    
    // 未知错误
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
});

// ❌ 错误: 忽略错误处理
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const result = await processRequest(body);
  return result;
});
```

### 重试机制

```typescript
// ✅ 正确: 实现重试逻辑
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Retry ${i + 1}/${maxRetries} failed:`, error);
      
      // 等待后重试
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError!;
}
```

## 日志规范

### 日志级别

```typescript
// ✅ 正确: 使用适当的日志级别
console.error('[Error]', 'Failed to connect:', error);      // 错误
console.warn('[Warning]', 'Token expired, refreshing...');  // 警告
console.info('[Info]', 'Request processed successfully');   // 信息
console.log('[Debug]', 'Request body:', body);              // 调试

// ❌ 错误: 滥用 console.log
console.log('Error:', error);
console.log('Warning:', warning);
```

### 日志格式

```typescript
// ✅ 正确: 结构化日志
console.log('[ProjectName]', 'Action:', {
  timestamp: new Date().toISOString(),
  userId: user.id,
  action: 'login',
  status: 'success'
});

// ❌ 错误: 无结构的日志
console.log('User logged in');
```

### 敏感信息处理

```typescript
// ✅ 正确: 隐藏敏感信息
console.log('[Auth]', 'Token:', token.substring(0, 10) + '...');
console.log('[Account]', 'Email:', email.replace(/(.{3}).*(@.*)/, '$1***$2'));

// ❌ 错误: 暴露敏感信息
console.log('[Auth]', 'Token:', token);
console.log('[Account]', 'Password:', password);
```

## 配置管理

### 配置文件结构

```yaml
# ✅ 正确: 清晰的配置结构
app:
  name: web-proxy-api
  port: 3000
  
admin:
  username: admin
  password: ${ADMIN_PASSWORD}  # 使用环境变量

keys:
  - ${API_KEY_1}
  - ${API_KEY_2}

projects:
  deepseek:
    enabled: true
    timeout: 30000
```

### 配置访问

```typescript
// ✅ 正确: 通过配置工具访问
import { getConfig } from '../utils/config';

const config = getConfig();
const port = config.app.port;
const isEnabled = config.projects.deepseek?.enabled ?? false;

// ❌ 错误: 硬编码配置
const port = 3000;
const apiUrl = 'https://api.example.com';
```

### 环境变量

```typescript
// ✅ 正确: 使用环境变量
const apiKey = process.env.API_KEY || '';
const nodeEnv = process.env.NODE_ENV || 'development';

// 验证必需的环境变量
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}

// ❌ 错误: 硬编码敏感信息
const apiKey = 'sk-1234567890abcdef';
```

## 性能优化

### 缓存策略

```typescript
// ✅ 正确: 实现缓存
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

async function getCachedData(key: string): Promise<any> {
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchData(key);
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### 异步处理

```typescript
// ✅ 正确: 并行处理
const [user, posts, comments] = await Promise.all([
  fetchUser(userId),
  fetchPosts(userId),
  fetchComments(userId)
]);

// ❌ 错误: 串行处理
const user = await fetchUser(userId);
const posts = await fetchPosts(userId);
const comments = await fetchComments(userId);
```

### 流式处理

```typescript
// ✅ 正确: 使用流式响应
async function* streamResponse(data: AsyncIterable<string>) {
  for await (const chunk of data) {
    yield `data: ${JSON.stringify(chunk)}\n\n`;
  }
}

// ❌ 错误: 等待所有数据
async function getResponse(data: AsyncIterable<string>) {
  const chunks: string[] = [];
  for await (const chunk of data) {
    chunks.push(chunk);
  }
  return chunks.join('');
}
```

## 安全规范

### 输入验证

```typescript
// ✅ 正确: 验证所有输入
function validateChatRequest(body: any): ChatRequest {
  if (!body.model || typeof body.model !== 'string') {
    throw new Error('Invalid model');
  }
  
  if (!Array.isArray(body.messages)) {
    throw new Error('Invalid messages');
  }
  
  // 验证每条消息
  for (const msg of body.messages) {
    if (!msg.role || !msg.content) {
      throw new Error('Invalid message format');
    }
  }
  
  return body as ChatRequest;
}

// ❌ 错误: 直接使用未验证的输入
function handleRequest(body: any) {
  const model = body.model;
  const messages = body.messages;
  // 直接使用可能不安全
}
```

### 认证和授权

```typescript
// ✅ 正确: 实现认证中间件
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: 'Missing or invalid authorization header'
    });
  }
  
  const token = authHeader.substring(7);
  const isValid = await validateToken(token);
  
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid token'
    });
  }
  
  // 继续处理请求
});
```

### SQL 注入防护

```typescript
// ✅ 正确: 使用参数化查询（如果使用数据库）
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
// ✅ 正确: 转义用户输入
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// 使用时
const safeContent = escapeHtml(userInput);
```

## 代码审查清单

在提交代码前，请确保：

- [ ] 遵循项目隔离原则
- [ ] 使用正确的命名规范
- [ ] 添加完整的类型注解
- [ ] 实现错误处理
- [ ] 添加适当的日志
- [ ] 验证所有输入
- [ ] 处理边界情况
- [ ] 编写单元测试
- [ ] 更新相关文档
- [ ] 移除调试代码和注释
- [ ] 检查性能影响
- [ ] 确保安全性

## 参考资源

- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Nuxt 3 最佳实践](https://nuxt.com/docs/guide/going-further/best-practices)
- [代码风格指南](CODE_STYLE.md)
- [API 开发指南](API_DEVELOPMENT.md)

---

最后更新: 2026-01-31
