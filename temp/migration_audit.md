# 迁移文件审计报告

## 审计结果摘要

### 1. plan_features 表 ❌ 需要修复
- **代码使用字段**: id, plan_id, feature_code, feature_name, feature_value, feature_unit
- **001迁移定义**: quota_value NOT NULL, quota_unit, feature_value, feature_unit
- **问题**: 代码不使用 quota_value/quota_unit，但迁移定义了 quota_value NOT NULL
- **修复**: 删除 quota_value/quota_unit，只保留 feature_value/feature_unit

### 2. orders 表 ❌ 需要修复
- **代码使用字段**: order_no, user_id, plan_id, amount, status, payment_method, order_type, expired_at, paid_at, transaction_id, original_price, discount_rate, is_agent_discount, agent_id, profit_sharing, expected_commission
- **001迁移定义**: order_no, user_id, plan_id, amount, status, payment_method, payment_time
- **问题**: 缺少 order_type, expired_at, paid_at, transaction_id, original_price, discount_rate, is_agent_discount, agent_id, profit_sharing, expected_commission
- **修复**: 添加所有缺失字段

### 3. users 表 ❌ 需要修复
- **代码使用字段**: invited_by_agent, email_verified, is_active, name, first_purchase_discount_used
- **001迁移定义**: 缺少以上字段
- **修复**: 添加所有缺失字段

### 4. subscription_plans 表 ❌ 需要修复
- **代码使用字段**: billing_cycle, display_order, agent_discount_rate, quota_cycle_type, plan_type
- **001迁移定义**: 缺少以上字段
- **修复**: 添加所有缺失字段（后续迁移会添加，但001应该包含完整结构）

### 5. user_subscriptions 表 ❌ 需要修复
- **代码使用字段**: paused_at, pause_reason, custom_quotas, is_gift, gift_reason, quota_reset_anchor, quota_cycle_type, plan_type, next_plan_id
- **001迁移定义**: 缺少以上字段
- **修复**: 添加所有缺失字段

---

## 修复策略

由于后续迁移文件（002-052）会逐步添加这些字段，001_initial_schema.sql 应该只包含最基础的结构。
但为了确保一致性，我们需要：
1. 修复 001 中的错误定义（如 plan_features 的 quota_value NOT NULL）
2. 确保后续迁移文件正确添加缺失字段
3. 验证所有迁移文件的执行顺序和依赖关系

