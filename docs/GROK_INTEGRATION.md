# Grok 项目集成文档

本文档介绍如何在 Web Proxy API 中使用 Grok 项目。

## 概述

Grok 项目提供了对 X.AI Grok 模型的完整支持，包括文本生成、图像生成和视频生成功能。

## 支持的模型

### 文本模型

- **grok-4.1**: 最新 Grok 4.1 模型，支持工具调用
- **grok-4.1-thinking**: Grok 4.1 思考模型，提供推理过程
- **grok-4-fast**: 快速 Grok 4 模型
- **grok-4-fast-expert**: Grok 4 快速专家模式（消耗 4 次调用）
- **grok-4-expert**: Grok 4 专家模式（消耗 4 次调用）
- **grok-4-heavy**: Grok 4 重型模型（需要 Super Token，独立计费）
- **grok-3-fast**: Grok 3 快速模型

### 多模态模型

- **grok-imagine-0.9**: 图像和视频生成模型
  - 支持文本到图像生成
  - 支持图像到视频生成

## 配置

### 1. 启用 Grok 项目

编辑 `config.yaml`:

```yaml
projects:
  grok:
    enabled: true

grok:
  # 基础 URL（可选，用于生成图片/视频链接）
  base_url: ""
  
  # Statsig ID（可选，启用 dynamic_statsig 时自动生成）
  x_statsig_id: ""
  
  # 动态生成 Statsig ID（推荐）
  dynamic_statsig: true
  
  # 临时会话模式
  temporary: false
  
  # 代理配置
  proxy_url: ""
  proxy_pool_url: ""
  proxy_pool_interval: 300
  
  # 重试状态码
  retry_status_codes:
    - 401
    - 429
  
  # 过滤标签
  filtered_tags: "xaiartifact,xai:tool_usage_card,grok:render"
  
  # 显示思考过程
  show_thinking: true
  
  # 图片模式：url 或 base64
  image_mode: "url"
  
  # 缓存大小限制（MB）
  image_cache_max_size_mb: 500
  video_cache_max_size_mb: 500
```

### 2. 添加 Token

Grok 使用 SSO Token 进行认证，支持两种类型：

- **ssoNormal**: 普通用户 Token
- **ssoSuper**: Super 用户 Token（可使用 grok-4-heavy 模型）

#### 通过管理面板添加

1. 访问 http://localhost:3000/projects/grok
2. 点击"添加令牌"
3. 选择 Token 类型（SSO Normal 或 SSO Super）
4. 输入 Token（一行一个或逗号分隔）
5. 点击"添加"

#### 手动添加

创建或编辑 `accounts/grok/token.json`:

```json
{
  "ssoNormal": {
    "your-token-1": {
      "createdTime": 1706745600000,
      "remainingQueries": -1,
      "heavyremainingQueries": -1,
      "status": "active",
      "failedCount": 0,
      "lastFailureTime": null,
      "lastFailureReason": null,
      "tags": [],
      "note": ""
    },
    "your-token-2": {
      "createdTime": 1706745600000,
      "remainingQueries": -1,
      "heavyremainingQueries": -1,
      "status": "active",
      "failedCount": 0,
      "lastFailureTime": null,
      "lastFailureReason": null,
      "tags": [],
      "note": ""
    }
  },
  "ssoSuper": {
    "your-super-token": {
      "createdTime": 1706745600000,
      "remainingQueries": -1,
      "heavyremainingQueries": -1,
      "status": "active",
      "failedCount": 0,
      "lastFailureTime": null,
      "lastFailureReason": null,
      "tags": [],
      "note": ""
    }
  }
}
```

## 使用示例

### 文本生成

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-4.1",
    "messages": [
      {"role": "user", "content": "Hello, Grok!"}
    ],
    "stream": true
  }'
```

### 思考模型

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-4.1-thinking",
    "messages": [
      {"role": "user", "content": "Solve this math problem: 2x + 5 = 13"}
    ]
  }'
```

### 图像生成

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-imagine-0.9",
    "messages": [
      {"role": "user", "content": "A beautiful sunset over the ocean"}
    ]
  }'
```

### 图像到视频

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-imagine-0.9",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Make this image move"},
          {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
        ]
      }
    ]
  }'
```

## 特性说明

### Token 管理

- **自动选择**: 系统自动选择可用的 Token
- **负载均衡**: 优先使用剩余配额最多的 Token
- **失败重试**: Token 失败时自动切换到其他 Token
- **状态跟踪**: 记录每个 Token 的使用情况和失败次数

### 代理支持

支持三种代理配置方式：

1. **静态代理**: 在 `config.yaml` 中配置 `grok.proxy_url`
2. **代理池**: 配置 `grok.proxy_pool_url`，定期从 URL 获取新代理
3. **混合模式**: 代理池失败时回退到静态代理

支持的代理协议：
- SOCKS5/SOCKS5H
- HTTP/HTTPS

### 图像和视频缓存

- **自动缓存**: 生成的图像和视频自动缓存到本地
- **大小限制**: 可配置缓存大小上限
- **自动清理**: 超过限制时自动删除最旧的文件
- **URL 模式**: 返回本地 URL 或 base64 编码

缓存目录：
- 图像: `data/temp/image/`
- 视频: `data/temp/video/`

访问缓存文件：
- 图像: `http://localhost:3000/images/image/[filename]`
- 视频: `http://localhost:3000/images/video/[filename]`

### Statsig ID

Statsig ID 用于请求认证，支持两种模式：

1. **动态生成**（推荐）: 设置 `dynamic_statsig: true`，每次请求自动生成
2. **固定 ID**: 设置 `x_statsig_id` 为固定值

### 重试机制

- **403 错误**: 最多重试 5 次，每次刷新代理
- **401/429 错误**: 最多重试 3 次，使用指数退避
- **其他错误**: 不重试，直接返回错误

## 故障排查

### Token 无效

**症状**: 请求返回 401 错误

**解决方案**:
1. 检查 Token 是否正确
2. 确认 Token 未过期
3. 查看管理面板中 Token 状态

### 代理连接失败

**症状**: 请求超时或连接错误

**解决方案**:
1. 检查代理服务器是否可用
2. 确认代理协议正确（socks5h:// 或 http://）
3. 尝试使用代理池模式

### 图像/视频无法访问

**症状**: 返回的图片/视频链接无法访问

**解决方案**:
1. 检查 `grok.base_url` 配置
2. 确认缓存目录存在且有写权限
3. 查看服务器日志确认下载成功

### 模型不可用

**症状**: 返回"Model not available"错误

**解决方案**:
1. 确认 Grok 项目已启用
2. 检查模型名称是否正确
3. 访问 `/v1/models` 查看可用模型列表

## 最佳实践

### Token 管理

1. **分离 Token 类型**: Normal Token 用于常规模型，Super Token 用于 Heavy 模型
2. **定期检查**: 通过管理面板查看 Token 状态和剩余配额
3. **备用 Token**: 准备多个 Token 以提高可用性

### 性能优化

1. **启用缓存**: 图像和视频缓存可显著提高响应速度
2. **使用代理池**: 避免单个代理被封禁
3. **合理配置重试**: 根据网络情况调整重试次数

### 安全建议

1. **保护 Token**: 不要在公开代码中暴露 Token
2. **限制访问**: 使用 API Key 控制访问权限
3. **监控使用**: 定期检查 Token 使用情况

## 相关文档

- [添加新项目指南](ADD_NEW_PROJECT.md)
- [代理配置文档](PROXY.md)
- [架构设计](ARCHITECTURE.md)

---

最后更新: 2026-01-31
