# 用户管理增强功能

## 概述

用户管理增强功能为系统添加了完整的用户注册、认证、管理和邀请系统。该功能包括：

- ✅ 用户注册和登录
- ✅ 邀请码推荐系统
- ✅ 管理员用户管理界面
- ✅ 实时跨平台同步（WebSocket）
- ✅ 限流保护（防止暴力破解）
- ✅ 密码安全（bcrypt 哈希）
- ✅ 全面的属性测试覆盖

## 快速开始

### 1. 环境配置

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：

```bash
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/geo_system

# JWT 密钥（生产环境请使用强密钥）
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 2. 数据库迁移

执行数据库迁移以添加用户管理所需的表和字段：

```bash
cd server
npm run migrate:user-management
```

详细迁移指南请参考：[DATABASE_MIGRATION_GUIDE.md](./DATABASE_MIGRATION_GUIDE.md)

### 3. 启动服务

```bash
# 启动后端服务器
cd server
npm run dev

# 启动前端（另一个终端）
cd landing
npm run dev

# 启动客户端应用（可选）
cd client
npm run dev
```

### 4. 测试功能

访问 `http://localhost:5173` 测试以下功能：

1. **注册新用户**
   - 访问注册页面
   - 输入用户名和密码
   - 可选：输入邀请码

2. **登录**
   - 使用注册的账号登录
   - 系统会自动生成 JWT 令牌

3. **查看个人资料**
   - 查看自己的邀请码
   - 查看邀请统计

4. **管理员功能**（需要管理员权限）
   - 查看所有用户
   - 编辑用户信息
   - 重置用户密码
   - 删除用户

## 核心功能

### 1. 用户注册

- 用户名：3-20个字符，字母数字下划线
- 密码：最少6个字符
- 自动生成唯一的6字符邀请码
- 可选：使用邀请码注册建立推荐关系
- 注册成功后自动登录

### 2. 邀请系统

每个用户都有一个唯一的邀请码，可以：
- 分享邀请码给其他人
- 查看自己邀请了多少人
- 查看被邀请用户列表

### 3. 用户管理（管理员）

管理员可以：
- 查看所有用户列表（支持搜索和分页）
- 查看用户详细信息
- 编辑用户名和角色
- 重置用户密码（生成临时密码）
- 删除用户

### 4. 实时同步

使用 WebSocket 实现跨平台实时同步：
- 用户信息更新时，所有平台立即同步
- 用户被删除时，所有会话立即终止
- 密码被修改时，旧令牌立即失效

### 5. 安全保护

#### 限流保护
- **登录限流**：15分钟内最多5次失败尝试
- **注册限流**：每小时最多3次注册
- 防止暴力破解和恶意注册

#### 密码安全
- 使用 bcrypt 哈希（10轮盐）
- 密码不以明文存储
- API 响应中不包含密码信息
- 支持临时密码（管理员重置后必须修改）

#### 会话管理
- JWT 访问令牌（1小时有效期）
- 刷新令牌（7天有效期）
- 密码修改后自动使旧令牌失效

## API 文档

完整的 API 文档请参考：[USER_MANAGEMENT_API.md](./USER_MANAGEMENT_API.md)

### 主要端点

```
认证：
POST   /api/auth/register      - 用户注册
POST   /api/auth/login         - 用户登录
POST   /api/auth/logout        - 用户登出

用户资料：
GET    /api/users/profile      - 获取当前用户资料
PUT    /api/users/password     - 修改密码

邀请系统：
GET    /api/invitations/stats  - 获取邀请统计
POST   /api/invitations/validate - 验证邀请码

管理员：
GET    /api/admin/users        - 获取用户列表
GET    /api/admin/users/:id    - 获取用户详情
PUT    /api/admin/users/:id    - 更新用户信息
POST   /api/admin/users/:id/reset-password - 重置密码
DELETE /api/admin/users/:id    - 删除用户
```

## 测试

### 运行测试

```bash
cd server
npm test
```

### 测试覆盖

- ✅ 单元测试：核心功能和边界情况
- ✅ 属性测试：使用 fast-check 进行属性验证
- ✅ 集成测试：API 端点和数据库交互

测试文件：
- `server/src/__tests__/invitation.property.test.ts` - 邀请服务属性测试
- `server/src/__tests__/auth.property.test.ts` - 认证服务属性测试
- `server/src/__tests__/user-service.property.test.ts` - 用户服务属性测试

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Landing    │  │    Client    │  │   Windows    │          │
│  │   Website    │  │     App      │  │     App      │          │
│  │ [User Mgmt]  │  │ [Data Sync]  │  │ [Data Sync]  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
     ┌────▼──────────────────▼──────────────────▼────┐
     │              API Gateway (Express)             │
     │         + WebSocket Server (ws)                │
     └────────────────────┬───────────────────────────┘
                          │
     ┌────────────────────┼────────────────────┐
     │                    │                    │
┌────▼─────┐      ┌──────▼──────┐      ┌─────▼──────┐
│   Auth   │      │    User     │      │ Invitation │
│ Service  │      │   Service   │      │  Service   │
└────┬─────┘      └──────┬──────┘      └─────┬──────┘
     │                   │                    │
     └───────────────────┼────────────────────┘
                         │
                 ┌───────▼────────┐
                 │   PostgreSQL   │
                 │    Database    │
                 └────────────────┘
```

## 数据模型

### Users 表

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  invitation_code VARCHAR(6) UNIQUE NOT NULL,
  invited_by_code VARCHAR(6),
  role VARCHAR(20) DEFAULT 'user',
  is_temp_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  
  CONSTRAINT fk_invited_by FOREIGN KEY (invited_by_code) 
    REFERENCES users(invitation_code) ON DELETE SET NULL
);
```

### Login Attempts 表

```sql
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT FALSE
);
```

## 配置选项

### JWT 配置

```bash
JWT_SECRET=your-secret-key              # 访问令牌密钥
JWT_REFRESH_SECRET=your-refresh-secret  # 刷新令牌密钥
JWT_EXPIRES_IN=1h                       # 访问令牌有效期
REFRESH_TOKEN_EXPIRES_IN=7d             # 刷新令牌有效期
```

### 限流配置

```bash
LOGIN_RATE_LIMIT=5                      # 登录失败次数限制
LOGIN_RATE_WINDOW_MINUTES=15            # 登录限流时间窗口
REGISTRATION_RATE_LIMIT=3               # 注册次数限制
REGISTRATION_RATE_WINDOW_HOURS=1        # 注册限流时间窗口
```

## 故障排除

### 问题1：无法注册用户

**可能原因：**
- 用户名已存在
- 密码太短（少于6个字符）
- 达到注册限流限制

**解决方案：**
- 使用不同的用户名
- 使用更长的密码
- 等待1小时后重试

### 问题2：登录失败

**可能原因：**
- 用户名或密码错误
- 达到登录限流限制

**解决方案：**
- 检查用户名和密码
- 等待15分钟后重试
- 联系管理员重置密码

### 问题3：WebSocket 连接失败

**可能原因：**
- JWT 令牌无效或过期
- WebSocket 服务未启动

**解决方案：**
- 重新登录获取新令牌
- 检查服务器日志
- 确认 WebSocket 端口配置正确

### 问题4：邀请码无效

**可能原因：**
- 邀请码格式错误（必须是6个字符）
- 邀请码不存在

**解决方案：**
- 检查邀请码格式
- 向邀请者确认正确的邀请码
- 可以不使用邀请码直接注册

## 安全最佳实践

1. **生产环境配置**
   - 使用强 JWT 密钥（至少32个字符）
   - 启用 HTTPS
   - 配置 CORS 白名单
   - 定期更新依赖包

2. **密码策略**
   - 建议在前端增加密码强度检查
   - 考虑增加密码复杂度要求
   - 定期提醒用户更改密码

3. **监控和日志**
   - 监控失败登录尝试
   - 记录所有管理员操作
   - 设置异常登录告警

4. **备份**
   - 定期备份数据库
   - 测试恢复流程
   - 保留多个备份版本

## 性能优化

1. **数据库优化**
   - 已创建必要的索引
   - 定期执行 VACUUM 和 ANALYZE
   - 监控慢查询

2. **缓存策略**
   - 考虑使用 Redis 缓存用户会话
   - 缓存邀请统计数据
   - 实现查询结果缓存

3. **WebSocket 优化**
   - 限制每个用户的连接数
   - 实现心跳机制
   - 自动清理断开的连接

## 未来增强

计划中的功能：
- [ ] 邮箱验证
- [ ] 双因素认证（2FA）
- [ ] 社交登录（OAuth）
- [ ] 密码找回功能
- [ ] 用户活动日志
- [ ] 更详细的邀请奖励系统

## 贡献

欢迎提交问题和改进建议！

## 许可证

[您的许可证]

---

**版本**: 1.0  
**最后更新**: 2024-12-24
