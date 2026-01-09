# Requirements Document

## Introduction

本文档定义了"加量包"（Booster Pack）商品系统的需求。加量包是一种特殊的商品类型，用户在购买基础套餐后，当配额不足时可以购买加量包来补充配额。

**核心设计原则**（参考 Stripe 高级用量计费模型和云服务商资源包模式）：
1. **独立存储** - 加量包配额与基础配额完全分离存储，便于独立管理和审计
2. **FIFO 消耗** - 多个加量包按购买时间先进先出消耗，避免配额浪费
3. **优先级消耗** - 先消耗基础配额，耗尽后再消耗加量包配额
4. **事务安全** - 所有配额操作使用数据库事务，确保数据一致性
5. **审计追踪** - 完整记录配额消耗历史，支持问题排查和数据分析

## Glossary

- **Booster_Pack**: 加量包商品，一种特殊的商品类型，用于补充用户的功能配额
- **Base_Subscription**: 基础订阅，用户购买的主套餐（如体验版、专业版、企业版）
- **Quota**: 配额，用户可使用某功能的数量限制
- **Base_Quota**: 基础配额，来自用户当前订阅套餐的配额，存储在 `user_usage` 表
- **Booster_Quota**: 加量包配额，来自用户购买的加量包的配额，存储在 `user_booster_quotas` 表
- **Feature_Code**: 功能代码，标识具体功能的唯一代码（如 articles_per_month, publish_per_month）
- **Consumption_Priority**: 消耗优先级，配额消耗的顺序规则（基础配额 → 加量包配额）
- **FIFO**: First In First Out，先进先出原则，多个加量包按购买时间顺序消耗
- **Quota_Transaction**: 配额事务，记录每次配额变动的审计记录

## Requirements

### Requirement 1: 加量包商品类型定义

**User Story:** As a 系统管理员, I want to 创建和管理加量包类型的商品, so that 用户可以购买额外配额。

#### Acceptance Criteria

1. THE Subscription_Plans_Table SHALL support a new field `plan_type` with values 'base' (基础套餐) or 'booster' (加量包)，默认值为 'base'
2. WHEN a booster pack is created, THE System SHALL require at least one feature quota configuration with feature_value > 0
3. THE Booster_Pack SHALL support the same billing_cycle, quota_cycle_type, and validity_period configurations as base subscriptions
4. WHEN displaying products in the admin panel, THE System SHALL use distinct visual indicators (标签/颜色) to distinguish booster packs from base subscriptions
5. THE System SHALL prevent deletion of booster pack products that have active user subscriptions

### Requirement 2: 加量包购买前置条件

**User Story:** As a 用户, I want to 在有基础套餐的前提下购买加量包, so that 我可以获得额外配额。

#### Acceptance Criteria

1. WHEN a user attempts to purchase a booster pack, THE System SHALL verify the user has an active base subscription (plan_type='base' AND status='active')
2. IF a user has no active base subscription, THEN THE System SHALL reject the purchase with error code 'NO_BASE_SUBSCRIPTION' and message "请先购买基础套餐后再购买加量包"
3. WHEN a user has an active base subscription, THE System SHALL allow the booster pack purchase to proceed normally
4. THE System SHALL allow users to purchase multiple booster packs of the same type (无数量限制)
5. THE System SHALL allow users to purchase different types of booster packs simultaneously

### Requirement 3: 加量包配额存储

**User Story:** As a 系统, I want to 独立存储加量包配额, so that 配额可以与基础配额分开管理和显示。

#### Acceptance Criteria

1. THE System SHALL create a new table `user_booster_quotas` with columns: id, user_id, booster_subscription_id, feature_code, quota_limit, quota_used, status, created_at, expires_at, updated_at
2. WHEN a user purchases a booster pack, THE System SHALL create records in `user_booster_quotas` for each feature defined in the booster pack's plan_features
3. THE quota_limit value SHALL be copied from the booster pack's plan_features.feature_value at purchase time (快照，不受后续商品配置变更影响)
4. WHEN a booster pack expires (expires_at < CURRENT_TIMESTAMP), THE System SHALL mark the corresponding quota records status as 'expired'
5. THE System SHALL create index on (user_id, feature_code, status) for efficient quota queries

### Requirement 4: 配额消耗优先级

**User Story:** As a 用户, I want to 先消耗基础配额再消耗加量包配额, so that 我的加量包配额可以作为备用。

#### Acceptance Criteria

1. WHEN a user performs an action that consumes quota, THE System SHALL first check base quota availability in `user_usage` table
2. IF base quota has remaining capacity (usage_count < quota_limit), THEN THE System SHALL consume from base quota only
3. IF base quota is exhausted (usage_count >= quota_limit), THEN THE System SHALL consume from booster quota
4. WHEN multiple active booster packs exist for the same feature, THE System SHALL consume from the earliest created (ORDER BY created_at ASC) booster pack first (FIFO)
5. WHEN a booster pack's quota is fully consumed (quota_used >= quota_limit), THE System SHALL move to the next booster pack in FIFO order
6. THE System SHALL use database transaction to ensure atomic quota consumption across base and booster quotas

### Requirement 5: 加量包配额显示

**User Story:** As a 用户, I want to 在个人中心看到加量包配额的独立统计, so that 我可以了解我的配额使用情况。

#### Acceptance Criteria

1. WHEN displaying usage statistics, THE System SHALL show base quota and booster quota as separate sections
2. THE Base_Quota_Display SHALL show: feature_name, used/total, percentage, reset_time
3. THE Booster_Quota_Display SHALL show: feature_name, total_booster_quota, total_booster_used, booster_remaining, earliest_expiration_date
4. WHEN a user has no active booster quota for a feature, THE System SHALL hide the booster quota section for that feature
5. WHEN booster quota is being consumed (base quota exhausted), THE System SHALL display a visual indicator "正在使用加量包配额"
6. THE System SHALL display booster pack expiration warnings when expires_at is within 7 days

### Requirement 6: 加量包开通流程

**User Story:** As a 系统, I want to 在用户支付成功后自动开通加量包, so that 用户可以立即使用额外配额。

#### Acceptance Criteria

1. WHEN payment is confirmed, THE System SHALL create a subscription record in `user_subscriptions` with plan_type='booster' and status='active'
2. THE System SHALL initialize booster quota records by reading plan_features from the purchased booster pack at activation time
3. THE System SHALL calculate expires_at based on the booster pack's duration_days from activation time
4. WHEN a booster pack is activated, THE System SHALL broadcast WebSocket event 'booster_quota_updated' to update client displays
5. THE Booster_Subscription SHALL have independent start_date and end_date, not tied to base subscription dates
6. THE System SHALL record activation in `usage_records` table with type='booster_activation' for audit trail

### Requirement 7: 加量包管理界面

**User Story:** As a 管理员, I want to 在商品管理页面管理加量包, so that 我可以配置和维护加量包商品。

#### Acceptance Criteria

1. THE Product_Management_Page SHALL support creating products with plan_type='booster'
2. WHEN creating/editing a booster pack, THE System SHALL provide form fields for: plan_name, plan_code, price, billing_cycle, quota_cycle_type, validity_period, description, display_order, and feature quotas
3. THE System SHALL validate that booster packs have at least one feature quota with feature_value > 0 before saving
4. THE Product_List_Page SHALL support filtering by plan_type with options: 'all', 'base', 'booster'
5. THE System SHALL display booster pack usage statistics: total_sold, active_count, revenue

### Requirement 8: 加量包配额同步与审计

**User Story:** As a 系统, I want to 在相关位置同步加量包配额数据并记录审计日志, so that 系统各部分数据保持一致且可追溯。

#### Acceptance Criteria

1. WHEN booster quota is consumed, THE System SHALL update `user_booster_quotas.quota_used` and broadcast WebSocket event 'quota_updated'
2. THE System SHALL provide API endpoint GET /api/usage/combined-quota/:featureCode to return combined quota (base + all active boosters)
3. WHEN checking quota availability, THE check_user_quota function SHALL query both `user_usage` and `user_booster_quotas` tables
4. THE System SHALL record all booster quota consumption in `usage_records` table with source='booster' and booster_subscription_id
5. THE System SHALL provide API endpoint GET /api/usage/booster-history to query booster quota consumption history

### Requirement 9: 加量包过期处理

**User Story:** As a 系统, I want to 自动处理过期的加量包, so that 过期配额不再可用且数据保持准确。

#### Acceptance Criteria

1. THE System SHALL run a scheduled job to check and expire booster quotas where expires_at < CURRENT_TIMESTAMP
2. WHEN a booster quota expires, THE System SHALL update status to 'expired' and broadcast WebSocket event 'booster_expired'
3. THE System SHALL NOT delete expired booster quota records; they SHALL be retained for historical reference
4. WHEN displaying booster quotas, THE System SHALL only show records with status='active'
5. THE System SHALL send notification to user 3 days before booster pack expiration (可配置)



### Requirement 10: 加量包与基础套餐独立生命周期

**User Story:** As a 用户, I want to 在基础套餐过期后仍能使用未过期的加量包, so that 我购买的加量包不会因为基础套餐变化而浪费。

#### Acceptance Criteria

1. WHEN a user's base subscription expires and downgrades to free plan, THE System SHALL NOT affect the user's active booster quotas
2. THE Booster_Pack SHALL have completely independent lifecycle from base subscription, governed only by its own expires_at
3. WHEN a user is on free plan with active booster quotas, THE System SHALL allow consumption of booster quotas after free plan's base quota is exhausted
4. THE System SHALL continue to track booster quota expiration based on booster pack's own duration_days, regardless of base subscription status changes
5. WHEN displaying quota information for a user on free plan with boosters, THE System SHALL show: free plan base quota + active booster quotas
6. IF a user purchases a new base subscription while having active boosters, THE System SHALL preserve existing booster quotas and continue their independent countdown
7. THE System SHALL NOT reset or extend booster quota expiration when base subscription changes (upgrade/downgrade/renewal)

### Requirement 11: 加量包购买条件澄清

**User Story:** As a 系统, I want to 明确加量包的购买条件, so that 业务规则清晰一致。

#### Acceptance Criteria

1. THE System SHALL require user authentication before allowing booster pack purchase (未注册/未登录用户不能购买)
2. THE System SHALL allow booster pack purchase for any authenticated user with an active subscription (including free plan)
3. WHEN a new user registers, THE System SHALL automatically assign them a free plan subscription, making them eligible to purchase booster packs immediately
4. THE System SHALL NOT require users to purchase a paid subscription before buying booster packs
5. THE purchase_booster_pack function SHALL check: user is authenticated AND user has an active subscription (any plan_type='base', including free plan)
