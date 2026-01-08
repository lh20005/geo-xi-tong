# Design Document: 代理商折扣功能

## Overview

本设计文档描述了 GEO 优化系统代理商折扣功能的技术实现方案。该功能扩展现有的套餐管理和支付系统，允许管理员为每个套餐设置代理商专属折扣比例，被代理商邀请的新用户首次购买时自动享受优惠。

核心流程：
1. 管理员在商品管理页面为套餐设置代理商折扣比例（如 80 表示 8 折）
2. 被邀请用户访问落地页时，系统检查折扣资格并展示优惠价格
3. 用户下单时，系统实时查询套餐折扣设置，计算折扣价
4. 支付成功后，标记用户已使用首次购买折扣

**关键设计原则**：
- 折扣比例随套餐配置，实时查询，不硬编码
- 首次购买折扣仅限一次，支付成功后标记
- 订单记录完整的折扣信息（原价、折扣比例、实付金额）
- 不影响现有支付流程，仅在符合条件时应用折扣

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
├─────────────────────────────────────────────────────────────────┤
│  Landing Page (8080)           │  Admin Panel (5173)            │
│  ├── PricingSection            │  ├── ProductManagementPage     │
│  │   ├── PlanCard              │  │   ├── PlanEditModal         │
│  │   │   ├── OriginalPrice     │  │   │   └── AgentDiscountInput│
│  │   │   ├── DiscountPrice     │  │   └── PlanListTable         │
│  │   │   └── DiscountBadge     │  │       └── DiscountColumn    │
│  │   └── PaymentModal          │  └── OrderManagementPage       │
│  └── useDiscountEligibility    │      └── DiscountFilter        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                         │
├─────────────────────────────────────────────────────────────────┤
│  Routes                                                          │
│  ├── /api/subscription/plans           (套餐列表，含折扣信息)    │
│  ├── /api/subscription/discount-check  (检查用户折扣资格)        │
│  ├── /api/admin/products/plans/:id     (更新套餐，含折扣配置)    │
│  └── /api/orders                       (创建订单，应用折扣)      │
├─────────────────────────────────────────────────────────────────┤
│  Services                                                        │
│  ├── DiscountService           (折扣资格检查、价格计算)          │
│  ├── ProductManagementService  (套餐管理，扩展折扣配置)          │
│  ├── PaymentService            (支付流程，应用折扣)              │
│  └── OrderService              (订单管理，记录折扣信息)          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database                                  │
├─────────────────────────────────────────────────────────────────┤
│  subscription_plans                                              │
│  └── + agent_discount_rate INTEGER DEFAULT 100                   │
│                                                                  │
│  orders                                                          │
│  ├── + original_price DECIMAL(12,2)                              │
│  ├── + discount_rate INTEGER                                     │
│  └── + is_agent_discount BOOLEAN DEFAULT FALSE                   │
│                                                                  │
│  users                                                           │
│  └── + first_purchase_discount_used BOOLEAN DEFAULT FALSE        │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. DiscountService (折扣服务)

```typescript
interface DiscountService {
  // 检查用户是否有资格享受代理商折扣
  // 条件：1) 通过代理商邀请码注册 2) 首次购买（无成功支付记录）
  checkDiscountEligibility(userId: number): Promise<DiscountEligibility>;
  
  // 计算折扣价格
  // 公式：折扣价 = 原价 × (折扣比例 / 100)，四舍五入到分
  calculateDiscountedPrice(originalPrice: number, discountRate: number): number;
  
  // 获取用户的折扣价格信息（用于落地页展示）
  getUserDiscountPrices(userId: number, planIds: number[]): Promise<PlanDiscountInfo[]>;
  
  // 标记用户已使用首次购买折扣
  markFirstPurchaseDiscountUsed(userId: number): Promise<void>;
}

interface DiscountEligibility {
  eligible: boolean;           // 是否有资格
  reason?: string;             // 不符合资格的原因
  invitedByAgent: boolean;     // 是否被代理商邀请
  isFirstPurchase: boolean;    // 是否首次购买
}

interface PlanDiscountInfo {
  planId: number;
  planName: string;
  originalPrice: number;       // 原价
  discountRate: number;        // 折扣比例（1-100）
  discountedPrice: number;     // 折扣价
  hasDiscount: boolean;        // 是否有折扣（discountRate < 100）
}
```

### 2. ProductManagementService 扩展

```typescript
// 扩展现有的 SubscriptionPlan 接口
interface SubscriptionPlan {
  // ... 现有字段
  agentDiscountRate: number;   // 代理商折扣比例（1-100，默认100）
}

// 扩展 updatePlan 方法支持折扣配置
interface PlanUpdateData {
  // ... 现有字段
  agentDiscountRate?: number;  // 可选的折扣比例更新
}
```

### 3. PaymentService 扩展

```typescript
// 扩展订单创建逻辑
interface OrderCreationContext {
  userId: number;
  planId: number;
  originalPrice: number;
  discountRate: number;        // 100 表示无折扣
  finalPrice: number;          // 实际支付金额
  isAgentDiscount: boolean;    // 是否使用代理商折扣
}
```

### 4. API 接口设计

```typescript
// GET /api/subscription/discount-check
// 检查当前用户的折扣资格
interface DiscountCheckResponse {
  success: boolean;
  data: {
    eligible: boolean;
    reason?: string;
    plans: PlanDiscountInfo[];  // 所有套餐的折扣价格信息
  };
}

// PUT /api/admin/products/plans/:id
// 更新套餐（扩展支持折扣配置）
interface UpdatePlanRequest {
  // ... 现有字段
  agentDiscountRate?: number;  // 1-100
}
```

## Data Models

### 数据库迁移

```sql
-- 1. 为 subscription_plans 表添加代理商折扣字段
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS agent_discount_rate INTEGER DEFAULT 100;

-- 添加约束：折扣比例必须在 1-100 之间
ALTER TABLE subscription_plans 
ADD CONSTRAINT chk_agent_discount_rate 
CHECK (agent_discount_rate >= 1 AND agent_discount_rate <= 100);

-- 2. 为 orders 表添加折扣相关字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS original_price DECIMAL(12,2);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS discount_rate INTEGER DEFAULT 100;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_agent_discount BOOLEAN DEFAULT FALSE;

-- 3. 为 users 表添加首次购买折扣使用标记
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_purchase_discount_used BOOLEAN DEFAULT FALSE;

-- 4. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_orders_is_agent_discount 
ON orders(is_agent_discount);

CREATE INDEX IF NOT EXISTS idx_users_first_purchase_discount 
ON users(first_purchase_discount_used);
```

### TypeScript 类型定义

```typescript
// 折扣资格检查结果
interface DiscountEligibility {
  eligible: boolean;
  reason?: 'not_invited_by_agent' | 'not_first_purchase' | 'discount_already_used';
  invitedByAgent: boolean;
  isFirstPurchase: boolean;
  discountUsed: boolean;
}

// 套餐折扣信息
interface PlanDiscountInfo {
  planId: number;
  planName: string;
  planCode: string;
  originalPrice: number;
  discountRate: number;
  discountedPrice: number;
  hasDiscount: boolean;
}

// 订单折扣信息
interface OrderDiscountInfo {
  originalPrice: number;
  discountRate: number;
  finalPrice: number;
  isAgentDiscount: boolean;
  savedAmount: number;  // 节省金额 = originalPrice - finalPrice
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 折扣比例输入验证

*For any* 折扣比例输入值，系统应只接受 1-100 之间的整数，拒绝其他值。

**Validates: Requirements 1.2**

### Property 2: 折扣配置持久化

*For any* 套餐折扣配置更新操作，保存后重新查询应返回相同的折扣比例值。

**Validates: Requirements 1.5**

### Property 3: 折扣资格判断

*For any* 用户，其折扣资格应满足以下规则：
- 如果用户通过代理商邀请码注册 AND 无成功支付订单 AND 未使用过首次购买折扣 → 有资格
- 否则 → 无资格

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

### Property 4: 折扣价格计算准确性

*For any* 原价和折扣比例（1-100），计算出的折扣价应等于 round(原价 × 折扣比例 / 100, 2)，且不小于 0.01。

**Validates: Requirements 3.1, 3.2, 3.4**

### Property 5: 订单折扣应用完整性

*For any* 有折扣资格的用户创建的订单，订单记录应包含：
- original_price = 套餐原价
- discount_rate = 套餐当前折扣比例
- amount = 计算后的折扣价
- is_agent_discount = true

**Validates: Requirements 3.5, 3.6, 5.2, 5.3, 6.1, 6.2**

### Property 6: 首次购买折扣状态管理

*For any* 用户，首次购买折扣状态应满足：
- 支付成功后，first_purchase_discount_used 应为 true
- 支付失败后，first_purchase_discount_used 应保持 false
- 一旦为 true，后续订单不再应用折扣

**Validates: Requirements 5.5, 5.6, 8.4**

### Property 7: 折扣统计准确性

*For any* 时间范围内的订单统计，代理商折扣订单数量应等于 is_agent_discount = true 的订单数，优惠总金额应等于所有折扣订单的 (original_price - amount) 之和。

**Validates: Requirements 6.5**

### Property 8: 代理商状态不影响用户折扣

*For any* 被代理商邀请的用户，即使邀请代理商被暂停，用户仍应有资格享受首次购买折扣。

**Validates: Requirements 8.2**

### Property 9: 折扣比例快照

*For any* 订单创建过程，订单记录的 discount_rate 应为创建时查询到的值，即使管理员在此期间修改了套餐折扣比例。

**Validates: Requirements 8.3**

## Error Handling

### 业务错误处理

```typescript
// 折扣相关错误码
const DiscountErrorCodes = {
  INVALID_DISCOUNT_RATE: 'INVALID_DISCOUNT_RATE',      // 折扣比例无效（不在1-100范围）
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',                        // 用户无折扣资格
  DISCOUNT_ALREADY_USED: 'DISCOUNT_ALREADY_USED',      // 首次购买折扣已使用
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',                    // 套餐不存在
};

// 错误处理示例
class DiscountError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}
```

### 边界情况处理

| 场景 | 处理策略 |
|------|----------|
| 折扣比例为 NULL | 视为 100（无折扣） |
| 折扣比例为 0 | 拒绝，返回验证错误 |
| 折扣比例 > 100 | 拒绝，返回验证错误 |
| 计算结果 < 0.01 | 设为 0.01 |
| 并发修改折扣比例 | 使用订单创建时的快照值 |
| 支付失败 | 不标记折扣已使用 |
| 订单退款 | 不恢复折扣资格 |

## Testing Strategy

### 单元测试

- DiscountService 方法测试
  - checkDiscountEligibility 各种用户状态组合
  - calculateDiscountedPrice 各种价格和折扣组合
  - markFirstPurchaseDiscountUsed 状态更新

- ProductManagementService 扩展测试
  - 折扣比例验证
  - 折扣配置保存和读取

### 属性测试

使用 fast-check 进行属性测试：

```typescript
import fc from 'fast-check';

describe('Discount Calculation Properties', () => {
  // Property 4: 折扣价格计算准确性
  it('should calculate discounted price correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.01, max: 10000, noNaN: true }),  // 原价
        fc.integer({ min: 1, max: 100 }),                   // 折扣比例
        (originalPrice, discountRate) => {
          const discountedPrice = calculateDiscountedPrice(originalPrice, discountRate);
          const expected = Math.max(0.01, Math.round(originalPrice * discountRate) / 100);
          return Math.abs(discountedPrice - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 1: 折扣比例输入验证
  it('should reject invalid discount rates', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        (rate) => {
          const isValid = rate >= 1 && rate <= 100;
          const result = validateDiscountRate(rate);
          return result.valid === isValid;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 集成测试

- 完整的折扣购买流程测试
  - 管理员设置折扣 → 用户查看折扣价 → 用户下单 → 支付成功 → 折扣标记
- 边界情况测试
  - 非邀请用户购买
  - 已使用折扣用户再次购买
  - 并发修改折扣比例

### 测试框架

- Jest 单元测试
- fast-check 属性测试
- Supertest API 集成测试

