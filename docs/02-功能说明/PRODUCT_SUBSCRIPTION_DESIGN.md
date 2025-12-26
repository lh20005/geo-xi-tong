# 产品订阅系统设计方案

## 问题分析

你的核心问题是：**产品套餐配置应该硬编码在代码中，还是做成可配置的管理后台？**

## 方案对比

### 方案 1：硬编码在代码中

```typescript
// server/src/config/plans.ts
export const PLANS = {
  free: {
    name: '体验版',
    price: 0,
    features: {
      articlesPerMonth: 10,
      publishPerMonth: 20,
      platformAccounts: 1,
      keywordDistillation: 50,
      knowledgeBaseSize: 100 * 1024 * 1024, // 100MB
    }
  },
  professional: {
    name: '专业版',
    price: 99,
    features: {
      articlesPerMonth: 100,
      publishPerMonth: 200,
      platformAccounts: 3,
      keywordDistillation: 500,
      knowledgeBaseSize: 1024 * 1024 * 1024, // 1GB
    }
  },
  enterprise: {
    name: '企业版',
    price: 299,
    features: {
      articlesPerMonth: -1, // -1 表示无限制
      publishPerMonth: -1,
      platformAccounts: 10,
      keywordDistillation: -1,
      knowledgeBaseSize: 10 * 1024 * 1024 * 1024, // 10GB
    }
  }
};
```

**优点：**
- ✅ 简单直接，开发快速
- ✅ 性能最好（无需查询数据库）
- ✅ 不会被误操作修改
- ✅ 代码即文档，清晰明了

**缺点：**
- ❌ 修改需要重新部署代码
- ❌ 不能快速响应市场变化
- ❌ 无法做 A/B 测试
- ❌ 不能针对特定用户定制

**适用场景：**
- 产品初期，套餐稳定
- 技术团队主导定价
- 不需要频繁调整

---

### 方案 2：数据库配置（推荐）

```sql
-- 套餐配置表
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  plan_code VARCHAR(50) UNIQUE NOT NULL,  -- 'free', 'professional', 'enterprise'
  plan_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly',  -- 'monthly', 'yearly'
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 套餐功能配额表
CREATE TABLE plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,  -- 'articles_per_month', 'publish_per_month'
  feature_name VARCHAR(100) NOT NULL,
  feature_value INTEGER,  -- -1 表示无限制
  feature_unit VARCHAR(20),  -- '篇', '个', 'MB'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_code)
);

-- 用户订阅表
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'expired', 'cancelled'
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户使用量统计表
CREATE TABLE user_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,  -- 统计周期开始
  period_end DATE NOT NULL,    -- 统计周期结束
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, feature_code, period_start)
);
```

**优点：**
- ✅ 灵活可配置，无需重新部署
- ✅ 可以快速调整价格和功能
- ✅ 支持 A/B 测试和促销活动
- ✅ 可以为特定用户定制套餐
- ✅ 完整的历史记录和审计
- ✅ 支持多种计费周期

**缺点：**
- ❌ 开发复杂度较高
- ❌ 需要管理后台界面
- ❌ 性能略低（需要查询数据库）
- ❌ 可能被误操作修改

**适用场景：**
- 产品成熟期，需要灵活调整
- 运营团队主导定价
- 需要频繁测试和优化
- 有多种套餐组合

---

### 方案 3：混合方案（最佳实践）

**核心思想：代码定义结构，数据库存储配置**

```typescript
// server/src/config/planStructure.ts
// 定义功能代码和默认值（代码中）
export const FEATURE_DEFINITIONS = {
  articles_per_month: {
    name: '每月生成文章数',
    unit: '篇',
    defaultValue: 10,
    description: '每月可生成的文章数量'
  },
  publish_per_month: {
    name: '每月发布文章数',
    unit: '篇',
    defaultValue: 20,
    description: '每月可发布的文章数量'
  },
  platform_accounts: {
    name: '平台账号数',
    unit: '个',
    defaultValue: 1,
    description: '可管理的平台账号数量'
  },
  keyword_distillation: {
    name: '关键词蒸馏数',
    unit: '个',
    defaultValue: 50,
    description: '每月可蒸馏的关键词数量'
  },
  knowledge_base_size: {
    name: '知识库容量',
    unit: 'MB',
    defaultValue: 100,
    description: '企业知识库存储容量'
  }
} as const;

// 套餐代码定义（代码中）
export const PLAN_CODES = {
  FREE: 'free',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise'
} as const;
```

```typescript
// server/src/services/SubscriptionService.ts
// 业务逻辑（代码中）+ 配置数据（数据库中）
class SubscriptionService {
  // 获取套餐配置（从数据库，带缓存）
  async getPlanConfig(planCode: string) {
    // 先从缓存获取
    const cached = await redis.get(`plan:${planCode}`);
    if (cached) return JSON.parse(cached);
    
    // 从数据库获取
    const plan = await pool.query(
      `SELECT p.*, 
              json_agg(json_build_object(
                'feature_code', f.feature_code,
                'feature_value', f.feature_value
              )) as features
       FROM subscription_plans p
       LEFT JOIN plan_features f ON p.id = f.plan_id
       WHERE p.plan_code = $1 AND p.is_active = true
       GROUP BY p.id`,
      [planCode]
    );
    
    if (plan.rows.length === 0) {
      // 如果数据库没有，使用代码中的默认值
      return this.getDefaultPlanConfig(planCode);
    }
    
    // 缓存5分钟
    await redis.setex(`plan:${planCode}`, 300, JSON.stringify(plan.rows[0]));
    
    return plan.rows[0];
  }
  
  // 检查用户是否可以执行某个操作
  async canUserPerformAction(userId: number, featureCode: string): Promise<boolean> {
    // 1. 获取用户当前套餐
    const subscription = await this.getUserActiveSubscription(userId);
    if (!subscription) {
      // 没有订阅，使用免费套餐
      subscription = await this.getPlanConfig(PLAN_CODES.FREE);
    }
    
    // 2. 获取该功能的配额
    const feature = subscription.features.find(f => f.feature_code === featureCode);
    if (!feature) return false;
    
    // -1 表示无限制
    if (feature.feature_value === -1) return true;
    
    // 3. 获取用户当前使用量
    const usage = await this.getUserUsage(userId, featureCode);
    
    // 4. 判断是否超过配额
    return usage < feature.feature_value;
  }
  
  // 记录用户使用量
  async recordUsage(userId: number, featureCode: string, amount: number = 1) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    await pool.query(
      `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, feature_code, period_start)
       DO UPDATE SET 
         usage_count = user_usage.usage_count + $3,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, featureCode, amount, periodStart, periodEnd]
    );
  }
  
  // 获取用户使用量
  async getUserUsage(userId: number, featureCode: string): Promise<number> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const result = await pool.query(
      `SELECT usage_count FROM user_usage
       WHERE user_id = $1 AND feature_code = $2 AND period_start = $3`,
      [userId, featureCode, periodStart]
    );
    
    return result.rows[0]?.usage_count || 0;
  }
}
```

**使用示例：**

```typescript
// 在文章生成 API 中使用
router.post('/api/articles/generate', authenticate, async (req, res) => {
  const userId = req.user.userId;
  
  // 检查是否可以生成文章
  const canGenerate = await subscriptionService.canUserPerformAction(
    userId,
    'articles_per_month'
  );
  
  if (!canGenerate) {
    return res.status(403).json({
      success: false,
      message: '本月文章生成配额已用完，请升级套餐',
      code: 'QUOTA_EXCEEDED'
    });
  }
  
  // 生成文章
  const article = await articleService.generate(req.body);
  
  // 记录使用量
  await subscriptionService.recordUsage(userId, 'articles_per_month', 1);
  
  res.json({
    success: true,
    data: article
  });
});
```

**优点：**
- ✅ 结合了两种方案的优点
- ✅ 代码定义结构，保证一致性
- ✅ 数据库存储配置，灵活可调
- ✅ 有默认值，即使数据库出问题也能运行
- ✅ 使用缓存，性能优秀

**缺点：**
- ❌ 实现复杂度最高
- ❌ 需要维护代码和数据库两部分

**适用场景：**
- 中大型 SaaS 产品（推荐）
- 需要平衡灵活性和稳定性
- 有专业的产品和技术团队

---

## 推荐方案：混合方案

### 为什么推荐混合方案？

对于你的 GEO 系统，我强烈推荐**混合方案**，原因如下：

1. **产品会持续迭代**
   - 初期可能需要频繁调整价格和配额
   - 后期可能增加新功能和套餐

2. **运营需要灵活性**
   - 节假日促销活动
   - 针对不同客户的定制套餐
   - A/B 测试不同定价策略

3. **技术需要稳定性**
   - 核心功能代码不应频繁变动
   - 配额检查逻辑应该统一
   - 即使数据库出问题也能降级运行

4. **团队协作效率**
   - 运营可以自己调整配置
   - 技术专注于功能开发
   - 减少沟通成本

---

## 完整实现方案

### 1. 数据库设计

```sql
-- 初始化套餐数据
INSERT INTO subscription_plans (plan_code, plan_name, price, display_order) VALUES
('free', '体验版', 0.00, 1),
('professional', '专业版', 99.00, 2),
('enterprise', '企业版', 299.00, 3);

-- 初始化功能配额
-- 体验版
INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit) VALUES
(1, 'articles_per_month', '每月生成文章数', 10, '篇'),
(1, 'publish_per_month', '每月发布文章数', 20, '篇'),
(1, 'platform_accounts', '平台账号数', 1, '个'),
(1, 'keyword_distillation', '关键词蒸馏数', 50, '个'),
(1, 'knowledge_base_size', '知识库容量', 100, 'MB');

-- 专业版
INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit) VALUES
(2, 'articles_per_month', '每月生成文章数', 100, '篇'),
(2, 'publish_per_month', '每月发布文章数', 200, '篇'),
(2, 'platform_accounts', '平台账号数', 3, '个'),
(2, 'keyword_distillation', '关键词蒸馏数', 500, '个'),
(2, 'knowledge_base_size', '知识库容量', 1024, 'MB');

-- 企业版
INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit) VALUES
(3, 'articles_per_month', '每月生成文章数', -1, '篇'),
(3, 'publish_per_month', '每月发布文章数', -1, '篇'),
(3, 'platform_accounts', '平台账号数', 10, '个'),
(3, 'keyword_distillation', '关键词蒸馏数', -1, '个'),
(3, 'knowledge_base_size', '知识库容量', 10240, 'MB');
```

### 2. 管理后台界面

```typescript
// landing/src/pages/SubscriptionManagementPage.tsx
export default function SubscriptionManagementPage() {
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">订阅套餐管理</h1>
      
      {/* 套餐列表 */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="border rounded-lg p-6">
            <h3 className="text-xl font-bold">{plan.plan_name}</h3>
            <div className="text-3xl font-bold my-4">
              ¥{plan.price}
              <span className="text-sm text-gray-500">/月</span>
            </div>
            
            {/* 功能列表 */}
            <div className="space-y-2 mb-4">
              {plan.features.map(feature => (
                <div key={feature.feature_code} className="flex justify-between">
                  <span className="text-sm">{feature.feature_name}</span>
                  <span className="text-sm font-medium">
                    {feature.feature_value === -1 
                      ? '不限' 
                      : `${feature.feature_value}${feature.feature_unit}`
                    }
                  </span>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setEditingPlan(plan)}
              className="w-full py-2 bg-blue-600 text-white rounded-lg"
            >
              编辑套餐
            </button>
          </div>
        ))}
      </div>
      
      {/* 编辑对话框 */}
      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={handleSavePlan}
        />
      )}
    </div>
  );
}
```

### 3. API 接口

```typescript
// server/src/routes/subscription.ts
router.get('/api/subscription/plans', async (req, res) => {
  const plans = await subscriptionService.getAllPlans();
  res.json({ success: true, data: plans });
});

router.put('/api/admin/subscription/plans/:id', authenticate, requireAdmin, async (req, res) => {
  const { price, features } = req.body;
  
  // 记录操作日志
  await logAdminAction(
    req.user.userId,
    'UPDATE_SUBSCRIPTION_PLAN',
    req.params.id,
    { price, features },
    req.ip
  );
  
  // 更新套餐
  const updated = await subscriptionService.updatePlan(req.params.id, { price, features });
  
  // 清除缓存
  await redis.del(`plan:${updated.plan_code}`);
  
  res.json({ success: true, data: updated });
});
```

### 4. 中间件使用

```typescript
// server/src/middleware/checkQuota.ts
export function checkQuota(featureCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.userId;
    
    const canPerform = await subscriptionService.canUserPerformAction(
      userId,
      featureCode
    );
    
    if (!canPerform) {
      // 获取用户套餐信息，用于提示升级
      const subscription = await subscriptionService.getUserActiveSubscription(userId);
      const currentPlan = subscription?.plan_name || '体验版';
      
      return res.status(403).json({
        success: false,
        message: `${currentPlan}配额已用完，请升级套餐`,
        code: 'QUOTA_EXCEEDED',
        currentPlan: currentPlan,
        upgradeUrl: '/pricing'
      });
    }
    
    // 将 featureCode 附加到 request，方便后续记录使用量
    (req as any).featureCode = featureCode;
    next();
  };
}

// 使用示例
router.post('/api/articles/generate', 
  authenticate, 
  checkQuota('articles_per_month'),  // 检查配额
  async (req, res) => {
    // 生成文章
    const article = await articleService.generate(req.body);
    
    // 记录使用量
    await subscriptionService.recordUsage(
      req.user.userId, 
      (req as any).featureCode, 
      1
    );
    
    res.json({ success: true, data: article });
  }
);
```

---

## 实施步骤

### 第一阶段：基础架构（1-2天）
1. ✅ 创建数据库表
2. ✅ 实现 SubscriptionService
3. ✅ 实现配额检查中间件
4. ✅ 初始化默认套餐数据

### 第二阶段：业务集成（2-3天）
1. ✅ 在文章生成 API 中集成配额检查
2. ✅ 在文章发布 API 中集成配额检查
3. ✅ 在其他功能中集成配额检查
4. ✅ 实现使用量统计和展示

### 第三阶段：管理后台（2-3天）
1. ✅ 实现套餐管理页面
2. ✅ 实现套餐编辑功能
3. ✅ 实现用户订阅管理
4. ✅ 实现使用量查看

### 第四阶段：支付集成（3-5天）
1. ✅ 集成支付接口（微信/支付宝）
2. ✅ 实现订单管理
3. ✅ 实现自动续费
4. ✅ 实现发票管理

---

## 最佳实践建议

### 1. 配额设计原则

```typescript
// 好的设计：功能独立，易于扩展
const FEATURES = {
  articles_per_month: '每月生成文章数',
  publish_per_month: '每月发布文章数',
  platform_accounts: '平台账号数',
  // 未来可以轻松添加新功能
  ai_model_advanced: '高级AI模型',
  priority_support: '优先技术支持'
};

// 不好的设计：功能耦合
const FEATURES = {
  basic_package: '基础功能包',  // 包含多个功能，难以单独调整
};
```

### 2. 配额检查位置

```typescript
// ✅ 好的做法：在 API 入口检查
router.post('/api/articles/generate', checkQuota('articles_per_month'), handler);

// ❌ 不好的做法：在业务逻辑中检查
async function generateArticle(userId, data) {
  // 业务逻辑中检查，容易遗漏
  if (!await canGenerate(userId)) {
    throw new Error('配额不足');
  }
  // ...
}
```

### 3. 用户体验优化

```typescript
// 在前端显示配额使用情况
GET /api/user/quota-status
{
  "success": true,
  "data": {
    "plan": "professional",
    "features": [
      {
        "code": "articles_per_month",
        "name": "每月生成文章数",
        "limit": 100,
        "used": 45,
        "remaining": 55,
        "percentage": 45
      }
    ]
  }
}
```

### 4. 降级策略

```typescript
// 如果数据库查询失败，使用默认配置
async getPlanConfig(planCode: string) {
  try {
    return await this.getPlanFromDatabase(planCode);
  } catch (error) {
    console.error('获取套餐配置失败，使用默认配置', error);
    return this.getDefaultPlanConfig(planCode);
  }
}
```

---

## 总结

### 直接回答你的问题

**应该在后端数据库操作，还是开发产品模块在网页端设置？**

**答案：开发产品模块，在网页端设置（混合方案）**

**理由：**
1. ✅ 运营可以快速调整价格和配额，无需技术介入
2. ✅ 可以灵活应对市场变化和促销活动
3. ✅ 支持 A/B 测试和个性化定制
4. ✅ 完整的操作日志和审计
5. ✅ 代码定义结构，保证稳定性
6. ✅ 数据库存储配置，保证灵活性

### 实施建议

1. **立即开始**：实施混合方案的基础架构
2. **分步实施**：先实现核心功能，再完善管理后台
3. **安全第一**：管理后台使用前面讨论的安全措施
4. **用户体验**：前端清晰展示配额使用情况

**需要我帮你实现这个订阅系统吗？** 我可以从数据库设计开始，一步步帮你搭建完整的产品订阅模块。
