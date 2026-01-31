# 添加新项目指南

本指南将帮助你在 Web Proxy API 中集成新的 AI 服务提供商。

## 目录

- [概述](#概述)
- [项目结构](#项目结构)
- [实现步骤](#实现步骤)
- [接口规范](#接口规范)
- [账号管理](#账号管理)
- [测试项目](#测试项目)
- [最佳实践](#最佳实践)
- [示例项目](#示例项目)

## 概述

### 项目隔离原则

每个 AI 服务提供商作为独立项目，遵循以下原则：

- ✅ **独立目录**: 所有项目代码在 `server/projects/[project-name]/` 下
- ✅ **独立工具**: 项目特定工具在 `utils/` 子目录下
- ✅ **独立账号**: 账号文件在 `accounts/[project-name]/` 下
- ✅ **插件注册**: 通过插件系统注册到全局
- ✅ **标准接口**: 实现统一的处理器接口

### 支持的功能

- 聊天完成 (Chat Completions)
- 流式响应 (Streaming)
- 模型列表 (Models)
- 账号管理 (Account Management)
- 代理支持 (Proxy Support)

## 项目结构

### 基本结构

```
server/projects/your-project/
├── handler.ts              # 必需: 项目处理器
├── types.ts               # 可选: 类型定义
└── utils/                 # 可选: 项目工具函数
    ├── accounts.ts        # 账号管理
    ├── api.ts            # API 调用
    └── [other-utils].ts  # 其他工具
```

### 完整示例

```
server/projects/deepseek/
├── handler.ts
└── utils/
    ├── accounts.ts        # 账号加载和管理
    ├── api.ts            # DeepSeek API 调用
    └── wasm.ts           # PoW 计算（项目特定）
```

## 实现步骤

### 步骤 1: 创建项目目录

```bash
mkdir -p server/projects/your-project/utils
mkdir -p accounts/your-project
```

### 步骤 2: 定义类型

```typescript
// server/projects/your-project/types.ts
export interface YourProjectAccount {
  email?: string;
  mobile?: string;
  password: string;
  token: string;
  proxy_url?: string;
  lastUsed?: number;
}

export interface YourProjectConfig {
  enabled: boolean;
  apiUrl?: string;
  timeout?: number;
}

export interface YourProjectChatRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}
```

### 步骤 3: 实现账号管理

```typescript
// server/projects/your-project/utils/accounts.ts
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { YourProjectAccount } from '../types';

const ACCOUNTS_DIR = 'accounts/your-project';
let accounts: YourProjectAccount[] = [];

/**
 * 加载所有账号
 */
export async function loadAccounts(): Promise<void> {
  try {
    const files = await readdir(ACCOUNTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    accounts = [];
    
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(ACCOUNTS_DIR, file), 'utf-8');
        const account = JSON.parse(content) as YourProjectAccount;
        accounts.push(account);
      } catch (error) {
        console.error(`[YourProject] Failed to load account ${file}:`, error);
      }
    }
    
    console.log(`[YourProject] Loaded ${accounts.length} accounts`);
  } catch (error) {
    console.error('[YourProject] Failed to load accounts:', error);
    accounts = [];
  }
}

/**
 * 获取可用账号（轮换策略）
 */
export function getAvailableAccount(): YourProjectAccount | null {
  if (accounts.length === 0) {
    return null;
  }
  
  // 简单轮换：选择最久未使用的账号
  accounts.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
  const account = accounts[0];
  account.lastUsed = Date.now();
  
  return account;
}

/**
 * 根据 token 获取账号
 */
export function getAccountByToken(token: string): YourProjectAccount | null {
  return accounts.find(acc => acc.token === token) || null;
}

/**
 * 获取所有账号
 */
export function getAllAccounts(): YourProjectAccount[] {
  return accounts;
}
```

### 步骤 4: 实现 API 调用

```typescript
// server/projects/your-project/utils/api.ts
import type { YourProjectAccount, YourProjectChatRequest } from '../types';
import { createProxyFetch } from '../../../utils/proxy-fetch';

const API_BASE_URL = 'https://api.your-service.com';

/**
 * 调用聊天 API
 */
export async function callChatApi(
  request: YourProjectChatRequest,
  account: YourProjectAccount
): Promise<Response> {
  const fetch = createProxyFetch(account.proxy_url);
  
  const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${account.token}`,
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

/**
 * 登录获取 token
 */
export async function login(
  email: string,
  password: string,
  proxyUrl?: string
): Promise<string> {
  const fetch = createProxyFetch(proxyUrl);
  
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  return data.token;
}
```

### 步骤 5: 实现处理器

```typescript
// server/projects/your-project/handler.ts
import type { H3Event } from 'h3';
import { getAvailableAccount, getAccountByToken } from './utils/accounts';
import { callChatApi } from './utils/api';
import type { YourProjectChatRequest } from './types';

/**
 * 处理聊天请求
 */
export async function handleChatRequest(
  event: H3Event,
  request: any,
  userToken?: string
): Promise<Response> {
  // 1. 确定使用的账号
  let account;
  
  if (userToken) {
    // 用户提供了自己的 token
    account = getAccountByToken(userToken);
    if (!account) {
      // 创建临时账号对象
      account = {
        token: userToken,
        password: '',
      };
    }
  } else {
    // 使用托管账号
    account = getAvailableAccount();
    if (!account) {
      throw createError({
        statusCode: 503,
        message: 'No available accounts',
      });
    }
  }
  
  // 2. 转换请求格式
  const apiRequest: YourProjectChatRequest = {
    model: request.model,
    messages: request.messages,
    stream: request.stream,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
  };
  
  // 3. 调用上游 API
  try {
    const response = await callChatApi(apiRequest, account);
    return response;
  } catch (error) {
    console.error('[YourProject] API call failed:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to process request',
    });
  }
}

/**
 * 获取支持的模型列表
 */
export function getSupportedModels(): string[] {
  return [
    'your-model-1',
    'your-model-2',
    'your-model-3',
  ];
}

/**
 * 检查模型是否支持
 */
export function isModelSupported(model: string): boolean {
  return getSupportedModels().includes(model);
}
```

### 步骤 6: 创建注册插件

```typescript
// server/plugins/register-your-project.ts
import { registerProject } from '../utils/project-registry';
import { loadAccounts } from '../projects/your-project/utils/accounts';
import { 
  handleChatRequest, 
  getSupportedModels 
} from '../projects/your-project/handler';

export default defineNitroPlugin(async () => {
  const config = getConfig();
  
  // 检查项目是否启用
  if (!config.projects?.['your-project']?.enabled) {
    console.log('[YourProject] Project is disabled');
    return;
  }
  
  console.log('[YourProject] Initializing...');
  
  // 加载账号
  await loadAccounts();
  
  // 注册项目
  registerProject({
    name: 'your-project',
    models: getSupportedModels(),
    handler: handleChatRequest,
  });
  
  console.log('[YourProject] Registered successfully');
});
```

### 步骤 7: 更新配置文件

```yaml
# config.yaml
projects:
  your-project:
    enabled: true
    # 项目特定配置
    api_url: https://api.your-service.com
    timeout: 30000
```

### 步骤 8: 创建账号文件

```json
// accounts/your-project/account1.json
{
  "email": "user@example.com",
  "password": "your-password",
  "token": "",
  "proxy_url": "socks5://127.0.0.1:1080"
}
```

## 接口规范

### ProjectHandler 接口

```typescript
// server/utils/project-registry.ts
export interface ProjectHandler {
  (event: H3Event, request: any, userToken?: string): Promise<Response>;
}

export interface ProjectRegistration {
  name: string;
  models: string[];
  handler: ProjectHandler;
}
```

### 处理器要求

1. **接受标准参数**:
   - `event`: H3Event 对象
   - `request`: 聊天请求对象
   - `userToken`: 可选的用户 token

2. **返回 Response 对象**:
   - 流式: 返回 SSE 流
   - 非流式: 返回 JSON 响应

3. **错误处理**:
   - 使用 `createError` 抛出错误
   - 提供清晰的错误消息

### 请求格式

```typescript
interface ChatRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  // 其他参数...
}
```

### 响应格式

#### 非流式响应

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "your-model",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Response text"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

#### 流式响应

```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

## 账号管理

### 账号文件格式

```json
{
  "email": "user@example.com",
  "password": "password",
  "token": "your-token-here",
  "proxy_url": "socks5://127.0.0.1:1080",
  "lastUsed": 1234567890
}
```

### 账号轮换策略

```typescript
// 简单轮换
export function getAvailableAccount(): Account | null {
  if (accounts.length === 0) return null;
  
  // 按最后使用时间排序
  accounts.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
  const account = accounts[0];
  account.lastUsed = Date.now();
  
  return account;
}

// 带冷却时间的轮换
export function getAvailableAccount(cooldownMs = 60000): Account | null {
  const now = Date.now();
  
  // 找到不在冷却期的账号
  const available = accounts.filter(acc => 
    !acc.lastUsed || (now - acc.lastUsed) > cooldownMs
  );
  
  if (available.length === 0) {
    // 所有账号都在冷却期，返回最早可用的
    accounts.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    return accounts[0];
  }
  
  // 随机选择一个可用账号
  const account = available[Math.floor(Math.random() * available.length)];
  account.lastUsed = now;
  
  return account;
}
```

### 自动登录

```typescript
export async function ensureLoggedIn(account: Account): Promise<void> {
  // 检查 token 是否有效
  if (account.token) {
    const isValid = await validateToken(account.token);
    if (isValid) {
      return;
    }
  }
  
  // Token 无效或不存在，重新登录
  console.log('[YourProject] Logging in...');
  
  const identifier = account.email || account.mobile;
  if (!identifier) {
    throw new Error('No email or mobile provided');
  }
  
  const token = await login(identifier, account.password, account.proxy_url);
  account.token = token;
  
  // 保存 token 到文件
  await saveAccount(account);
}
```

## 测试项目

### 1. 启动服务

```bash
bun run dev
```

### 2. 检查模型列表

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer your-api-key"
```

应该能看到你的模型：

```json
{
  "object": "list",
  "data": [
    {
      "id": "your-model-1",
      "object": "model",
      "owned_by": "your-project"
    }
  ]
}
```

### 3. 测试聊天

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "your-model-1",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

### 4. 测试流式响应

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "your-model-1",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "stream": true
  }' \
  --no-buffer
```

## 最佳实践

### 1. 错误处理

```typescript
export async function handleChatRequest(
  event: H3Event,
  request: any,
  userToken?: string
): Promise<Response> {
  try {
    // 处理请求
    const response = await callApi(request);
    return response;
    
  } catch (error) {
    console.error('[YourProject] Error:', error);
    
    // 区分不同类型的错误
    if (error.message.includes('authentication')) {
      throw createError({
        statusCode: 401,
        message: 'Authentication failed'
      });
    }
    
    if (error.message.includes('rate limit')) {
      throw createError({
        statusCode: 429,
        message: 'Rate limit exceeded'
      });
    }
    
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
}
```

### 2. 日志记录

```typescript
// 使用统一的日志前缀
console.log('[YourProject] Initializing...');
console.error('[YourProject] Error:', error);
console.warn('[YourProject] Warning:', warning);

// 记录重要操作
console.log('[YourProject] Account selected:', account.email);
console.log('[YourProject] API call:', { model, messageCount });
```

### 3. 配置管理

```typescript
// 从配置文件读取项目配置
const config = getConfig();
const projectConfig = config.projects?.['your-project'];

const apiUrl = projectConfig?.api_url || 'https://api.default.com';
const timeout = projectConfig?.timeout || 30000;
```

### 4. 代理支持

```typescript
import { createProxyFetch } from '../../../utils/proxy-fetch';

// 使用代理
const fetch = createProxyFetch(account.proxy_url);
const response = await fetch(url, options);
```

### 5. 重试机制

```typescript
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
      console.warn(`[YourProject] Retry ${i + 1}/${maxRetries}:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError!;
}
```

## 示例项目

### 参考 DeepSeek 实现

查看 `server/projects/deepseek/` 目录获取完整示例：

- `handler.ts`: 主处理器实现
- `utils/accounts.ts`: 账号管理
- `utils/api.ts`: API 调用
- `utils/wasm.ts`: 项目特定功能（PoW 计算）

### 简化示例

```typescript
// server/projects/simple-ai/handler.ts
import { getAvailableAccount } from './utils/accounts';

export async function handleChatRequest(
  event: H3Event,
  request: any,
  userToken?: string
): Promise<Response> {
  const account = userToken 
    ? { token: userToken } 
    : getAvailableAccount();
  
  if (!account) {
    throw createError({
      statusCode: 503,
      message: 'No available accounts'
    });
  }
  
  const response = await fetch('https://api.simple-ai.com/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${account.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  return response;
}

export function getSupportedModels(): string[] {
  return ['simple-ai-model'];
}
```

## 故障排查

### 项目未加载

1. 检查配置文件中项目是否启用
2. 确认插件文件存在且命名正确
3. 查看启动日志确认注册成功

### 模型不可用

1. 检查 `getSupportedModels()` 返回的模型列表
2. 确认项目已成功注册
3. 访问 `/v1/models` 查看可用模型

### 账号问题

1. 确认账号文件格式正确
2. 检查账号目录路径
3. 查看日志确认账号加载成功

## 相关文档

- [开发规范](DEVELOPMENT_STANDARDS.md)
- [API 开发指南](API_DEVELOPMENT.md)
- [架构设计](ARCHITECTURE.md)
- [代理配置](PROXY.md)

---

最后更新: 2026-01-31
