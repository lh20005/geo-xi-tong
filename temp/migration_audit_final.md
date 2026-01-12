# 迁移文件审计报告 - 最终版

## 审计日期: 2026-01-11

## 审计结果摘要

### 001_initial_schema.sql 已修复的问题

1. **users 表**
   - ✅ invitation_code 改为 VARCHAR(6)
   - ✅ invited_by_code 改为 VARCHAR(6)
   - ✅ 添加 name VARCHAR(100)
   - ✅ 添加 is_active BOOLEAN DEFAULT true
   - ✅ 添加 email 索引

2. **refresh_tokens 表**
   - ✅ 添加 revoked BOOLEAN DEFAULT false

3. **login_attempts 表**
   - ✅ 将 attempted_at 改为 created_at
   - ✅ success 改为 NOT NULL

4. **subscription_plans 表**
   - ✅ 添加 duration_days DEFAULT 30

5. **plan_features 表**
   - ✅ feature_value NOT NULL
   - ✅ quota_value 可空
   - ✅ 添加 UNIQUE 约束

6. **orders 表**
   - ✅ 将 payment_time 改为 paid_at
   - ✅ payment_method 改为 VARCHAR(20)
   - ✅ 添加 order_type
   - ✅ 添加 transaction_id
   - ✅ 添加 expired_at

7. **user_usage 表**
   - ✅ period_start/period_end 改为 DATE

8. **audit_logs 表**
   - ✅ details 改为 JSONB
   - ✅ ip_address 改为 NOT NULL

9. **security_events 表**
   - ✅ 移除 resolved/resolved_at/resolved_by/description
   - ✅ 添加 message TEXT NOT NULL
   - ✅ details 改为 JSONB

10. **security_config 表**
    - ✅ 添加 config_type
    - ✅ 添加 validation_rule
    - ✅ 添加 is_active
    - ✅ 添加 version
    - ✅ 添加 created_by/updated_by

11. **security_config_history 表**
    - ✅ 添加 config_key
    - ✅ 添加 version
    - ✅ 添加 change_reason

12. **config_history 表**
    - ✅ changed_by 改为 NOT NULL
    - ✅ 添加 ip_address NOT NULL

13. **ip_whitelist 表**
    - ✅ 将 created_by 改为 added_by

14. **permissions 表**
    - ✅ category 改为 NOT NULL

15. **api_configs 表**
    - ✅ 添加 user_id NOT NULL

16. **topics 表**
    - ✅ 添加 keyword VARCHAR(255) NOT NULL
    - ✅ 添加 user_id INTEGER NOT NULL

17. **images 表**
    - ✅ 添加 deleted_at
    - ✅ 添加 is_orphan
    - ✅ 添加 reference_count
    - ✅ 添加 user_id

18. **distillation_config 表**
    - ✅ 添加 user_id

19. **generation_tasks 表**
    - ✅ 外键改为可空 (ON DELETE SET NULL)
    - ✅ 添加所有快照字段

20. **articles 表**
    - ✅ 添加 publishing_status
    - ✅ 添加 image_size_bytes
    - ✅ 添加 image_id
    - ✅ 添加快照字段

21. **distillation_usage 表**
    - ✅ 添加 task_id

22. **topic_usage 表**
    - ✅ 添加 distillation_id
    - ✅ 添加 task_id
    - ✅ 添加 keyword

23. **platform_accounts 表**
    - ✅ 添加 cookies
    - ✅ 添加 error_message
    - ✅ 添加 real_username
    - ✅ credentials 改为可空

24. **platforms_config 表**
    - ✅ 添加 login_url
    - ✅ 添加 selectors
    - ✅ 添加 home_url

25. **publishing_records 表**
    - ✅ 添加 account_name
    - ✅ 添加所有快照字段

---

## 后续迁移文件检查结果

### 002_add_missing_columns.sql ✅
- 添加 conversion_targets.address
- 添加 distillations.usage_count
- 添加 users 邀请相关字段
- 添加 articles 发布相关字段
- 添加 topics.usage_count
- 添加 publishing_tasks 批次字段
- 添加 generation_tasks.selected_distillation_ids

### 011_add_user_id_to_publishing_records.sql ✅
- 添加 publishing_records.user_id
- 添加 publishing_records.account_id

### 012_add_publishing_status_column.sql ✅
- 添加 articles.publishing_status

### 014_add_usage_tracking_and_alerts.sql ✅
- 创建 usage_records 表
- 创建 quota_alerts 表
- 添加 user_usage.last_reset_at
- 添加 subscription_plans.billing_cycle
- 添加 subscription_plans.display_order
- 创建配额检查函数

### 017_add_storage_management.sql ✅
- 创建 user_storage_usage 表
- 创建 storage_usage_history 表
- 创建 storage_transactions 表
- 创建 admin_quota_modifications 表
- 创建存储管理函数

### 018_add_storage_purchases.sql ✅
- 创建 storage_purchases 表

### 027_add_subscription_management.sql ✅
- 创建 subscription_adjustments 表
- 扩展 user_subscriptions 表

### 031_subscription_cycle_quota_reset.sql ✅
- 添加 user_subscriptions.quota_reset_anchor
- 添加 user_subscriptions.quota_cycle_type
- 创建配额周期函数

### 034-042 快照迁移 ✅
- 添加 generation_tasks 快照字段
- 添加 articles 快照字段
- 添加 publishing_records 快照字段

### 043_agent_commission_system.sql ✅
- 创建 agents 表
- 创建 commission_records 表
- 创建 profit_sharing_records 表
- 创建 agent_audit_logs 表
- 添加 users.invited_by_agent
- 添加 orders 分账字段

### 044_agent_discount_system.sql ✅
- 添加 subscription_plans.agent_discount_rate
- 添加 orders 折扣字段
- 添加 users.first_purchase_discount_used

### 046_add_plan_quota_cycle_type.sql ✅
- 添加 subscription_plans.quota_cycle_type
- 添加 subscription_plans.plan_type

### 047_add_booster_pack_system.sql ✅
- 创建 user_booster_quotas 表
- 添加 usage_records.source
- 添加 usage_records.booster_subscription_id

### 052_add_email_verification.sql ✅
- 添加 users.email_verified
- 创建 verification_codes 表

### 053_add_missing_tables.sql (新建) ✅
- 创建 auth_logs 表
- 创建 encryption_keys 表
- 创建 quota_configs 表
- 创建 quota_audit_logs 表
- 创建 user_sessions 表
- 创建 system_api_configs 表
- 创建 publish_records 表
- 创建 schema_migrations 表

---

## 本地数据库表清单 (61个表)

### 已在迁移文件中定义的表 (61个)
1. admin_logs ✅
2. admin_quota_modifications ✅ (017)
3. agent_audit_logs ✅ (043)
4. agents ✅ (043)
5. albums ✅ (001)
6. api_configs ✅ (001)
7. article_settings ✅ (001)
8. articles ✅ (001)
9. audit_logs ✅ (001)
10. auth_logs ✅ (053)
11. commission_records ✅ (043)
12. config_history ✅ (001)
13. conversion_targets ✅ (001)
14. distillation_config ✅ (001)
15. distillation_usage ✅ (001)
16. distillations ✅ (001)
17. encryption_keys ✅ (053)
18. generation_tasks ✅ (001)
19. image_usage ✅ (001)
20. images ✅ (001)
21. ip_whitelist ✅ (001)
22. knowledge_bases ✅ (001)
23. knowledge_documents ✅ (001)
24. login_attempts ✅ (001)
25. orders ✅ (001)
26. password_history ✅ (001)
27. permissions ✅ (001)
28. plan_features ✅ (001)
29. platform_accounts ✅ (001)
30. platforms_config ✅ (001)
31. product_config_history ✅ (001)
32. profit_sharing_records ✅ (043)
33. publish_records ✅ (053)
34. publishing_logs ✅ (001)
35. publishing_records ✅ (001)
36. publishing_tasks ✅ (001)
37. quota_alerts ✅ (014)
38. quota_audit_logs ✅ (053)
39. quota_configs ✅ (053)
40. refresh_tokens ✅ (001)
41. schema_migrations ✅ (053)
42. security_alerts ✅ (001)
43. security_config ✅ (001)
44. security_config_history ✅ (001)
45. security_events ✅ (001)
46. storage_purchases ✅ (018)
47. storage_transactions ✅ (017)
48. storage_usage_history ✅ (017)
49. subscription_adjustments ✅ (027)
50. subscription_plans ✅ (001)
51. system_api_configs ✅ (053)
52. topic_usage ✅ (001)
53. topics ✅ (001)
54. usage_records ✅ (014)
55. user_booster_quotas ✅ (047)
56. user_permissions ✅ (001)
57. user_sessions ✅ (053)
58. user_storage_usage ✅ (017)
59. user_subscriptions ✅ (001)
60. user_usage ✅ (001)
61. users ✅ (001)
62. verification_codes ✅ (052)

### 视图 (不需要迁移)
- v_function_count
- v_subscription_adjustment_history
- v_user_storage_detail

---

## 下一步操作

1. 将迁移文件上传到服务器
2. 在服务器上运行迁移
3. 验证所有表结构与本地一致
