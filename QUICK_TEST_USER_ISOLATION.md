# 快速测试用户隔离修复

## 🚀 快速开始

### 1. 运行自动化测试
```bash
cd server
npx ts-node src/scripts/test-user-isolation-fix.ts
```

预期输出：
```
🧪 开始测试用户隔离修复...

📝 准备测试数据...
✅ 测试数据准备完成

📊 测试结果汇总:
============================================================
✅ 测试 1: 用户可以标记自己的预警
   用户成功标记了自己的预警
✅ 测试 2: 用户不能标记其他用户的预警
   正确阻止了跨用户操作
✅ 测试 3: 批量标记时验证权限
   正确阻止了批量跨用户操作
✅ 测试 4: 向后兼容性（不提供 userId）
   向后兼容性正常，内部调用仍然有效
============================================================
总计: 4 个测试
通过: 4 个
失败: 0 个

🎉 所有测试通过！用户隔离修复成功！
```

---

## 🧪 手动测试步骤

### 测试 1: 验证用户只能标记自己的预警

#### 步骤 1: 创建两个测试用户
```bash
# 在数据库中执行
INSERT INTO users (username, email, password_hash, role)
VALUES 
  ('testuser1', 'test1@test.com', '$2b$10$...', 'user'),
  ('testuser2', 'test2@test.com', '$2b$10$...', 'user');
```

#### 步骤 2: 为两个用户创建预警
```bash
# 获取用户ID
SELECT id FROM users WHERE email IN ('test1@test.com', 'test2@test.com');

# 创建预警（假设用户ID为 1 和 2）
INSERT INTO quota_alerts (user_id, feature_code, alert_type, threshold_percentage, current_usage, quota_limit, is_sent)
VALUES 
  (1, 'articles_per_month', 'warning', 80, 80, 100, FALSE),
  (2, 'articles_per_month', 'warning', 80, 80, 100, FALSE);
```

#### 步骤 3: 使用用户1的 token 尝试标记用户2的预警
```bash
# 获取用户1的 token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@test.com","password":"your_password"}'

# 获取用户2的预警ID
SELECT id FROM quota_alerts WHERE user_id = 2 AND is_sent = FALSE LIMIT 1;

# 尝试标记（应该返回 403 错误）
curl -X PUT http://localhost:3000/api/usage/alerts/[ALERT_ID]/mark-sent \
  -H "Authorization: Bearer [USER1_TOKEN]"
```

**预期结果**: 
```json
{
  "success": false,
  "message": "无权操作此预警"
}
```
HTTP 状态码: 403

#### 步骤 4: 使用用户1的 token 标记自己的预警
```bash
# 获取用户1的预警ID
SELECT id FROM quota_alerts WHERE user_id = 1 AND is_sent = FALSE LIMIT 1;

# 标记（应该成功）
curl -X PUT http://localhost:3000/api/usage/alerts/[ALERT_ID]/mark-sent \
  -H "Authorization: Bearer [USER1_TOKEN]"
```

**预期结果**:
```json
{
  "success": true,
  "message": "预警已标记为已读"
}
```
HTTP 状态码: 200

---

## 🔍 验证修复的关键点

### 1. Service 层验证
检查 `server/src/services/QuotaAlertService.ts`:
```typescript
async markAsSent(alertId: number, userId?: number): Promise<void> {
  // ✅ 应该有这段代码
  if (userId !== undefined) {
    const checkResult = await pool.query(
      `SELECT user_id FROM quota_alerts WHERE id = $1`,
      [alertId]
    );
    
    if (checkResult.rows[0].user_id !== userId) {
      throw new Error('无权操作此预警');
    }
  }
  // ...
}
```

### 2. Route 层验证
检查 `server/src/routes/usageTracking.ts`:
```typescript
router.put('/alerts/:id/mark-sent', async (req, res) => {
  const userId = (req as any).user.userId; // ✅ 应该获取当前用户ID
  const alertId = parseInt(req.params.id);
  
  await quotaAlertService.markAsSent(alertId, userId); // ✅ 应该传入 userId
  // ...
});
```

### 3. 错误处理验证
```typescript
catch (error: any) {
  // ✅ 应该根据错误类型返回不同的状态码
  const statusCode = error.message === '无权操作此预警' ? 403 : 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || '标记预警失败'
  });
}
```

---

## 📋 检查清单

- [ ] 自动化测试全部通过
- [ ] 用户无法标记其他用户的预警（返回 403）
- [ ] 用户可以标记自己的预警（返回 200）
- [ ] 批量标记时验证所有预警的所有权
- [ ] 内部调用（不提供 userId）仍然有效
- [ ] 错误消息清晰明确
- [ ] 日志记录正确

---

## 🐛 常见问题

### Q1: 测试失败 - "预警不存在"
**原因**: 测试数据未正确创建
**解决**: 检查数据库连接，确保测试用户和预警已创建

### Q2: 测试失败 - "无法连接数据库"
**原因**: 数据库未启动或连接配置错误
**解决**: 
```bash
# 检查数据库状态
psql -U postgres -d geo_optimization -c "SELECT 1"

# 检查 .env 文件中的 DATABASE_URL
```

### Q3: 所有测试都通过，但手动测试失败
**原因**: 可能是缓存或旧代码未重启
**解决**:
```bash
# 重启后端服务
cd server
npm run server:dev
```

---

## 📞 需要帮助？

如果测试失败或有疑问：
1. 查看 `USER_ISOLATION_FIX_COMPLETE.md` 了解详细修复内容
2. 查看 `USER_ISOLATION_SECURITY_AUDIT.md` 了解安全审计详情
3. 检查服务器日志: `tail -f server/logs/app.log`
