# GEO系统安全故障排除指南

## 目录
1. [登录问题](#登录问题)
2. [会话问题](#会话问题)
3. [权限问题](#权限问题)
4. [频率限制问题](#频率限制问题)
5. [配置问题](#配置问题)
6. [通知问题](#通知问题)
7. [性能问题](#性能问题)
8. [数据库问题](#数据库问题)

---

## 登录问题

### 问题1: 账户被锁定

**症状**: 登录时提示"账户已被锁定，请15分钟后重试"

**原因**: 15分钟内登录失败次数超过5次

**解决方法**:

**方法1: 等待自动解锁**
- 等待15分钟后自动解锁
- 确保使用正确的密码

**方法2: 管理员手动解锁**
```sql
-- 连接到数据库
psql -U postgres -d geo_db

-- 重置失败计数
UPDATE users 
SET failed_login_attempts = 0, 
    locked_until = NULL 
WHERE username = 'USERNAME';
```

**方法3: 重置密码**
```bash
# 管理员重置用户密码
curl -X POST http://localhost:3000/api/users/reset-password \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123, "newPassword": "TempPass123"}'
```

**预防措施**:
- 使用密码管理器避免输入错误
- 如果经常忘记密码，考虑提高锁定阈值

### 问题2: 临时密码无法登录

**症状**: 使用管理员重置的临时密码无法登录

**可能原因**:
1. 临时密码已过期（超过7天）
2. 密码输入错误
3. 临时密码标记未正确设置

**解决方法**:

**检查临时密码状态**:
```sql
SELECT username, is_temp_password, created_at 
FROM users 
WHERE username = 'USERNAME';
```

**重新生成临时密码**:
```bash
curl -X POST http://localhost:3000/api/users/reset-password \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123}'
```

### 问题3: 登录后立即要求修改密码

**症状**: 登录成功但被重定向到修改密码页面

**原因**: 账户使用临时密码

**解决方法**:
- 这是正常行为，按提示修改密码即可
- 新密码必须符合密码策略（至少8字符，包含大小写字母和数字）

---

## 会话问题

### 问题4: Token过期频繁

**症状**: 频繁提示"会话已过期，请重新登录"

**原因**: Access token有效期太短（默认1小时）

**解决方法**:

**方法1: 使用refresh token自动刷新**
```javascript
// 前端实现自动刷新
async function refreshAccessToken() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken')
    })
  });
  
  const data = await response.json();
  localStorage.setItem('accessToken', data.accessToken);
}
```

**方法2: 延长token有效期**
```bash
curl -X PUT http://localhost:3000/api/security-config/session.access_token_expiry_ms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "7200000", "reason": "延长至2小时"}'
```

### 问题5: 修改密码后所有设备被登出

**症状**: 修改密码后，其他设备上的登录会话全部失效

**原因**: 这是安全特性，密码变更会撤销所有其他会话

**解决方法**:
- 这是正常行为，无需修复
- 在其他设备上重新登录即可
- 当前设备的会话会被保留

### 问题6: 超过最大会话数限制

**症状**: 登录时提示"已达到最大会话数限制"

**原因**: 用户的活动会话数超过5个

**解决方法**:

**方法1: 撤销旧会话**
```bash
# 查看所有活动会话
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/sessions"

# 撤销特定会话
curl -X DELETE http://localhost:3000/api/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# 撤销所有其他会话
curl -X POST http://localhost:3000/api/sessions/revoke-others \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**方法2: 增加最大会话数**
```bash
curl -X PUT http://localhost:3000/api/security-config/session.max_concurrent \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "10", "reason": "增加并发会话限制"}'
```

---

## 权限问题

### 问题7: 403 Forbidden错误

**症状**: 访问某些功能时返回403错误

**原因**: 用户没有所需权限

**解决方法**:

**检查用户权限**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/permissions/user/USER_ID"
```

**授予权限**:
```bash
curl -X POST http://localhost:3000/api/permissions/grant \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123, "permission": "view_users"}'
```

**可用权限列表**:
- `view_users` - 查看用户列表
- `edit_users` - 编辑用户信息
- `delete_users` - 删除用户
- `edit_config` - 修改系统配置
- `view_logs` - 查看审计日志
- `view_config` - 查看安全配置
- `manage_permissions` - 管理权限

### 问题8: 管理员无法删除用户

**症状**: 删除用户时提示"无法删除最后一个管理员"

**原因**: 系统保护机制，防止删除最后一个管理员

**解决方法**:
1. 先创建或提升另一个管理员
2. 然后再删除目标用户

```bash
# 提升用户为管理员
curl -X PUT http://localhost:3000/api/users/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

## 频率限制问题

### 问题9: 429 Too Many Requests错误

**症状**: 操作时提示"操作过于频繁，请稍后再试"

**原因**: 触发了频率限制

**解决方法**:

**方法1: 等待限制重置**
- 查看响应头中的`Retry-After`值
- 等待指定时间后重试

**方法2: 检查剩余配额**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/rate-limit/quota"
```

**方法3: 调整频率限制（管理员）**
```bash
# 增加登录频率限制
curl -X PUT http://localhost:3000/api/security-config/rate_limit.login.max_requests \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "10", "reason": "用户反馈限制过严"}'
```

### 问题10: IP被封禁

**症状**: 所有请求都返回403，提示IP被封禁

**原因**: 检测到暴力攻击或异常行为

**解决方法**:

**检查封禁状态**:
```bash
# 在Redis中查看
redis-cli
> GET blocked_ip:YOUR_IP_ADDRESS
```

**手动解除封禁**:
```bash
redis-cli
> DEL blocked_ip:YOUR_IP_ADDRESS
```

**预防措施**:
- 避免频繁失败的登录尝试
- 使用正确的凭据
- 如果是合法操作，联系管理员调整限制

---

## 配置问题

### 问题11: 配置更新失败

**症状**: 更新配置时返回错误

**可能原因**:
1. 配置值不符合验证规则
2. 权限不足
3. 配置键不存在

**解决方法**:

**检查验证规则**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-config/CONFIG_KEY"
```

**查看错误详情**:
```bash
# 响应会包含具体的验证错误
{
  "success": false,
  "message": "配置值必须在1到100之间"
}
```

### 问题12: 配置导入失败

**症状**: 导入配置备份时失败

**解决方法**:

**验证JSON格式**:
```bash
# 使用jq验证JSON
cat backup.json | jq .
```

**逐个导入配置**:
```bash
# 不要一次导入所有配置，逐个导入以定位问题
for key in $(jq -r '.configs[].key' backup.json); do
  value=$(jq -r ".configs[] | select(.key==\"$key\") | .value" backup.json)
  curl -X PUT "http://localhost:3000/api/security-config/$key" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"value\": \"$value\", \"reason\": \"恢复备份\"}"
done
```

---

## 通知问题

### 问题13: 未收到配置变更通知

**症状**: 修改配置后没有收到邮件通知

**可能原因**:
1. 邮件服务未配置
2. 邮件地址错误
3. 邮件被垃圾邮件过滤器拦截

**解决方法**:

**检查邮件配置**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-config" | grep notification.email
```

**检查用户邮箱**:
```sql
SELECT id, username, email FROM users WHERE role = 'admin';
```

**测试邮件发送**:
```bash
# 手动触发测试通知
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com"}'
```

**检查邮件日志**:
```bash
# 查看服务器日志
tail -f server/logs/app.log | grep notification
```

### 问题14: 通知延迟

**症状**: 配置变更后很久才收到通知

**原因**: 通知批处理机制（5分钟窗口）

**解决方法**:
- 这是正常行为，用于合并多个变更
- 如需立即通知，可以缩短批处理窗口：

```bash
curl -X PUT http://localhost:3000/api/security-config/notification.batch_window_ms \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "60000", "reason": "缩短至1分钟"}'
```

---

## 性能问题

### 问题15: 审计日志查询缓慢

**症状**: 查询审计日志时响应很慢

**原因**: 审计日志表数据量大，缺少索引

**解决方法**:

**检查索引**:
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'audit_logs';
```

**创建缺失的索引**:
```sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
```

**定期清理旧日志**:
```sql
-- 删除90天前的日志
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
```

### 问题16: Redis连接失败

**症状**: 频率限制、会话管理等功能异常

**原因**: Redis服务未启动或连接配置错误

**解决方法**:

**检查Redis状态**:
```bash
redis-cli ping
# 应该返回 PONG
```

**启动Redis**:
```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis
```

**检查连接配置**:
```bash
# 查看.env文件
cat .env | grep REDIS
```

---

## 数据库问题

### 问题17: 数据库连接失败

**症状**: 服务启动失败，提示数据库连接错误

**解决方法**:

**检查PostgreSQL状态**:
```bash
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

**启动PostgreSQL**:
```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

**验证连接信息**:
```bash
# 查看.env文件
cat .env | grep DB_

# 测试连接
psql -U postgres -d geo_db -c "SELECT 1;"
```

### 问题18: 迁移脚本执行失败

**症状**: 运行迁移脚本时出错

**解决方法**:

**检查已执行的迁移**:
```sql
SELECT * FROM schema_migrations ORDER BY version;
```

**手动执行迁移**:
```bash
psql -U postgres -d geo_db -f server/migrations/XXX_migration_name.sql
```

**回滚迁移**:
```sql
-- 根据具体迁移脚本的回滚部分执行
```

---

## 紧急情况处理

### 紧急情况1: 所有管理员被锁定

**症状**: 所有管理员账户都被锁定，无法登录

**解决方法**:

**直接修改数据库**:
```sql
-- 解锁所有管理员
UPDATE users 
SET failed_login_attempts = 0, 
    locked_until = NULL 
WHERE role = 'admin';
```

### 紧急情况2: 系统遭受攻击

**症状**: 大量异常请求，系统响应缓慢

**立即措施**:

1. **启用紧急锁定模式**（如果实现）
2. **临时降低频率限制阈值**
3. **封禁攻击源IP**

```bash
# 降低登录限制
curl -X PUT http://localhost:3000/api/security-config/rate_limit.login.max_requests \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "2", "reason": "应对攻击"}'

# 手动封禁IP
redis-cli SET blocked_ip:ATTACKER_IP "1" EX 3600
```

4. **查看安全事件日志**
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/security-events?severity=critical"
```

### 紧急情况3: 配置错误导致服务不可用

**症状**: 修改配置后服务无法访问

**解决方法**:

**回滚配置**:
```bash
# 查看配置历史
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/security-config/CONFIG_KEY/history"

# 如果API不可用，直接修改数据库
psql -U postgres -d geo_db
UPDATE security_config 
SET value = 'OLD_VALUE' 
WHERE key = 'CONFIG_KEY';
```

**重启服务**:
```bash
# 重启后端服务
pm2 restart geo-server

# 或者
npm run server
```

---

## 日志和调试

### 启用详细日志

```bash
# 修改.env文件
LOG_LEVEL=debug

# 重启服务
npm run server
```

### 查看实时日志

```bash
# 后端日志
tail -f server/logs/app.log

# 安全事件日志
tail -f server/logs/security.log

# 审计日志（数据库）
psql -U postgres -d geo_db -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;"
```

### 常用调试命令

```bash
# 检查所有服务状态
brew services list

# 检查端口占用
lsof -i :3000
lsof -i :5432
lsof -i :6379

# 检查系统资源
top
df -h
```

---

## 获取帮助

如果以上方法都无法解决问题，请：

1. **收集信息**:
   - 错误消息
   - 相关日志
   - 操作步骤
   - 系统环境

2. **查看文档**:
   - `SECURITY_FEATURES_GUIDE.md`
   - `SECURITY_CONFIG_GUIDE.md`
   - `API_SECURITY_GUIDE.md`

3. **联系技术支持**:
   - 提供收集的信息
   - 说明已尝试的解决方法
