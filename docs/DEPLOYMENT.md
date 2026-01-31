# 部署指南

本文档提供了 Web Proxy API 项目的完整部署指南，包括开发、测试和生产环境的部署方案。

## 目录

- [环境要求](#环境要求)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [Docker 部署](#docker-部署)
- [反向代理配置](#反向代理配置)
- [环境变量](#环境变量)
- [监控和日志](#监控和日志)
- [故障排查](#故障排查)

## 环境要求

### 最低要求

- **操作系统**: Linux (Ubuntu 20.04+), macOS, Windows 10+
- **运行时**: Bun 1.0+ 或 Node.js 18+
- **内存**: 512MB RAM (最低), 2GB+ (推荐)
- **磁盘**: 1GB 可用空间
- **网络**: 稳定的互联网连接

### 推荐配置

- **CPU**: 2 核心或更多
- **内存**: 4GB RAM
- **磁盘**: SSD, 10GB+ 可用空间
- **网络**: 100Mbps+ 带宽

## 开发环境部署

### 1. 安装 Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"

# 验证安装
bun --version
```

### 2. 克隆项目

```bash
git clone https://github.com/your-repo/web-proxy-api.git
cd web-proxy-api
```

### 3. 安装依赖

```bash
bun install
```

### 4. 配置项目

```bash
# 复制配置文件
cp config.yaml.example config.yaml

# 编辑配置
nano config.yaml
```

```yaml
app:
  name: web-proxy-api
  port: 3000

admin:
  username: admin
  password: your-secure-password  # 修改为强密码

keys:
  - your-api-key-here

projects:
  deepseek:
    enabled: true
```

### 5. 创建账号目录

```bash
mkdir -p accounts/deepseek
```

### 6. 添加账号文件

```bash
# 创建账号文件
cat > accounts/deepseek/account1.json << EOF
{
  "email": "your-email@example.com",
  "password": "your-password",
  "token": "",
  "proxy_url": ""
}
EOF
```

### 7. 启动开发服务器

```bash
bun run dev
```

访问 http://localhost:3000

## 生产环境部署

### 方案 1: 直接部署

#### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y git curl
```

#### 2. 安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

#### 3. 部署项目

```bash
# 克隆项目
cd /opt
sudo git clone https://github.com/your-repo/web-proxy-api.git
cd web-proxy-api

# 安装依赖
bun install

# 配置项目
sudo nano config.yaml
```

#### 4. 构建项目

```bash
bun run build
```

#### 5. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'web-proxy-api',
    script: '.output/server/index.mjs',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

#### 6. 查看状态

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs web-proxy-api

# 监控
pm2 monit
```

### 方案 2: Systemd 服务

#### 1. 创建服务文件

```bash
sudo nano /etc/systemd/system/web-proxy-api.service
```

```ini
[Unit]
Description=Web Proxy API Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/web-proxy-api
ExecStart=/home/user/.bun/bin/bun run .output/server/index.mjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

#### 2. 启动服务

```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start web-proxy-api

# 设置开机自启
sudo systemctl enable web-proxy-api

# 查看状态
sudo systemctl status web-proxy-api

# 查看日志
sudo journalctl -u web-proxy-api -f
```

## Docker 部署

### 1. 创建 Dockerfile

```dockerfile
# Dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# 安装依赖
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 构建应用
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# 生产镜像
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 复制构建产物
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/config.yaml ./config.yaml

# 创建账号目录
RUN mkdir -p accounts

EXPOSE 3000

CMD ["bun", "run", ".output/server/index.mjs"]
```

### 2. 创建 .dockerignore

```
node_modules
.nuxt
.output
dist
.git
.env
*.log
accounts/*
!accounts/.gitkeep
```

### 3. 构建镜像

```bash
docker build -t web-proxy-api:latest .
```

### 4. 运行容器

```bash
docker run -d \
  --name web-proxy-api \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/accounts:/app/accounts \
  --restart unless-stopped \
  web-proxy-api:latest
```

### 5. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  web-proxy-api:
    build: .
    container_name: web-proxy-api
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./accounts:/app/accounts
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

## 反向代理配置

### Nginx

```nginx
# /etc/nginx/sites-available/web-proxy-api
upstream web_proxy_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/web-proxy-api-access.log;
    error_log /var/log/nginx/web-proxy-api-error.log;

    # 客户端最大请求体大小
    client_max_body_size 10M;

    # 代理配置
    location / {
        proxy_pass http://web_proxy_api;
        proxy_http_version 1.1;
        
        # 请求头
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓存
        proxy_cache_bypass $http_upgrade;
    }

    # SSE 流式响应特殊配置
    location /v1/chat/completions {
        proxy_pass http://web_proxy_api;
        proxy_http_version 1.1;
        
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 禁用缓冲以支持流式响应
        proxy_buffering off;
        proxy_cache off;
        
        # 超时设置
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/web-proxy-api /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### Caddy

```caddyfile
# Caddyfile
api.yourdomain.com {
    reverse_proxy localhost:3000 {
        # 流式响应配置
        flush_interval -1
    }

    # 日志
    log {
        output file /var/log/caddy/web-proxy-api.log
    }
}
```

```bash
# 启动 Caddy
sudo caddy start --config Caddyfile
```

### Apache

```apache
# /etc/apache2/sites-available/web-proxy-api.conf
<VirtualHost *:80>
    ServerName api.yourdomain.com
    Redirect permanent / https://api.yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName api.yourdomain.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/api.yourdomain.com/privkey.pem

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # 流式响应
    ProxyPass /v1/chat/completions http://localhost:3000/v1/chat/completions disablereuse=On
    ProxyPassReverse /v1/chat/completions http://localhost:3000/v1/chat/completions

    ErrorLog ${APACHE_LOG_DIR}/web-proxy-api-error.log
    CustomLog ${APACHE_LOG_DIR}/web-proxy-api-access.log combined
</VirtualHost>
```

```bash
# 启用模块
sudo a2enmod ssl proxy proxy_http

# 启用站点
sudo a2ensite web-proxy-api

# 重载 Apache
sudo systemctl reload apache2
```

## 环境变量

### 配置环境变量

```bash
# .env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# API Keys
API_KEY_1=your-api-key-1
API_KEY_2=your-api-key-2

# 日志级别
LOG_LEVEL=info
```

### 在配置文件中使用

```yaml
# config.yaml
admin:
  username: ${ADMIN_USERNAME}
  password: ${ADMIN_PASSWORD}

keys:
  - ${API_KEY_1}
  - ${API_KEY_2}
```

## 监控和日志

### 1. 应用日志

```bash
# PM2 日志
pm2 logs web-proxy-api

# Systemd 日志
sudo journalctl -u web-proxy-api -f

# Docker 日志
docker logs -f web-proxy-api
```

### 2. 日志轮转

```bash
# /etc/logrotate.d/web-proxy-api
/var/log/web-proxy-api/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload web-proxy-api > /dev/null 2>&1 || true
    endscript
}
```

### 3. 监控脚本

```bash
#!/bin/bash
# monitor.sh

# 检查服务状态
check_service() {
    if ! systemctl is-active --quiet web-proxy-api; then
        echo "Service is down, restarting..."
        systemctl restart web-proxy-api
        
        # 发送告警
        curl -X POST https://your-webhook-url \
            -H "Content-Type: application/json" \
            -d '{"text":"Web Proxy API service restarted"}'
    fi
}

# 检查端口
check_port() {
    if ! nc -z localhost 3000; then
        echo "Port 3000 is not responding"
        systemctl restart web-proxy-api
    fi
}

# 检查内存使用
check_memory() {
    MEMORY=$(ps aux | grep web-proxy-api | awk '{sum+=$6} END {print sum/1024}')
    if (( $(echo "$MEMORY > 2048" | bc -l) )); then
        echo "High memory usage: ${MEMORY}MB"
        # 发送告警
    fi
}

check_service
check_port
check_memory
```

```bash
# 添加到 crontab
crontab -e

# 每 5 分钟检查一次
*/5 * * * * /opt/web-proxy-api/monitor.sh
```

### 4. 性能监控

```bash
# 安装 node-exporter (Prometheus)
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
sudo mv node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
sudo useradd -rs /bin/false node_exporter

# 创建 systemd 服务
sudo nano /etc/systemd/system/node_exporter.service
```

```ini
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter
```

## SSL 证书

### Let's Encrypt (免费)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d api.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

### 手动证书

```bash
# 生成自签名证书（仅用于测试）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/selfsigned.key \
    -out /etc/ssl/certs/selfsigned.crt
```

## 备份策略

### 1. 配置文件备份

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/web-proxy-api"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份配置
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /opt/web-proxy-api/config.yaml \
    /opt/web-proxy-api/accounts/

# 保留最近 30 天的备份
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +30 -delete

echo "Backup completed: config_$DATE.tar.gz"
```

### 2. 自动备份

```bash
# 添加到 crontab
0 2 * * * /opt/web-proxy-api/backup.sh
```

## 更新部署

### 零停机更新

```bash
#!/bin/bash
# update.sh

cd /opt/web-proxy-api

# 拉取最新代码
git pull origin main

# 安装依赖
bun install

# 构建
bun run build

# 重启服务（PM2 会自动实现零停机）
pm2 reload web-proxy-api

echo "Update completed"
```

### 回滚

```bash
#!/bin/bash
# rollback.sh

cd /opt/web-proxy-api

# 回滚到上一个版本
git reset --hard HEAD~1

# 重新构建
bun install
bun run build

# 重启
pm2 reload web-proxy-api

echo "Rollback completed"
```

## 故障排查

### 1. 服务无法启动

```bash
# 检查日志
pm2 logs web-proxy-api --lines 100

# 检查端口占用
sudo lsof -i :3000

# 检查配置文件
bun run build --dry-run
```

### 2. 内存泄漏

```bash
# 监控内存使用
pm2 monit

# 生成堆快照
node --inspect .output/server/index.mjs
```

### 3. 性能问题

```bash
# 检查 CPU 使用
top -p $(pgrep -f web-proxy-api)

# 检查网络连接
netstat -an | grep :3000

# 分析慢查询
# 启用详细日志
LOG_LEVEL=debug pm2 restart web-proxy-api
```

### 4. 连接问题

```bash
# 测试本地连接
curl http://localhost:3000/v1/models

# 测试外部连接
curl https://api.yourdomain.com/v1/models

# 检查防火墙
sudo ufw status
sudo iptables -L
```

## 安全加固

### 1. 防火墙配置

```bash
# UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# iptables
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### 2. 限制访问

```nginx
# Nginx 限流
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /v1/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://web_proxy_api;
}
```

### 3. 定期更新

```bash
# 系统更新
sudo apt update && sudo apt upgrade -y

# 依赖更新
bun update
```

## 相关文档

- [开发规范](DEVELOPMENT_STANDARDS.md)
- [架构设计](ARCHITECTURE.md)
- [安全规范](SECURITY.md)

---

最后更新: 2026-01-31
