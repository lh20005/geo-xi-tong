# 蒸馏结果使用追踪 - 监控和维护指南

## 概述

本文档提供了蒸馏结果使用追踪功能的监控和维护指南，帮助系统管理员确保功能正常运行和数据一致性。

## 监控指标

### 1. 数据一致性监控

#### 检查usage_count一致性

**频率**: 每日

**检查方法**:
```sql
-- 查找usage_count与实际使用记录数量不一致的记录
SELECT 
  d.id,
  d.keyword,
  d.usage_count,
  COUNT(du.id) as actual_count,
  d.usage_count - COUNT(du.id) as difference
FROM distillations d
LEFT JOIN distillation_usage du ON d.id = du.distillation_id
GROUP BY d.id, d.keyword, d.usage_count
HAVING d.usage_count != COUNT(du.id);
```

**预期结果**: 返回0行

**如果发现不一致**:
1. 记录不一致的详情
2. 运行修复工具：`POST /api/distillation/repair-usage-stats`
3. 再次检查是否修复成功
4. 如果问题持续，检查应用日志

#### 检查级联删除

**频率**: 每周

**检查方法**:
```sql
-- 查找孤立的使用记录（关联的文章已被删除）
SELECT du.*
FROM distillation_usage du
LEFT JOIN articles a ON du.article_id = a.id
WHERE a.id IS NULL;

-- 查找孤立的使用记录（关联的蒸馏结果已被删除）
SELECT du.*
FROM distillation_usage du
LEFT JOIN distillations d ON du.distillation_id = d.id
WHERE d.id IS NULL;
```

**预期结果**: 两个查询都返回0行

**如果发现孤立记录**:
1. 检查级联删除配置
2. 手动清理孤立记录
3. 检查应用日志查找原因

### 2. 性能监控

#### API响应时间

**监控端点**:
- `GET /api/distillation/stats`
- `GET /api/distillation/:id/usage-history`
- `GET /api/distillation/recommended`

**目标响应时间**:
- 统计列表: < 200ms
- 使用历史: < 150ms
- 推荐结果: < 100ms

**监控方法**:
```bash
# 使用curl测量响应时间
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/distillation/stats"

# curl-format.txt内容:
# time_total: %{time_total}s
```

**如果响应时间过长**:
1. 检查数据库索引是否存在
2. 分析慢查询日志
3. 考虑增加数据库资源
4. 检查是否有大量并发请求

#### 数据库查询性能

**频率**: 每周

**检查方法**:
```sql
-- 检查智能选择查询的执行计划
EXPLAIN ANALYZE
SELECT id, keyword, usage_count
FROM distillations
WHERE id IN (
  SELECT distillation_id 
  FROM distillation_topics 
  GROUP BY distillation_id 
  HAVING COUNT(*) > 0
)
ORDER BY usage_count ASC, created_at ASC
LIMIT 10;

-- 检查使用历史查询的执行计划
EXPLAIN ANALYZE
SELECT * FROM distillation_usage
WHERE distillation_id = 1
ORDER BY used_at DESC
LIMIT 10;
```

**关注指标**:
- 是否使用了索引
- 扫描的行数
- 执行时间

#### 索引使用情况

**频率**: 每月

**检查方法**:
```sql
-- 检查索引大小
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('distillations', 'distillation_usage')
ORDER BY pg_relation_size(indexrelid) DESC;

-- 检查索引使用统计
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('distillations', 'distillation_usage')
ORDER BY idx_scan DESC;
```

**关注指标**:
- `idx_scan`: 索引扫描次数（应该 > 0）
- 索引大小是否合理

### 3. 业务监控

#### 使用分布统计

**频率**: 每周

**检查方法**:
```sql
-- 使用次数分布
SELECT 
  usage_count,
  COUNT(*) as distillation_count
FROM distillations
GROUP BY usage_count
ORDER BY usage_count;

-- 使用次数统计
SELECT 
  COUNT(*) as total_distillations,
  SUM(usage_count) as total_usage,
  AVG(usage_count) as avg_usage,
  MAX(usage_count) as max_usage,
  MIN(usage_count) as min_usage,
  STDDEV(usage_count) as stddev_usage
FROM distillations;
```

**关注指标**:
- 平均使用次数
- 标准差（反映使用是否平衡）
- 最大和最小使用次数的差距

#### 推荐算法效果

**频率**: 每月

**检查方法**:
```sql
-- 查看推荐的蒸馏结果
SELECT 
  id,
  keyword,
  usage_count,
  (SELECT COUNT(*) FROM distillation_topics WHERE distillation_id = d.id) as topic_count
FROM distillations d
WHERE id IN (
  SELECT distillation_id 
  FROM distillation_topics 
  GROUP BY distillation_id 
  HAVING COUNT(*) > 0
)
ORDER BY usage_count ASC, created_at ASC
LIMIT 3;
```

**评估标准**:
- 推荐的蒸馏结果是否确实使用次数最少
- 推荐的蒸馏结果是否有足够的话题

#### 文章生成成功率

**频率**: 每日

**检查方法**:
```sql
-- 统计文章生成成功率
SELECT 
  COUNT(*) as total_tasks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM generation_tasks
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

**目标成功率**: > 95%

### 4. 错误监控

#### 应用日志监控

**关注的错误类型**:
- 数据库连接错误
- 事务回滚
- 并发冲突
- 数据一致性错误

**日志位置**: 
- 应用日志: `logs/app.log`
- 错误日志: `logs/error.log`

**监控命令**:
```bash
# 查看最近的错误
tail -f logs/error.log

# 统计错误类型
grep "ERROR" logs/app.log | awk '{print $5}' | sort | uniq -c | sort -rn

# 查找数据一致性错误
grep "inconsistency" logs/app.log
```

#### 数据库日志监控

**关注的问题**:
- 死锁
- 慢查询
- 连接池耗尽

**检查方法**:
```sql
-- 查看当前活动的查询
SELECT 
  pid,
  usename,
  application_name,
  state,
  query,
  query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- 查看锁等待
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

## 定期维护任务

### 每日任务

1. **检查错误日志**
   ```bash
   grep "ERROR" logs/app.log | tail -n 50
   ```

2. **验证数据一致性**
   ```bash
   # 运行一致性检查脚本
   npm run check-consistency
   ```

3. **监控API响应时间**
   ```bash
   # 使用监控工具或手动检查
   curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/distillation/stats"
   ```

### 每周任务

1. **分析使用统计**
   - 查看使用分布
   - 识别异常模式
   - 评估推荐算法效果

2. **优化查询性能**
   - 检查慢查询日志
   - 分析执行计划
   - 优化索引

3. **清理过期数据**（如果有）
   ```sql
   -- 示例：清理6个月前的使用记录（根据实际需求调整）
   -- DELETE FROM distillation_usage WHERE used_at < NOW() - INTERVAL '6 months';
   ```

### 每月任务

1. **运行修复工具验证数据**
   ```bash
   curl -X POST http://localhost:3000/api/distillation/repair-usage-stats
   ```

2. **分析并发冲突情况**
   - 检查重试日志
   - 评估并发控制效果
   - 调整重试策略（如需要）

3. **评估索引效果**
   - 检查索引使用统计
   - 识别未使用的索引
   - 考虑添加新索引

4. **数据库维护**
   ```sql
   -- 更新统计信息
   ANALYZE distillations;
   ANALYZE distillation_usage;
   
   -- 清理死元组
   VACUUM ANALYZE distillations;
   VACUUM ANALYZE distillation_usage;
   ```

## 故障排查

### 问题1: 使用次数不更新

**症状**: 文章生成后，usage_count没有增加

**可能原因**:
1. 事务回滚
2. 数据库连接问题
3. 应用代码错误

**排查步骤**:
1. 检查应用日志中的错误
2. 检查数据库事务日志
3. 手动验证数据库中的数据
4. 运行修复工具

**解决方案**:
```bash
# 运行修复工具
curl -X POST http://localhost:3000/api/distillation/repair-usage-stats
```

### 问题2: 数据不一致

**症状**: usage_count与实际使用记录数量不匹配

**可能原因**:
1. 并发更新冲突
2. 事务回滚不完整
3. 手动修改数据库

**排查步骤**:
1. 运行一致性检查查询
2. 检查应用日志
3. 检查数据库日志

**解决方案**:
```bash
# 运行修复工具
curl -X POST http://localhost:3000/api/distillation/repair-usage-stats
```

### 问题3: 查询性能下降

**症状**: API响应时间明显增加

**可能原因**:
1. 索引缺失或损坏
2. 数据量增长
3. 并发请求过多
4. 数据库资源不足

**排查步骤**:
1. 检查索引是否存在
2. 分析查询执行计划
3. 检查数据库资源使用情况
4. 检查并发请求数

**解决方案**:
```sql
-- 重建索引
REINDEX TABLE distillations;
REINDEX TABLE distillation_usage;

-- 更新统计信息
ANALYZE distillations;
ANALYZE distillation_usage;
```

### 问题4: 并发冲突频繁

**症状**: 日志中频繁出现重试记录

**可能原因**:
1. 并发请求过多
2. 事务持有时间过长
3. 锁竞争激烈

**排查步骤**:
1. 检查并发请求数
2. 分析事务持有时间
3. 检查锁等待情况

**解决方案**:
1. 增加重试次数
2. 优化事务逻辑
3. 考虑使用队列处理

## 备份和恢复

### 备份策略

**频率**: 每日

**备份内容**:
- 完整数据库备份
- 关键表备份（distillations, distillation_usage）

**备份命令**:
```bash
# 完整数据库备份
pg_dump -U username -d database_name -F c -b -v -f backup_$(date +%Y%m%d).dump

# 仅备份关键表
pg_dump -U username -d database_name -t distillations -t distillation_usage -F c -b -v -f usage_tracking_$(date +%Y%m%d).dump
```

### 恢复流程

**场景1: 数据损坏**
```bash
# 1. 停止应用
pm2 stop all

# 2. 恢复数据库
pg_restore -U username -d database_name -v backup_file.dump

# 3. 验证数据
npx ts-node server/src/db/verify-migration.ts

# 4. 启动应用
pm2 start all
```

**场景2: 误删除数据**
```bash
# 1. 从备份中恢复特定表
pg_restore -U username -d database_name -t distillation_usage -v backup_file.dump

# 2. 运行修复工具
curl -X POST http://localhost:3000/api/distillation/repair-usage-stats
```

## 告警配置

### 建议的告警规则

1. **数据一致性告警**
   - 条件: 发现不一致的记录数 > 0
   - 级别: 高
   - 通知: 立即

2. **API响应时间告警**
   - 条件: 响应时间 > 500ms
   - 级别: 中
   - 通知: 15分钟内

3. **错误率告警**
   - 条件: 错误率 > 5%
   - 级别: 高
   - 通知: 立即

4. **数据库连接告警**
   - 条件: 连接池使用率 > 80%
   - 级别: 中
   - 通知: 5分钟内

## 性能优化建议

### 数据库优化

1. **定期更新统计信息**
   ```sql
   ANALYZE distillations;
   ANALYZE distillation_usage;
   ```

2. **定期清理死元组**
   ```sql
   VACUUM ANALYZE distillations;
   VACUUM ANALYZE distillation_usage;
   ```

3. **监控表膨胀**
   ```sql
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE tablename IN ('distillations', 'distillation_usage')
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

### 应用优化

1. **使用连接池**
   - 配置合适的连接池大小
   - 监控连接池使用情况

2. **实现缓存**
   - 缓存推荐结果（5分钟）
   - 缓存统计列表（1分钟）

3. **优化查询**
   - 使用索引
   - 避免N+1查询
   - 使用分页

## 联系方式

如遇到无法解决的问题，请联系：
- 技术支持: support@example.com
- 紧急联系: +86-xxx-xxxx-xxxx

## 附录

### 有用的SQL查询

```sql
-- 查看表大小
SELECT 
  pg_size_pretty(pg_total_relation_size('distillations')) as distillations_size,
  pg_size_pretty(pg_total_relation_size('distillation_usage')) as usage_size;

-- 查看索引大小
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE tablename IN ('distillations', 'distillation_usage');

-- 查看最近的使用记录
SELECT * FROM distillation_usage
ORDER BY used_at DESC
LIMIT 10;

-- 查看使用次数最多的蒸馏结果
SELECT id, keyword, usage_count
FROM distillations
ORDER BY usage_count DESC
LIMIT 10;
```

### 监控脚本示例

```bash
#!/bin/bash
# check-consistency.sh

# 检查数据一致性
INCONSISTENT=$(psql -U username -d database_name -t -c "
SELECT COUNT(*)
FROM distillations d
LEFT JOIN distillation_usage du ON d.id = du.distillation_id
GROUP BY d.id, d.usage_count
HAVING d.usage_count != COUNT(du.id);
")

if [ "$INCONSISTENT" -gt 0 ]; then
  echo "发现 $INCONSISTENT 条不一致的记录！"
  # 发送告警
  # curl -X POST https://alert-service.com/api/alert ...
else
  echo "数据一致性检查通过"
fi
```
