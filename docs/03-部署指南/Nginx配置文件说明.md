# Nginx 配置文件说明

## 📁 配置文件位置

### 项目中的配置文件（示例）

```
config/nginx/
├── nginx.conf.example        # 主应用 Nginx 配置示例
├── nginx.conf.production     # 生产环境 Nginx 配置
└── nginx-production.conf     # 生产环境配置（备用）

landing/
└── nginx.conf.example        # Landing 页面 Nginx 配置示例
```

### 服务器上的配置文件（实际使用）

```
/etc/nginx/
├── nginx.conf                # Nginx 主配置文件
├── sites-available/          # 可用的站点配置
│   └── geo-system           # 我们的应用配置
└── sites-enabled/            # 启用的站点配置
    └── geo-system -> ../sites-available/geo-system
```

## ❓ 为什么移动配置文件不会影响程序？

### 1. Nginx 配置是手动部署的

这些 `.conf` 文件只是**示例模板**，不会被程序自动读取。部署时需要：

```bash
# 手动复制配置文件到 Nginx 目录
sudo cp config/nginx/nginx.conf.example /etc/nginx/sites-available/geo-system

# 或者直接创建配置文件
sudo nano /etc/nginx/sites-available/geo-system
```

### 2. 程序不会读取这些文件

- Node.js 应用（server/）不会读取 Nginx 配置
- React 应用（client/）不会读取 Nginx 配置
- Nginx 只读取 `/etc/nginx/` 目录下的配置

### 3. 配置文件的作用

这些文件只是：
- ✅ 部署时的参考模板
- ✅ 文档和示例
- ✅ 版本控制的一部分

## 📝 使用方法

### 方法一：使用 config/nginx/ 中的配置

```bash
# 1. 复制配置文件
sudo cp config/nginx/nginx.conf.example /etc/nginx/sites-available/geo-system

# 2. 编辑配置（替换域名、路径等）
sudo nano /etc/nginx/sites-available/geo-system

# 3. 启用配置
sudo ln -s /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/

# 4. 测试配置
sudo nginx -t

# 5. 重启 Nginx
sudo systemctl restart nginx
```

### 方法二：使用 landing/nginx.conf.example

```bash
# landing/deploy.sh 脚本会自动使用这个文件
cd landing
sudo ./deploy.sh
```

## 🔍 配置文件对比

### config/nginx/nginx.conf.example
- **用途**：主应用的 Nginx 配置
- **包含**：前端、后端 API、WebSocket、Landing 页面
- **适用**：完整部署

### landing/nginx.conf.example
- **用途**：只部署 Landing 页面
- **包含**：只有 Landing 页面的配置
- **适用**：单独部署营销网站

### config/nginx/nginx.conf.production
- **用途**：生产环境优化配置
- **包含**：性能优化、安全加固、SSL 配置
- **适用**：正式上线

## ✅ 验证配置

### 检查配置文件是否存在

```bash
# 检查项目中的配置文件
ls -la config/nginx/
ls -la landing/nginx.conf.example

# 检查服务器上的配置文件
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/
```

### 测试 Nginx 配置

```bash
# 测试配置语法
sudo nginx -t

# 查看当前配置
sudo nginx -T

# 重新加载配置
sudo nginx -s reload
```

## 📚 相关文档

- [README.md](../README.md) - 第六步：配置 Nginx
- [腾讯云快速部署指南](./03-部署指南/腾讯云快速部署指南.md)
- [Landing 页面部署指南](./03-部署指南/LANDING_DEPLOYMENT_GUIDE.md)

## 🎯 总结

**移动配置文件到 `config/nginx/` 不会影响程序运行，因为：**

1. ✅ 这些文件只是示例模板
2. ✅ 程序不会自动读取它们
3. ✅ 部署时需要手动复制到 `/etc/nginx/`
4. ✅ 移动后更容易管理和查找

**唯一需要注意的是：**
- `landing/nginx.conf.example` 仍在 landing 目录中
- `landing/deploy.sh` 脚本会使用这个文件
- 这个文件不需要移动，保持原位即可

---

**更新时间：** 2024年12月26日  
**状态：** ✅ 配置文件整理完成，不影响程序运行
