# API 开发指南

本文档提供了在 Web Proxy API 项目中开发 API 端点的完整指南。

## 目录

- [API 架构](#api-架构)
- [创建 API 端点](#创建-api-端点)
- [请求处理](#请求处理)
- [响应格式](#响应格式)
- [错误处理](#错误处理)
- [认证和授权](#认证和授权)
- [流式响应](#流式响应)
- [API 版本控制](#api-版本控制)
- [测试 API](#测试-api)

## API 架构

### 目录结构

```
server/api/
├── v0/                          # 内部管理 API
│   └── management/             # 管理面板 API
│       ├── check.get.ts        # 检查登录状态
│       ├── login.post.ts       # 管理员登录
│       ├── logout.post.ts      # 管理员登出
│       ├── projects/
│       │   └── list.get.ts     # 获取项目列表
│       └── tokens/
│           ├── add.post.ts     # 添加令牌
│           ├── delete.post.ts  # 删除令牌
│           ├── get.get.ts      # 获取令牌详情
│           └── list.get.ts     # 获取令牌列表
└── v1/                          # 公开 API (OpenAI 兼容)
    ├── models.get.ts           # 获取模型列表
    └── chat/
        └── completions.post.ts # 聊天完成
```

### API 版本说明

- **v0**: 内部管理 API，用于管理面板
- **v1**: 公开 API，兼容 OpenAI API 格式

## 创建 API 端点

### 基本结构

```typescript
// server/api/v1/example.get.ts
export default defineEventHandler(async (event) => {
  try {
    // 1. 获取请求参数
    const query = getQuery(event);
    
    // 2. 验证输入
    if (!query.id) {
      throw createError({
        statusCode: 400,
        message: 'Missing required parameter: id'
      });
    }
    
    // 3. 处理业务逻辑
    const result = await processRequest(query.id as string);
    
    // 4. 返回响应
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    // 5. 错误处理
    console.error('[API Error]', error);
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
});
```

### GET 请求示例

```typescript
// server/api/v1/users/[id].get.ts
export default defineEventHandler(async (event) => {
  // 获取路由参数
  const id = getRouterParam(event, 'id');
  
  // 获取查询参数
  const query = getQuery(event);
  const includeDetails = query.details === 'true';
  
  // 获取请求头
  const authHeader = getHeader(event, 'authorization');
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    });
  }
  
  const user = await getUserById(id, includeDetails);
  
  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    });
  }
  
  return {
    success: true,
    data: user
  };
});
```

### POST 请求示例

```typescript
// server/api/v1/users.post.ts
interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

export default defineEventHandler(async (event) => {
  // 读取请求体
  const body = await readBody<CreateUserRequest>(event);
  
  // 验证必需字段
  if (!body.name || !body.email || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields'
    });
  }
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid email format'
    });
  }
  
  // 创建用户
  const user = await createUser(body);
  
  // 设置响应状态码
  setResponseStatus(event, 201);
  
  return {
    success: true,
    data: user
  };
});
```

### PUT/PATCH 请求示例

```typescript
// server/api/v1/users/[id].patch.ts
interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody<UpdateUserRequest>(event);
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    });
  }
  
  // 至少需要一个字段
  if (!body.name && !body.email) {
    throw createError({
      statusCode: 400,
      message: 'At least one field is required'
    });
  }
  
  const updatedUser = await updateUser(id, body);
  
  return {
    success: true,
    data: updatedUser
  };
});
```

### DELETE 请求示例

```typescript
// server/api/v1/users/[id].delete.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    });
  }
  
  await deleteUser(id);
  
  // 返回 204 No Content
  setResponseStatus(event, 204);
  return null;
});
```

## 请求处理

### 获取请求数据

```typescript
export default defineEventHandler(async (event) => {
  // 1. 路由参数
  const id = getRouterParam(event, 'id');
  
  // 2. 查询参数
  const query = getQuery(event);
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  
  // 3. 请求体
  const body = await readBody(event);
  
  // 4. 请求头
  const contentType = getHeader(event, 'content-type');
  const authHeader = getHeader(event, 'authorization');
  
  // 5. Cookies
  const sessionId = getCookie(event, 'session_id');
  
  // 6. 请求方法
  const method = getMethod(event);
  
  // 7. 请求 URL
  const url = getRequestURL(event);
  
  return { id, query, body, contentType, authHeader, sessionId, method, url };
});
```

### 输入验证

```typescript
// 使用 Zod 进行验证（推荐）
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().int().positive().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  // 验证输入
  const result = CreateUserSchema.safeParse(body);
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Validation failed',
      data: result.error.errors
    });
  }
  
  // 使用验证后的数据
  const validatedData = result.data;
  const user = await createUser(validatedData);
  
  return { success: true, data: user };
});
```

### 手动验证

```typescript
function validateChatRequest(body: any): ChatRequest {
  // 验证 model
  if (!body.model || typeof body.model !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Invalid or missing model'
    });
  }
  
  // 验证 messages
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Messages must be a non-empty array'
    });
  }
  
  // 验证每条消息
  for (const msg of body.messages) {
    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid message role'
      });
    }
    
    if (!msg.content || typeof msg.content !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Invalid message content'
      });
    }
  }
  
  return body as ChatRequest;
}
```

## 响应格式

### 标准响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// 使用示例
export default defineEventHandler(async (event) => {
  try {
    const users = await getUsers();
    
    return {
      success: true,
      data: users,
      meta: {
        page: 1,
        limit: 10,
        total: users.length
      }
    } satisfies SuccessResponse<User[]>;
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch users',
        details: error
      }
    } satisfies ErrorResponse;
  }
});
```

### 设置响应头

```typescript
export default defineEventHandler(async (event) => {
  // 设置单个响应头
  setHeader(event, 'X-Custom-Header', 'value');
  
  // 设置多个响应头
  setHeaders(event, {
    'X-Request-ID': generateRequestId(),
    'X-Response-Time': Date.now().toString(),
    'Cache-Control': 'no-cache'
  });
  
  // 设置 Cookie
  setCookie(event, 'session_id', 'xxx', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
  
  return { success: true };
});
```

### 设置状态码

```typescript
export default defineEventHandler(async (event) => {
  // 创建资源 - 201
  setResponseStatus(event, 201);
  
  // 无内容 - 204
  setResponseStatus(event, 204);
  
  // 重定向 - 302
  setResponseStatus(event, 302);
  setHeader(event, 'Location', '/new-url');
  
  return { success: true };
});
```

## 错误处理

### 使用 createError

```typescript
export default defineEventHandler(async (event) => {
  // 400 Bad Request
  throw createError({
    statusCode: 400,
    message: 'Invalid request parameters'
  });
  
  // 401 Unauthorized
  throw createError({
    statusCode: 401,
    message: 'Authentication required'
  });
  
  // 403 Forbidden
  throw createError({
    statusCode: 403,
    message: 'Access denied'
  });
  
  // 404 Not Found
  throw createError({
    statusCode: 404,
    message: 'Resource not found'
  });
  
  // 500 Internal Server Error
  throw createError({
    statusCode: 500,
    message: 'Internal server error',
    data: { details: 'Additional error information' }
  });
});
```

### 自定义错误类

```typescript
// server/utils/errors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

// 使用
export default defineEventHandler(async (event) => {
  try {
    // 业务逻辑
  } catch (error) {
    if (error instanceof ApiError) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message,
        data: { code: error.code, details: error.details }
      });
    }
    throw error;
  }
});
```

## 认证和授权

### API Key 认证

```typescript
// server/utils/auth.ts
export async function validateApiKey(event: H3Event): Promise<boolean> {
  const authHeader = getHeader(event, 'authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: 'Missing or invalid authorization header'
    });
  }
  
  const apiKey = authHeader.substring(7);
  const config = getConfig();
  
  // 检查是否是配置的 API Key
  if (config.keys.includes(apiKey)) {
    return true;
  }
  
  // 检查是否是项目 token
  const isValidToken = await validateProjectToken(apiKey);
  if (isValidToken) {
    return true;
  }
  
  throw createError({
    statusCode: 401,
    message: 'Invalid API key'
  });
}

// 使用
export default defineEventHandler(async (event) => {
  await validateApiKey(event);
  
  // 继续处理请求
  return { success: true };
});
```

### Session 认证

```typescript
// server/utils/session.ts
export async function validateSession(event: H3Event): Promise<string> {
  const sessionId = getCookie(event, 'session_id');
  
  if (!sessionId) {
    throw createError({
      statusCode: 401,
      message: 'No session found'
    });
  }
  
  const session = await getSession(sessionId);
  
  if (!session || session.expiresAt < Date.now()) {
    throw createError({
      statusCode: 401,
      message: 'Session expired'
    });
  }
  
  return session.userId;
}

// 使用
export default defineEventHandler(async (event) => {
  const userId = await validateSession(event);
  
  // 使用 userId 处理请求
  return { success: true, userId };
});
```

### 权限检查

```typescript
// server/utils/permissions.ts
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
  await requirePermission(event, 'users:delete');
  
  // 继续处理删除操作
  return { success: true };
});
```

## 流式响应

### Server-Sent Events (SSE)

```typescript
// server/api/v1/chat/completions.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (body.stream) {
    // 设置 SSE 响应头
    setHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // 创建流
    const stream = createEventStream(event);
    
    try {
      // 获取上游响应流
      const upstreamResponse = await fetchUpstream(body);
      
      // 转发流数据
      for await (const chunk of upstreamResponse) {
        await stream.push(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      
      // 发送结束标记
      await stream.push('data: [DONE]\n\n');
      
    } catch (error) {
      console.error('[Stream Error]', error);
      await stream.push(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
    } finally {
      await stream.close();
    }
    
    return stream.send();
  }
  
  // 非流式响应
  const response = await fetchUpstream(body);
  return response;
});
```

### 自定义流处理

```typescript
export default defineEventHandler(async (event) => {
  setHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  });
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 发送初始消息
        controller.enqueue(encoder.encode('data: {"status":"started"}\n\n'));
        
        // 处理数据
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const data = { progress: (i + 1) * 10 };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
        
        // 发送完成消息
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        
      } catch (error) {
        controller.error(error);
      }
    }
  });
  
  return stream;
});
```

## API 版本控制

### URL 版本控制

```
✅ 推荐方式:
/v1/users
/v1/chat/completions
/v2/users
/v2/chat/completions
```

### 版本迁移

```typescript
// server/api/v2/users.get.ts
export default defineEventHandler(async (event) => {
  // v2 实现
  const users = await getUsersV2();
  
  return {
    version: 'v2',
    data: users
  };
});

// server/api/v1/users.get.ts
export default defineEventHandler(async (event) => {
  // v1 实现（保持向后兼容）
  const users = await getUsersV1();
  
  // 添加弃用警告
  setHeader(event, 'X-API-Deprecated', 'true');
  setHeader(event, 'X-API-Sunset', '2026-12-31');
  
  return {
    version: 'v1',
    data: users
  };
});
```

## 测试 API

### 使用 curl

```bash
# GET 请求
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer your-api-key"

# POST 请求
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# 流式请求
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }' \
  --no-buffer
```

### 使用 Postman/Insomnia

1. 创建新请求
2. 设置 URL: `http://localhost:3000/v1/chat/completions`
3. 设置方法: POST
4. 添加 Header: `Authorization: Bearer your-api-key`
5. 设置 Body (JSON):
```json
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

### 单元测试

```typescript
// tests/api/users.test.ts
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';

describe('Users API', async () => {
  await setup();
  
  it('should get user list', async () => {
    const response = await $fetch('/v1/users', {
      headers: {
        'Authorization': 'Bearer test-key'
      }
    });
    
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
  });
  
  it('should return 401 without auth', async () => {
    await expect($fetch('/v1/users')).rejects.toThrow();
  });
});
```

## 最佳实践

### 1. 使用 TypeScript 类型

```typescript
interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequest>(event);
  // TypeScript 会提供类型检查和自动完成
});
```

### 2. 统一错误处理

```typescript
// server/middleware/error-handler.ts
export default defineEventHandler(async (event) => {
  try {
    // 处理请求
  } catch (error) {
    console.error('[API Error]', error);
    
    if (error instanceof ApiError) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message
      });
    }
    
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
});
```

### 3. 请求日志

```typescript
export default defineEventHandler(async (event) => {
  const startTime = Date.now();
  const method = getMethod(event);
  const url = getRequestURL(event);
  
  console.log(`[${method}] ${url.pathname}`);
  
  try {
    const result = await handleRequest(event);
    const duration = Date.now() - startTime;
    console.log(`[${method}] ${url.pathname} - ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${method}] ${url.pathname} - ${duration}ms - Error:`, error);
    throw error;
  }
});
```

### 4. 速率限制

```typescript
// server/utils/rate-limit.ts
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): void {
  const now = Date.now();
  const record = requestCounts.get(identifier);
  
  if (!record || record.resetAt < now) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return;
  }
  
  if (record.count >= limit) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests'
    });
  }
  
  record.count++;
}

// 使用
export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, 'authorization')?.substring(7);
  checkRateLimit(apiKey || 'anonymous', 100, 60000);
  
  // 继续处理请求
});
```

## 参考资源

- [Nuxt Server Routes](https://nuxt.com/docs/guide/directory-structure/server)
- [H3 Documentation](https://h3.unjs.io/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

---

最后更新: 2026-01-31
