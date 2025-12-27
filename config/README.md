# Config 目录说明

## 📁 目录结构

```
config/
├── nginx/                    # Nginx配置文件
│   ├── geo-system.conf      # ✅ 推荐使用的统一配置
│   ├── nginx-fixed.conf     # ✅ 当前服务器使用的配置（参考）
│   └── README.md            # Nginx配置详细说明
└── README.md                # 本文件
```

## 📋 文件说明

### Nginx 配置

#### ✅ geo-system.conf（推荐使用）
- **用途**：统一的生产环境Nginx配置
- **特点**：
  - 完整的路由配置
  - 静态文件部署
  - 安全头和Gzip压缩
  - 详细的注释说明
  - HTTPS配置模板
- **适用场景**：新部署或更新配置时使用

#### ✅ nginx-fixed.conf（参考）
- **用途**：当前腾讯云服务器使用的配置
- **特点**：已验证可用的配置
- **适用场景**：作为参考，了解当前配置

## 🚀 快速开始

### 部署到生产环境

1. **复制配置文件**
   ```bash
   sudo cp config/nginx/geo-system.conf /etc/nginx/sites-available/
   ```

2. **修改配置**
   ```bash
   sudo nano /etc/nginx/sites-available/geo-system.conf
   # 修改 server_name 为你的域名或IP
   ```

3. **启用配置**
   ```bash
   sudo ln -s /etc/nginx/sites-available/geo-system.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

详细说明请查看：[nginx/README.md](./nginx/README.md)

## 📝 配置原则

### 生产环境
- ✅ 使用静态文件部署（client/dist, landing/dist）
- ✅ 只有API和WebSocket使用代理
- ✅ 启用Gzip压缩
- ✅ 配置缓存策略
- ✅ 添加安全头

### 开发环境
- 使用代理模式（支持热重载）
- 无需Nginx配置
- 直接运行 `npm run dev:all`

## 🔧 维护说明

### 更新配置
1. 修改 `geo-system.conf`
2. 测试配置：`sudo nginx -t`
3. 重启Nginx：`sudo systemctl restart nginx`

### 备份配置
```bash
# 备份当前配置
sudo cp /etc/nginx/sites-available/geo-system.conf \
        /etc/nginx/sites-available/geo-system.conf.backup
```

### 回滚配置
```bash
# 恢复备份
sudo cp /etc/nginx/sites-available/geo-system.conf.backup \
        /etc/nginx/sites-available/geo-system.conf
sudo nginx -t
sudo systemctl restart nginx
```

## 🗑️ 已清理的文件

以下文件已被删除（有问题或过时）：
- ❌ nginx-production.conf（使用代理模式，不适合生产）
- ❌ nginx.conf.example（配置不完整）
- ❌ nginx.conf.production（配置错误）

## 📚 相关文档

- [Nginx配置详细说明](./nginx/README.md)
- [部署指南](../docs/03-部署指南/)
- [README.md](../README.md)

---

**更新时间：** 2025-12-27  
**版本：** 1.0.0
