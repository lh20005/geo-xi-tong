# GEO系统安全最佳实践

## 目录
1. [管理员安全](#管理员安全)
2. [密码管理](#密码管理)
3. [会话管理](#会话管理)
4. [权限管理](#权限管理)
5. [配置管理](#配置管理)
6. [监控和审计](#监控和审计)
7. [事件响应](#事件响应)
8. [定期维护](#定期维护)

---

## 管理员安全

### 1. 保护管理员账户

**强密码策略**:
- 使用至少12个字符的密码
- 包含大小写字母、数字和特殊字符
- 不要使用个人信息（姓名、生日等）
- 不要在多个系统使用相同密码

**示例强密码**: `Ge0$ecur3!2024@Adm`

**密码管理器**:
- 使用密码管理器（如1Password、LastPass）
- 为每个系统生成唯一密码
- 定期更新主密码

### 2. 定期更换密码

**建议频率**:
- 管理员密码: 每90天
- 普通用户密码: 每180天
- 临时密码: 立即更换

**更换密码时**:
```bash
# 登录后修改密码
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPass123",
    "newPassword": "NewSecurePass456"
  }'
```

### 3. 限制管理员数量

**原则**: 最小权限原则
- 只授予必要的管理员权限
- 定期审查管理员列表
- 移除不再需要的管理员账户

**检查管理员列表**:
```sql
SELECT id, username, email, created_at, last_login_at 
FROM users 
WHERE role = 'admin' 
ORDER BY last_login_at DESC;
```

### 4. 监控管理员活动

**定期检查**:
- 审计日志中的管理员操作
- 异常时间的登录（如深夜）
- 异常IP地址的访问

```bash
# 查看管理员操作日志
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/audit-logs?adminId=1&page=1"
```

---

## 密码管理

### 1. 密码策略配置

**推荐配置**:
```bash
# 最小长度12字符
curl -X PUT http://localhost:3000/api/security-config/password.min_length \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "12", "reason": "提高安全性"}'

# 防止重用最近10个密码
curl -X PUT http://localhost:3000/api/security-config/password.history_count \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "10", "reason": "防止密码重用"}'
```

### 2. 临时密码管理

**最佳实践**:
- 临时密码应在24小时内修改
- 通过安全渠道发送临时密码（不要通过邮件明文发送）
- 定期检查未修改的临时密码

**检查临时密码**:
```sql
SELECT username, email, created_at 
FROM users 
WHERE is_temp_password = true 
  AND created_at < NOW() - INTERVAL '7 days';
```

### 3. 密码重置流程

**安全流程**:
1. 验证用户身份（邮箱、手机号）
2. 生成临时密码
3. 通过安全渠道发送
4. 设置短期有效期
5. 要求首次登录时修改

---

## 会话管理

### 1. 会话超时配置

**推荐配置**:
```bash
# Access Token: 1小时
curl -X PUT http://localhost:3000/api/security-config/session.access_token_expiry_ms \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "3600000", "reason": "标准配置"}'

# Refresh Token: 7天
curl -X PUT http://localhost:3000/api/security-config/session.refresh_token_expiry_ms \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "604800000", "reason": "标准配置"}'
```

### 2. 管理活动会话

**定期检查**:
```bash
# 查看自己的活动会话
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/sessions"

# 撤销不认识的会话
curl -X DELETE http://localhost:3000/api/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. 密码变更后的会话处理

**自动处理**:
- 系统会自动撤销所有其他会话
- 保留当前会话
- 其他设备需要重新登录

**手动撤销所有会话**:
```bash
curl -X POST http://localhost:3000/api/sessions/revoke-others \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 权限管理

### 1. 最小权限原则

**原则**: 只授予完成工作所需的最小权限

**权限分配示例**:
- 内容编辑: `view_users`
- 用户管理员: `view_users`, `edit_users`
- 系统管理员: 所有权限

### 2. 定期权限审查

**审查频率**: 每季度一次

**审查内容**:
- 用户是否仍需要当前权限
- 是否有权限滥用
- 是否需要调整权限

**查看用户权限**:
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/permissions/user/USER_ID"
```

### 3. 权限变更记录

**所有权限变更都会记录到审计日志**:
```bash
# 查看权限变更历史
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/audit-logs?action=grant_permission"
```

---

## 配置管理

### 1. 配置变更流程

**标准流程**:
1. 在测试环境验证
2. 记录变更原因
3. 通知相关人员
4. 执行变更
5. 监控影响
6. 必要时回滚

### 2. 配置备份

**定期备份**:
```bash
# 每周备份一次
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/security-config/actions/export" \
  > security-config-backup-$(date +%Y%m%d).json

# 保存到安全位置
mv security-config-backup-*.json /secure/backup/location/
```

### 3. 配置文档化

**记录内容**:
- 配置项的用途
- 当前值和原因
- 变更历史
- 相关依赖

**示例**:
```markdown
## rate_limit.login.max_requests

**当前值**: 5
**设置原因**: 平衡安全性和用户体验
**最后修改**: 2024-12-20
**修改人**: admin@example.com
**变更原因**: 应对暴力攻击
```

---

## 监控和审计

### 1. 审计日志审查

**审查频率**: 每周一次

**重点关注**:
- 失败的登录尝试
- 权限变更
- 配置修改
- 用户删除操作

**查询示例**:
```bash
# 查看失败的登录
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/audit-logs?action=login_failed&startDate=2024-12-01"

# 查看权限变更
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/audit-logs?action=grant_permission"
```

### 2. 安全事件监控

**实时监控**:
- 设置告警规则
- 关注关键安全事件
- 及时响应异常

**查看安全事件**:
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/security-events?severity=critical"
```

### 3. 定期安全报告

**报告内容**:
- 安全事件统计
- 异常行为分析
- 配置变更记录
- 改进建议

**生成报告**:
- 系统每日自动生成安全检查报告
- 管理员每周生成人工审查报告
- 每月生成综合安全报告

---

## 事件响应

### 1. 安全事件分类

**严重程度**:
- **Critical**: 账户被盗、数据泄露
- **High**: 暴力攻击、权限滥用
- **Medium**: 异常登录、配置错误
- **Low**: 单次登录失败、正常操作

### 2. 响应流程

**Critical事件**:
1. 立即锁定受影响账户
2. 撤销所有会话
3. 通知所有管理员
4. 调查事件原因
5. 采取补救措施
6. 记录事件报告

**High事件**:
1. 封禁攻击源IP
2. 加强监控
3. 通知相关管理员
4. 分析攻击模式
5. 调整安全策略

### 3. 事后分析

**分析内容**:
- 事件时间线
- 攻击方式
- 影响范围
- 响应效果
- 改进措施

---

## 定期维护

### 1. 每日任务

**自动执行**:
- 清理过期会话
- 检查临时密码
- 识别休眠账户
- 数据库完整性检查

**手动检查**:
- 查看安全检查报告
- 处理告警通知

### 2. 每周任务

**审查内容**:
- 审计日志
- 安全事件
- 系统性能
- 备份状态

**维护操作**:
```bash
# 导出审计日志
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/audit-logs/export?format=csv" \
  > audit-logs-$(date +%Y%m%d).csv

# 备份配置
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:3000/api/security-config/actions/export" \
  > config-backup-$(date +%Y%m%d).json
```

### 3. 每月任务

**全面审查**:
- 用户权限审查
- 配置合理性评估
- 安全策略更新
- 性能优化

**清理操作**:
```sql
-- 清理90天前的审计日志
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- 清理过期的配置历史
DELETE FROM security_config_history WHERE created_at < NOW() - INTERVAL '180 days';
```

### 4. 每季度任务

**深度审查**:
- 完整的安全审计
- 渗透测试
- 灾难恢复演练
- 安全培训

---

## 安全检查清单

### 日常检查清单

- [ ] 查看安全检查报告
- [ ] 处理安全告警
- [ ] 检查系统日志
- [ ] 验证备份完成

### 周检查清单

- [ ] 审查审计日志
- [ ] 检查用户活动
- [ ] 验证配置正确
- [ ] 导出日志备份
- [ ] 更新安全文档

### 月检查清单

- [ ] 权限审查
- [ ] 配置优化
- [ ] 性能评估
- [ ] 清理旧数据
- [ ] 生成月度报告

### 季度检查清单

- [ ] 完整安全审计
- [ ] 密码策略评估
- [ ] 灾难恢复测试
- [ ] 安全培训
- [ ] 策略更新

---

## 安全文化

### 1. 安全意识培训

**培训内容**:
- 密码安全
- 钓鱼攻击识别
- 社会工程学防范
- 安全操作规范

### 2. 安全责任

**明确责任**:
- 每个用户对自己的账户安全负责
- 管理员对系统安全负责
- 发现安全问题及时报告

### 3. 持续改进

**改进机制**:
- 定期评估安全措施
- 收集用户反馈
- 跟踪安全趋势
- 更新安全策略

---

## 参考资源

**内部文档**:
- `SECURITY_FEATURES_GUIDE.md` - 功能使用指南
- `SECURITY_CONFIG_GUIDE.md` - 配置详细说明
- `SECURITY_TROUBLESHOOTING.md` - 故障排除
- `API_SECURITY_GUIDE.md` - API安全文档

**外部资源**:
- OWASP Top 10
- NIST Cybersecurity Framework
- CIS Controls

---

## 联系方式

**安全问题报告**:
- 邮箱: security@example.com
- 紧急热线: [电话号码]

**技术支持**:
- 邮箱: support@example.com
- 工作时间: 周一至周五 9:00-18:00
