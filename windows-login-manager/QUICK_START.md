# 快速开始指南

## 🚀 5分钟快速启动

本指南帮助你快速启动Windows平台登录管理器的完整系统（后端 + Electron应用）。

---

## 📋 前置要求

- Node.js 18+ 
- npm 或 yarn
- PostgreSQL 数据库（用于后端）
- Windows 10/11（用于Electron应用）

---

## 🔧 步骤1: 安装依赖

### 1.1 安装后端依赖

```bash
cd server
npm install
```

### 1.2 安装Electron应用依赖

```bash
cd windows-login-manager
npm install
```

---

## 🗄️ 步骤2: 配置数据库

### 2.1 创建数据库

```sql
CREATE DATABASE geo_optimization;
```

### 2.2 运行数据库迁移

```bash
cd server
npm run db:migrate
npm run db:migrate:publishing
```

---

## ⚙️ 步骤3: 配置环境变量

在项目根目录创建 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geo_optimization
DB_USER=your_username
DB_PASSWORD=your_password

# 服务器配置
PORT=3000

# JWT配置
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 加密密钥
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

---

## 🎯 步骤4: 启动服务

### 4.1 启动后端服务器

```bash
cd server
npm run dev
```

你应该看到：
```
✅ 加密服务初始化成功
✅ WebSocket服务器初始化成功
✅ WebSocket心跳检测已启动
🚀 服务器运行在 http://localhost:3000
🔌 WebSocket服务运行在 ws://localhost:3000/ws
```

### 4.2 启动Electron应用（新终端）

```bash
cd windows-login-manager
npm run electron:dev
```

应用将自动打开！

---

## ✅ 步骤5: 验证安装

### 5.1 测试后端API

```bash
# 测试健康检查
curl http://localhost:3000/api/health

# 测试登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 5.2 测试Electron应用

1. 应用应该自动打开
2. 你应该看到仪表板页面
3. 点击"平台选择"查看支持的平台
4. 点击"账号管理"查看账号列表

---

## 🎨 可选: 添加应用图标

### 方法1: 使用Python脚本生成

```bash
cd windows-login-manager
python scripts/create_icon.py
```

### 方法2: 使用自己的图标

将你的 `.ico` 文件复制到：
```
windows-login-manager/build/icon.ico
```

---

## 📦 构建安装包

```bash
cd windows-login-manager
npm run build:win
```

安装包将生成在 `windows-login-manager/release/` 目录。

---

## 🔍 故障排除

### 问题1: 后端启动失败

**错误**: `数据库连接失败`

**解决**:
1. 确认PostgreSQL正在运行
2. 检查 `.env` 文件中的数据库配置
3. 确认数据库已创建

### 问题2: Electron应用无法连接后端

**错误**: `无法连接到服务器`

**解决**:
1. 确认后端服务器正在运行（http://localhost:3000）
2. 在Electron应用的设置页面检查服务器地址
3. 检查防火墙设置

### 问题3: WebSocket连接失败

**错误**: `WebSocket连接失败`

**解决**:
1. 确认后端服务器正在运行
2. 检查端口3000是否被占用
3. 查看后端日志获取详细错误

### 问题4: 构建失败

**错误**: `找不到icon.ico`

**解决**:
1. 运行 `python scripts/create_icon.py` 生成图标
2. 或者将自己的图标复制到 `build/icon.ico`

---

## 📚 下一步

### 学习更多

- 📖 [用户手册](USER_GUIDE.md) - 详细的功能使用说明
- 🔧 [API文档](API_DOCUMENTATION.md) - 完整的API接口文档
- 🔌 [后端集成](BACKEND_API_INTEGRATION.md) - 后端API集成详情
- 🏗️ [构建说明](BUILD_INSTRUCTIONS.md) - 详细的构建和打包说明

### 开发指南

- 📝 [README](README.md) - 项目总览和架构
- 🎯 [任务完成情况](TASK_COMPLETION_SUMMARY.md) - 项目完成度

---

## 🆘 获取帮助

如果遇到问题：

1. 查看 [故障排除](#-故障排除) 部分
2. 查看后端日志: `server/logs/`
3. 查看Electron日志: 应用菜单 → 帮助 → 查看日志
4. 查看详细文档

---

## 🎉 成功！

如果一切正常，你现在应该有：

✅ 后端服务器运行在 http://localhost:3000  
✅ WebSocket服务运行在 ws://localhost:3000/ws  
✅ Electron应用正常运行  
✅ 可以登录平台并管理账号

**开始使用吧！** 🚀

---

**提示**: 首次使用时，建议先阅读 [用户手册](USER_GUIDE.md) 了解所有功能。
