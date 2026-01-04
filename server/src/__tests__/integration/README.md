# 存储空间管理集成测试

## 概述

本目录包含存储空间管理系统的端到端集成测试。这些测试验证完整的工作流程，包括：

- ✅ 上传流程（配额检查 + 存储跟踪）
- ✅ 删除流程（清理 + 配额释放）
- ✅ 配额更新传播
- ✅ 警报生成和通知
- ✅ 管理员管理功能
- ✅ 存储历史和报告
- ✅ 文件大小验证
- ✅ 用户隔离

## 测试覆盖

### 1. 完整上传流程（配额执行）
- 配额可用时成功上传
- 配额超限时拒绝上传
- 管理员无限存储

### 2. 完整删除流程（清理）
- 删除资源时正确清理存储
- 多资源类型独立处理

### 3. 配额更新传播
- 订阅套餐变更时更新配额
- 购买存储累积叠加

### 4. 警报生成和通知
- 80% 使用时生成警告警报
- 95% 使用时生成严重警报
- 100% 使用时生成耗尽警报
- 防止重复警报

### 5. 管理员管理功能
- 查看任意用户存储
- 修改用户配额
- 触发存储对账
- 获取存储明细

### 6. 存储历史和报告
- 创建每日快照
- 检索日期范围历史

### 7. 文件大小验证
- 图片 50MB 限制
- 文档 100MB 限制
- 允许限制内文件

### 8. 用户隔离
- 用户间存储数据隔离
- 防止跨用户存储计算

## 前置条件

### 1. 创建测试数据库

```bash
# 创建测试数据库
createdb geo_test

# 或使用 psql
psql -U postgres -c "CREATE DATABASE geo_test;"
```

### 2. 运行数据库迁移

```bash
cd server

# 设置测试数据库 URL
export TEST_DATABASE_URL="postgresql://localhost:5432/geo_test"

# 运行迁移
npm run db:migrate
```

### 3. 配置测试环境变量

在 `server/.env.test` 文件中设置：

```env
NODE_ENV=test
TEST_DATABASE_URL=postgresql://localhost:5432/geo_test
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
JWT_SECRET=test-secret
JWT_REFRESH_SECRET=test-refresh-secret
```

### 4. 确保 Redis 运行

```bash
# 检查 Redis 是否运行
redis-cli ping

# 如果未运行，启动 Redis
redis-server
```

## 运行测试

### 运行所有集成测试

```bash
cd server
npm test -- integration/storage-e2e.test.ts
```

### 运行特定测试套件

```bash
# 只运行上传流程测试
npm test -- integration/storage-e2e.test.ts -t "Complete Upload Flow"

# 只运行删除流程测试
npm test -- integration/storage-e2e.test.ts -t "Complete Deletion Flow"

# 只运行警报测试
npm test -- integration/storage-e2e.test.ts -t "Alert Generation"
```

### 使用详细输出

```bash
npm test -- integration/storage-e2e.test.ts --verbose
```

### 检测未关闭的句柄

```bash
npm test -- integration/storage-e2e.test.ts --detectOpenHandles
```

## 测试数据清理

测试会自动清理创建的数据，但如果测试中断，可以手动清理：

```bash
psql -U postgres -d geo_test -c "
DELETE FROM storage_transactions WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.com'
);
DELETE FROM storage_usage_history WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.com'
);
DELETE FROM user_storage_usage WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.com'
);
DELETE FROM users WHERE email LIKE '%@test.com';
"
```

## 故障排除

### 数据库连接错误

如果看到 "database 'geo_test' does not exist" 错误：

1. 确认测试数据库已创建
2. 检查 `TEST_DATABASE_URL` 环境变量
3. 验证 PostgreSQL 服务正在运行

### Redis 连接错误

如果看到 Redis 连接错误：

1. 确认 Redis 服务正在运行
2. 检查 `TEST_REDIS_HOST` 和 `TEST_REDIS_PORT`
3. 验证 Redis 可访问：`redis-cli ping`

### 测试超时

如果测试超时：

1. 增加超时时间：`--testTimeout=60000`
2. 检查数据库性能
3. 确保没有死锁或长时间运行的查询

### 未关闭的句柄

如果 Jest 报告未关闭的句柄：

1. 运行 `--detectOpenHandles` 查看详情
2. 确保所有数据库连接已关闭
3. 确保 Redis 连接已关闭

## 持续集成

在 CI/CD 管道中运行这些测试：

```yaml
# .github/workflows/test.yml
- name: Setup Test Database
  run: |
    createdb geo_test
    cd server && npm run db:migrate

- name: Run Integration Tests
  run: |
    cd server
    npm test -- integration/storage-e2e.test.ts
  env:
    TEST_DATABASE_URL: postgresql://localhost:5432/geo_test
    TEST_REDIS_HOST: localhost
    TEST_REDIS_PORT: 6379
```

## 测试覆盖率

运行测试并生成覆盖率报告：

```bash
cd server
npm test -- integration/storage-e2e.test.ts --coverage
```

目标覆盖率：
- 分支覆盖率：≥ 75%
- 函数覆盖率：≥ 80%
- 行覆盖率：≥ 80%
- 语句覆盖率：≥ 80%

## 相关文档

- [存储空间管理设计文档](../../.kiro/specs/storage-space-management/design.md)
- [存储空间管理需求文档](../../.kiro/specs/storage-space-management/requirements.md)
- [存储空间管理任务列表](../../.kiro/specs/storage-space-management/tasks.md)
