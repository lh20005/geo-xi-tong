# Dashboard 多租户隔离修复指南

## 已完成
1. ✅ `dashboard.ts` 路由 - 已添加认证和租户中间件，所有路由都传递 userId
2. ✅ `getMetrics()` 方法 - 已添加 userId 参数和过滤

## 需要修改的方法

所有以下方法都需要：
1. 在方法签名中添加 `userId: number` 作为第一个参数
2. 在所有 SQL 查询中添加 `WHERE user_id = $n` 或 `AND user_id = $n`

### 方法列表：
1. ✅ `getMetrics(userId, startDate?, endDate?)` - 已完成
2. `getTrends(userId, startDate?, endDate?)`
3. `getPlatformDistribution(userId, startDate?, endDate?)`
4. `getPublishingStatus(userId, startDate?, endDate?)`
5. `getResourceUsage(userId, startDate?, endDate?)`
6. `getGenerationTasks(userId, startDate?, endDate?)`
7. `getArticleStats(userId)`
8. `getKeywordDistribution(userId)`
9. `getMonthlyComparison(userId)`
10. `getHourlyActivity(userId)`
11. `getSuccessRates(userId)`
12. `getTopResources(userId, startDate?, endDate?)`

## 需要添加 user_id 过滤的表：
- `distillations` - WHERE user_id = $n
- `articles` - WHERE user_id = $n  
- `publishing_tasks` - WHERE user_id = $n
- `knowledge_bases` - WHERE user_id = $n
- `albums` - WHERE user_id = $n
- `topics` - 通过 JOIN distillations 间接过滤

## 注意事项：
- `publishing_records` 表通过 `publishing_tasks` 关联，需要 JOIN 过滤
- `platforms_config` 和 `accounts` 表已经有 user_id，需要添加过滤
- 所有 CTE (WITH 子句) 中的查询也需要添加过滤

## 快速修复方案：
由于文件较大(670行)，建议：
1. 使用备份文件：`server/src/services/DashboardService.ts.backup`
2. 系统性地为每个方法添加 userId 参数
3. 在每个 FROM 子句后添加相应的 WHERE user_id 过滤
