# 代理配置文档 (Proxy Configuration)

## 概述 (Overview)

本系统支持为每个令牌文件配置独立的代理服务器。当使用对应的令牌进行请求时，系统会自动通过配置的代理服务器进行连接。

This system supports configuring independent proxy servers for each token file. When making requests with the corresponding token, the system will automatically connect through the configured proxy server.

## 支持的代理协议 (Supported Proxy Protocols)

- **SOCKS5**: `socks5://host:port` 或 `socks5://username:password@host:port`
- **SOCKS4**: `socks4://host:port`
- **HTTP**: `http://host:port` 或 `http://username:password@host:port`
- **HTTPS**: `https://host:port` 或 `https://username:password@host:port`

## 配置方法 (Configuration Method)

### 1. 在账户文件中添加 proxy_url 字段

在 `accounts/deepseek/` 目录下的 JSON 文件中添加可选的 `proxy_url` 字段：

```json
{
  "email": "user@example.com",
  "password": "your_password",
  "token": "your_token_here",
  "proxy_url": "socks5://127.0.0.1:1080"
}
```

### 2. 代理配置示例 (Proxy Configuration Examples)

#### SOCKS5 代理（无认证）
```json
{
  "email": "user@example.com",
  "password": "your_password",
  "proxy_url": "socks5://127.0.0.1:1080"
}
```

#### SOCKS5 代理（带认证）
```json
{
  "email": "user@example.com",
  "password": "your_password",
  "proxy_url": "socks5://username:password@proxy.example.com:1080"
}
```

#### HTTP 代理
```json
{
  "email": "user@example.com",
  "password": "your_password",
  "proxy_url": "http://proxy.example.com:8080"
}
```

#### HTTP 代理（带认证）
```json
{
  "email": "user@example.com",
  "password": "your_password",
  "proxy_url": "http://username:password@proxy.example.com:8080"
}
```

### 3. 不使用代理

如果不需要使用代理，只需不添加 `proxy_url` 字段，或将其设置为空字符串：

```json
{
  "email": "user@example.com",
  "password": "your_password",
  "token": "your_token_here"
}
```

或

```json
{
  "email": "user@example.com",
  "password": "your_password",
  "token": "your_token_here",
  "proxy_url": ""
}
```

## 工作原理 (How It Works)

1. 系统读取账户文件时会检查 `proxy_url` 字段
2. 如果存在有效的 `proxy_url`，所有使用该账户的 HTTP 请求都会通过指定的代理服务器
3. 如果 `proxy_url` 不存在或为空，则直接连接目标服务器
4. 代理配置仅对当前账户生效，不影响其他账户

## 日志输出 (Logging)

当使用代理时，系统会在控制台输出日志：

```
[ProxyFetch] Using proxy: socks5://127.0.0.1:1080 for https://chat.deepseek.com/api/v0/users/login
```

## 故障排查 (Troubleshooting)

### 代理连接失败

如果看到类似以下错误：

```
[ProxyFetch] Proxy error: ...
Failed to connect through proxy socks5://127.0.0.1:1080: ...
```

请检查：

1. 代理服务器是否正在运行
2. 代理地址和端口是否正确
3. 如果使用认证，用户名和密码是否正确
4. 防火墙是否允许连接到代理服务器

### 代理协议不支持

如果看到错误：

```
Unsupported proxy protocol: xxx://...
```

请确保使用支持的代理协议：socks5、socks4、http 或 https

## 安全建议 (Security Recommendations)

1. **不要在代码仓库中提交包含真实代理凭据的文件**
2. 使用环境变量或配置管理工具来管理敏感信息
3. 定期更换代理服务器的认证凭据
4. 使用加密的代理协议（如 SOCKS5 over TLS）以提高安全性

## 性能考虑 (Performance Considerations)

- 使用代理会增加请求延迟
- 选择地理位置接近目标服务器的代理可以减少延迟
- 确保代理服务器有足够的带宽和稳定性
