# 统一认证系统说明

## 🎯 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      统一认证系统                              │
│                                                               │
│  ┌──────────────┐              ┌──────────────┐              │
│  │   服务端     │              │   数据库     │              │
│  │              │              │              │              │
│  │ /api/auth/   │◄────────────►│   users表    │              │
│  │  - login     │              │   - admin    │              │
│  │  - logout    │              │   - ...      │              │
│  │  - refresh   │              │              │              │
│  └──────┬───────┘              └──────────────┘              │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
          │ 同一套API
          │ 同一个用户数据库
          │ 同一套JWT认证
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌─────────┐ ┌─────────┐
│ 网页端  │ │Windows端│
│         │ │         │
│ Token A │ │ Token B │
│ (独立)  │ │ (独立)  │
└─────────┘ └─────────┘
```

## ✅ 统一认证的含义

### 1. 同一套服务端API
- 网页端和Windows端都调用 `http://localhost:3000/api/auth/login`
- 使用相同的认证逻辑
- 使用相同的JWT密钥

### 2. 同一个用户数据库
- 共享 `users` 表
- 使用相同的用户账号（admin/admin123）
- 密码加密方式一致（bcrypt）

### 3. 同一套认证机制
- JWT token认证
- 访问令牌（1小时）+ 刷新令牌（7天）
- Token自动刷新机制

### 4. 独立的Token存储
- **网页端**: localStorage
- **Windows端**: Electron安全存储
- 各自管理自己的token

### 5. 共享的数据访问
- 登录后都能访问同一套数据
- 账号列表、平台配置等
- WebSocket实时同步

## 🔄 工作流程

### 网页端登录流程
```
1. 用户访问 http://localhost:5173
2. 显示登录页面
3. 输入 admin/admin123
4. 调用 POST /api/auth/login
5. 服务端验证用户（查询users表）
6. 返回 JWT token
7. 保存到 localStorage
8. 初始化 WebSocket 连接
9. 可以访问所有数据
```

### Windows端登录流程
```
1. 启动 Windows 应用
2. 显示登录页面
3. 输入 admin/admin123
4. 调用 POST /api/auth/login（同一个API）
5. 服务端验证用户（同一个users表）
6. 返回 JWT token
7. 保存到 Electron 安全存储
8. 初始化 WebSocket 连接
9. 可以访问所有数据（同一套数据）
```

## 📊 数据共享示例

### 场景1: 账号列表
```
网页端登录 → 查看账号列表 → 看到账号A、B、C
Windows端登录 → 查看账号列表 → 看到账号A、B、C（同样的数据）
```

### 场景2: 删除账号
```
网页端: 删除账号A
  ↓
服务端: 广播 WebSocket 事件
  ↓
网页端: 实时更新（账号A消失）
Windows端: 实时更新（账号A消失）
```

### 场景3: 创建账号
```
Windows端: 创建账号D
  ↓
服务端: 保存到数据库 + 广播事件
  ↓
网页端: 实时显示账号D
Windows端: 实时显示账号D
```

## 🔐 安全性

### Token隔离
- 网页端的token和Windows端的token是**独立的**
- 一端登出不影响另一端
- 各自管理自己的token生命周期

### 认证一致性
- 使用相同的JWT密钥
- 使用相同的加密算法
- 使用相同的验证逻辑

## 🧪 测试验证

### 测试1: 同一账号登录
```bash
# 网页端
1. 访问 http://localhost:5173
2. 登录 admin/admin123
3. 成功进入系统

# Windows端
1. 启动应用
2. 登录 admin/admin123（同一个账号）
3. 成功进入系统
```

### 测试2: 数据一致性
```bash
# 网页端
1. 查看账号列表 → 3个账号

# Windows端
1. 查看账号列表 → 3个账号（相同）
```

### 测试3: 实时同步
```bash
# Windows端
1. 删除一个账号

# 网页端
1. 自动更新（账号消失）
2. 无需刷新页面
```

## 📝 关键代码位置

### 服务端
- 认证API: `server/src/routes/auth.ts`
- 用户服务: `server/src/services/AuthService.ts`
- 用户表: `users` (PostgreSQL)

### 网页端
- 登录页面: `client/src/pages/LoginPage.tsx`
- API客户端: `client/src/api/client.ts`
- Token存储: localStorage

### Windows端
- 登录页面: `windows-login-manager/src/pages/Login.tsx`
- API客户端: `windows-login-manager/electron/api/client.ts`
- Token存储: Electron Store (加密)

## ✨ 优势

1. **统一管理**: 一个用户数据库，统一管理所有用户
2. **数据一致**: 两端访问同一套数据，保证一致性
3. **实时同步**: WebSocket实时推送，两端同步更新
4. **安全隔离**: Token独立存储，互不影响
5. **灵活部署**: 可以独立部署和使用

## 🎉 总结

这就是**真正的统一认证系统**：
- ✅ 同一套API
- ✅ 同一个数据库
- ✅ 同一套认证机制
- ✅ 独立的登录流程
- ✅ 共享的数据访问
- ✅ 实时的数据同步

**不是**"登录一次两端都能用"，而是"两端分别登录，但使用同一套系统和数据"！
