# 代码风格指南

本文档定义了 Web Proxy API 项目的代码风格规范，包括 TypeScript、Vue 和配置文件的编写规范。

## 目录

- [通用规范](#通用规范)
- [TypeScript 风格](#typescript-风格)
- [Vue 组件风格](#vue-组件风格)
- [CSS/TailwindCSS 风格](#csstailwindcss-风格)
- [注释规范](#注释规范)
- [Git 提交规范](#git-提交规范)

## 通用规范

### 缩进和空格

```typescript
// ✅ 正确: 使用 2 空格缩进
function example() {
  if (condition) {
    doSomething();
  }
}

// ❌ 错误: 使用 4 空格或 Tab
function example() {
    if (condition) {
        doSomething();
    }
}
```

### 行长度

```typescript
// ✅ 正确: 每行不超过 100 字符
const message = 
  'This is a very long message that needs to be split ' +
  'across multiple lines for better readability';

// ❌ 错误: 单行过长
const message = 'This is a very long message that needs to be split across multiple lines for better readability';
```

### 引号使用

```typescript
// ✅ 正确: 优先使用单引号
const name = 'John';
const message = 'Hello, world!';

// 模板字符串用于插值
const greeting = `Hello, ${name}!`;

// ❌ 错误: 不必要的双引号
const name = "John";
```

### 分号使用

```typescript
// ✅ 正确: 始终使用分号
const x = 1;
const y = 2;

function test() {
  return x + y;
}

// ❌ 错误: 省略分号
const x = 1
const y = 2
```

### 尾随逗号

```typescript
// ✅ 正确: 多行对象/数组使用尾随逗号
const obj = {
  name: 'John',
  age: 30,
  city: 'New York',
};

const arr = [
  'item1',
  'item2',
  'item3',
];

// ❌ 错误: 缺少尾随逗号
const obj = {
  name: 'John',
  age: 30,
  city: 'New York'
};
```

## TypeScript 风格

### 类型注解

```typescript
// ✅ 正确: 明确的类型注解
function add(a: number, b: number): number {
  return a + b;
}

const user: User = {
  id: 1,
  name: 'John',
};

// ❌ 错误: 缺少类型注解
function add(a, b) {
  return a + b;
}
```

### 接口 vs 类型别名

```typescript
// ✅ 正确: 对象形状使用 interface
interface User {
  id: number;
  name: string;
  email: string;
}

// ✅ 正确: 联合类型、交叉类型使用 type
type Status = 'pending' | 'success' | 'error';
type UserWithRole = User & { role: string };

// ❌ 错误: 混淆使用
type User = {
  id: number;
  name: string;
};
```

### 枚举

```typescript
// ✅ 正确: 使用 const enum 或字符串字面量类型
const enum Status {
  Pending = 'pending',
  Success = 'success',
  Error = 'error',
}

// 或使用字符串字面量类型
type Status = 'pending' | 'success' | 'error';

// ❌ 错误: 使用数字枚举
enum Status {
  Pending,
  Success,
  Error,
}
```

### 可选属性

```typescript
// ✅ 正确: 使用 ? 标记可选属性
interface Config {
  host: string;
  port: number;
  timeout?: number;
  retries?: number;
}

// ❌ 错误: 使用 undefined
interface Config {
  host: string;
  port: number;
  timeout: number | undefined;
}
```

### 函数重载

```typescript
// ✅ 正确: 使用函数重载
function format(value: string): string;
function format(value: number): string;
function format(value: Date): string;
function format(value: string | number | Date): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return value.toISOString();
}

// ❌ 错误: 使用联合类型和类型检查
function format(value: string | number | Date): string {
  // 实现
}
```

### 泛型命名

```typescript
// ✅ 正确: 使用描述性的泛型名称
interface ApiResponse<TData, TError = Error> {
  data?: TData;
  error?: TError;
}

// 单个泛型可以使用 T
function identity<T>(value: T): T {
  return value;
}

// ❌ 错误: 使用无意义的名称
interface ApiResponse<A, B> {
  data?: A;
  error?: B;
}
```

### 类型断言

```typescript
// ✅ 正确: 使用 as 语法
const input = document.getElementById('input') as HTMLInputElement;

// ❌ 错误: 使用尖括号语法（与 JSX 冲突）
const input = <HTMLInputElement>document.getElementById('input');

// ❌ 错误: 过度使用类型断言
const value = data as any as string;
```

### 导入导出

```typescript
// ✅ 正确: 命名导出
export interface User {
  id: number;
  name: string;
}

export function getUser(id: number): User {
  // 实现
}

// ✅ 正确: 默认导出（用于组件）
export default defineEventHandler(async (event) => {
  // 实现
});

// ❌ 错误: 混合使用
export default interface User {
  id: number;
}
```

### 异步函数

```typescript
// ✅ 正确: 使用 async/await
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return data;
}

// ❌ 错误: 使用 Promise 链
function fetchUser(id: number): Promise<User> {
  return fetch(`/api/users/${id}`)
    .then(response => response.json())
    .then(data => data);
}
```

## Vue 组件风格

### 组件结构

```vue
<!-- ✅ 正确: 使用 <script setup> 语法 -->
<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  title: string;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
});

const emit = defineEmits<{
  update: [value: number];
  close: [];
}>();

const localCount = ref(props.count);

const doubleCount = computed(() => localCount.value * 2);

function increment() {
  localCount.value++;
  emit('update', localCount.value);
}
</script>

<template>
  <div class="component">
    <h2>{{ title }}</h2>
    <p>Count: {{ localCount }}</p>
    <p>Double: {{ doubleCount }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>

<style scoped>
.component {
  padding: 1rem;
}
</style>
```

### 组件命名

```vue
<!-- ✅ 正确: PascalCase 文件名 -->
<!-- UserProfile.vue -->
<script setup lang="ts">
// 组件逻辑
</script>

<!-- ❌ 错误: kebab-case 文件名 -->
<!-- user-profile.vue -->
```

### Props 定义

```vue
<script setup lang="ts">
// ✅ 正确: 使用 TypeScript 接口
interface Props {
  userId: number;
  userName: string;
  isActive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: true,
});

// ❌ 错误: 使用运行时声明
const props = defineProps({
  userId: Number,
  userName: String,
  isActive: Boolean,
});
</script>
```

### 事件定义

```vue
<script setup lang="ts">
// ✅ 正确: 类型化的 emit
const emit = defineEmits<{
  submit: [data: FormData];
  cancel: [];
  update: [id: number, value: string];
}>();

// 使用
emit('submit', formData);
emit('cancel');
emit('update', 1, 'new value');

// ❌ 错误: 无类型的 emit
const emit = defineEmits(['submit', 'cancel', 'update']);
</script>
```

### 模板语法

```vue
<template>
  <!-- ✅ 正确: 使用简洁的指令 -->
  <div v-if="isVisible" class="content">
    <p v-for="item in items" :key="item.id">
      {{ item.name }}
    </p>
  </div>

  <!-- ✅ 正确: 事件处理 -->
  <button @click="handleClick">Click</button>
  <input @input="handleInput" />

  <!-- ❌ 错误: 使用完整指令名 -->
  <div v-bind:class="className" v-on:click="handleClick">
    Content
  </div>

  <!-- ❌ 错误: 缺少 key -->
  <p v-for="item in items">{{ item.name }}</p>
</template>
```

### Composables

```typescript
// ✅ 正确: 使用 use 前缀
// composables/useAuth.ts
export function useAuth() {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => user.value !== null);

  async function login(credentials: Credentials) {
    // 实现
  }

  async function logout() {
    // 实现
  }

  return {
    user: readonly(user),
    isAuthenticated,
    login,
    logout,
  };
}

// ❌ 错误: 不使用 use 前缀
export function auth() {
  // 实现
}
```

## CSS/TailwindCSS 风格

### TailwindCSS 类顺序

```vue
<template>
  <!-- ✅ 正确: 按功能分组 -->
  <div
    class="
      flex items-center justify-between
      w-full max-w-4xl
      p-4 m-2
      bg-white dark:bg-gray-800
      border border-gray-200
      rounded-lg shadow-md
      hover:shadow-lg
      transition-shadow duration-200
    "
  >
    Content
  </div>

  <!-- ❌ 错误: 无序的类名 -->
  <div class="p-4 bg-white flex rounded-lg w-full shadow-md border">
    Content
  </div>
</template>
```

### 自定义 CSS

```vue
<style scoped>
/* ✅ 正确: 使用 scoped 样式 */
.component {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.component__title {
  font-size: 1.5rem;
  font-weight: bold;
}

/* ❌ 错误: 全局样式污染 */
.title {
  font-size: 1.5rem;
}
</style>
```

### CSS 变量

```vue
<style scoped>
/* ✅ 正确: 使用 CSS 变量 */
.component {
  --primary-color: #3b82f6;
  --spacing: 1rem;
  
  color: var(--primary-color);
  padding: var(--spacing);
}

/* ❌ 错误: 硬编码值 */
.component {
  color: #3b82f6;
  padding: 16px;
}
</style>
```

## 注释规范

### 文件头注释

```typescript
/**
 * User authentication utilities
 * 
 * This module provides functions for user authentication,
 * including login, logout, and token validation.
 * 
 * @module utils/auth
 */
```

### 函数注释

```typescript
/**
 * Validates a user token
 * 
 * @param token - The authentication token to validate
 * @param options - Optional validation options
 * @returns True if the token is valid, false otherwise
 * @throws {AuthenticationError} If the token format is invalid
 * 
 * @example
 * ```typescript
 * const isValid = await validateToken('sk-xxx');
 * if (isValid) {
 *   // Token is valid
 * }
 * ```
 */
async function validateToken(
  token: string,
  options?: ValidationOptions
): Promise<boolean> {
  // 实现
}
```

### 行内注释

```typescript
// ✅ 正确: 解释为什么，而不是做什么
// 使用指数退避策略避免过载服务器
const delay = Math.pow(2, retryCount) * 1000;

// ❌ 错误: 重复代码内容
// 设置延迟为 2 的 retryCount 次方乘以 1000
const delay = Math.pow(2, retryCount) * 1000;
```

### TODO 注释

```typescript
// ✅ 正确: 包含上下文和负责人
// TODO(username): 实现缓存机制以提高性能
// 相关 Issue: #123

// ❌ 错误: 缺少上下文
// TODO: 优化
```

### 复杂逻辑注释

```typescript
// ✅ 正确: 解释复杂的业务逻辑
/**
 * 账号轮换策略:
 * 1. 优先使用最近未使用的账号
 * 2. 如果所有账号都在冷却期，等待最早可用的账号
 * 3. 如果账号失败次数超过阈值，标记为不可用
 */
function selectAccount(accounts: Account[]): Account {
  // 实现
}
```

## Git 提交规范

### 提交消息格式

```bash
# ✅ 正确: 使用约定式提交
feat: 添加用户认证功能
fix: 修复代理连接超时问题
docs: 更新 API 文档
style: 格式化代码
refactor: 重构账号管理模块
test: 添加单元测试
chore: 更新依赖包

# 带作用域
feat(auth): 添加 JWT 令牌验证
fix(proxy): 修复 SOCKS5 代理连接

# 带详细描述
feat: 添加用户认证功能

实现了基于 JWT 的用户认证系统，包括:
- 登录/登出功能
- Token 刷新机制
- 权限验证中间件

Closes #123

# ❌ 错误: 无意义的提交消息
git commit -m "update"
git commit -m "fix bug"
git commit -m "修改"
```

### 提交类型

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是修复 bug）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动
- `ci`: CI 配置文件和脚本的变动
- `revert`: 回滚之前的提交

### 分支命名

```bash
# ✅ 正确: 描述性的分支名
feature/user-authentication
fix/proxy-timeout
docs/api-documentation
refactor/account-management

# ❌ 错误: 无意义的分支名
dev
test
my-branch
```

## 代码格式化工具

### 推荐配置

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

```json
// .eslintrc.json
{
  "extends": [
    "@nuxt/eslint-config",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "no-console": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

## 编辑器配置

### VSCode 设置

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.tabSize": 2,
  "files.eol": "\n",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### 推荐扩展

- ESLint
- Prettier
- Volar (Vue Language Features)
- TypeScript Vue Plugin
- Tailwind CSS IntelliSense

## 代码审查清单

提交代码前检查：

- [ ] 代码符合命名规范
- [ ] 使用正确的缩进和格式
- [ ] 添加必要的类型注解
- [ ] 编写清晰的注释
- [ ] 移除调试代码和 console.log
- [ ] 提交消息符合规范
- [ ] 通过 ESLint 检查
- [ ] 通过 TypeScript 类型检查

## 参考资源

- [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Vue Style Guide](https://vuejs.org/style-guide/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

---

最后更新: 2026-01-31
