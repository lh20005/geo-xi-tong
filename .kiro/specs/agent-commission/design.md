# Design Document: 代理商分佣模块

## Overview

本设计文档描述了 GEO 优化系统代理商分佣模块的技术实现方案。该模块基于微信支付分账功能，实现代理商邀请用户后的佣金自动分成。

**重要说明**：本模块是在现有支付系统基础上的扩展，不会影响已有的套餐支付功能。现有订单正常处理，只有被代理商邀请的用户下单时才会标记为分账订单。

核心流程：
1. 用户点击"成为代理商" → 立即激活（无需审核）
2. 代理商扫码绑定微信零钱账户 → 系统调用微信支付API添加分账接收方
3. 被邀请用户下单支付 → 订单标记为分账订单（profit_sharing=true）
4. T+1 自动结算 → 系统调用微信支付分账API将佣金（30%）分给代理商

**关键配置**：
- 默认佣金比例：30%（微信支付最大分账比例）
- 微信授权方式：公众号网页授权（snsapi_base 静默授权）
- AppID：与微信支付使用同一个
- 分账接收方类型：PERSONAL_OPENID（个人微信零钱）

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  UserCenterPage                    │  AdminAgentPage             │
│  ├── AgentApplyCard               │  ├── AgentListTable         │
│  ├── AgentDashboard               │  ├── AgentDetailModal       │
│  │   ├── EarningsStats            │  └── CommissionRecords      │
│  │   ├── WechatBindCard           │                              │
│  │   └── CommissionList           │                              │
│  └── WechatAuthModal              │                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                         │
├─────────────────────────────────────────────────────────────────┤
│  Routes                                                          │
│  ├── /api/agent/*          (代理商相关API)                       │
│  └── /api/admin/agents/*   (管理员代理商管理API)                 │
├─────────────────────────────────────────────────────────────────┤
│  Services                                                        │
│  ├── AgentService          (代理商管理)                          │
│  ├── CommissionService     (佣金计算与结算)                      │
│  ├── ProfitSharingService  (微信分账API封装)                     │
│  └── SchedulerService      (定时任务 - T+1结算)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  微信支付 API V3                                                 │
│  ├── POST /v3/profitsharing/receivers/add    (添加分账接收方)    │
│  ├── POST /v3/profitsharing/receivers/delete (删除分账接收方)    │
│  ├── POST /v3/profitsharing/orders           (请求分账)          │
│  ├── GET  /v3/profitsharing/orders/{no}      (查询分账结果)      │
│  └── POST /v3/profitsharing/orders/unfreeze  (解冻剩余资金)      │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. AgentService (代理商服务)

```typescript
interface AgentService {
  // 申请成为代理商（自动激活，无需审核）
  applyAgent(userId: number): Promise<Agent>;
  
  // 获取代理商信息
  getAgentByUserId(userId: number): Promise<Agent | null>;
  
  // 更新代理商状态（管理员操作：暂停/恢复）
  updateAgentStatus(agentId: number, status: AgentStatus): Promise<Agent>;
  
  // 绑定微信账户
  bindWechatAccount(agentId: number, openid: string, nickname: string): Promise<void>;
  
  // 获取代理商统计数据
  getAgentStats(agentId: number): Promise<AgentStats>;
  
  // 获取代理商列表（管理员）
  listAgents(filters: AgentFilters): Promise<PaginatedResult<Agent>>;
  
  // 调整佣金比例（管理员）
  updateCommissionRate(agentId: number, rate: number): Promise<void>;
  
  // 删除代理商（管理员）
  deleteAgent(agentId: number): Promise<void>;
}
```

### 2. CommissionService (佣金服务)

```typescript
interface CommissionService {
  // 创建佣金记录（订单支付成功时调用）
  createCommission(orderId: number, agentId: number, orderAmount: number): Promise<Commission>;
  
  // 执行分账结算
  settleCommission(commissionId: number): Promise<void>;
  
  // 批量结算（定时任务调用）
  batchSettlePendingCommissions(): Promise<SettlementResult>;
  
  // 处理退款（取消或标记佣金）
  handleRefund(orderId: number, refundAmount: number): Promise<void>;
  
  // 获取佣金列表
  listCommissions(agentId: number, filters: CommissionFilters): Promise<PaginatedResult<Commission>>;
  
  // 计算佣金金额
  calculateCommission(orderAmount: number, commissionRate: number): number;
}
```

### 3. ProfitSharingService (微信分账服务)

```typescript
interface ProfitSharingService {
  // 添加分账接收方（个人微信零钱）
  // type: PERSONAL_OPENID
  // relation_type: USER
  addReceiver(openid: string, name?: string): Promise<ReceiverResult>;
  
  // 删除分账接收方
  deleteReceiver(openid: string): Promise<void>;
  
  // 请求分账
  requestProfitSharing(params: ProfitSharingRequest): Promise<ProfitSharingResult>;
  
  // 查询分账结果
  queryProfitSharing(outOrderNo: string, transactionId: string): Promise<ProfitSharingStatus>;
  
  // 解冻剩余资金
  unfreezeRemaining(transactionId: string, outOrderNo: string): Promise<void>;
  
  // 查询剩余待分金额
  queryUnsplitAmount(transactionId: string): Promise<number>;
}
```

### 4. WechatAuthService (微信授权服务)

```typescript
interface WechatAuthService {
  // 生成授权链接（用于生成二维码）
  // 使用 snsapi_base 静默授权
  generateAuthUrl(redirectUri: string, state: string): string;
  
  // 处理授权回调，获取 OpenID
  handleAuthCallback(code: string): Promise<{ openid: string; nickname?: string }>;
  
  // 生成授权二维码数据
  generateAuthQRCode(agentId: number): Promise<{ qrCodeUrl: string; state: string }>;
}
```

## Data Models

### 数据库表设计

```sql
-- 代理商表
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active/suspended（无需审核，直接激活）
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.30,  -- 默认30%（微信支付最大比例）
  wechat_openid VARCHAR(128),  -- 微信OpenID（用于分账）
  wechat_nickname VARCHAR(100),  -- 微信昵称
  wechat_bindtime TIMESTAMP,  -- 绑定时间
  receiver_added BOOLEAN DEFAULT FALSE,  -- 是否已添加为分账接收方
  total_earnings DECIMAL(12,2) DEFAULT 0,  -- 累计收益
  settled_earnings DECIMAL(12,2) DEFAULT 0,  -- 已结算收益
  pending_earnings DECIMAL(12,2) DEFAULT 0,  -- 待结算收益
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 佣金记录表
CREATE TABLE commission_records (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  invited_user_id INTEGER NOT NULL REFERENCES users(id),
  order_amount DECIMAL(12,2) NOT NULL,  -- 订单金额
  commission_rate DECIMAL(5,4) NOT NULL,  -- 佣金比例（快照）
  commission_amount DECIMAL(12,2) NOT NULL,  -- 佣金金额
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/settled/cancelled/refunded
  settle_date DATE,  -- 预计结算日期（T+1）
  settled_at TIMESTAMP,  -- 实际结算时间
  fail_reason TEXT,  -- 失败原因
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分账记录表（微信分账API调用记录）
CREATE TABLE profit_sharing_records (
  id SERIAL PRIMARY KEY,
  commission_id INTEGER NOT NULL REFERENCES commission_records(id),
  transaction_id VARCHAR(64) NOT NULL,  -- 微信支付订单号
  out_order_no VARCHAR(64) NOT NULL,  -- 商户分账单号
  wechat_order_id VARCHAR(64),  -- 微信分账单号
  amount INTEGER NOT NULL,  -- 分账金额（分）
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/processing/success/failed
  fail_reason TEXT,
  request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finish_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_commission_agent_id ON commission_records(agent_id);
CREATE INDEX idx_commission_order_id ON commission_records(order_id);
CREATE INDEX idx_commission_status_settle_date ON commission_records(status, settle_date);
CREATE INDEX idx_profit_sharing_commission_id ON profit_sharing_records(commission_id);
CREATE INDEX idx_profit_sharing_out_order_no ON profit_sharing_records(out_order_no);
```

### TypeScript 类型定义

```typescript
// 代理商状态（简化：无需审核）
type AgentStatus = 'active' | 'suspended';

// 佣金状态
type CommissionStatus = 'pending' | 'settled' | 'cancelled' | 'refunded';

// 分账状态
type ProfitSharingStatus = 'pending' | 'processing' | 'success' | 'failed';

interface Agent {
  id: number;
  userId: number;
  status: AgentStatus;
  commissionRate: number;  // 默认 0.30 (30%)
  wechatOpenid?: string;
  wechatNickname?: string;
  wechatBindtime?: Date;
  receiverAdded: boolean;
  totalEarnings: number;
  settledEarnings: number;
  pendingEarnings: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Commission {
  id: number;
  agentId: number;
  orderId: number;
  invitedUserId: number;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  settleDate: Date;
  settledAt?: Date;
  failReason?: string;
  createdAt: Date;
}

interface AgentStats {
  totalEarnings: number;
  settledEarnings: number;
  pendingEarnings: number;
  totalInvites: number;
  paidInvites: number;
  commissionCount: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 代理商创建默认值正确性

*For any* 新创建的代理商记录，其佣金比例应为默认值 0.30（30%），状态应为 'active'（自动激活）。

**Validates: Requirements 1.1, 1.2**

### Property 2: 代理商状态转换合法性

*For any* 代理商状态变更操作，状态转换必须遵循合法路径：active ↔ suspended（管理员操作）。

**Validates: Requirements 7.3**

### Property 3: 佣金计算准确性

*For any* 订单金额和佣金比例，计算出的佣金金额应等于 订单金额 × 佣金比例，精确到分（两位小数）。

**Validates: Requirements 4.1**

### Property 4: 分账订单标记正确性

*For any* 被邀请用户创建的订单，如果其邀请人是已激活的代理商，则订单应标记 profit_sharing=true；否则不标记。

**Validates: Requirements 3.1, 3.2**

### Property 5: 佣金记录创建完整性

*For any* 支付成功的分账订单，系统应创建对应的佣金记录，包含正确的代理商ID、订单金额、佣金比例和佣金金额。

**Validates: Requirements 3.3, 3.4**

### Property 6: T+1 结算时间正确性

*For any* 待结算的佣金记录，其预计结算日期应为订单支付日期的次日。

**Validates: Requirements 4.2**

### Property 7: 退款佣金处理正确性

*For any* 发生退款的订单，如果佣金状态为 pending 则应变为 cancelled；如果已 settled 则应变为 refunded。

**Validates: Requirements 5.1, 5.2**

### Property 8: 部分退款佣金调整正确性

*For any* 部分退款的订单，调整后的佣金金额应等于 (原订单金额 - 退款金额) × 佣金比例。

**Validates: Requirements 5.4**

### Property 9: 代理商统计数据一致性

*For any* 代理商，其 totalEarnings 应等于所有佣金记录金额之和，settledEarnings 应等于状态为 settled 的佣金之和，pendingEarnings 应等于状态为 pending 的佣金之和。

**Validates: Requirements 6.1, 6.2**

### Property 10: 管理员操作权限正确性

*For any* 代理商管理操作（审核、调整比例、暂停、删除），只有管理员角色的用户才能执行。

**Validates: Requirements 7.2, 7.3, 7.4, 7.5**

### Property 11: 分账金额限制正确性

*For any* 分账请求，分账金额不应超过订单金额的 30%（微信支付默认最大分账比例）。

**Validates: Requirements 9.2**

## Error Handling

### 微信支付API错误处理

| 错误码 | 描述 | 处理策略 |
|--------|------|----------|
| PARAM_ERROR | 参数错误 | 记录日志，返回用户友好错误信息 |
| SIGN_ERROR | 签名错误 | 检查证书配置，记录告警 |
| NO_AUTH | 无分账权限 | 提示管理员检查商户平台配置 |
| RULE_LIMIT | 超出最大分账比例 | 调整分账金额后重试 |
| NOT_ENOUGH | 分账金额不足 | 检查订单是否已退款或已分账 |
| FREQUENCY_LIMITED | 频率限制 | 延迟重试 |
| SYSTEM_ERROR | 系统错误 | 原单重试 |

### 业务错误处理

```typescript
// 自定义错误类
class AgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

// 错误码定义
const AgentErrorCodes = {
  ALREADY_AGENT: 'ALREADY_AGENT',  // 已经是代理商
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',  // 代理商不存在
  AGENT_NOT_ACTIVE: 'AGENT_NOT_ACTIVE',  // 代理商未激活
  WECHAT_NOT_BOUND: 'WECHAT_NOT_BOUND',  // 微信未绑定
  RECEIVER_ADD_FAILED: 'RECEIVER_ADD_FAILED',  // 添加分账接收方失败
  COMMISSION_NOT_FOUND: 'COMMISSION_NOT_FOUND',  // 佣金记录不存在
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',  // 结算失败
};
```

## Testing Strategy

### 单元测试

- AgentService 方法测试
- CommissionService 佣金计算测试
- ProfitSharingService API 调用测试（使用 mock）

### 属性测试

使用 fast-check 进行属性测试：

```typescript
// 示例：佣金计算属性测试
import fc from 'fast-check';

describe('Commission Calculation Properties', () => {
  it('Property 3: 佣金计算准确性', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.01, max: 10000, noNaN: true }),  // 订单金额
        fc.float({ min: 0.01, max: 0.30, noNaN: true }),   // 佣金比例
        (orderAmount, commissionRate) => {
          const commission = calculateCommission(orderAmount, commissionRate);
          const expected = Math.round(orderAmount * commissionRate * 100) / 100;
          return Math.abs(commission - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 集成测试

- 完整的代理商申请→审核→绑定→分账流程测试
- 订单支付→佣金创建→T+1结算流程测试
- 退款→佣金处理流程测试

### 测试框架

- Jest 单元测试
- fast-check 属性测试
- 微信支付 API 使用 nock 进行 mock
