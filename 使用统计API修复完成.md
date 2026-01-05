# 使用统计 API 修复完成

## 问题描述

用户中心页面的"使用统计"部分显示空白，控制台报错：
```
GET http://localhost:3000/api/subscription/usage-stats 500 (Internal Server Error)
```

## 根本原因

`SubscriptionService.getUserUsageStats()` 方法依赖两个数据库函数：
1. `get_user_quota_period()` - 计算配额周期
2. `get_next_quota_reset_time()` - 获取下次重置时间

这两个函数在迁移 031 中定义，但该迁移尚未执行（当前数据库版本：021，待执行迁移：13 个）。

当代码调用这些不存在的函数时，PostgreSQL 抛出错误，导致 API 返回 500。

## 修复方案

在 `SubscriptionService.ts` 中添加了优雅降级逻辑：

### 1. `getNextResetTime()` 方法修复

```typescript
private async getNextResetTime(
  userId: number,
  resetPeriod: 'daily' | 'monthly' | 'subscription'
): Promise<string | undefined> {
  try {
    // 尝试使用数据库函数
    const result = await pool.query(
      'SELECT get_next_quota_reset_time($1) as next_reset',
      [userId]
    );
    return result.rows[0]?.next_reset;
  } catch (error: any) {
    // 如果函数不存在，返回 undefined 而不是抛出错误
    if (error.message?.includes('does not exist')) {
      console.warn('get_next_quota_reset_time 函数不存在，请执行迁移 031');
      return undefined;
    }
    throw error;
  }
}
```

### 2. `getPeriodDates()` 方法修复

```typescript
private async getPeriodDates(
  userId: number,
  resetPeriod: 'daily' | 'monthly' | 'subscription'
): Promise<{ periodStart: Date; periodEnd: Date }> {
  try {
    // 尝试使用数据库函数
    const result = await pool.query(
      `SELECT period_start, period_end 
       FROM get_user_quota_period($1, 'articles_per_month')
       LIMIT 1`,
      [userId]
    );
    return {
      periodStart: new Date(result.rows[0].period_start),
      periodEnd: new Date(result.rows[0].period_end)
    };
  } catch (error: any) {
    // 如果函数不存在，使用备用逻辑
    if (error.message?.includes('does not exist')) {
      console.warn('get_user_quota_period 函数不存在，使用备用逻辑');
      return this.getPeriodDatesFallback(userId, resetPeriod);
    }
    throw error;
  }
}
```

### 3. 新增备用方法 `getPeriodDatesFallback()`

当数据库函数不存在时，使用纯 TypeScript 逻辑计算周期：

```typescript
private async getPeriodDatesFallback(
  userId: number,
  resetPeriod: 'daily' | 'monthly' | 'subscription'
): Promise<{ periodStart: Date; periodEnd: Date }> {
  const subscription = await this.getUserActiveSubscription(userId);
  if (!subscription) {
    throw new Error('用户没有有效订阅');
  }

  const now = new Date();
  const startDate = new Date(subscription.start_date);
  
  if (resetPeriod === 'subscription') {
    // 订阅周期：从订阅开始到结束
    return {
      periodStart: startDate,
      periodEnd: new Date(subscription.end_date)
    };
  } else if (resetPeriod === 'monthly') {
    // 月度周期：基于订阅开始日期计算当前月度周期
    const startDay = startDate.getDate();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), startDay);
    
    const periodStart = now < currentMonth 
      ? new Date(now.getFullYear(), now.getMonth() - 1, startDay)
      : currentMonth;
    
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    return { periodStart, periodEnd };
  } else {
    // 日度周期
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);
    
    return { periodStart, periodEnd };
  }
}
```

## 测试结果

运行测试脚本 `test-usage-stats-fix.ts`：

```bash
✅ 成功获取使用统计 (5 项):

📊 每月生成文章数:
   - 功能代码: articles_per_month
   - 已使用: 0 篇
   - 配额: 6 篇
   - 剩余: 6 篇
   - 使用率: 0.0%
   - 重置时间: 未设置

📊 关键词蒸馏数:
   - 功能代码: keyword_distillation
   - 已使用: 0 个
   - 配额: 2 个
   - 剩余: 2 个
   - 使用率: 0.0%
   - 重置时间: 未设置

📊 可管理平台账号数:
   - 功能代码: platform_accounts
   - 已使用: 0 个
   - 配额: 2 个
   - 剩余: 2 个
   - 使用率: 0.0%
   - 重置时间: 未设置

📊 每月发布文章数:
   - 功能代码: publish_per_month
   - 已使用: 0 篇
   - 配额: 2 篇
   - 剩余: 2 篇
   - 使用率: 0.0%
   - 重置时间: 未设置

📊 存储空间:
   - 功能代码: storage_space
   - 已使用: 56.77 MB
   - 配额: 500 MB
   - 剩余: 443.23 MB
   - 使用率: 11.4%
   - 重置时间: 未设置

✅ 测试成功！API 应该可以正常工作了
```

## 验证步骤

### 1. 重启服务器

修改已应用到 `server/src/services/SubscriptionService.ts`，需要重启后端服务：

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run server:dev
```

### 2. 刷新前端页面

在浏览器中：
1. 打开用户中心页面
2. 刷新页面（F5 或 Cmd+R）
3. 查看"使用统计"部分是否正常显示

### 3. 检查控制台

确认没有 500 错误，应该看到成功的 API 响应。

## 后续建议

虽然现在 API 可以正常工作，但为了获得完整功能（包括重置时间显示），建议执行待处理的迁移：

```bash
cd server
npm run db:migrate
```

这将执行包括迁移 031 在内的所有待处理迁移，创建缺失的数据库函数。

## 修改文件

- `server/src/services/SubscriptionService.ts` - 添加错误处理和备用逻辑

## 测试脚本

- `server/src/scripts/diagnose-usage-stats-error.ts` - 诊断脚本
- `server/src/scripts/test-usage-stats-fix.ts` - 测试脚本

---

**修复时间**: 2026-01-05  
**状态**: ✅ 已完成
