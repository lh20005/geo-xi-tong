# 登录问题修复成功

## 问题描述
用户使用 `lzc2005` / `jehI2oBuNMMJehMM` 登录时返回 500 错误。

## 根本原因
1. **后端服务不断重启** - PM2 配置指向错误的路径
2. **管理员用户未创建** - `initializeDefaultAdmin()` 方法未被调用
3. **数据库表缺失列** - `users` 表缺少 `invitation_code`, `invited_by_code`, `is_temp_password` 列
4. **会话表不存在** - `refresh_tokens` 和 `login_attempts` 表未创建

## 修复步骤

### 1. 添加管理员初始化代码
修改 `server/src/index.ts`，在服务器启动时调用 `authService.initializeDefaultAdmin()`：

```typescript
import { authService } from './services/AuthService';

async function startServer() {
  try {
    // 初始化默认管理员账号
    console.log('👤 初始化管理员账号...');
    await authService.initializeDefaultAdmin();
    
    // ... 其他启动代码
  }
}
```

### 2. 更新 users 表结构
添加邀请码系统所需的列：

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_code VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT false;
```

### 3. 创建会话管理表
创建 `refresh_tokens` 和 `login_attempts` 表：

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT FALSE
);
```

### 4. 重新部署后端
```bash
# 本地构建
cd server && npm run build

# 部署到服务器
scp -r server/dist ubuntu@43.143.163.6:/var/www/geo-system/server/

# 重启 PM2
pm2 delete geo-backend
pm2 start /var/www/geo-system/server/dist/index.js --name geo-backend
pm2 save
```

## 验证结果

### 数据库状态
```sql
SELECT id, username, role, invitation_code FROM users;
```

结果：
```
 id | username | role  | invitation_code 
----+----------+-------+-----------------
  1 | admin    | admin | 
  2 | lzc2005  | admin | uzzx2k
```

### 登录测试
```bash
curl -X POST http://43.143.163.6/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"lzc2005","password":"jehI2oBuNMMJehMM"}'
```

返回：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": 3600,
    "user": {
      "id": 2,
      "username": "lzc2005",
      "email": null,
      "role": "admin",
      "invitationCode": "uzzx2k",
      "isTempPassword": false
    }
  }
}
```

## 当前状态
✅ 后端服务稳定运行  
✅ 管理员用户 `lzc2005` 已创建  
✅ 数据库表结构完整  
✅ 登录功能正常工作  
✅ JWT Token 和 Refresh Token 正常生成  

## 下一步
用户现在可以：
1. 访问 http://43.143.163.6 （落地页）
2. 点击"登录系统"按钮
3. 使用 `lzc2005` / `jehI2oBuNMMJehMM` 登录
4. 自动跳转到 http://43.143.163.6/app/ （客户端应用）
5. Token 会自动从 URL 参数中提取并存储

## 技术细节
- **服务器**: 43.143.163.6
- **后端端口**: 3000 (通过 Nginx 反向代理)
- **数据库**: PostgreSQL 16
- **PM2 进程**: geo-backend
- **日志位置**: `/home/ubuntu/.pm2/logs/geo-backend-*.log`
