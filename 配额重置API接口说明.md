# 配额重置 API 接口说明

## 前端需要的新接口

### 1. 获取用户配额重置信息

**接口**: `GET /api/user/quota-reset-info`

**响应**:
```json
{
  "success": true,
  "data": {
    "cycle_type": "monthly",
    "reset_description": "每月15号重置",
    "next_reset_time": "2026-02-15T00:00:00Z",
    "days_until_reset": 10,
    "current_period": {
      "start": "2026-01-15T00:00:00Z",
      "end": "2026-02-14T23:59:59Z"
    }
  }
}
```

**实现示例**:
```typescript
// server/src/routes/user.ts
router.get('/quota-reset-info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    const result = await pool.query(`
      SELECT 
        us.quota_cycle_type as cycle_type,
        get_quota_reset_description($1) as reset_description,
        get_next_quota_reset_time($1) as next_reset_time,
        p.period_start as current_period_start,
        p.period_end as current_period_end
      FROM user_subscriptions us
      CROSS JOIN LATERAL get_user_quota_period($1, 'articles_per_month') p
      WHERE us.user_id = $1 
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: '没有有效订阅'
      });
    }
    
    const data = result.rows[0];
    const nextReset = new Date(data.next_reset_time);
    const now = new Date();
    const daysUntilReset = Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    res.json({
      success: true,
      data: {
        cycle_type: data.cycle_type,
        reset_description: data.reset_description,
        next_reset_time: data.next_reset_time,
        days_until_reset: daysUntilReset,
        current_period: {
          start: data.current_period_start,
          end: data.current_period_end
        }
      }
    });
  } catch (error) {
    console.error('获取配额重置信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配额重置信息失败'
    });
  }
});
```

### 2. 增强现有配额统计接口

**接口**: `GET /api/user/usage-stats`

**新增字段**:
```json
{
  "success": true,
  "data": [
    {
      "feature_code": "articles_per_month",
      "feature_name": "每月生成文章数",
      "used": 15,
      "limit": 50,
      "remaining": 35,
      "percentage": 30,
      "unit": "篇",
      // 新增字段 ↓
      "reset_description": "每月15号重置",
      "next_reset_time": "2026-02-15T00:00:00Z",
      "days_until_reset": 10,
      "current_period": {
        "start": "2026-01-15T00:00:00Z",
        "end": "2026-02-14T23:59:59Z"
      }
    }
  ]
}
```

**实现修改**:
```typescript
// server/src/services/SubscriptionService.ts
async getUserUsageStats(userId: number): Promise<UsageStats[]> {
  // ... 现有代码 ...
  
  // 获取配额重置信息
  const resetInfoResult = await pool.query(`
    SELECT 
      get_quota_reset_description($1) as reset_description,
      get_next_quota_reset_time($1) as next_reset_time,
      p.period_start,
      p.period_end
    FROM get_user_quota_period($1, 'articles_per_month') p
  `, [userId]);
  
  const resetInfo = resetInfoResult.rows[0] || {};
  const nextReset = resetInfo.next_reset_time ? new Date(resetInfo.next_reset_time) : null;
  const daysUntilReset = nextReset 
    ? Math.ceil((nextReset.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  
  // 为每个配额项添加重置信息
  stats.forEach(stat => {
    stat.reset_description = resetInfo.reset_description;
    stat.next_reset_time = resetInfo.next_reset_time;
    stat.days_until_reset = daysUntilReset;
    stat.current_period = {
      start: resetInfo.period_start,
      end: resetInfo.period_end
    };
  });
  
  return stats;
}
```

## 前端组件示例

### 配额重置信息卡片

```tsx
// client/src/components/QuotaResetInfo.tsx
import { Card, Tag, Tooltip } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getQuotaResetInfo } from '../api/user';

interface QuotaResetInfo {
  cycle_type: 'monthly' | 'yearly';
  reset_description: string;
  next_reset_time: string;
  days_until_reset: number;
  current_period: {
    start: string;
    end: string;
  };
}

export const QuotaResetInfo: React.FC = () => {
  const [info, setInfo] = useState<QuotaResetInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotaResetInfo();
  }, []);

  const loadQuotaResetInfo = async () => {
    try {
      const response = await getQuotaResetInfo();
      if (response.success) {
        setInfo(response.data);
      }
    } catch (error) {
      console.error('加载配额重置信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !info) {
    return null;
  }

  const getResetColor = (days: number) => {
    if (days <= 3) return 'red';
    if (days <= 7) return 'orange';
    return 'green';
  };

  return (
    <Card 
      size="small" 
      className="mb-4"
      title={
        <span>
          <CalendarOutlined className="mr-2" />
          配额重置周期
        </span>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">重置规则：</span>
          <Tag color="blue">{info.reset_description}</Tag>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">下次重置：</span>
          <span className="font-medium">
            {new Date(info.next_reset_time).toLocaleDateString('zh-CN')}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">距离重置：</span>
          <Tooltip title="配额将在此时间后重置">
            <Tag 
              color={getResetColor(info.days_until_reset)}
              icon={<ClockCircleOutlined />}
            >
              {info.days_until_reset} 天
            </Tag>
          </Tooltip>
        </div>
        
        <div className="mt-3 pt-3 border-t text-xs text-gray-500">
          当前周期：
          {new Date(info.current_period.start).toLocaleDateString('zh-CN')} 
          {' - '}
          {new Date(info.current_period.end).toLocaleDateString('zh-CN')}
        </div>
      </div>
    </Card>
  );
};
```

### 配额使用卡片（增强版）

```tsx
// client/src/components/QuotaUsageCard.tsx
import { Card, Progress, Tag } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';

interface QuotaUsage {
  feature_name: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  unit: string;
  reset_description: string;
  days_until_reset: number;
}

export const QuotaUsageCard: React.FC<{ quota: QuotaUsage }> = ({ quota }) => {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#ff4d4f';
    if (percentage >= 70) return '#faad14';
    return '#52c41a';
  };

  return (
    <Card size="small" className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{quota.feature_name}</span>
        <Tag color="blue" icon={<CalendarOutlined />}>
          {quota.days_until_reset}天后重置
        </Tag>
      </div>
      
      <Progress
        percent={quota.percentage}
        strokeColor={getProgressColor(quota.percentage)}
        format={() => `${quota.used} / ${quota.limit} ${quota.unit}`}
      />
      
      <div className="mt-2 text-xs text-gray-500">
        {quota.reset_description}
      </div>
    </Card>
  );
};
```

### API 客户端函数

```typescript
// client/src/api/user.ts
import axios from 'axios';

export interface QuotaResetInfo {
  cycle_type: 'monthly' | 'yearly';
  reset_description: string;
  next_reset_time: string;
  days_until_reset: number;
  current_period: {
    start: string;
    end: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * 获取用户配额重置信息
 */
export const getQuotaResetInfo = async (): Promise<ApiResponse<QuotaResetInfo>> => {
  const response = await axios.get('/api/user/quota-reset-info');
  return response.data;
};

/**
 * 获取用户配额使用统计（增强版）
 */
export const getUserUsageStats = async (): Promise<ApiResponse<QuotaUsage[]>> => {
  const response = await axios.get('/api/user/usage-stats');
  return response.data;
};
```

## 管理员接口

### 查看用户配额周期信息

**接口**: `GET /api/admin/users/:userId/quota-cycle`

**响应**:
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "username": "testuser",
    "plan_name": "专业版",
    "billing_cycle": "monthly",
    "quota_cycle_type": "monthly",
    "quota_reset_anchor": "2026-01-15T00:00:00Z",
    "reset_description": "每月15号重置",
    "next_reset_time": "2026-02-15T00:00:00Z",
    "current_period": {
      "start": "2026-01-15T00:00:00Z",
      "end": "2026-02-14T23:59:59Z"
    },
    "quotas": [
      {
        "feature_code": "articles_per_month",
        "feature_name": "每月生成文章数",
        "limit": 50,
        "used": 15,
        "remaining": 35
      }
    ]
  }
}
```

### 手动调整配额周期（特殊情况）

**接口**: `POST /api/admin/users/:userId/adjust-quota-cycle`

**请求**:
```json
{
  "quota_reset_anchor": "2026-01-20T00:00:00Z",
  "reason": "用户要求调整重置日期"
}
```

**响应**:
```json
{
  "success": true,
  "message": "配额周期已调整",
  "data": {
    "old_anchor": "2026-01-15T00:00:00Z",
    "new_anchor": "2026-01-20T00:00:00Z",
    "reset_description": "每月20号重置"
  }
}
```

## WebSocket 事件

### 配额重置提醒

当用户配额即将重置时（提前3天、1天），发送 WebSocket 通知：

```typescript
// 事件类型
type: 'quota:reset_reminder'

// 数据
{
  "days_until_reset": 3,
  "reset_description": "每月15号重置",
  "next_reset_time": "2026-02-15T00:00:00Z",
  "message": "您的配额将在3天后重置，请合理安排使用"
}
```

### 配额已重置

配额重置后，发送通知：

```typescript
// 事件类型
type: 'quota:reset_completed'

// 数据
{
  "reset_time": "2026-02-15T00:00:00Z",
  "new_period": {
    "start": "2026-02-15T00:00:00Z",
    "end": "2026-03-14T23:59:59Z"
  },
  "message": "您的配额已重置，新周期已开始"
}
```

## 数据库查询示例

### 查询用户配额周期

```sql
-- 单个用户
SELECT 
  u.username,
  sp.plan_name,
  us.quota_cycle_type,
  us.quota_reset_anchor,
  get_quota_reset_description(u.id) as reset_rule,
  get_next_quota_reset_time(u.id) as next_reset,
  p.period_start,
  p.period_end
FROM users u
JOIN user_subscriptions us ON us.user_id = u.id
JOIN subscription_plans sp ON sp.id = us.plan_id
CROSS JOIN LATERAL get_user_quota_period(u.id, 'articles_per_month') p
WHERE u.id = 123
  AND us.status = 'active';
```

### 查询即将重置的用户

```sql
-- 未来3天内重置的用户
SELECT 
  u.id,
  u.username,
  u.email,
  get_next_quota_reset_time(u.id) as next_reset,
  EXTRACT(DAY FROM get_next_quota_reset_time(u.id) - CURRENT_TIMESTAMP) as days_remaining
FROM users u
WHERE get_next_quota_reset_time(u.id) BETWEEN 
  CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '3 days'
ORDER BY next_reset;
```

### 统计配额重置日期分布

```sql
-- 月度用户的重置日期分布
SELECT 
  EXTRACT(DAY FROM quota_reset_anchor) as reset_day,
  COUNT(*) as user_count
FROM user_subscriptions
WHERE status = 'active'
  AND quota_cycle_type = 'monthly'
  AND end_date > CURRENT_TIMESTAMP
GROUP BY reset_day
ORDER BY reset_day;
```

## 测试建议

### 单元测试

```typescript
describe('配额重置周期', () => {
  it('应该根据订阅日期计算重置周期', async () => {
    // 创建1月15日购买的用户
    const userId = await createTestUser('2026-01-15');
    
    // 获取配额周期
    const period = await getQuotaPeriod(userId);
    
    expect(period.period_start).toBe('2026-01-15T00:00:00Z');
    expect(period.period_end).toBe('2026-02-14T23:59:59Z');
  });
  
  it('应该为不同用户计算不同的重置周期', async () => {
    const user1 = await createTestUser('2026-01-01');
    const user2 = await createTestUser('2026-01-15');
    
    const period1 = await getQuotaPeriod(user1);
    const period2 = await getQuotaPeriod(user2);
    
    expect(period1.period_start).not.toBe(period2.period_start);
  });
});
```

### 集成测试

```bash
# 测试配额重置信息接口
curl -X GET http://localhost:3000/api/user/quota-reset-info \
  -H "Authorization: Bearer YOUR_TOKEN"

# 测试配额使用统计接口
curl -X GET http://localhost:3000/api/user/usage-stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**文档版本**: 1.0  
**更新日期**: 2026-01-05  
**相关迁移**: 031
