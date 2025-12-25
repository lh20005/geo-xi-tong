# Design Document

## Overview

本设计文档描述了 GEO-SaaS 系统的商品管理与订阅系统的技术实现方案。系统采用混合架构，代码定义功能结构，数据库存储配置数据，确保灵活性和稳定性的平衡。

核心特性：
- 管理员通过网页端可视化配置商品套餐
- 集成微信支付 API v3 实现在线支付
- 用户购买后自动开通对应权限
- 实时配额检查和使用量统计
- 完整的安全措施和审计日志

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层                               │
├─────────────────────────────────────────────────────────────┤
│  Landing 网站                    │  Client 管理后台          │
│  - 套餐展示页面                  │  - 商品配置页面（管理员）  │
│  - 购买支付页面                  │  - 订单管理页面（管理员）  │
│  - 个人中心（订阅状态）          │  - 配置历史页面（管理员）  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         API 层                               │
├─────────────────────────────────────────────────────────────┤
│  认证中间件 (authenticate)                                   │
│  权限中间件 (requireAdmin)                                   │
│  配额检查中间件 (checkQuota)                                 │
│  频率限制中间件 (rateLimit)                                  │
│  确认令牌中间件 (requireConfirmation)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       业务逻辑层                             │
├─────────────────────────────────────────────────────────────┤
│  SubscriptionService  │  PaymentService  │  OrderService    │
│  ProductService       │  UsageService    │  AuditLogService │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据层                                │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 数据库    │  Redis 缓存      │  环境变量配置    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       外部服务                               │
├─────────────────────────────────────────────────────────────┤
│  微信支付 API v3      │  WebSocket 通知  │  邮件服务        │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

**后端**:
- Node.js + TypeScript
- Express.js
- PostgreSQL (数据持久化)
- Redis (缓存 + 会话)
- wechatpay-axios-plugin (微信支付集成，基于微信官方规范)

**前端**:
- React + TypeScript
- Ant Design (UI组件库)
- Axios (HTTP客户端)

**安全**:
- JWT 认证
- HTTPS 加密传输
- 环境变量存储密钥
- 操作审计日志



## Components and Interfaces

### 1. 数据库设计

#### subscription_plans (套餐配置表)
```sql
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  plan_code VARCHAR(50) UNIQUE NOT NULL,  -- 'free', 'professional', 'enterprise'
  plan_name VARCHAR(100) NOT NULL,        -- '体验版', '专业版', '企业版'
  price DECIMAL(10, 2) NOT NULL,          -- 价格（元）
  billing_cycle VARCHAR(20) DEFAULT 'monthly',  -- 'monthly', 'yearly'
  is_active BOOLEAN DEFAULT true,         -- 是否启用
  display_order INTEGER DEFAULT 0,        -- 显示顺序
  description TEXT,                       -- 套餐描述
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plans_code ON subscription_plans(plan_code);
CREATE INDEX idx_plans_active ON subscription_plans(is_active);
```

#### plan_features (套餐功能配额表)
```sql
CREATE TABLE plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,      -- 'articles_per_day', 'publish_per_day', etc.
  feature_name VARCHAR(100) NOT NULL,     -- '每日生成文章数'
  feature_value INTEGER NOT NULL,         -- 配额值，-1表示无限制
  feature_unit VARCHAR(20),               -- '篇', '个'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_code)
);

CREATE INDEX idx_features_plan ON plan_features(plan_id);
CREATE INDEX idx_features_code ON plan_features(feature_code);
```

#### user_subscriptions (用户订阅表)
```sql
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'active',    -- 'active', 'expired', 'cancelled'
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_subscriptions_end_date ON user_subscriptions(end_date);
```

#### orders (订单表)
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,   -- 订单号
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  amount DECIMAL(10, 2) NOT NULL,         -- 订单金额
  status VARCHAR(20) DEFAULT 'pending',   -- 'pending', 'paid', 'failed', 'closed'
  payment_method VARCHAR(20),             -- 'wechat'
  transaction_id VARCHAR(100),            -- 微信支付交易号
  paid_at TIMESTAMP,                      -- 支付时间
  expired_at TIMESTAMP,                   -- 订单过期时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_no ON orders(order_no);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_transaction ON orders(transaction_id);
```

#### user_usage (用户使用量统计表)
```sql
CREATE TABLE user_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,             -- 统计周期开始（每日00:00）
  period_end DATE NOT NULL,               -- 统计周期结束（每日23:59）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, feature_code, period_start)
);

CREATE INDEX idx_usage_user_feature ON user_usage(user_id, feature_code);
CREATE INDEX idx_usage_period ON user_usage(period_start);
```

#### product_config_history (配置变更历史表)
```sql
CREATE TABLE product_config_history (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id),
  changed_by INTEGER REFERENCES users(id),
  change_type VARCHAR(50) NOT NULL,       -- 'price', 'feature', 'status', 'rollback'
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_plan ON product_config_history(plan_id);
CREATE INDEX idx_history_user ON product_config_history(changed_by);
CREATE INDEX idx_history_time ON product_config_history(created_at);
```



### 2. 功能配额定义（代码层）

```typescript
// server/src/config/features.ts
export const FEATURE_DEFINITIONS = {
  articles_per_day: {
    code: 'articles_per_day',
    name: '每日生成文章数',
    unit: '篇',
    defaultValue: 10,
    description: '每天可生成的文章数量',
    resetPeriod: 'daily'  // 每日重置
  },
  publish_per_day: {
    code: 'publish_per_day',
    name: '每日发布文章数',
    unit: '篇',
    defaultValue: 20,
    description: '每天可发布的文章数量',
    resetPeriod: 'daily'  // 每日重置
  },
  platform_accounts: {
    code: 'platform_accounts',
    name: '可管理平台账号数',
    unit: '个',
    defaultValue: 1,
    description: '可同时管理的平台账号数量',
    resetPeriod: 'never'  // 不重置
  },
  keyword_distillation: {
    code: 'keyword_distillation',
    name: '关键词蒸馏数',
    unit: '个',
    defaultValue: 50,
    description: '每月可蒸馏的关键词数量',
    resetPeriod: 'monthly'  // 每月重置
  }
} as const;

export const PLAN_CODES = {
  FREE: 'free',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise'
} as const;
```

### 3. 微信支付配置（环境变量）

```bash
# .env
# 微信支付配置（必须保密，不能提交到代码仓库）
WECHAT_PAY_APP_ID=wx1234567890abcdef          # 微信公众号/小程序 AppID
WECHAT_PAY_MCH_ID=1234567890                  # 商户号
WECHAT_PAY_API_V3_KEY=your_32_char_api_v3_key # API v3 密钥（32位）
WECHAT_PAY_SERIAL_NO=1234567890ABCDEF         # 商户证书序列号
WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/apiclient_key.pem  # 商户私钥路径
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify  # 支付回调地址
```

**安全要求**：
1. 所有密钥必须存储在环境变量中，不能硬编码
2. 证书文件存储在服务器安全目录，权限设置为 600
3. .env 文件必须添加到 .gitignore
4. 生产环境使用系统环境变量或密钥管理服务

### 4. 核心服务接口

#### SubscriptionService
```typescript
// server/src/services/SubscriptionService.ts
export class SubscriptionService {
  /**
   * 获取套餐配置（带缓存）
   */
  async getPlanConfig(planCode: string): Promise<Plan>;
  
  /**
   * 获取所有激活的套餐
   */
  async getAllActivePlans(): Promise<Plan[]>;
  
  /**
   * 更新套餐配置（管理员）
   */
  async updatePlan(planId: number, data: UpdatePlanDto): Promise<Plan>;
  
  /**
   * 获取用户当前订阅
   */
  async getUserActiveSubscription(userId: number): Promise<Subscription | null>;
  
  /**
   * 检查用户是否可以执行某个操作
   */
  async canUserPerformAction(userId: number, featureCode: string): Promise<boolean>;
  
  /**
   * 记录用户使用量
   */
  async recordUsage(userId: number, featureCode: string, amount: number): Promise<void>;
  
  /**
   * 获取用户使用量统计
   */
  async getUserUsageStats(userId: number): Promise<UsageStats>;
  
  /**
   * 为用户开通订阅
   */
  async activateSubscription(userId: number, planId: number, duration: number): Promise<Subscription>;
}
```

#### PaymentService
```typescript
// server/src/services/PaymentService.ts
export class PaymentService {
  /**
   * 创建微信支付订单
   */
  async createWeChatPayOrder(userId: number, planId: number): Promise<WeChatPayParams>;
  
  /**
   * 处理微信支付回调
   */
  async handleWeChatPayNotify(notifyData: any): Promise<void>;
  
  /**
   * 查询订单支付状态
   */
  async queryOrderStatus(orderNo: string): Promise<OrderStatus>;
  
  /**
   * 关闭超时订单
   */
  async closeExpiredOrders(): Promise<void>;
}
```

#### ProductService
```typescript
// server/src/services/ProductService.ts
export class ProductService {
  /**
   * 获取套餐配置历史
   */
  async getConfigHistory(planId: number, limit: number): Promise<ConfigHistory[]>;
  
  /**
   * 回滚配置到历史版本
   */
  async rollbackConfig(historyId: number, adminId: number): Promise<void>;
  
  /**
   * 记录配置变更
   */
  async recordConfigChange(change: ConfigChange): Promise<void>;
  
  /**
   * 通知配置变更
   */
  async notifyConfigChange(change: ConfigChange): Promise<void>;
}
```



## Data Models

### TypeScript 类型定义

```typescript
// server/src/types/subscription.ts

export interface Plan {
  id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  is_active: boolean;
  display_order: number;
  description?: string;
  features: PlanFeature[];
  created_at: Date;
  updated_at: Date;
}

export interface PlanFeature {
  id: number;
  plan_id: number;
  feature_code: string;
  feature_name: string;
  feature_value: number;  // -1 表示无限制
  feature_unit: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  plan: Plan;
  status: 'active' | 'expired' | 'cancelled';
  start_date: Date;
  end_date: Date;
  auto_renew: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: number;
  order_no: string;
  user_id: number;
  plan_id: number;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'closed';
  payment_method: 'wechat';
  transaction_id?: string;
  paid_at?: Date;
  expired_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UsageRecord {
  id: number;
  user_id: number;
  feature_code: string;
  usage_count: number;
  period_start: Date;
  period_end: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UsageStats {
  feature_code: string;
  feature_name: string;
  limit: number;
  used: number;
  remaining: number;
  percentage: number;
  unit: string;
}

export interface ConfigHistory {
  id: number;
  plan_id: number;
  changed_by: number;
  changed_by_name: string;
  change_type: string;
  field_name: string;
  old_value: string;
  new_value: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
}

export interface WeChatPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}
```

### API 请求/响应模型

```typescript
// 创建订单请求
export interface CreateOrderRequest {
  plan_id: number;
}

// 创建订单响应
export interface CreateOrderResponse {
  success: boolean;
  data: {
    order_no: string;
    amount: number;
    payment_params: WeChatPayParams;
  };
}

// 更新套餐请求
export interface UpdatePlanRequest {
  price?: number;
  features?: {
    feature_code: string;
    feature_value: number;
  }[];
  is_active?: boolean;
  confirmationToken?: string;  // 敏感操作需要
}

// 配额检查响应
export interface QuotaCheckResponse {
  success: boolean;
  can_perform: boolean;
  message?: string;
  current_plan?: string;
  upgrade_url?: string;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 套餐卡片数据完整性
*For any* 套餐对象，渲染后的卡片内容应该包含套餐名称、价格、每日生成文章数、每日发布文章数、可管理平台账号数、关键词蒸馏数这些必需字段
**Validates: Requirements 1.3**

### Property 2: 输入验证拒绝无效数据
*For any* 无效的套餐配置输入（负数价格、负数配额、空值等），系统应该拒绝并返回验证错误
**Validates: Requirements 1.5**

### Property 3: 配置变更产生审计日志
*For any* 套餐配置保存操作，系统应该创建包含操作人、时间、IP地址、变更内容的审计日志记录
**Validates: Requirements 1.6, 2.5**

### Property 4: 价格大幅变动需要确认
*For any* 套餐价格修改，如果变动幅度超过20%，系统应该返回需要确认令牌的响应
**Validates: Requirements 1.7**

### Property 5: 配置保存清除缓存
*For any* 套餐配置保存成功后，立即查询该套餐应该返回新值而不是缓存的旧值
**Validates: Requirements 1.8**

### Property 6: 非管理员访问被拒绝
*For any* 角色不是admin的用户，尝试访问商品管理API应该返回403错误
**Validates: Requirements 2.1, 2.2**

### Property 7: 敏感操作需要认证和授权
*For any* 敏感操作请求，如果JWT令牌无效或用户角色不是admin，应该被拒绝
**Validates: Requirements 2.3**

### Property 8: 价格修改频率限制
*For any* 管理员，在一小时内尝试修改价格超过5次，第6次及以后的请求应该被频率限制拒绝
**Validates: Requirements 2.4**

### Property 9: 配置变更通知所有管理员
*For any* 配置变更操作，系统应该向所有角色为admin的用户发送通知
**Validates: Requirements 2.6**

### Property 10: 订单号唯一性
*For any* 两个不同的购买请求，生成的订单号应该是唯一的
**Validates: Requirements 3.1**

### Property 11: 微信支付参数正确性
*For any* 成功的预支付订单创建，返回的支付参数应该包含appId、timeStamp、nonceStr、package、signType、paySign这些必需字段
**Validates: Requirements 3.3**

### Property 12: 支付回调签名验证
*For any* 支付回调请求，如果签名验证失败或订单不存在，应该拒绝处理并返回错误
**Validates: Requirements 3.5**

### Property 13: 支付成功自动开通订阅
*For any* 订单状态更新为已支付，系统应该为该用户创建对应套餐的订阅记录
**Validates: Requirements 3.7**

### Property 14: 前端不暴露支付密钥
*For any* API响应和前端代码，不应该包含微信商户密钥、API v3密钥或证书私钥
**Validates: Requirements 4.3**

### Property 15: 日志不记录完整密钥
*For any* 日志输出，如果包含密钥相关信息，应该只显示前4位和后4位，中间用星号替代
**Validates: Requirements 4.4**

### Property 16: 订阅信息数据完整性
*For any* 用户订阅记录，查询结果应该包含套餐名称、到期时间、所有功能配额信息
**Validates: Requirements 5.2**

### Property 17: 使用量统计准确性
*For any* 用户和功能，使用量统计应该等于该用户在当前周期内该功能的实际使用次数
**Validates: Requirements 5.3, 5.4, 5.5, 5.6**

### Property 18: 到期自动降级
*For any* 订阅记录，当到期时间小于当前时间且状态为active，系统应该自动将用户订阅切换到免费套餐
**Validates: Requirements 5.8**

### Property 19: 配额检查先于功能执行
*For any* 需要配额的功能请求，系统应该先检查用户配额，只有配额充足时才执行功能
**Validates: Requirements 6.1, 6.3, 6.5, 6.7**

### Property 20: 配额耗尽拒绝请求
*For any* 用户，当某功能的使用量达到或超过配额限制，该功能的请求应该被拒绝并返回配额不足的错误
**Validates: Requirements 6.2, 6.4, 6.6, 6.8**

### Property 21: 每日配额重置
*For any* 标记为每日重置的功能配额，在每天00:00时，所有用户的该功能使用量应该重置为0
**Validates: Requirements 6.9**

### Property 22: 使用量记录增量
*For any* 成功的功能使用，该用户该功能的使用量应该增加对应的数量
**Validates: Requirements 6.10**

### Property 23: 配置变更创建历史记录
*For any* 套餐配置修改，系统应该创建包含变更前后值的历史记录
**Validates: Requirements 8.1**

### Property 24: 配置历史数据完整性
*For any* 配置历史记录，应该包含变更时间、操作人、字段名、旧值、新值这些必需信息
**Validates: Requirements 8.2**

### Property 25: 配置回滚恢复旧值
*For any* 配置回滚操作，执行后的配置值应该等于历史记录中的旧值
**Validates: Requirements 8.3, 8.5**

### Property 26: 回滚需要确认令牌
*For any* 配置回滚请求，如果没有提供有效的确认令牌，应该被拒绝
**Validates: Requirements 8.4**

### Property 27: 历史记录数量限制
*For any* 套餐，其配置历史记录的数量应该不超过50条
**Validates: Requirements 8.7**



## Error Handling

### 错误类型定义

```typescript
// server/src/types/errors.ts

export class QuotaExceededError extends Error {
  constructor(
    public featureCode: string,
    public currentPlan: string,
    public limit: number,
    public used: number
  ) {
    super(`配额已用完：${featureCode}`);
    this.name = 'QuotaExceededError';
  }
}

export class PaymentError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class OrderNotFoundError extends Error {
  constructor(public orderNo: string) {
    super(`订单不存在：${orderNo}`);
    this.name = 'OrderNotFoundError';
  }
}

export class InvalidSignatureError extends Error {
  constructor() {
    super('签名验证失败');
    this.name = 'InvalidSignatureError';
  }
}

export class ConfigValidationError extends Error {
  constructor(public field: string, public reason: string) {
    super(`配置验证失败：${field} - ${reason}`);
    this.name = 'ConfigValidationError';
  }
}
```

### 错误处理策略

#### 1. 配额不足错误
```typescript
// 返回友好的错误信息和升级引导
{
  success: false,
  code: 'QUOTA_EXCEEDED',
  message: '体验版配额已用完，请升级套餐',
  data: {
    feature: '每日生成文章数',
    limit: 10,
    used: 10,
    remaining: 0,
    current_plan: '体验版',
    upgrade_url: '/pricing'
  }
}
```

#### 2. 支付错误
```typescript
// 记录详细日志，返回用户友好信息
{
  success: false,
  code: 'PAYMENT_FAILED',
  message: '支付失败，请稍后重试',
  data: {
    order_no: 'ORD20250101123456',
    error_code: 'SYSTEMERROR'
  }
}
```

#### 3. 权限错误
```typescript
// 记录安全日志，返回403
{
  success: false,
  code: 'PERMISSION_DENIED',
  message: '需要管理员权限'
}
```

#### 4. 验证错误
```typescript
// 返回具体的验证失败原因
{
  success: false,
  code: 'VALIDATION_ERROR',
  message: '配置验证失败',
  errors: [
    { field: 'price', message: '价格不能为负数' },
    { field: 'features.articles_per_day', message: '配额必须大于0' }
  ]
}
```

### 错误恢复机制

#### 1. 支付回调失败重试
- 微信支付会重试通知（15s、15s、30s、3m、10m、20m、30m、30m、30m、60m、3h、3h、3h、6h、6h）
- 系统应该实现幂等性处理，避免重复开通订阅
- 使用订单号和交易号作为幂等键

#### 2. 订单超时自动关闭
- 定时任务每5分钟扫描一次
- 关闭创建超过30分钟且状态为pending的订单
- 释放相关资源

#### 3. 配置缓存失效
- 配置更新后立即清除Redis缓存
- 如果Redis不可用，降级为直接查询数据库
- 记录缓存失效日志

#### 4. 数据库事务回滚
- 订单支付和订阅开通使用事务
- 任何步骤失败都回滚整个事务
- 记录失败日志供人工处理



## Testing Strategy

### 双重测试方法

本系统采用**单元测试**和**属性测试**相结合的方式，确保全面的测试覆盖：

- **单元测试**：验证具体示例、边界情况和错误条件
- **属性测试**：验证通用属性在所有输入下都成立
- 两者互补，共同保证系统正确性

### 属性测试配置

**测试框架**: 使用 `fast-check` 进行属性测试（Node.js/TypeScript）

**配置要求**:
- 每个属性测试最少运行 100 次迭代
- 每个测试必须引用设计文档中的属性编号
- 标签格式: `Feature: product-subscription-system, Property {number}: {property_text}`

**示例配置**:
```typescript
// server/src/tests/subscription.property.test.ts
import fc from 'fast-check';

describe('Subscription Properties', () => {
  it('Property 10: 订单号唯一性', () => {
    // Feature: product-subscription-system, Property 10: 订单号唯一性
    fc.assert(
      fc.property(
        fc.array(fc.record({ userId: fc.integer(), planId: fc.integer() }), { minLength: 2 }),
        async (requests) => {
          const orderNos = await Promise.all(
            requests.map(req => orderService.createOrder(req.userId, req.planId))
          );
          const uniqueOrderNos = new Set(orderNos.map(o => o.order_no));
          return uniqueOrderNos.size === orderNos.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 单元测试策略

#### 1. API 端点测试
```typescript
// 测试商品管理API
describe('Product Management API', () => {
  it('should return 403 for non-admin users', async () => {
    const response = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(response.status).toBe(403);
  });
  
  it('should require confirmation for large price changes', async () => {
    const response = await request(app)
      .put('/api/admin/products/1/price')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 200 }); // 原价99，变动超过100%
    
    expect(response.body.requiresConfirmation).toBe(true);
  });
});
```

#### 2. 服务层测试
```typescript
// 测试订阅服务
describe('SubscriptionService', () => {
  it('should check quota before allowing action', async () => {
    const canGenerate = await subscriptionService.canUserPerformAction(
      userId,
      'articles_per_day'
    );
    
    expect(canGenerate).toBe(false);
  });
  
  it('should record usage after successful action', async () => {
    await subscriptionService.recordUsage(userId, 'articles_per_day', 1);
    
    const usage = await subscriptionService.getUserUsage(userId, 'articles_per_day');
    expect(usage).toBe(1);
  });
});
```

#### 3. 支付集成测试
```typescript
// 测试微信支付
describe('PaymentService', () => {
  it('should create wechat pay order with correct params', async () => {
    const result = await paymentService.createWeChatPayOrder(userId, planId);
    
    expect(result).toHaveProperty('appId');
    expect(result).toHaveProperty('timeStamp');
    expect(result).toHaveProperty('paySign');
  });
  
  it('should reject invalid payment notification', async () => {
    const invalidNotify = { /* 无效签名 */ };
    
    await expect(
      paymentService.handleWeChatPayNotify(invalidNotify)
    ).rejects.toThrow(InvalidSignatureError);
  });
});
```

#### 4. 配额限制测试
```typescript
// 测试配额中间件
describe('checkQuota middleware', () => {
  it('should allow action when quota available', async () => {
    const req = { user: { userId: 1 } };
    const res = {};
    const next = jest.fn();
    
    await checkQuota('articles_per_day')(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
  
  it('should reject action when quota exceeded', async () => {
    // 用户已达配额
    const req = { user: { userId: 2 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    
    await checkQuota('articles_per_day')(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### 集成测试

#### 1. 完整购买流程测试
```typescript
describe('Purchase Flow Integration', () => {
  it('should complete full purchase and subscription activation', async () => {
    // 1. 创建订单
    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ plan_id: 2 });
    
    expect(order.body.success).toBe(true);
    
    // 2. 模拟支付回调
    const notify = createMockWeChatNotify(order.body.data.order_no);
    await request(app)
      .post('/api/payment/wechat/notify')
      .send(notify);
    
    // 3. 验证订阅已开通
    const subscription = await request(app)
      .get('/api/user/subscription')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(subscription.body.data.plan_id).toBe(2);
    expect(subscription.body.data.status).toBe('active');
  });
});
```

#### 2. 配额使用流程测试
```typescript
describe('Quota Usage Flow', () => {
  it('should enforce quota limits across multiple requests', async () => {
    // 用户配额为10篇/天
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/api/articles/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ topic: 'test' });
      
      expect(response.status).toBe(200);
    }
    
    // 第11次应该被拒绝
    const response = await request(app)
      .post('/api/articles/generate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ topic: 'test' });
    
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('QUOTA_EXCEEDED');
  });
});
```

### 测试数据生成器

```typescript
// server/src/tests/generators.ts
import fc from 'fast-check';

export const planArbitrary = fc.record({
  plan_code: fc.constantFrom('free', 'professional', 'enterprise'),
  plan_name: fc.string({ minLength: 1, maxLength: 50 }),
  price: fc.double({ min: 0, max: 10000 }),
  is_active: fc.boolean()
});

export const featureArbitrary = fc.record({
  feature_code: fc.constantFrom(
    'articles_per_day',
    'publish_per_day',
    'platform_accounts',
    'keyword_distillation'
  ),
  feature_value: fc.integer({ min: -1, max: 10000 })
});

export const orderArbitrary = fc.record({
  user_id: fc.integer({ min: 1, max: 10000 }),
  plan_id: fc.integer({ min: 1, max: 10 }),
  amount: fc.double({ min: 0, max: 10000 })
});
```

### 测试覆盖率目标

- **代码覆盖率**: 最低 80%
- **分支覆盖率**: 最低 75%
- **关键路径**: 100% 覆盖（支付、订阅开通、配额检查）
- **属性测试**: 每个属性至少 100 次迭代

### 持续集成

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run property tests
        run: npm run test:property
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Check coverage
        run: npm run test:coverage
```



## 用户个人中心设计

### 个人中心页面结构

```
┌─────────────────────────────────────────────────────────────┐
│                      个人中心导航                             │
│  [个人信息] [我的订阅] [使用统计] [订单记录] [账号设置]      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      我的订阅                                 │
├─────────────────────────────────────────────────────────────┤
│  当前套餐：专业版                                             │
│  到期时间：2025-12-31 23:59:59                               │
│  自动续费：已开启 [关闭]                                      │
│  [升级套餐] [续费] [查看详情]                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      功能配额使用情况                          │
├─────────────────────────────────────────────────────────────┤
│  每日生成文章数                                               │
│  ████████░░ 45/100 篇 (45%)                                  │
│  重置时间：今天 00:00                                         │
│                                                              │
│  每日发布文章数                                               │
│  ██████░░░░ 30/200 篇 (15%)                                  │
│  重置时间：今天 00:00                                         │
│                                                              │
│  可管理平台账号数                                             │
│  ██░░░░░░░░ 2/3 个 (67%)                                     │
│  [管理账号]                                                   │
│                                                              │
│  关键词蒸馏数                                                 │
│  ████████░░ 250/500 个 (50%)                                 │
│  重置时间：2025-02-01 00:00                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      订单记录                                 │
├─────────────────────────────────────────────────────────────┤
│  订单号：ORD20250101123456                                   │
│  套餐：专业版                                                 │
│  金额：¥99.00                                                │
│  状态：已支付                                                 │
│  支付时间：2025-01-01 12:34:56                               │
│  [查看详情] [申请发票]                                        │
│                                                              │
│  订单号：ORD20241201123456                                   │
│  套餐：体验版                                                 │
│  金额：¥0.00                                                 │
│  状态：已完成                                                 │
│  开通时间：2024-12-01 12:34:56                               │
└─────────────────────────────────────────────────────────────┘
```

### 前端组件设计

#### 1. 订阅信息卡片组件
```typescript
// landing/src/components/SubscriptionCard.tsx
interface SubscriptionCardProps {
  subscription: {
    plan_name: string;
    plan_code: string;
    end_date: string;
    auto_renew: boolean;
    status: 'active' | 'expired' | 'cancelled';
  };
  onUpgrade: () => void;
  onRenew: () => void;
  onToggleAutoRenew: () => void;
}

export function SubscriptionCard({ subscription, onUpgrade, onRenew, onToggleAutoRenew }: SubscriptionCardProps) {
  const daysRemaining = calculateDaysRemaining(subscription.end_date);
  const isExpiringSoon = daysRemaining <= 7;
  
  return (
    <Card className="subscription-card">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">{subscription.plan_name}</h3>
          <p className="text-gray-600">
            到期时间：{formatDate(subscription.end_date)}
            {isExpiringSoon && (
              <Tag color="warning" className="ml-2">即将到期</Tag>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {subscription.plan_code !== 'enterprise' && (
            <Button type="primary" onClick={onUpgrade}>升级套餐</Button>
          )}
          <Button onClick={onRenew}>续费</Button>
        </div>
      </div>
      
      <div className="mt-4">
        <Switch
          checked={subscription.auto_renew}
          onChange={onToggleAutoRenew}
        />
        <span className="ml-2">自动续费</span>
      </div>
    </Card>
  );
}
```

#### 2. 配额使用进度条组件
```typescript
// landing/src/components/QuotaProgress.tsx
interface QuotaProgressProps {
  feature: {
    code: string;
    name: string;
    limit: number;
    used: number;
    unit: string;
    reset_time?: string;
  };
}

export function QuotaProgress({ feature }: QuotaProgressProps) {
  const percentage = feature.limit === -1 ? 0 : (feature.used / feature.limit) * 100;
  const remaining = feature.limit === -1 ? '无限制' : feature.limit - feature.used;
  
  // 根据使用率设置颜色
  const getColor = () => {
    if (feature.limit === -1) return 'blue';
    if (percentage >= 90) return 'red';
    if (percentage >= 70) return 'orange';
    return 'green';
  };
  
  return (
    <div className="quota-item mb-4">
      <div className="flex justify-between mb-2">
        <span className="font-medium">{feature.name}</span>
        <span className="text-gray-600">
          {feature.limit === -1 ? '无限制' : `${feature.used}/${feature.limit} ${feature.unit}`}
        </span>
      </div>
      
      {feature.limit !== -1 && (
        <Progress
          percent={percentage}
          strokeColor={getColor()}
          showInfo={false}
        />
      )}
      
      {feature.reset_time && (
        <p className="text-sm text-gray-500 mt-1">
          重置时间：{formatResetTime(feature.reset_time)}
        </p>
      )}
      
      {percentage >= 90 && feature.limit !== -1 && (
        <Alert
          message="配额即将用完"
          description={`剩余 ${remaining} ${feature.unit}，建议升级套餐`}
          type="warning"
          showIcon
          className="mt-2"
        />
      )}
    </div>
  );
}
```

#### 3. 订单列表组件
```typescript
// landing/src/components/OrderList.tsx
interface OrderListProps {
  orders: Order[];
  onViewDetail: (orderNo: string) => void;
  onRequestInvoice: (orderNo: string) => void;
}

export function OrderList({ orders, onViewDetail, onRequestInvoice }: OrderListProps) {
  const getStatusTag = (status: string) => {
    const statusMap = {
      pending: { color: 'default', text: '待支付' },
      paid: { color: 'success', text: '已支付' },
      failed: { color: 'error', text: '支付失败' },
      closed: { color: 'default', text: '已关闭' }
    };
    return statusMap[status] || { color: 'default', text: status };
  };
  
  return (
    <List
      dataSource={orders}
      renderItem={(order) => (
        <List.Item
          actions={[
            <Button type="link" onClick={() => onViewDetail(order.order_no)}>
              查看详情
            </Button>,
            order.status === 'paid' && (
              <Button type="link" onClick={() => onRequestInvoice(order.order_no)}>
                申请发票
              </Button>
            )
          ]}
        >
          <List.Item.Meta
            title={
              <div className="flex justify-between">
                <span>订单号：{order.order_no}</span>
                <Tag color={getStatusTag(order.status).color}>
                  {getStatusTag(order.status).text}
                </Tag>
              </div>
            }
            description={
              <div>
                <p>套餐：{order.plan_name}</p>
                <p>金额：¥{order.amount.toFixed(2)}</p>
                <p>
                  {order.paid_at
                    ? `支付时间：${formatDateTime(order.paid_at)}`
                    : `创建时间：${formatDateTime(order.created_at)}`}
                </p>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );
}
```

### API 接口设计

#### 1. 获取用户订阅信息
```typescript
// GET /api/user/subscription
// 响应
{
  "success": true,
  "data": {
    "id": 123,
    "plan": {
      "plan_code": "professional",
      "plan_name": "专业版",
      "price": 99.00,
      "features": [
        {
          "feature_code": "articles_per_day",
          "feature_name": "每日生成文章数",
          "feature_value": 100,
          "feature_unit": "篇"
        },
        // ... 其他功能
      ]
    },
    "status": "active",
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-12-31T23:59:59Z",
    "auto_renew": true,
    "days_remaining": 365
  }
}
```

#### 2. 获取用户使用统计
```typescript
// GET /api/user/usage-stats
// 响应
{
  "success": true,
  "data": {
    "features": [
      {
        "feature_code": "articles_per_day",
        "feature_name": "每日生成文章数",
        "limit": 100,
        "used": 45,
        "remaining": 55,
        "percentage": 45,
        "unit": "篇",
        "reset_time": "2025-01-02T00:00:00Z"
      },
      {
        "feature_code": "publish_per_day",
        "feature_name": "每日发布文章数",
        "limit": 200,
        "used": 30,
        "remaining": 170,
        "percentage": 15,
        "unit": "篇",
        "reset_time": "2025-01-02T00:00:00Z"
      },
      {
        "feature_code": "platform_accounts",
        "feature_name": "可管理平台账号数",
        "limit": 3,
        "used": 2,
        "remaining": 1,
        "percentage": 67,
        "unit": "个",
        "reset_time": null
      },
      {
        "feature_code": "keyword_distillation",
        "feature_name": "关键词蒸馏数",
        "limit": 500,
        "used": 250,
        "remaining": 250,
        "percentage": 50,
        "unit": "个",
        "reset_time": "2025-02-01T00:00:00Z"
      }
    ]
  }
}
```

#### 3. 获取用户订单列表
```typescript
// GET /api/user/orders?page=1&limit=10&status=paid
// 响应
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 456,
        "order_no": "ORD20250101123456",
        "plan_id": 2,
        "plan_name": "专业版",
        "amount": 99.00,
        "status": "paid",
        "payment_method": "wechat",
        "transaction_id": "4200001234567890",
        "paid_at": "2025-01-01T12:34:56Z",
        "created_at": "2025-01-01T12:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

#### 4. 切换自动续费
```typescript
// PUT /api/user/subscription/auto-renew
// 请求
{
  "auto_renew": true
}

// 响应
{
  "success": true,
  "message": "自动续费已开启",
  "data": {
    "auto_renew": true
  }
}
```

#### 5. 申请发票
```typescript
// POST /api/user/orders/:orderNo/invoice
// 请求
{
  "invoice_type": "personal",  // 'personal' | 'company'
  "invoice_title": "张三",
  "tax_number": "",  // 企业发票需要
  "email": "user@example.com"
}

// 响应
{
  "success": true,
  "message": "发票申请已提交，将在3个工作日内发送到您的邮箱",
  "data": {
    "invoice_id": 789,
    "status": "pending"
  }
}
```

### 实时更新机制

#### WebSocket 推送
```typescript
// 当配额使用量变化时，推送更新
{
  "type": "quota:updated",
  "data": {
    "feature_code": "articles_per_day",
    "used": 46,
    "remaining": 54,
    "percentage": 46
  }
}

// 当订阅状态变化时，推送更新
{
  "type": "subscription:updated",
  "data": {
    "status": "active",
    "plan_name": "专业版",
    "end_date": "2025-12-31T23:59:59Z"
  }
}

// 当订单支付成功时，推送通知
{
  "type": "order:paid",
  "data": {
    "order_no": "ORD20250101123456",
    "plan_name": "专业版",
    "message": "支付成功，套餐已开通"
  }
}
```

### 用户体验优化

#### 1. 配额预警
- 当配额使用达到 70% 时，显示橙色提示
- 当配额使用达到 90% 时，显示红色警告并推荐升级
- 配额用完时，显示升级引导弹窗

#### 2. 到期提醒
- 到期前 30 天，显示续费提示
- 到期前 7 天，显示醒目的续费提醒
- 到期前 1 天，发送邮件和站内通知

#### 3. 升级引导
- 配额不足时，显示当前套餐和推荐套餐对比
- 一键升级，自动计算差价
- 升级后立即生效，配额立即增加

#### 4. 数据可视化
- 使用图表展示每日/每月使用趋势
- 对比不同功能的使用率
- 预测配额耗尽时间

