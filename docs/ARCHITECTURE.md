# 架构设计文档

本文档详细描述了 Web Proxy API 的系统架构、设计理念和技术决策。

## 目录

- [系统概述](#系统概述)
- [架构原则](#架构原则)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [数据流](#数据流)
- [模块设计](#模块设计)
- [扩展性设计](#扩展性设计)
- [性能优化](#性能优化)

## 系统概述

Web Proxy API 是一个多项目 AI 代理服务，旨在：

1. **统一接口**: 提供 OpenAI 兼容的 API 接口
2. **多项目支持**: 集成多个 AI 服务提供商（DeepSeek、OpenAI、Anthropic 等）
3. **账号管理**: 自动管理和轮换多个账号
4. **代理支持**: 为每个账号配置独立的代理服务器
5. **Web 管理**: 提供现代化的 Web 管理界面

### 核心特性

- ✅ 项目隔离架构
- ✅ 自动账号轮换
- ✅ 流式响应支持
- ✅ 代理服务器支持
- ✅ Token 计数
- ✅ Web 管理面板

## 架构原则

### 1. 项目隔离原则

**理念**: 每个 AI 服务提供商作为独立项目，互不干扰。

```
✅ 优点:
- 代码组织清晰
- 易于维护和扩展
- 降低耦合度
- 便于团队协作

❌ 避免:
- 项目代码混在通用目录
- 项目间直接依赖
- 共享可变状态
```

### 2. 插件化架构

**理念**: 通过插件系统动态注册项目。

```typescript
// 项目通过插件注册
export default defineNitroPlugin(async () => {
  registerProject({
    name: 'deepseek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    handler: handleChatRequest,
  });
});
```

### 3. 依赖倒置

**理念**: 高层模块依赖抽象，不依赖具体实现。

```typescript
// 抽象接口
interface ProjectHandler {
  (event: H3Event, request: any, userToken?: string): Promise<Response>;
}

// 通用 API 依赖接口
const handler = getProjectHandler(model);
const response = await handler(event, request, token);
```

### 4. 单一职责

**理念**: 每个模块只负责一件事。

```
server/utils/
├── config.ts              # 只负责配置管理
├── auth.ts                # 只负责认证
├── tokenizer.ts           # 只负责 token 计数
└── project-registry.ts    # 只负责项目注册
```

## 技术栈

### 核心框架

- **Nuxt 3**: 全栈框架
  - 服务器端: Nitro (基于 h3)
  - 客户端: Vue 3 + Composition API
  - 路由: 文件系统路由

- **Bun**: JavaScript 运行时
  - 快速启动
  - 原生 TypeScript 支持
  - 高性能

### UI 框架

- **NuxtUI**: 组件库
- **TailwindCSS**: 样式框架
- **Heroicons/Lucide**: 图标库

### 开发工具

- **TypeScript**: 类型安全
- **ESLint**: 代码检查
- **Prettier**: 代码格式化

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Web 管理面板 │  │  API 客户端   │  │  第三方应用   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nuxt 3 应用层                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    前端 (app/)                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │  Pages   │  │Components│  │Composables│          │  │
│  │  └──────────┘  └──────────┘  └──────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  API 层 (server/api/)                 │  │
│  │  ┌──────────┐  ┌──────────────────────────────┐     │  │
│  │  │  v0/     │  │         v1/                   │     │  │
│  │  │ 管理 API  │  │  OpenAI 兼容 API              │     │  │
│  │  └──────────┘  └──────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                业务逻辑层 (server/)                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │ Plugins  │  │  Utils   │  │ Projects │          │  │
│  │  └──────────┘  └──────────┘  └──────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      项目注册表                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ DeepSeek │  │  OpenAI  │  │ Anthropic│  ...            │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    上游 AI 服务                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │DeepSeek  │  │ OpenAI   │  │ Claude   │  ...            │
│  │   API    │  │   API    │  │   API    │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
web-proxy-api/
├── accounts/                    # 账号文件存储
│   ├── deepseek/               # 按项目分类
│   ├── openai/
│   └── anthropic/
│
├── app/                         # Nuxt 应用（前端）
│   ├── components/             # Vue 组件
│   │   └── admin/              # 管理面板组件
│   ├── composables/            # 组合式函数
│   ├── middleware/             # 路由中间件
│   ├── pages/                  # 页面路由
│   └── app.vue                 # 根组件
│
├── docs/                        # 项目文档
│   ├── README.md               # 文档索引
│   ├── ARCHITECTURE.md         # 架构设计
│   ├── DEVELOPMENT_STANDARDS.md # 开发规范
│   └── ...
│
├── public/                      # 静态资源
│   ├── favicon.ico
│   └── robots.txt
│
├── server/                      # 服务器端代码
│   ├── api/                    # API 路由
│   │   ├── v0/                 # 管理 API
│   │   │   └── management/
│   │   └── v1/                 # 公开 API
│   │       ├── models.get.ts
│   │       └── chat/
│   │
│   ├── assets/                 # 服务器资源
│   │   ├── tokenizer.json
│   │   └── deepseek_wasm/
│   │
│   ├── plugins/                # Nitro 插件
│   │   ├── config.ts           # 配置加载
│   │   ├── tokenizer.ts        # Tokenizer 初始化
│   │   └── register-*.ts       # 项目注册
│   │
│   ├── projects/               # 项目实现
│   │   └── [project-name]/     # 每个项目独立目录
│   │       ├── handler.ts      # 项目处理器
│   │       └── utils/          # 项目工具
│   │
│   └── utils/                  # 通用工具
│       ├── config.ts           # 配置管理
│       ├── auth.ts             # 认证工具
│       ├── tokenizer.ts        # Token 计数
│       ├── project-registry.ts # 项目注册表
│       └── proxy-fetch.ts      # 代理请求
│
├── config.yaml                 # 主配置文件
├── nuxt.config.ts             # Nuxt 配置
├── package.json               # 依赖管理
└── tsconfig.json              # TypeScript 配置
```

## 数据流

### 请求处理流程

```
1. 客户端请求
   │
   ▼
2. API 端点 (server/api/v1/chat/completions.post.ts)
   │
   ├─→ 验证 API Key
   │
   ├─→ 解析请求体
   │
   ▼
3. 项目路由 (project-registry.ts)
   │
   ├─→ 根据 model 查找项目
   │
   ├─→ 获取项目处理器
   │
   ▼
4. 项目处理器 (projects/[name]/handler.ts)
   │
   ├─→ 选择账号（轮换策略）
   │
   ├─→ 准备请求参数
   │
   ▼
5. API 调用 (projects/[name]/utils/api.ts)
   │
   ├─→ 创建代理 fetch
   │
   ├─→ 调用上游 API
   │
   ▼
6. 响应处理
   │
   ├─→ 流式: 转发 SSE 流
   │
   ├─→ 非流式: 返回 JSON
   │
   ├─→ 计算 token 使用量
   │
   ▼
7. 返回客户端
```

### 账号管理流程

```
1. 服务器启动
   │
   ▼
2. 加载配置 (plugins/config.ts)
   │
   ▼
3. 初始化项目 (plugins/register-*.ts)
   │
   ├─→ 加载账号文件
   │
   ├─→ 注册项目和模型
   │
   ▼
4. 请求到达
   │
   ▼
5. 选择账号
   │
   ├─→ 用户提供 token? → 使用用户 token
   │
   ├─→ 否则 → 从账号池选择
   │   │
   │   ├─→ 按最后使用时间排序
   │   │
   │   ├─→ 选择最久未使用的
   │   │
   │   └─→ 更新使用时间
   │
   ▼
6. 使用账号发起请求
```

### 流式响应流程

```
1. 客户端请求 (stream: true)
   │
   ▼
2. 设置 SSE 响应头
   │
   ├─→ Content-Type: text/event-stream
   ├─→ Cache-Control: no-cache
   └─→ Connection: keep-alive
   │
   ▼
3. 创建事件流
   │
   ▼
4. 调用上游 API
   │
   ▼
5. 读取上游流
   │
   ├─→ 解析 SSE 数据
   │
   ├─→ 累积完整内容
   │
   ├─→ 转发给客户端
   │
   └─→ 循环直到结束
   │
   ▼
6. 计算 token 使用量
   │
   ▼
7. 发送最终块（包含 usage）
   │
   ▼
8. 发送 [DONE] 标记
   │
   ▼
9. 关闭流
```

## 模块设计

### 1. 配置管理 (server/utils/config.ts)

```typescript
// 职责: 加载和管理配置
interface Config {
  app: {
    name: string;
    port: number;
  };
  admin: {
    username: string;
    password: string;
  };
  keys: string[];
  projects: Record<string, any>;
}

// 单例模式
let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = loadConfigFromFile();
  }
  return config;
}
```

### 2. 项目注册表 (server/utils/project-registry.ts)

```typescript
// 职责: 管理项目和模型映射
interface ProjectRegistration {
  name: string;
  models: string[];
  handler: ProjectHandler;
}

const projects = new Map<string, ProjectRegistration>();
const modelToProject = new Map<string, string>();

export function registerProject(registration: ProjectRegistration) {
  projects.set(registration.name, registration);
  
  for (const model of registration.models) {
    modelToProject.set(model, registration.name);
  }
}

export function getProjectHandler(model: string): ProjectHandler | null {
  const projectName = modelToProject.get(model);
  if (!projectName) return null;
  
  const project = projects.get(projectName);
  return project?.handler || null;
}
```

### 3. 认证系统 (server/utils/auth.ts)

```typescript
// 职责: API Key 和 Session 认证
export async function validateApiKey(event: H3Event): Promise<boolean> {
  const authHeader = getHeader(event, 'authorization');
  const apiKey = authHeader?.substring(7);
  
  // 检查配置的 API Key
  if (config.keys.includes(apiKey)) {
    return true;
  }
  
  // 检查项目 token
  return await validateProjectToken(apiKey);
}

export async function validateSession(event: H3Event): Promise<string> {
  const sessionId = getCookie(event, 'session_id');
  // 验证 session
  return userId;
}
```

### 4. 代理请求 (server/utils/proxy-fetch.ts)

```typescript
// 职责: 创建支持代理的 fetch 函数
export function createProxyFetch(proxyUrl?: string): typeof fetch {
  if (!proxyUrl) {
    return fetch;
  }
  
  const agent = createProxyAgent(proxyUrl);
  
  return (url: RequestInfo, init?: RequestInit) => {
    return fetch(url, {
      ...init,
      // @ts-ignore
      dispatcher: agent,
    });
  };
}
```

### 5. Token 计数 (server/utils/tokenizer.ts)

```typescript
// 职责: 计算 token 使用量
class Tokenizer {
  countMessagesTokens(messages: ChatMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.estimateTokenCount(msg.content);
      total += 4; // 角色标记开销
    }
    return total;
  }
  
  estimateTokenCount(text: string): number {
    // 中文: 2 字符 ≈ 1 token
    // 英文: 4 字符 ≈ 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }
}
```

## 扩展性设计

### 1. 添加新项目

只需三步：

```typescript
// 1. 创建项目目录和处理器
server/projects/new-project/
  ├── handler.ts
  └── utils/

// 2. 创建注册插件
server/plugins/register-new-project.ts

// 3. 更新配置
config.yaml:
  projects:
    new-project:
      enabled: true
```

### 2. 添加新 API 端点

```typescript
// 创建新文件即可
server/api/v1/new-endpoint.post.ts

export default defineEventHandler(async (event) => {
  // 实现
});
```

### 3. 添加新组件

```vue
<!-- 创建新组件 -->
app/components/NewComponent.vue

<script setup lang="ts">
// 组件逻辑
</script>

<template>
  <!-- 模板 -->
</template>
```

### 4. 扩展配置

```yaml
# config.yaml
projects:
  your-project:
    enabled: true
    # 添加项目特定配置
    custom_option: value
```

## 性能优化

### 1. Bun 运行时

- 快速启动（比 Node.js 快 4 倍）
- 原生 TypeScript 支持
- 高效的内存管理

### 2. 账号轮换

```typescript
// 避免单个账号过载
function getAvailableAccount(): Account {
  // 选择最久未使用的账号
  accounts.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
  return accounts[0];
}
```

### 3. 流式响应

```typescript
// 减少首字节时间
if (request.stream) {
  // 立即开始流式传输
  return streamResponse(upstreamResponse);
}
```

### 4. 缓存策略

```typescript
// 缓存模型列表
const modelCache = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 分钟
};

export function getModels() {
  const now = Date.now();
  if (modelCache.data && now - modelCache.timestamp < modelCache.ttl) {
    return modelCache.data;
  }
  
  modelCache.data = fetchModels();
  modelCache.timestamp = now;
  return modelCache.data;
}
```

### 5. 并行处理

```typescript
// 并行加载账号
const accountFiles = await readdir(ACCOUNTS_DIR);
const accounts = await Promise.all(
  accountFiles.map(file => loadAccount(file))
);
```

## 安全设计

### 1. 认证层级

```
Level 1: API Key 认证（公开 API）
Level 2: Session 认证（管理面板）
Level 3: 项目 Token 认证（用户自己的 token）
```

### 2. 输入验证

```typescript
// 所有输入都需要验证
function validateInput(body: any): ValidatedData {
  if (!body.model) {
    throw new Error('Invalid input');
  }
  // 更多验证...
  return body as ValidatedData;
}
```

### 3. 敏感信息保护

```typescript
// 日志中隐藏敏感信息
console.log('Token:', token.substring(0, 10) + '...');

// 配置文件使用环境变量
admin:
  password: ${ADMIN_PASSWORD}
```

### 4. CORS 配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
        },
      },
    },
  },
});
```

## 设计决策

### 为什么选择 Nuxt 3？

1. **全栈框架**: 前后端统一
2. **文件系统路由**: 简化 API 开发
3. **TypeScript 支持**: 类型安全
4. **插件系统**: 易于扩展
5. **SSR/SSG**: 灵活的渲染模式

### 为什么选择 Bun？

1. **性能**: 比 Node.js 快
2. **原生 TS**: 无需编译
3. **兼容性**: 兼容 Node.js API
4. **内置工具**: 包管理、测试等

### 为什么使用项目隔离？

1. **清晰**: 代码组织清晰
2. **维护**: 易于维护和调试
3. **扩展**: 添加新项目简单
4. **协作**: 团队可并行开发

### 为什么使用文件化账号？

1. **简单**: 无需数据库
2. **灵活**: 易于备份和迁移
3. **透明**: 可直接查看和编辑
4. **隔离**: 按项目分类存储

## 未来规划

### 短期目标

- [ ] 添加更多 AI 服务提供商
- [ ] 实现账号健康检查
- [ ] 添加请求统计和监控
- [ ] 优化错误处理和重试

### 长期目标

- [ ] 支持数据库存储
- [ ] 实现分布式部署
- [ ] 添加负载均衡
- [ ] 支持插件市场

## 相关文档

- [开发规范](DEVELOPMENT_STANDARDS.md)
- [添加新项目](ADD_NEW_PROJECT.md)
- [API 开发指南](API_DEVELOPMENT.md)
- [部署指南](DEPLOYMENT.md)

---

最后更新: 2026-01-31
