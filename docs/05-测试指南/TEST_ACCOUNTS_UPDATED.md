# 测试账户说明

## 当前可用的测试账户

### 1. 管理员账户
- **用户名**: `admin`
- **密码**: （请使用原始密码）
- **角色**: 管理员 (admin)
- **权限**: 
  - 所有普通用户权限
  - 用户管理权限
  - 系统配置权限

### 2. 普通测试账户 - test
- **用户名**: `test`
- **密码**: （请使用原始密码）
- **角色**: 普通用户 (user)
- **邀请码**: （查看数据库）

### 3. 普通测试账户 - testuser ✨ 新创建
- **用户名**: `testuser`
- **密码**: `password123`
- **角色**: 普通用户 (user)
- **邀请码**: `suvboa`
- **状态**: 激活
- **临时密码**: 否

### 4. 其他测试账户
- `testuser_1766557078` - 带时间戳的测试用户
- `testuser_1766557091` - 带时间戳的测试用户
- `invited_1766557203` - 被邀请的用户

## 登录测试

### 在营销网站登录 (http://localhost:8080)
1. 访问 http://localhost:8080/login
2. 输入用户名: `testuser`
3. 输入密码: `password123`
4. 点击登录
5. 登录成功后会跳转到首页
6. 导航栏会显示"个人中心"和"进入系统"按钮

### 进入前端系统
1. 在营销网站登录后
2. 点击导航栏的"进入系统"按钮
3. 自动跳转到前端系统 (http://localhost:5173)
4. Token 会自动传递，无需再次登录

## 数据库信息

### 数据库类型
- **类型**: PostgreSQL
- **数据库名**: `geo_system`
- **用户**: `lzc`
- **连接字符串**: `postgresql://lzc@localhost:5432/geo_system`

### 查询所有用户
```sql
SELECT id, username, role, invitation_code, is_active, is_temp_password, created_at 
FROM users 
ORDER BY created_at;
```

### 查询特定用户
```sql
SELECT * FROM users WHERE username = 'testuser';
```

## 邀请码生成规则

邀请码由系统自动生成，遵循以下规则：

### 格式规范
- **长度**: 固定 6 个字符
- **字符集**: 只包含小写字母和数字 (`a-z0-9`)
- **正则表达式**: `^[a-z0-9]{6}$`
- **示例**: `suvboa`, `xr2w8q`, `d50t3s`

### 生成算法
```typescript
// 使用 crypto.randomBytes 生成加密安全的随机邀请码
const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 6;
const bytes = crypto.randomBytes(CODE_LENGTH);
let code = '';

for (let i = 0; i < CODE_LENGTH; i++) {
  const index = bytes[i] % CHARSET.length;
  code += CHARSET[index];
}
```

### 唯一性保证
- 生成后会检查数据库中是否已存在
- 如果冲突，会自动重试（最多 10 次）
- 确保每个用户的邀请码都是唯一的

### 验证规则
1. 长度必须是 6 个字符
2. 只能包含小写字母 (a-z) 和数字 (0-9)
3. 不允许大写字母、特殊字符或空格
4. 必须在数据库中存在才能用于邀请

## 创建新测试账户

如果需要创建新的测试账户，可以使用以下步骤：

### 1. 生成密码哈希
```bash
cd server
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password', 10).then(hash => console.log(hash));"
```

### 2. 生成邀请码（6位小写字母+数字）
```bash
node -e "const crypto = require('crypto'); const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'; const CODE_LENGTH = 6; const bytes = crypto.randomBytes(CODE_LENGTH); let code = ''; for (let i = 0; i < CODE_LENGTH; i++) { const index = bytes[i] % CHARSET.length; code += CHARSET[index]; } console.log(code);"
```

### 3. 插入用户
```sql
INSERT INTO users (
  username, 
  password_hash, 
  role, 
  invitation_code, 
  is_active, 
  is_temp_password, 
  created_at, 
  updated_at
) VALUES (
  'new_username',
  'password_hash_from_step1',
  'user',
  'INVITE_CODE_FROM_STEP2',
  true,
  false,
  NOW(),
  NOW()
);
```

## 注意事项

1. **密码安全**: 
   - 所有密码都使用 bcrypt 加密存储
   - 加密轮数为 10

2. **邀请码**:
   - 必须是唯一的
   - 长度为 6 个字符
   - 建议使用大写字母和数字组合

3. **用户角色**:
   - `admin`: 管理员，拥有所有权限
   - `user`: 普通用户，只能访问基本功能

4. **账户状态**:
   - `is_active`: 账户是否激活
   - `is_temp_password`: 是否使用临时密码（首次登录需要修改）

## 测试场景

### 场景 1: 普通用户登录流程
1. 使用 `testuser` / `password123` 登录营销网站
2. 查看个人中心页面
3. 点击"进入系统"进入前端应用
4. 测试各项功能

### 场景 2: 管理员功能测试
1. 使用 `admin` 账户登录
2. 导航栏会显示"用户管理"按钮
3. 可以访问用户管理页面
4. 可以创建、编辑、删除用户

### 场景 3: 邀请功能测试
1. 登录任意账户
2. 访问个人中心
3. 复制邀请码
4. 使用邀请码注册新用户
5. 查看邀请统计

## 故障排查

### 问题: 无法登录
1. 检查用户名是否正确（区分大小写）
2. 检查密码是否正确
3. 检查账户是否激活 (`is_active = true`)
4. 查看服务器日志

### 问题: 数据库连接失败
1. 确认 PostgreSQL 服务正在运行
2. 检查 `.env` 文件中的 `DATABASE_URL` 配置
3. 确认数据库 `geo_system` 存在
4. 确认用户 `lzc` 有访问权限

### 问题: Token 传递失败
1. 检查浏览器控制台是否有错误
2. 确认 localStorage 中有 token
3. 检查 URL 参数是否正确传递
4. 查看网络请求

## 相关文件

- `.env` - 环境变量配置
- `server/src/db/database.ts` - 数据库连接配置
- `server/src/routes/auth.ts` - 认证路由
- `landing/src/pages/LoginPage.tsx` - 营销网站登录页面
- `client/src/pages/LoginPage.tsx` - 前端系统登录页面
- `landing/src/components/Header.tsx` - 营销网站导航栏组件
