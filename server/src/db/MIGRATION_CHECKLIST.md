# 数据库迁移检查清单

## 迁移前准备

- [ ] **备份数据库**
  ```bash
  # PostgreSQL备份命令
  pg_dump -U username -d database_name -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump
  ```

- [ ] **确认当前数据库状态**
  ```bash
  # 检查当前表结构
  psql -U username -d database_name -c "\d distillations"
  psql -U username -d database_name -c "\dt"
  ```

- [ ] **记录当前数据统计**
  ```sql
  SELECT COUNT(*) FROM distillations;
  SELECT COUNT(*) FROM articles;
  SELECT COUNT(*) FROM generation_tasks;
  ```

## 执行迁移

- [ ] **运行迁移脚本**
  ```bash
  # 方式1: 使用psql
  psql -U username -d database_name -f server/src/db/migrations/002_add_usage_tracking.sql

  # 方式2: 使用Node.js脚本
  npm run migrate
  ```

- [ ] **检查迁移执行结果**
  - 查看控制台输出，确认没有错误
  - 检查是否有警告信息

## 迁移后验证

- [ ] **运行验证脚本**
  ```bash
  npx ts-node server/src/db/verify-migration.ts
  ```

- [ ] **手动验证表结构**
  ```sql
  -- 验证usage_count字段
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'distillations' AND column_name = 'usage_count';

  -- 验证distillation_usage表
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'distillation_usage';
  ```

- [ ] **验证索引创建**
  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename IN ('distillations', 'distillation_usage');
  ```

- [ ] **验证数据一致性**
  ```sql
  -- 检查usage_count是否与实际文章数量一致
  SELECT 
    d.id,
    d.keyword,
    d.usage_count,
    COUNT(a.id) as actual_count
  FROM distillations d
  LEFT JOIN articles a ON d.id = a.distillation_id
  GROUP BY d.id, d.keyword, d.usage_count
  HAVING d.usage_count != COUNT(a.id);
  
  -- 应该返回0行，表示数据一致
  ```

- [ ] **测试修复工具**
  ```bash
  # 调用修复API
  curl -X POST http://localhost:3000/api/distillation/repair-usage-stats
  ```

## 功能测试

- [ ] **测试后端API**
  ```bash
  # 获取蒸馏结果统计
  curl http://localhost:3000/api/distillation/stats

  # 获取使用历史
  curl http://localhost:3000/api/distillation/1/usage-history

  # 获取推荐结果
  curl http://localhost:3000/api/distillation/recommended
  ```

- [ ] **测试前端功能**
  - 访问蒸馏结果页面，检查使用次数列是否显示
  - 点击"查看使用历史"按钮，检查历史记录是否正确
  - 访问任务配置页面，检查推荐标记是否显示
  - 创建新任务，验证智能选择算法是否工作

- [ ] **测试文章生成流程**
  - 创建新的文章生成任务
  - 验证usage_count是否正确增加
  - 验证使用记录是否正确创建
  - 删除文章，验证usage_count是否正确减少

## 性能测试

- [ ] **检查查询性能**
  ```sql
  -- 测试智能选择查询
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

  -- 测试使用历史查询
  EXPLAIN ANALYZE
  SELECT * FROM distillation_usage
  WHERE distillation_id = 1
  ORDER BY used_at DESC
  LIMIT 10;
  ```

- [ ] **监控数据库性能指标**
  - 查询响应时间
  - 索引使用情况
  - 锁等待情况

## 回滚准备

- [ ] **测试回滚脚本（在测试环境）**
  ```bash
  psql -U username -d test_database -f server/src/db/migrations/002_rollback_usage_tracking.sql
  ```

- [ ] **准备回滚计划**
  - 记录回滚步骤
  - 准备回滚命令
  - 确认回滚后的数据恢复方案

## 如果迁移失败

1. **立即停止应用服务**
   ```bash
   # 停止Node.js服务
   pm2 stop all  # 或其他进程管理器命令
   ```

2. **运行回滚脚本**
   ```bash
   psql -U username -d database_name -f server/src/db/migrations/002_rollback_usage_tracking.sql
   ```

3. **恢复数据库备份**
   ```bash
   # 如果回滚脚本失败，从备份恢复
   pg_restore -U username -d database_name -v backup_file.dump
   ```

4. **验证回滚结果**
   ```sql
   -- 确认usage_count字段已删除
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'distillations' AND column_name = 'usage_count';
   
   -- 确认distillation_usage表已删除
   SELECT table_name FROM information_schema.tables
   WHERE table_name = 'distillation_usage';
   ```

5. **重启应用服务**
   ```bash
   pm2 start all
   ```

## 监控和维护

- [ ] **设置监控告警**
  - 数据一致性检查（每日）
  - 查询性能监控
  - 错误日志监控

- [ ] **定期维护任务**
  - 每周运行数据一致性检查
  - 每月运行修复工具验证
  - 定期分析慢查询日志

## 完成确认

- [ ] 所有验证检查通过
- [ ] 功能测试通过
- [ ] 性能测试通过
- [ ] 回滚计划已准备
- [ ] 监控已设置
- [ ] 文档已更新

**迁移负责人签名:** _______________  
**日期:** _______________  
**验证人签名:** _______________  
**日期:** _______________
