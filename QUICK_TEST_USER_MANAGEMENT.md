# 用户管理系统快速测试指南

## 🚀 启动服务

### 1. 启动后端服务器

```bash
cd server
npm install  # 如果还没安装依赖
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 2. 启动前端（营销网站）

```bash
cd landing
npm install  # 如果还没安装依赖
npm run dev
```

前端将在 `http://localhost:5174` 启动

## 📝 测试步骤

### 测试 1: 用户注册

1. 访问 `http://localhost:5174/register`
2. 填写信息：
   - 用户名: `testuser1`（3-20字符，字母数字下划线）
   - 密码: `password123`（至少6字符）
   - 确认密码: `password123`
   - 邀请码: 留空（可选）
3. 观察密码强度指示器变化
4. 点击"注册"按钮
5. **预期结果**: 
   - 显示"注册成功！正在跳转..."
   - 自动跳转到客户端应用（`http://localhost:5173`）
   - Token 已保存到 localStorage

### 测试 2: 用户登录

1. 访问 `http://localhost:5174/login`
2. 输入刚才注册的用户名和密码
3. 点击"登录"按钮
4. **预期结果**: 
   - 显示"登录成功！正在跳转..."
   - 跳转到客户端应用

### 测试 3: 查看个人资料

1. 访问 `http://localhost:5174/profile`
2. **预期结果**: 
   - 显示用户基本信息（用户名、角色、注册时间）
   - 显示邀请码（6位小写字母数字）
   - 显示邀请统计（当前为0）
3. 点击"复制"按钮复制邀请码
4. **预期结果**: 按钮文字变为"已复制!"

### 测试 4: 修改密码

1. 在个人资料页面点击"修改密码"按钮
2. 填写信息：
   - 当前密码: `password123`
   - 新密码: `newpassword123`
   - 确认新密码: `newpassword123`
3. 观察密码强度指示器
4. 点击"确认修改"
5. **预期结果**: 
   - 显示成功消息
   - 模态框关闭
6. 退出登录，使用新密码重新登录验证

### 测试 5: 使用邀请码注册

1. 复制第一个用户的邀请码（从个人资料页面）
2. 退出登录
3. 访问 `http://localhost:5174/register`
4. 填写信息：
   - 用户名: `testuser2`
   - 密码: `password123`
   - 确认密码: `password123`
   - 邀请码: 粘贴刚才复制的邀请码
5. **预期结果**: 
   - 输入邀请码后显示"✓ 有效邀请码 (来自 testuser1)"
6. 完成注册
7. 使用 `testuser1` 登录，访问个人资料
8. **预期结果**: 
   - 邀请统计显示"累计邀请: 1"
   - 受邀用户列表显示 `testuser2`

### 测试 6: 创建管理员账号

在数据库中执行：

```sql
-- 方法1: 修改现有用户为管理员
UPDATE users SET role = 'admin' WHERE username = 'testuser1';

-- 方法2: 直接创建管理员账号
INSERT INTO users (username, password_hash, role, invitation_code)
VALUES (
  'admin',
  '$2b$10$YourHashedPasswordHere',  -- 使用 bcrypt 哈希
  'admin',
  'admin1'
);
```

或者使用 Node.js 脚本创建：

```javascript
// create-admin.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/geo_saas'
});

async function createAdmin() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  
  await pool.query(
    'INSERT INTO users (username, password_hash, role, invitation_code) VALUES ($1, $2, $3, $4)',
    ['admin', hash, 'admin', 'admin1']
  );
  
  console.log('管理员账号创建成功！');
  console.log('用户名: admin');
  console.log('密码: admin123');
  process.exit(0);
}

createAdmin();
```

### 测试 7: 用户管理（管理员功能）

1. 使用管理员账号登录
2. 访问 `http://localhost:5174/profile`
3. **预期结果**: 看到"用户管理"按钮
4. 点击"用户管理"按钮
5. **预期结果**: 
   - 跳转到 `/admin/users`
   - 显示用户列表表格
   - 显示所有用户信息

### 测试 8: 搜索用户

1. 在用户管理页面的搜索框输入 `test`
2. **预期结果**: 
   - 500ms 后自动搜索
   - 只显示包含 "test" 的用户名
3. 清空搜索框
4. **预期结果**: 显示所有用户

### 测试 9: 查看用户详情

1. 在用户列表中点击某个用户的"查看详情"按钮
2. **预期结果**: 
   - 弹出用户详情模态框
   - 显示完整用户信息
   - 显示邀请码
   - 显示注册时间和最后登录时间

### 测试 10: 编辑用户信息

1. 在用户详情模态框中点击"编辑信息"
2. 修改用户名或角色
3. 点击"保存"
4. **预期结果**: 
   - 显示成功消息
   - 用户信息更新
   - 列表刷新

### 测试 11: 重置用户密码

1. 在用户详情模态框中点击"重置密码"
2. 在确认对话框中点击"确认重置"
3. **预期结果**: 
   - 显示临时密码（8位随机字符）
   - 可以复制临时密码
4. 退出登录
5. 使用该用户名和临时密码登录
6. **预期结果**: 
   - 登录成功后立即显示"必须修改密码"模态框
   - 不能关闭模态框
7. 输入新密码并确认
8. **预期结果**: 
   - 密码修改成功
   - 跳转到客户端应用

### 测试 12: 删除用户

1. 在用户详情模态框中点击"删除用户"
2. 在确认对话框中点击"确认删除"
3. **预期结果**: 
   - 用户被删除
   - 模态框关闭
   - 用户列表刷新，该用户不再显示

### 测试 13: 权限控制

1. 使用普通用户账号登录
2. 尝试访问 `http://localhost:5174/admin/users`
3. **预期结果**: 
   - 自动重定向到 `/profile`
   - 无法访问用户管理页面

### 测试 14: 未登录访问保护

1. 清除 localStorage（或使用无痕模式）
2. 尝试访问 `http://localhost:5174/profile`
3. **预期结果**: 
   - 自动重定向到 `/login`
4. 尝试访问 `http://localhost:5174/admin/users`
5. **预期结果**: 
   - 自动重定向到 `/login`

## 🔍 API 测试（可选）

使用 curl 或 Postman 测试 API：

### 注册

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "apitest",
    "password": "password123",
    "invitationCode": "abc123"
  }'
```

### 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "apitest",
    "password": "password123"
  }'
```

### 获取个人资料

```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 获取邀请统计

```bash
curl -X GET http://localhost:3000/api/invitations/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 获取用户列表（管理员）

```bash
curl -X GET "http://localhost:3000/api/admin/users?page=1&pageSize=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## ✅ 测试检查清单

- [ ] 用户注册成功
- [ ] 用户登录成功
- [ ] 查看个人资料
- [ ] 复制邀请码
- [ ] 修改密码
- [ ] 使用邀请码注册
- [ ] 邀请统计正确
- [ ] 管理员可以访问用户管理
- [ ] 搜索用户功能正常
- [ ] 查看用户详情
- [ ] 编辑用户信息
- [ ] 重置用户密码
- [ ] 临时密码强制修改流程
- [ ] 删除用户
- [ ] 普通用户无法访问管理页面
- [ ] 未登录用户自动重定向

## 🐛 常见问题

### 1. 无法连接到后端

**问题**: 前端显示网络错误

**解决**:
- 确认后端服务器正在运行（`http://localhost:3000`）
- 检查 `landing/src/config/env.ts` 中的 API URL 配置
- 查看浏览器控制台的错误信息

### 2. 登录后无法跳转

**问题**: 登录成功但停留在登录页面

**解决**:
- 检查 `config.clientUrl` 配置
- 确认客户端应用正在运行（`http://localhost:5173`）
- 查看浏览器控制台日志

### 3. 邀请码验证失败

**问题**: 输入邀请码后显示无效

**解决**:
- 确认邀请码格式正确（6位小写字母数字）
- 检查数据库中是否存在该邀请码
- 查看网络请求响应

### 4. 管理员无法访问用户管理

**问题**: 管理员账号无法看到用户管理按钮

**解决**:
- 确认数据库中用户的 `role` 字段为 `'admin'`
- 清除 localStorage 并重新登录
- 检查 localStorage 中的 `user_info` 数据

### 5. 临时密码流程不工作

**问题**: 使用临时密码登录后没有强制修改密码

**解决**:
- 确认数据库中用户的 `is_temp_password` 字段为 `true`
- 检查登录响应中的 `isTempPassword` 字段
- 查看浏览器控制台日志

## 📊 测试数据示例

### 用户数据

| 用户名 | 密码 | 角色 | 邀请码 | 被邀请码 |
|--------|------|------|--------|----------|
| admin | admin123 | admin | admin1 | - |
| testuser1 | password123 | user | abc123 | - |
| testuser2 | password123 | user | def456 | abc123 |
| testuser3 | password123 | user | ghi789 | abc123 |

### 邀请关系

```
admin (admin1)
testuser1 (abc123)
  ├── testuser2 (def456)
  └── testuser3 (ghi789)
```

## 🎉 测试完成

如果所有测试都通过，恭喜！用户管理系统已经完全可用。

如果遇到问题，请查看：
- 浏览器控制台日志
- 后端服务器日志
- 数据库数据
- 网络请求详情

需要帮助？查看以下文档：
- [实现总结](FRONTEND_IMPLEMENTATION_COMPLETE.md)
- [任务列表](.kiro/specs/user-management-enhancement/tasks.md)
- [设计文档](.kiro/specs/user-management-enhancement/design.md)
