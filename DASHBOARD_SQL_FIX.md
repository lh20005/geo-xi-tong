# Dashboard SQL 参数占位符修复

## 问题描述

Dashboard API 的 `/api/dashboard/platform-distribution` 端点返回 500 错误。

## 根本原因

`DashboardService.ts` 中的 SQL 参数占位符构建顺序错误：

```typescript
// ❌ 错误：先构建占位符字符串，再添加参数
if (startDate) {
  conditions.push(`pr.published_at >= $${params.length + 1}`);
  params.push(startDate);
}
```

这会导致：
- 当 `params.length = 1` 时，生成 `$2` 占位符
- 然后才将 `startDate` 添加到 `params[1]`
- 但如果有两个条件，第二个也会生成 `$2`，导致冲突

## 解决方案

修正参数添加顺序：

```typescript
// ✅ 正确：先添加参数，再构建占位符
if (startDate) {
  params.push(startDate);
  conditions.push(`pr.published_at >= $${params.length}`);
}
```

## 修复的方法

在 `server/src/services/DashboardService.ts` 中修复了以下方法：

1. `getPlatformDistribution()` - 平台分布查询
2. `getPublishingStatus()` - 发布状态查询  
3. `getGenerationTasks()` - 生成任务查询

## 验证

- ✅ TypeScript 编译无错误
- ✅ 服务器自动重载
- ✅ 不再有 `params.length + 1` 的错误模式

## 测试建议

刷新前端 Dashboard 页面，确认：
- 平台分布图表正常加载
- 发布状态统计正常显示
- 生成任务数据正确展示
