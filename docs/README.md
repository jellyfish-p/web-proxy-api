# Web Proxy API 开发文档中心

欢迎来到 Web Proxy API 的开发文档中心。这里包含了项目开发、部署和维护所需的所有文档。

## 📚 文档导航

### 快速开始
- [项目 README](../README.md) - 项目概述和快速开始指南
- [架构设计](ARCHITECTURE.md) - 系统架构和设计理念
- [开发规范](DEVELOPMENT_STANDARDS.md) - 开发标准和最佳实践

### 开发指南
- [代码风格指南](CODE_STYLE.md) - TypeScript/Vue 代码规范
- [API 开发指南](API_DEVELOPMENT.md) - API 端点开发规范
- [添加新项目](ADD_NEW_PROJECT.md) - 集成新 AI 服务提供商
- [测试规范](TESTING.md) - 测试策略和编写指南

### 功能文档
- [代理配置](PROXY.md) - 代理服务器配置说明
- [Tokenizer 使用](TOKENIZER.md) - Token 计数工具使用指南

### 运维部署
- [部署指南](DEPLOYMENT.md) - 生产环境部署说明
- [安全规范](SECURITY.md) - 安全最佳实践

### 贡献
- [贡献指南](CONTRIBUTING.md) - 如何为项目做贡献

## 🎯 文档使用建议

### 新手开发者
1. 阅读 [项目 README](../README.md) 了解项目概况
2. 学习 [架构设计](ARCHITECTURE.md) 理解系统结构
3. 遵循 [开发规范](DEVELOPMENT_STANDARDS.md) 和 [代码风格指南](CODE_STYLE.md)
4. 参考 [API 开发指南](API_DEVELOPMENT.md) 开始开发

### 添加新功能
1. 查看 [架构设计](ARCHITECTURE.md) 确定功能位置
2. 遵循 [开发规范](DEVELOPMENT_STANDARDS.md)
3. 编写测试（参考 [测试规范](TESTING.md)）
4. 提交代码（参考 [贡献指南](CONTRIBUTING.md)）

### 集成新 AI 服务
1. 阅读 [添加新项目](ADD_NEW_PROJECT.md)
2. 遵循项目隔离原则
3. 实现标准接口
4. 编写项目文档

### 部署上线
1. 阅读 [部署指南](DEPLOYMENT.md)
2. 遵循 [安全规范](SECURITY.md)
3. 配置监控和日志
4. 准备回滚方案

## 🔧 技术栈

- **框架**: Nuxt 3
- **运行时**: Bun
- **语言**: TypeScript
- **UI**: NuxtUI + TailwindCSS
- **配置**: YAML

## 📖 外部资源

- [Nuxt 3 官方文档](https://nuxt.com/)
- [Bun 官方文档](https://bun.sh/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Vue 3 官方文档](https://vuejs.org/)

## 🤝 获取帮助

- 提交 Issue: [GitHub Issues](https://github.com/your-repo/issues)
- 查看示例: 参考 `server/projects/deepseek/` 目录
- 阅读源码: 代码中包含详细注释

## 📝 文档维护

文档应该与代码同步更新。当你修改代码时，请同时更新相关文档。

### 文档更新原则
- 保持文档简洁明了
- 提供实际可运行的示例
- 及时更新过时内容
- 添加必要的图表说明

---

最后更新: 2026-01-31
