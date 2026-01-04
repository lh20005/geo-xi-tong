# ✅ 用户隔离修复检查清单

## 执行前检查

- [ ] 已备份数据库
- [ ] 已在测试环境验证
- [ ] 已通知相关人员
- [ ] 服务器处于低峰期
- [ ] 已准备回滚方案

## 执行步骤

### 步骤 1: 运行迁移
```bash
cd server
npx ts-node src/db/run-migration-011.ts
```

**预期输出**:
- [ ] ✅ 添加 user_id 字段成功
- [ ] ✅ 从 articles 表填充数据
- [ ] ✅ 从 platform_accounts 表填充剩余数据
- [ ] ✅ 设置 NOT NULL 约束
- [ ] ✅ 添加外键约束
- [ ] ✅ 创建索引
- [ ] ✅ 验证结果显示正常

### 步骤 2: 验证修复
```bash
npx ts-node src/scripts/verify-user-isolation.ts
```

**预期输出**:
- [ ] ✅ user_id 字段存在
- [ ] ✅ 所有记录都有 user_id
- [ ] ✅ 找到 3 个用户相关索引
- [ ] ✅ 找到用户外键约束
- [ ] ✅ 数据分布正常
- [ ] ✅ user_id 与文章一致
- [ ] ✅ user_id 与账号一致
- [ ] ✅ 所有检查通过

### 步骤 3: 重启服务器
```bash
npm run server:dev
```

**预期输出**:
- [ ] ✅ 服务器启动成功
- [ ] ✅ 没有数据库错误
- [ ] ✅ API 正常响应

## 功能测试

### 测试场景 1: 用户 A 查看记录
- [ ] 登录用户 A
- [ ] 访问发布记录页面
- [ ] 只能看到用户 A 的记录
- [ ] 记录数量正确

### 测试场景 2: 用户 B 查看记录
- [ ] 登录用户 B
- [ ] 访问发布记录页面
- [ ] 只能看到用户 B 的记录
- [ ] 记录数量正确

### 测试场景 3: 跨用户访问测试
- [ ] 登录用户 A
- [ ] 获取用户 B 的某条记录 ID
- [ ] 尝试访问该记录
- [ ] 返回 404 或无权访问错误

### 测试场景 4: 统计数据测试
- [ ] 登录用户 A
- [ ] 查看统计数据
- [ ] 数据只包含用户 A 的记录
- [ ] 各平台统计正确

### 测试场景 5: 新建记录测试
- [ ] 登录用户 A
- [ ] 创建新的发布任务
- [ ] 任务执行成功
- [ ] 新记录包含正确的 user_id
- [ ] 用户 A 可以看到新记录
- [ ] 用户 B 看不到该记录

## API 测试

### GET /api/publishing/records
```bash
# 测试用户 A
curl -H "Authorization: Bearer <token_A>" \
  http://localhost:3000/api/publishing/records
```
- [ ] 返回用户 A 的记录
- [ ] 不包含其他用户的记录

### GET /api/publishing/records/:id
```bash
# 测试访问自己的记录
curl -H "Authorization: Bearer <token_A>" \
  http://localhost:3000/api/publishing/records/<record_id_A>
```
- [ ] 返回记录详情

```bash
# 测试访问其他用户的记录
curl -H "Authorization: Bearer <token_A>" \
  http://localhost:3000/api/publishing/records/<record_id_B>
```
- [ ] 返回 404 或无权访问

### GET /api/publishing/stats
```bash
curl -H "Authorization: Bearer <token_A>" \
  http://localhost:3000/api/publishing/stats
```
- [ ] 只包含用户 A 的统计数据

## 数据库验证

### 检查表结构
```sql
\d publishing_records
```
- [ ] user_id 字段存在
- [ ] user_id 为 NOT NULL
- [ ] 有外键约束到 users 表

### 检查索引
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'publishing_records';
```
- [ ] idx_publishing_records_user_id
- [ ] idx_publishing_records_user_platform
- [ ] idx_publishing_records_user_article

### 检查数据完整性
```sql
-- 检查 NULL 值
SELECT COUNT(*) FROM publishing_records WHERE user_id IS NULL;
```
- [ ] 结果为 0

```sql
-- 检查与文章的一致性
SELECT COUNT(*) FROM publishing_records pr
INNER JOIN articles a ON pr.article_id = a.id
WHERE pr.user_id != a.user_id;
```
- [ ] 结果为 0

```sql
-- 检查与账号的一致性
SELECT COUNT(*) FROM publishing_records pr
INNER JOIN platform_accounts pa ON pr.account_id = pa.id
WHERE pr.user_id != pa.user_id;
```
- [ ] 结果为 0

## 性能测试

### 查询性能
```sql
EXPLAIN ANALYZE
SELECT * FROM publishing_records
WHERE user_id = 1
ORDER BY published_at DESC
LIMIT 20;
```
- [ ] 使用了索引
- [ ] 执行时间合理（< 100ms）

### 统计查询性能
```sql
EXPLAIN ANALYZE
SELECT platform_id, COUNT(*) 
FROM publishing_records
WHERE user_id = 1
GROUP BY platform_id;
```
- [ ] 使用了索引
- [ ] 执行时间合理（< 100ms）

## 回滚准备

如果出现问题，执行回滚：

```sql
-- 1. 删除索引
DROP INDEX IF EXISTS idx_publishing_records_user_id;
DROP INDEX IF EXISTS idx_publishing_records_user_platform;
DROP INDEX IF EXISTS idx_publishing_records_user_article;

-- 2. 删除外键
ALTER TABLE publishing_records 
DROP CONSTRAINT IF EXISTS fk_publishing_records_user;

-- 3. 删除字段
ALTER TABLE publishing_records DROP COLUMN user_id;
```

- [ ] 回滚脚本已准备
- [ ] 回滚脚本已测试

## 完成确认

- [ ] 所有迁移步骤成功
- [ ] 所有验证测试通过
- [ ] 所有功能测试通过
- [ ] 所有 API 测试通过
- [ ] 数据库验证通过
- [ ] 性能测试通过
- [ ] 文档已更新
- [ ] 团队已通知

## 问题记录

如果遇到问题，记录在此：

| 问题 | 时间 | 解决方案 | 状态 |
|------|------|----------|------|
|      |      |          |      |

---

**执行人**: ___________  
**执行时间**: ___________  
**完成时间**: ___________  
**状态**: ⬜ 待执行 / ⬜ 进行中 / ⬜ 已完成 / ⬜ 已回滚
