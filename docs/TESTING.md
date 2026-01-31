# 测试规范文档

本文档定义了 Web Proxy API 项目的测试策略、规范和最佳实践。

## 目录

- [测试策略](#测试策略)
- [测试类型](#测试类型)
- [测试框架](#测试框架)
- [单元测试](#单元测试)
- [集成测试](#集成测试)
- [E2E 测试](#e2e-测试)
- [测试覆盖率](#测试覆盖率)
- [最佳实践](#最佳实践)

## 测试策略

### 测试金字塔

```
        ┌─────────────┐
        │   E2E 测试   │  10%  - 端到端测试
        ├─────────────┤
        │  集成测试    │  20%  - API 和组件集成
        ├─────────────┤
        │  单元测试    │  70%  - 函数和模块
        └─────────────┘
```

### 测试原则

1. **快速**: 测试应该快速执行
2. **独立**: 测试之间不应相互依赖
3. **可重复**: 每次运行结果一致
4. **自验证**: 自动判断通过或失败
5. **及时**: 在开发过程中编写测试

## 测试类型

### 1. 单元测试

测试单个函数或模块的功能。

```typescript
// ✅ 适合单元测试
- 工具函数
- 数据转换
- 验证逻辑
- 计算逻辑

// ❌ 不适合单元测试
- 数据库操作
- 外部 API 调用
- 文件系统操作
```

### 2. 集成测试

测试多个模块协同工作。

```typescript
// ✅ 适合集成测试
- API 端点
- 数据库查询
- 认证流程
- 项目处理器
```

### 3. E2E 测试

测试完整的用户流程。

```typescript
// ✅ 适合 E2E 测试
- 用户登录流程
- 完整的 API 调用
- 管理面板操作
- 多步骤业务流程
```

## 测试框架

### 推荐工具

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",           // 测试框架
    "@nuxt/test-utils": "^3.0.0", // Nuxt 测试工具
    "@vue/test-utils": "^2.4.0",  // Vue 组件测试
    "playwright": "^1.40.0",      // E2E 测试
    "msw": "^2.0.0"               // API Mock
  }
}
```

### 配置 Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
  },
});
```

### 配置 Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

## 单元测试

### 测试工具函数

```typescript
// server/utils/tokenizer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Tokenizer } from './tokenizer';

describe('Tokenizer', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  describe('estimateTokenCount', () => {
    it('should count English text correctly', () => {
      const text = 'Hello world';
      const count = tokenizer.estimateTokenCount(text);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(text.length);
    });

    it('should count Chinese text correctly', () => {
      const text = '你好世界';
      const count = tokenizer.estimateTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle mixed text', () => {
      const text = 'Hello 世界';
      const count = tokenizer.estimateTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      const count = tokenizer.estimateTokenCount('');
      expect(count).toBe(0);
    });
  });

  describe('countMessagesTokens', () => {
    it('should count message tokens with overhead', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const count = tokenizer.countMessagesTokens(messages);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle empty messages', () => {
      const count = tokenizer.countMessagesTokens([]);
      expect(count).toBe(0);
    });
  });
});
```

### 测试配置管理

```typescript
// server/utils/config.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConfig, loadConfig } from './config';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load config from file', async () => {
    const mockConfig = {
      app: { name: 'test', port: 3000 },
      admin: { username: 'admin', password: 'pass' },
      keys: ['key1'],
      projects: {},
    };

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(mockConfig)
    );

    const config = await loadConfig();
    expect(config).toEqual(mockConfig);
  });

  it('should cache config', () => {
    const config1 = getConfig();
    const config2 = getConfig();
    expect(config1).toBe(config2);
  });

  it('should throw error if config file not found', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(
      new Error('File not found')
    );

    await expect(loadConfig()).rejects.toThrow();
  });
});
```

### 测试认证逻辑

```typescript
// server/utils/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { validateApiKey, validateSession } from './auth';
import type { H3Event } from 'h3';

describe('Auth', () => {
  describe('validateApiKey', () => {
    it('should accept valid API key', async () => {
      const event = {
        node: {
          req: {
            headers: {
              authorization: 'Bearer valid-key',
            },
          },
        },
      } as unknown as H3Event;

      const result = await validateApiKey(event);
      expect(result).toBe(true);
    });

    it('should reject invalid API key', async () => {
      const event = {
        node: {
          req: {
            headers: {
              authorization: 'Bearer invalid-key',
            },
          },
        },
      } as unknown as H3Event;

      await expect(validateApiKey(event)).rejects.toThrow();
    });

    it('should reject missing authorization header', async () => {
      const event = {
        node: {
          req: {
            headers: {},
          },
        },
      } as unknown as H3Event;

      await expect(validateApiKey(event)).rejects.toThrow();
    });
  });
});
```

### 测试项目注册表

```typescript
// server/utils/project-registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerProject,
  getProjectHandler,
  getAllModels,
  clearRegistry,
} from './project-registry';

describe('ProjectRegistry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('should register project', () => {
    const handler = vi.fn();
    registerProject({
      name: 'test-project',
      models: ['model-1', 'model-2'],
      handler,
    });

    const retrievedHandler = getProjectHandler('model-1');
    expect(retrievedHandler).toBe(handler);
  });

  it('should return null for unknown model', () => {
    const handler = getProjectHandler('unknown-model');
    expect(handler).toBeNull();
  });

  it('should list all models', () => {
    registerProject({
      name: 'project-1',
      models: ['model-1', 'model-2'],
      handler: vi.fn(),
    });

    registerProject({
      name: 'project-2',
      models: ['model-3'],
      handler: vi.fn(),
    });

    const models = getAllModels();
    expect(models).toHaveLength(3);
    expect(models).toContain('model-1');
    expect(models).toContain('model-2');
    expect(models).toContain('model-3');
  });
});
```

## 集成测试

### 测试 API 端点

```typescript
// tests/api/models.test.ts
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';

describe('Models API', async () => {
  await setup();

  it('should return model list', async () => {
    const response = await $fetch('/v1/models', {
      headers: {
        Authorization: 'Bearer test-key',
      },
    });

    expect(response).toHaveProperty('object', 'list');
    expect(response).toHaveProperty('data');
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should require authentication', async () => {
    await expect($fetch('/v1/models')).rejects.toThrow();
  });
});
```

### 测试聊天完成

```typescript
// tests/api/chat.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';

describe('Chat Completions API', async () => {
  await setup();

  const validRequest = {
    model: 'deepseek-chat',
    messages: [
      { role: 'user', content: 'Hello' },
    ],
  };

  it('should handle non-streaming request', async () => {
    const response = await $fetch('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
      },
      body: validRequest,
    });

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('object', 'chat.completion');
    expect(response).toHaveProperty('choices');
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0]).toHaveProperty('message');
  });

  it('should validate required fields', async () => {
    await expect(
      $fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
        },
        body: { model: 'deepseek-chat' }, // missing messages
      })
    ).rejects.toThrow();
  });

  it('should reject unsupported model', async () => {
    await expect(
      $fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
        },
        body: {
          model: 'unsupported-model',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toThrow();
  });
});
```

### 测试管理 API

```typescript
// tests/api/management.test.ts
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';

describe('Management API', async () => {
  await setup();

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const response = await $fetch('/v0/management/login', {
        method: 'POST',
        body: {
          username: 'admin',
          password: 'admin123',
        },
      });

      expect(response).toHaveProperty('success', true);
    });

    it('should reject invalid credentials', async () => {
      await expect(
        $fetch('/v0/management/login', {
          method: 'POST',
          body: {
            username: 'admin',
            password: 'wrong-password',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Projects', () => {
    it('should list projects', async () => {
      // 先登录获取 session
      await $fetch('/v0/management/login', {
        method: 'POST',
        body: {
          username: 'admin',
          password: 'admin123',
        },
      });

      const response = await $fetch('/v0/management/projects/list');
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
      expect(Array.isArray(response.data)).toBe(true);
    });
  });
});
```

### Mock 外部 API

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock DeepSeek API
  http.post('https://chat.deepseek.com/api/v0/chat/completions', () => {
    return HttpResponse.json({
      id: 'mock-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'deepseek-chat',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mock response',
          },
          finish_reason: 'stop',
        },
      ],
    });
  }),

  // Mock login
  http.post('https://chat.deepseek.com/api/v0/users/login', () => {
    return HttpResponse.json({
      data: {
        token: 'mock-token',
      },
    });
  }),
];
```

```typescript
// tests/setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

// 在所有测试前启动 mock server
beforeAll(() => server.listen());

// 每个测试后重置 handlers
afterEach(() => server.resetHandlers());

// 所有测试后关闭 mock server
afterAll(() => server.close());
```

## E2E 测试

### 测试用户登录

```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/admin/login');

    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('管理面板');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/admin/login');

    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'wrong');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible();
  });
});
```

### 测试令牌管理

```typescript
// tests/e2e/tokens.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Token Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');
  });

  test('should add new token', async ({ page }) => {
    await page.click('button:has-text("添加令牌")');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.selectOption('select[name="project"]', 'deepseek');
    await page.click('button:has-text("确认")');

    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('should delete token', async ({ page }) => {
    // 假设已有令牌
    await page.click('button:has-text("删除")').first();
    await page.click('button:has-text("确认删除")');

    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

### 测试 API 调用

```typescript
// tests/e2e/api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('API Integration', () => {
  test('should call chat API successfully', async ({ request }) => {
    const response = await request.post('/v1/chat/completions', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
      },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('choices');
  });
});
```

## 测试覆盖率

### 目标

```
整体覆盖率: ≥ 80%
核心模块: ≥ 90%
- server/utils/
- server/api/
工具函数: ≥ 95%
```

### 生成覆盖率报告

```bash
# 运行测试并生成覆盖率
npm run test:coverage

# 查看 HTML 报告
open coverage/index.html
```

### 配置覆盖率

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.ts'],
      exclude: [
        'server/**/*.test.ts',
        'server/**/*.spec.ts',
        'server/**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

## 最佳实践

### 1. 测试命名

```typescript
// ✅ 正确: 描述性的测试名称
describe('Tokenizer', () => {
  it('should count English text correctly', () => {});
  it('should handle empty string', () => {});
  it('should throw error for invalid input', () => {});
});

// ❌ 错误: 模糊的测试名称
describe('Tokenizer', () => {
  it('test1', () => {});
  it('works', () => {});
});
```

### 2. AAA 模式

```typescript
// Arrange - Act - Assert
it('should add two numbers', () => {
  // Arrange: 准备测试数据
  const a = 1;
  const b = 2;

  // Act: 执行被测试的操作
  const result = add(a, b);

  // Assert: 验证结果
  expect(result).toBe(3);
});
```

### 3. 使用 beforeEach/afterEach

```typescript
describe('Database', () => {
  let db: Database;

  beforeEach(async () => {
    // 每个测试前初始化
    db = await createDatabase();
  });

  afterEach(async () => {
    // 每个测试后清理
    await db.close();
  });

  it('should insert record', async () => {
    await db.insert({ name: 'test' });
    const count = await db.count();
    expect(count).toBe(1);
  });
});
```

### 4. 测试边界情况

```typescript
describe('divide', () => {
  it('should divide positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should divide negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  it('should handle zero dividend', () => {
    expect(divide(0, 5)).toBe(0);
  });

  it('should throw error for zero divisor', () => {
    expect(() => divide(10, 0)).toThrow();
  });

  it('should handle decimal numbers', () => {
    expect(divide(10, 3)).toBeCloseTo(3.33, 2);
  });
});
```

### 5. 避免测试实现细节

```typescript
// ✅ 正确: 测试行为
it('should return user data', async () => {
  const user = await getUser(1);
  expect(user).toHaveProperty('id', 1);
  expect(user).toHaveProperty('name');
});

// ❌ 错误: 测试实现
it('should call database.query', async () => {
  const spy = vi.spyOn(database, 'query');
  await getUser(1);
  expect(spy).toHaveBeenCalled();
});
```

### 6. 使用测试工厂

```typescript
// tests/factories/user.ts
export function createUser(overrides = {}) {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  };
}

// 使用
it('should update user', () => {
  const user = createUser({ name: 'John' });
  expect(user.name).toBe('John');
});
```

### 7. 异步测试

```typescript
// ✅ 正确: 使用 async/await
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// ✅ 正确: 使用 done 回调
it('should call callback', (done) => {
  fetchData((data) => {
    expect(data).toBeDefined();
    done();
  });
});

// ❌ 错误: 忘记 await
it('should fetch data', () => {
  const data = fetchData(); // 返回 Promise
  expect(data).toBeDefined(); // 测试 Promise 对象
});
```

## 运行测试

### 命令

```bash
# 运行所有测试
npm run test

# 运行单元测试
npm run test:unit

# 运行 E2E 测试
npm run test:e2e

# 监听模式
npm run test:watch

# 生成覆盖率
npm run test:coverage

# 运行特定文件
npm run test -- tokenizer.test.ts

# 运行匹配的测试
npm run test -- --grep "should count"
```

### package.json 配置

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --dir tests/unit",
    "test:integration": "vitest run --dir tests/integration",
    "test:e2e": "playwright test",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage"
  }
}
```

## CI/CD 集成

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run unit tests
        run: bun run test:unit

      - name: Run integration tests
        run: bun run test:integration

      - name: Run E2E tests
        run: bun run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## 相关文档

- [开发规范](DEVELOPMENT_STANDARDS.md)
- [代码风格指南](CODE_STYLE.md)
- [API 开发指南](API_DEVELOPMENT.md)

---

最后更新: 2026-01-31
