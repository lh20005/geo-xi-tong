# GEO系统安全配置详细指南

## 目录
1. [配置概述](#配置概述)
2. [频率限制配置](#频率限制配置)
3. [会话管理配置](#会话管理配置)
4. [密码策略配置](#密码策略配置)
5. [账户安全配置](#账户安全配置)
6. [异常检测配置](#异常检测配置)
7. [通知配置](#通知配置)
8. [配置管理API](#配置管理api)

---

## 配置概述

GEO系统的安全配置采用集中管理方式，所有配置存储在 `security_config` 表中。配置系统具有以下特性：

- ✅ **版本控制**：所有配置变更都记录历史版本
- ✅ **验证机制**：配置值在应用前会进行验证
- ✅ **变更通知**：配置修改会通知所有管理员
- ✅ **审计日志**：所有配置操作记录到审计日志
- ✅ **导入导出**：支持配置备份和恢复

### 配置结构

每个配置项包含：
- `key`: 配置键（唯一标识）
- `value`: 配置值（字符串格式）
- `description`: 配置说明
- `category`: 配置分类
- `validation_rule`: 验证规则（JSON格式）
- `updated_at`: 最后更新时间
- `updated_by`: 更新者ID

---

## 频率限制配置

### 登录频率限制

**配置键**: `rate_limit.login.max_requests`

**说明**: 限制时间窗口内的最大登录尝试次数

**默认值**: `5`

**验证规则**:
```json
{
  "type": "number",
  "min": 1,
  "max": 100
}
```

**建议值**:
- 高安全环境: 3-5次
- 标准环境: 5-10次
- 低风险环境: 10-20次

**配置键**: `rate_limit.login.window_ms`

**说明**: 登录频率限制的时间窗口（毫秒）

**默认值**: `900000` (15分钟)

**验证规则**:
```json
{
  "type": "number",
  "min": 60000,
  "max": 3600000
}
```

**建议值**:
- 高安全: 300000 (5分钟)
- 标准: 900000 (15分钟)
- 宽松: 1800000 (30分钟)

### 用户管理操作频率限制

**配置键**: `rate_limit.user_management.max_requests`

**默认值**: `10`

**说明**: 限制1小时内的用户管理操作次数（创建、修改、删除用户）

**配置键**: `rate_limit.user_management.window_ms`

**默认值**: `3600000` (1小时)

### 配置修改频率限制

**配置键**: `rate_limit.config_change.max_requests`

**默认值**: `20`

**说明**: 限制1小时内的配置修改次数

**配置键**: `rate_limit.config_change.window_ms`

**默认值**: `3600000` (1小时)

### API请求频率限制

**配置键**: `rate_limit.api.max_requests`

**默认值**: `100`

**说明**: 限制1小时内的API请求总数

**配置键**: `rate_limit.api.window_ms`

**默认值**: `3600000` (1小时)

---

## 会话管理配置

### Access Token有效期

**配置键**: `session.access_token_expiry_ms`

**默认值**: `3600000` (1小时)

**验证规则**:
```json
{
  "type": "number",
  "min": 300000,
  "max": 86400000
}
```

**建议值**:
- 高安全: 900000 (15分钟)
- 标准: 3600000 (1小时)
- 便利优先: 14400000 (4小时)

### Refresh Token有效期

**配置键**: `session.refresh_token_expiry_ms`

**默认值**: `604800000` (7天)

**验证规则**:
```json
{
  "type": "number",
  "min": 86400000,
  "max": 2592000000
}
```

**建议值**:
- 高安全: 86400000 (1天)
- 标准: 604800000 (7天)
- 便利优先: 2592000000 (30天)

### 会话超时

**配置键**: `session.timeout_ms`

**默认值**: `86400000` (24小时)

**说明**: 会话无活动后的超时时间

**验证规则**:
```json
{
  "type": "number",
  "min": 300000,
  "max": 604800000
}
```

### 最大并发会话数

**配置键**: `session.max_concurrent`

**默认值**: `5`

**说明**: 每个用户允许的最大同时活动会话数

**验证规则**:
```json
{
  "type": "number",
  "min": 1,
  "max": 20
}
```

**建议值**:
- 严格控制: 1-2个
- 标准: 3-5个
- 宽松: 5-10个

---

## 密码策略配置

### 密码最小长度

**配置键**: `password.min_length`

**默认值**: `8`

**验证规则**:
```json
{
  "type": "number",
  "min": 6,
  "max": 128
}
```

**建议值**:
- 高安全: 12-16字符
- 标准: 8-12字符
- 最低要求: 6-8字符

### 密码复杂度要求

**配置键**: `password.require_uppercase`

**默认值**: `true`

**说明**: 是否要求包含大写字母

**配置键**: `password.require_lowercase`

**默认值**: `true`

**说明**: 是否要求包含小写字母

**配置键**: `password.require_numbers`

**默认值**: `true`

**说明**: 是否要求包含数字

**配置键**: `password.require_special_chars`

**默认值**: `false`

**说明**: 是否要求包含特殊字符

### 密码重用防止

**配置键**: `password.history_count`

**默认值**: `5`

**说明**: 防止重用最近N个密码

**验证规则**:
```json
{
  "type": "number",
  "min": 0,
  "max": 24
}
```

**建议值**:
- 高安全: 10-24个
- 标准: 5-10个
- 基础: 3-5个

---

## 账户安全配置

### 账户锁定阈值

**配置键**: `account.lockout_threshold`

**默认值**: `5`

**说明**: 触发账户锁定的失败登录次数

**验证规则**:
```json
{
  "type": "number",
  "min": 3,
  "max": 10
}
```

**建议值**:
- 高安全: 3次
- 标准: 5次
- 宽松: 8-10次

### 账户锁定时长

**配置键**: `account.lockout_duration_ms`

**默认值**: `900000` (15分钟)

**验证规则**:
```json
{
  "type": "number",
  "min": 300000,
  "max": 3600000
}
```

**建议值**:
- 严格: 1800000 (30分钟)
- 标准: 900000 (15分钟)
- 宽松: 300000 (5分钟)

### 临时密码过期时间

**配置键**: `temp_password.expiry_days`

**默认值**: `7`

**说明**: 临时密码的有效天数

**验证规则**:
```json
{
  "type": "number",
  "min": 1,
  "max": 30
}
```

**建议值**:
- 高安全: 1-3天
- 标准: 7天
- 宽松: 14-30天

### 休眠账户检测

**配置键**: `account.dormant_days`

**默认值**: `90`

**说明**: 多少天未登录视为休眠账户

**验证规则**:
```json
{
  "type": "number",
  "min": 30,
  "max": 365
}
```

---

## 异常检测配置

### 高频操作阈值

**配置键**: `anomaly.high_frequency_threshold`

**默认值**: `50`

**说明**: 5分钟内操作次数超过此值视为异常

**验证规则**:
```json
{
  "type": "number",
  "min": 10,
  "max": 1000
}
```

### 高频操作时间窗口

**配置键**: `anomaly.high_frequency_window_ms`

**默认值**: `300000` (5分钟)

**验证规则**:
```json
{
  "type": "number",
  "min": 60000,
  "max": 3600000
}
```

### IP封禁时长

**配置键**: `anomaly.ip_block_duration_ms`

**默认值**: `3600000` (1小时)

**说明**: 检测到攻击时封禁IP的时长

**验证规则**:
```json
{
  "type": "number",
  "min": 300000,
  "max": 86400000
}
```

### 新IP登录通知

**配置键**: `anomaly.notify_new_ip_login`

**默认值**: `true`

**说明**: 是否在检测到新IP登录时发送通知

---

## 通知配置

### 邮件服务配置

**配置键**: `notification.email.enabled`

**默认值**: `true`

**说明**: 是否启用邮件通知

**配置键**: `notification.email.smtp_host`

**说明**: SMTP服务器地址

**配置键**: `notification.email.smtp_port`

**默认值**: `587`

**配置键**: `notification.email.from_address`

**说明**: 发件人邮箱地址

### 通知批处理

**配置键**: `notification.batch_window_ms`

**默认值**: `300000` (5分钟)

**说明**: 配置变更通知的批处理时间窗口

**验证规则**:
```json
{
  "type": "number",
  "min": 60000,
  "max": 1800000
}
```

### 通知重试

**配置键**: `notification.max_retries`

**默认值**: `3`

**说明**: 通知发送失败时的最大重试次数

**验证规则**:
```json
{
  "type": "number",
  "min": 0,
  "max": 10
}
```

---

## 配置管理API

### 查看所有配置

```bash
GET /api/security-config
Authorization: Bearer YOUR_TOKEN
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "key": "rate_limit.login.max_requests",
      "value": "5",
      "description": "登录频率限制次数",
      "category": "rate_limit",
      "updatedAt": "2024-12-24T10:00:00Z",
      "updatedBy": 1
    }
  ]
}
```

### 查看单个配置

```bash
GET /api/security-config/:key
Authorization: Bearer YOUR_TOKEN
```

### 更新配置

```bash
PUT /api/security-config/:key
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "value": "10",
  "reason": "增加登录频率限制以应对攻击"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "配置已更新",
  "data": {
    "key": "rate_limit.login.max_requests",
    "value": "10",
    "oldValue": "5",
    "updatedAt": "2024-12-24T15:30:00Z",
    "updatedBy": 1
  }
}
```

### 查看配置历史

```bash
GET /api/security-config/:key/history
Authorization: Bearer YOUR_TOKEN
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "configKey": "rate_limit.login.max_requests",
      "oldValue": "5",
      "newValue": "10",
      "changedBy": 1,
      "changedAt": "2024-12-24T15:30:00Z",
      "reason": "增加登录频率限制以应对攻击",
      "ipAddress": "192.168.1.100"
    }
  ]
}
```

### 导出配置

```bash
GET /api/security-config/actions/export
Authorization: Bearer YOUR_TOKEN
```

**响应**: JSON文件包含所有配置

### 导入配置

```bash
POST /api/security-config/actions/import
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "configs": [
    {
      "key": "rate_limit.login.max_requests",
      "value": "10"
    }
  ],
  "reason": "恢复备份配置"
}
```

---

## 配置最佳实践

### 1. 定期备份配置

建议每周导出一次安全配置作为备份：

```bash
# 导出配置
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-config/actions/export" \
  > security-config-backup-$(date +%Y%m%d).json
```

### 2. 渐进式调整

修改安全配置时，建议采用渐进式方法：
1. 先在测试环境验证
2. 小幅度调整（如从5改为7，而不是直接改为20）
3. 观察影响并收集反馈
4. 根据实际情况进一步调整

### 3. 监控配置影响

修改配置后，应监控以下指标：
- 用户投诉数量
- 锁定账户数量
- 频率限制触发次数
- 系统性能指标

### 4. 文档化配置变更

每次修改配置时，应在 `reason` 字段中详细说明：
- 变更原因
- 预期效果
- 相关事件或问题

### 5. 定期审查配置

建议每季度审查一次安全配置：
- 检查是否符合当前安全需求
- 评估配置的有效性
- 根据威胁变化调整策略

---

## 常见配置场景

### 场景1: 遭受暴力攻击

**问题**: 系统遭受大量登录尝试攻击

**解决方案**:
```bash
# 降低登录频率限制阈值
curl -X PUT http://localhost:3000/api/security-config/rate_limit.login.max_requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "3", "reason": "应对暴力攻击"}'

# 缩短时间窗口
curl -X PUT http://localhost:3000/api/security-config/rate_limit.login.window_ms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "300000", "reason": "应对暴力攻击"}'
```

### 场景2: 用户频繁被锁定

**问题**: 正常用户因忘记密码频繁触发账户锁定

**解决方案**:
```bash
# 提高锁定阈值
curl -X PUT http://localhost:3000/api/security-config/account.lockout_threshold \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "8", "reason": "减少误锁定"}'

# 缩短锁定时长
curl -X PUT http://localhost:3000/api/security-config/account.lockout_duration_ms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "300000", "reason": "减少用户等待时间"}'
```

### 场景3: 提高安全级别

**问题**: 需要提高整体安全级别

**解决方案**:
```bash
# 增加密码长度要求
curl -X PUT http://localhost:3000/api/security-config/password.min_length \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "12", "reason": "提高安全级别"}'

# 缩短会话有效期
curl -X PUT http://localhost:3000/api/security-config/session.access_token_expiry_ms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "1800000", "reason": "提高安全级别"}'

# 限制并发会话
curl -X PUT http://localhost:3000/api/security-config/session.max_concurrent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "2", "reason": "提高安全级别"}'
```

---

## 故障排除

### 问题: 配置更新失败

**可能原因**:
1. 配置值不符合验证规则
2. 权限不足
3. 配置键不存在

**解决方法**:
```bash
# 检查配置键是否存在
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/security-config/YOUR_CONFIG_KEY"

# 查看验证规则
# 在响应中查看 validation_rule 字段
```

### 问题: 配置导入失败

**可能原因**:
1. JSON格式错误
2. 包含无效的配置键
3. 配置值不符合验证规则

**解决方法**:
1. 验证JSON格式
2. 检查每个配置项的验证规则
3. 逐个导入配置项以定位问题

---

## 技术支持

如需帮助，请参考：
- 安全功能指南: `SECURITY_FEATURES_GUIDE.md`
- 故障排除指南: `SECURITY_TROUBLESHOOTING.md`
- API文档: `/api/docs`
