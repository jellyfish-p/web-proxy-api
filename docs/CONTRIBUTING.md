# 贡献指南

感谢你对 Web Proxy API 项目的关注！本文档将帮助你了解如何为项目做出贡献。

## 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发流程](#开发流程)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [代码审查](#代码审查)
- [问题报告](#问题报告)

## 行为准则

### 我们的承诺

为了营造一个开放和友好的环境，我们承诺：

- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 人身攻击或侮辱性评论
- 公开或私下骚扰
- 未经许可发布他人的私人信息
- 其他不道德或不专业的行为

## 如何贡献

### 贡献类型

你可以通过以下方式为项目做出贡献：

1. **报告 Bug**: 发现问题并提交 Issue
2. **建议功能**: 提出新功能或改进建议
3. **编写代码**: 修复 Bug 或实现新功能
4. **改进文档**: 完善或翻译文档
5. **代码审查**: 审查其他人的 Pull Request
6. **分享经验**: 编写教程或使用案例

### 开始之前

在开始贡献之前，请：

1. 阅读 [开发规范](DEVELOPMENT_STANDARDS.md)
2. 阅读 [代码风格指南](CODE_STYLE.md)
3. 了解 [架构设计](ARCHITECTURE.md)
4. 搜索现有的 Issues 和 Pull Requests

## 开发流程

### 1. Fork 项目

```bash
# 在 GitHub 上 Fork 项目
# 然后克隆你的 Fork
git clone https://github.com/your-username/web-proxy-api.git
cd web-proxy-api
```

### 2. 添加上游仓库

```bash
git remote add upstream https://github.com/original-owner/web-proxy-api.git
git fetch upstream
```

### 3. 创建分支

```bash
# 从 main 分支创建新分支
git checkout -b feature/your-feature-name

# 或修复 bug
git checkout -b fix/bug-description
```

### 4. 设置开发环境

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev
```

### 5. 进行更改

遵循以下原则：

- 保持提交小而专注
- 编写清晰的提交消息
- 添加必要的测试
- 更新相关文档
- 确保代码通过所有检查

### 6. 运行测试

```bash
# 运行所有测试
bun run test

# 运行特定测试
bun run test -- your-test-file.test.ts

# 检查代码覆盖率
bun run test:coverage
```

### 7. 代码检查

```bash
# 运行 ESLint
bun run lint

# 自动修复
bun run lint:fix

# 类型检查
bun run typecheck
```

### 8. 提交更改

```bash
# 添加更改
git add .

# 提交（遵循提交规范）
git commit -m "feat: add new feature"
```

### 9. 同步上游更改

```bash
# 获取上游更改
git fetch upstream

# 合并到你的分支
git rebase upstream/main
```

### 10. 推送到你的 Fork

```bash
git push origin feature/your-feature-name
```

## 提交规范

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型 (Type)

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是修复 bug）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动
- `ci`: CI 配置文件和脚本的变动
- `revert`: 回滚之前的提交

### 作用域 (Scope)

可选，表示影响的范围：

- `api`: API 相关
- `ui`: 用户界面
- `auth`: 认证相关
- `config`: 配置相关
- `docs`: 文档
- `deps`: 依赖更新
- `project`: 项目相关（如 deepseek）

### 主题 (Subject)

- 使用祈使句，现在时态
- 不要大写首字母
- 不要以句号结尾
- 限制在 50 字符以内

### 正文 (Body)

可选，详细描述：

- 解释为什么做这个更改
- 如何解决问题
- 有什么副作用

### 页脚 (Footer)

可选，用于：

- 关闭 Issue: `Closes #123`
- 破坏性变更: `BREAKING CHANGE: description`

### 示例

```bash
# 简单提交
git commit -m "feat: add user authentication"

# 带作用域
git commit -m "fix(api): handle null response from upstream"

# 完整提交
git commit -m "feat(auth): implement JWT token validation

Add JWT token validation middleware for API endpoints.
This improves security by verifying token signatures.

Closes #123"

# 破坏性变更
git commit -m "refactor(api): change response format

BREAKING CHANGE: API response format changed from array to object.
Update your client code accordingly."
```

## Pull Request 流程

### 1. 创建 Pull Request

在 GitHub 上创建 Pull Request，包含：

- **标题**: 清晰描述更改内容
- **描述**: 详细说明更改的原因和方式
- **关联 Issue**: 如果有相关 Issue，请引用
- **截图**: 如果是 UI 更改，提供截图
- **测试**: 说明如何测试你的更改

### PR 模板

```markdown
## 描述
简要描述这个 PR 的目的和内容。

## 更改类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 破坏性变更
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化
- [ ] 测试相关

## 相关 Issue
Closes #(issue number)

## 更改内容
- 添加了 XXX 功能
- 修复了 XXX 问题
- 优化了 XXX 性能

## 测试
描述你如何测试这些更改：
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试通过

## 截图（如适用）
添加截图以帮助解释你的更改。

## 检查清单
- [ ] 代码遵循项目的代码风格
- [ ] 进行了自我审查
- [ ] 添加了必要的注释
- [ ] 更新了相关文档
- [ ] 没有产生新的警告
- [ ] 添加了测试证明修复有效或功能正常
- [ ] 新的和现有的单元测试都通过
- [ ] 任何依赖的更改都已合并和发布
```

### 2. 等待审查

- 保持耐心，维护者会尽快审查
- 及时回应审查意见
- 根据反馈进行修改

### 3. 合并

当 PR 被批准后：

- 维护者会合并你的 PR
- 你的贡献将出现在下一个版本中

## 代码审查

### 审查者指南

作为审查者，请：

1. **及时审查**: 尽快审查 PR
2. **建设性反馈**: 提供具体、有帮助的建议
3. **尊重作者**: 保持友好和专业
4. **关注重点**:
   - 代码逻辑是否正确
   - 是否遵循项目规范
   - 是否有足够的测试
   - 是否更新了文档

### 审查清单

- [ ] 代码符合项目规范
- [ ] 逻辑正确，没有明显 bug
- [ ] 有适当的错误处理
- [ ] 有足够的测试覆盖
- [ ] 文档已更新
- [ ] 提交消息清晰
- [ ] 没有不必要的更改
- [ ] 性能影响可接受

### 审查评论示例

```markdown
# ✅ 好的评论
建议使用 `const` 而不是 `let`，因为这个变量不会被重新赋值。

这个函数可以简化为：
```typescript
return items.filter(item => item.active);
```

# ❌ 不好的评论
这段代码写得很糟糕。
你不知道怎么写代码吗？
```

## 问题报告

### Bug 报告

使用 Bug 报告模板：

```markdown
## Bug 描述
清晰简洁地描述 bug。

## 复现步骤
1. 访问 '...'
2. 点击 '...'
3. 滚动到 '...'
4. 看到错误

## 期望行为
描述你期望发生什么。

## 实际行为
描述实际发生了什么。

## 截图
如果适用，添加截图帮助解释问题。

## 环境
- OS: [e.g. Ubuntu 22.04]
- Bun 版本: [e.g. 1.0.0]
- 项目版本: [e.g. 1.2.3]

## 额外信息
添加任何其他相关信息。
```

### 功能请求

使用功能请求模板：

```markdown
## 功能描述
清晰简洁地描述你想要的功能。

## 问题
这个功能解决什么问题？

## 建议的解决方案
描述你希望如何实现这个功能。

## 替代方案
描述你考虑过的其他解决方案。

## 额外信息
添加任何其他相关信息或截图。
```

## 文档贡献

### 改进现有文档

1. 找到需要改进的文档
2. 创建分支: `docs/improve-xxx`
3. 进行更改
4. 提交 PR

### 添加新文档

1. 确定文档类型和位置
2. 遵循现有文档的格式
3. 添加到文档索引
4. 提交 PR

### 文档规范

- 使用清晰的标题层级
- 提供代码示例
- 添加目录（如果文档较长）
- 使用正确的 Markdown 语法
- 检查拼写和语法

## 发布流程

### 版本号规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本号**: 不兼容的 API 更改
- **次版本号**: 向后兼容的功能性新增
- **修订号**: 向后兼容的问题修正

示例：`1.2.3`

### 发布清单

- [ ] 更新版本号
- [ ] 更新 CHANGELOG
- [ ] 运行所有测试
- [ ] 构建项目
- [ ] 创建 Git 标签
- [ ] 推送到仓库
- [ ] 创建 GitHub Release
- [ ] 发布公告

## 获取帮助

如果你有任何问题：

1. 查看 [文档](README.md)
2. 搜索现有的 [Issues](https://github.com/your-repo/issues)
3. 在 [Discussions](https://github.com/your-repo/discussions) 提问
4. 加入我们的社区频道

## 致谢

感谢所有为项目做出贡献的人！

### 贡献者

查看 [贡献者列表](https://github.com/your-repo/graphs/contributors)。

### 特别感谢

- 所有提交 Issue 和 PR 的人
- 所有参与代码审查的人
- 所有改进文档的人
- 所有分享项目的人

## 许可证

通过贡献代码，你同意你的贡献将在 [MIT License](../LICENSE) 下授权。

## 相关资源

- [开发规范](DEVELOPMENT_STANDARDS.md)
- [代码风格指南](CODE_STYLE.md)
- [API 开发指南](API_DEVELOPMENT.md)
- [测试规范](TESTING.md)
- [部署指南](DEPLOYMENT.md)

---

再次感谢你的贡献！🎉

最后更新: 2026-01-31
