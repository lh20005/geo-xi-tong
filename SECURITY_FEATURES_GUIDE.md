# GEO系统安全功能使用指南

## 目录
1. [概述](#概述)
2. [审计日志](#审计日志)
3. [权限管理](#权限管理)
4. [会话管理](#会话管理)
5. [密码安全](#密码安全)
6. [频率限制](#频率限制)
7. [安全配置](#安全配置)
8. [安全检查](#安全检查)
9. [异常检测](#异常检测)

---

## 概述

GEO系统实施了全面的安全加固措施，包括：
- ✅ 操作审计日志
- ✅ 细粒度权限控制
- ✅ 增强的会话管理
- ✅ 密码安全策略
- ✅ 操作频率限制
- ✅ 敏感操作二次确认
- ✅ 配置变更通知
- ✅ 每日安全检查
- ✅ 异常行为检测

---

## 审计日志

### 功能说明
系统自动记录所有敏感操作，包括：
- 用户管理操作（创建、修改、删除用户）
- 角色和权限变更
- 配置修改
- 密码重置
- 登录失败尝试

### 查看审计日志

**API端点**：`GET /api/audit-logs`

**查询参数**：
```javascript
{
  adminId: number,      // 按管理员ID筛选
  action: string,       // 按操作类型筛选
  targetType: string,   // 按目标类型筛选（user/config/system）
  startDate: Date,      // 开始日期
  endDate: Date,        // 结束日期
  page: number,         // 页码
  pageSize: number      // 每页数量
}
```

**示例**：
```bash
# 查询特定管理员的操作
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/audit-logs?adminId=1&page=1&pageSize=20"

# 查询特定时间范围的操作
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/audit-logs?startDate=2024-01-01&endDate=2024-12-31"
```

### 导出审计日志

**API端点**：`GET /api/audit-logs/export`

**支持格式**：JSON、CSV

**示例**：
```bash
# 导出为JSON
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/audit-logs/export?format=json" > audit-logs.json

# 导出为CSV
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/audit-logs/export?format=csv" > audit-logs.csv
```

---

## 权限管理

### 权限类型

系统支持以下细粒度权限：
- `view_users` - 查看用户列表
- `edit_users` - 编辑用户信息
- `delete_users` - 删除用户
- `edit_config` - 修改系统配置
- `view_logs` - 查看审计日志
- `view_config` - 查看安全配置
- `manage_permissions` - 管理权限

### 授予权限

**API端点**：`POST /api/permissions/grant`

**请求体**：
```json
{
  "userId": 123,
  "permission": "view_users"
}
```

**示例**：
```bash
curl -X POST http://localhost:3000/api/permissions/grant \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123, "permission": "view_users"}'
```

### 撤销权限

**API端点**：`POST /api/permissions/revoke`

**请求体**：
```json
{
  "userId": 123,
  "permission": "view_users"
}
```

### 查看用户权限

**API端点**：`GET /api/permissions/user/:userId`

**示例**：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/permissions/user/123"
```

---

## 会话管理

### 会话策略

- **Access Token有效期**：1小时
- **Refresh Token有效期**：7天
- **最大并发会话数**：5个
- **会话信息记录**：IP地址、User Agent、最后使用时间

### 查看活动会话

**API端点**：`GET /api/sessions`

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 123,
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-12-24T10:00:00Z",
      "lastUsedAt": "2024-12-24T14:30:00Z",
      "expiresAt": "2024-12-31T10:00:00Z"
    }
  ]
}
```

### 撤销会话

**撤销单个会话**：`DELETE /api/sessions/:sessionId`

**撤销所有其他会话**：`POST /api/sessions/revoke-others`

**示例**：
```bash
# 撤销特定会话
curl -X DELETE http://localhost:3000/api/sessions/123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 撤销所有其他会话（保留当前会话）
curl -X POST http://localhost:3000/api/sessions/revoke-others \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 密码变更时的会话处理

当用户修改密码时，系统会：
1. 保留当前会话（正在使用的会话）
2. 自动撤销所有其他会话
3. 要求其他设备重新登录

---

## 密码安全

### 密码策略

系统强制执行以下密码策略：
- ✅ 最小长度：8个字符
- ✅ 必须包含大写字母
- ✅ 必须包含小写字母
- ✅ 必须包含数字
- ✅ 防止重用最近5个密码
- ✅ 账户锁定：5次失败尝试后锁定15分钟

### 临时密码

管理员重置用户密码时：
1. 系统生成临时密码
2. 设置`is_temp_password`标记
3. 用户首次登录时必须修改密码
4. 临时密码超过7天会被安全检查标记

**修改临时密码**：
```bash
curl -X POST http://localhost:3000/api/auth/change-temp-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "NewSecurePass123"}'
```

### 账户锁定

**触发条件**：15分钟内5次登录失败

**锁定时长**：15分钟

**解锁方式**：
1. 等待15分钟自动解锁
2. 管理员手动解锁（通过重置密码）

---

## 频率限制

### 限制策略

系统对不同操作类型实施不同的频率限制：

| 操作类型 | 限制 | 时间窗口 |
|---------|------|---------|
| 登录 | 5次 | 15分钟 |
| 用户管理 | 10次 | 1小时 |
| 配置修改 | 20次 | 1小时 |
| API请求 | 100次 | 1小时 |

### 超限响应

当超过频率限制时：
- 返回HTTP 429状态码
- 响应头包含`Retry-After`信息
- 记录到审计日志
- 严重情况下可能触发IP封禁

**响应示例**：
```json
{
  "success": false,
  "message": "操作过于频繁，请稍后再试",
  "retryAfter": 900
}
```

### 查看剩余配额

**API端点**：`GET /api/rate-limit/quota`

**响应示例**：
```json
{
  "success": true,
  "data": {
    "remaining": 3,
    "limit": 5,
    "resetAt": "2024-12-24T15:00:00Z"
  }
}
```

---

## 安全配置

### 配置管理

系统提供集中的安全配置管理，所有配置变更都会：
- ✅ 记录历史版本
- ✅ 验证配置值
- ✅ 通知所有管理员
- ✅ 记录到审计日志

### 查看配置

**API端点**：`GET /api/security-config`

**示例**：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-config"
```

### 更新配置

**API端点**：`PUT /api/security-config/:key`

**请求体**：
```json
{
  "value": "10",
  "reason": "增加登录频率限制"
}
```

**示例**：
```bash
curl -X PUT http://localhost:3000/api/security-config/rate_limit.login.max_requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "10", "reason": "增加登录频率限制"}'
```

### 查看配置历史

**API端点**：`GET /api/security-config/:key/history`

**示例**：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-config/rate_limit.login.max_requests/history"
```

### 导出/导入配置

**导出配置**：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-config/actions/export" > security-config-backup.json
```

**导入配置**：
```bash
curl -X POST http://localhost:3000/api/security-config/actions/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @security-config-backup.json
```

### 可配置项

| 配置项 | 说明 | 默认值 | 范围 |
|-------|------|--------|------|
| `rate_limit.login.max_requests` | 登录频率限制次数 | 5 | 1-100 |
| `rate_limit.login.window_ms` | 登录频率限制窗口 | 900000 (15分钟) | 60000-3600000 |
| `session.timeout_ms` | 会话超时时间 | 86400000 (24小时) | 300000-604800000 |
| `session.max_concurrent` | 最大并发会话数 | 5 | 1-20 |
| `password.min_length` | 密码最小长度 | 8 | 6-128 |
| `account.lockout_threshold` | 账户锁定阈值 | 5 | 3-10 |
| `account.lockout_duration_ms` | 账户锁定时长 | 900000 (15分钟) | 300000-3600000 |
| `temp_password.expiry_days` | 临时密码过期天数 | 7 | 1-30 |

---

## 安全检查

### 每日安全检查

系统每天凌晨2点自动运行安全检查，包括：

1. **过期会话检查**
   - 检测并清理过期的refresh token
   - 超过10个过期会话时发出警告

2. **旧临时密码检查**
   - 查找超过7天的临时密码
   - 通知管理员提醒用户修改

3. **休眠管理员检查**
   - 识别90天未登录的管理员账户
   - 建议禁用或删除休眠账户

4. **数据库完整性检查**
   - 验证关键表存在
   - 检查管理员账户数量
   - 检查审计日志表大小

### 手动运行安全检查

虽然系统会自动运行，但管理员也可以手动触发：

```bash
# 通过API触发（需要实现对应端点）
curl -X POST http://localhost:3000/api/security-check/run \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 安全报告

检查完成后，系统会生成报告并发送给所有管理员：

**报告内容**：
- 检查时间
- 发现的问题数量（按严重程度分类）
- 详细问题列表
- 建议的处理措施

**报告示例**：
```
安全检查报告 (SEC-1703462400000)

检查时间: 2024/12/25 02:00:00

总结:
- 总检查项: 4
- 通过: 3
- 警告: 1
- 严重: 0

警告:
- old_temp_passwords: 2 个问题
  * 用户 testuser 的临时密码已过期 10 天
  * 用户 demo 的临时密码已过期 8 天
```

---

## 异常检测

### 检测类型

系统实时监控以下异常行为：

1. **新IP登录检测**
   - 检测用户从新IP地址登录
   - 发送通知给用户确认

2. **高频操作检测**
   - 检测5分钟内超过50次操作
   - 标记为可疑并发送警报

3. **账户妥协检测**
   - 检测从多个国家登录
   - 自动锁定账户并通知管理员

### 自动响应

系统会自动采取以下防护措施：

1. **暴力攻击防护**
   - 自动封禁攻击源IP（1小时）
   - 记录到安全事件日志

2. **账户保护**
   - 自动锁定疑似被盗账户
   - 撤销所有会话
   - 通知用户和管理员

3. **重新认证要求**
   - 可疑操作时要求重新登录
   - 敏感操作需要二次确认

### 查看安全事件

**API端点**：`GET /api/security-events`

**示例**：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-events?severity=critical&page=1"
```

---

## 最佳实践

### 管理员操作建议

1. **定期审查审计日志**
   - 每周检查一次审计日志
   - 关注异常操作模式

2. **及时处理安全警报**
   - 收到安全检查报告后立即处理
   - 不要忽略警告信息

3. **合理配置权限**
   - 遵循最小权限原则
   - 定期审查用户权限

4. **保护管理员账户**
   - 使用强密码
   - 定期更换密码
   - 不要共享管理员账户

5. **备份安全配置**
   - 定期导出安全配置
   - 保存配置备份

### 用户操作建议

1. **使用强密码**
   - 至少8个字符
   - 包含大小写字母和数字
   - 不要使用常见密码

2. **及时修改临时密码**
   - 收到临时密码后立即修改
   - 不要长期使用临时密码

3. **注意登录通知**
   - 收到新IP登录通知时确认是否为本人操作
   - 发现异常立即修改密码

4. **管理活动会话**
   - 定期检查活动会话
   - 撤销不认识的会话

---

## 故障排除

### 常见问题

**Q: 账户被锁定怎么办？**

A: 等待15分钟自动解锁，或联系管理员重置密码。

**Q: 为什么操作被拒绝（429错误）？**

A: 操作过于频繁，触发了频率限制。等待一段时间后重试。

**Q: 如何查看我的活动会话？**

A: 访问`GET /api/sessions`端点查看所有活动会话。

**Q: 临时密码在哪里修改？**

A: 使用临时密码登录后，系统会自动要求修改密码。

**Q: 配置修改后多久生效？**

A: 配置修改立即生效，但某些配置可能需要重启服务。

---

## 技术支持

如有问题，请联系系统管理员或查看：
- API文档：`/api/docs`
- 安全配置说明：`SECURITY_CONFIG_GUIDE.md`
- 故障排除指南：`SECURITY_TROUBLESHOOTING.md`
