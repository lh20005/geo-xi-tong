# 迁移文件修复计划

## 审计方法
对比本地数据库实际结构与迁移文件定义，逐个修复

---

## 001_initial_schema.sql 需要修复的问题

### 1. users 表
**问题:**
- invitation_code 长度应为 VARCHAR(6) 而非 VARCHAR(20)
- invited_by_code 长度应为 VARCHAR(6) 而非 VARCHAR(20)
- 缺少 name VARCHAR(100)
- 缺少 is_active BOOLEAN DEFAULT true

**修复:** 添加缺失字段，修正长度

### 2. login_attempts 表
**问题:**
- 有 attempted_at 列，但本地数据库是 created_at
- success 默认值应为 NOT NULL 而非 DEFAULT FALSE

**修复:** 将 attempted_at 改为 created_at，修正 success 约束

### 3. subscription_plans 表
**问题:**
- 缺少 billing_cycle VARCHAR(20) DEFAULT 'monthly'
- 缺少 display_order INTEGER DEFAULT 0

**修复:** 添加缺失字段（后续迁移014会添加，但001应该有基础结构）

### 4. plan_features 表
**问题:**
- quota_value 定义为 NOT NULL，但代码使用 feature_value
- 应该是 feature_value NOT NULL，quota_value 可空

**修复:** 修改约束

### 5. orders 表
**问题:**
- 有 payment_time 但代码使用 paid_at
- 缺少 order_type VARCHAR(20) DEFAULT 'purchase'
- 缺少 expired_at TIMESTAMP
- 缺少 transaction_id VARCHAR(100)
- payment_method 长度应为 VARCHAR(20) 而非 VARCHAR(50)

**修复:** 重命名 payment_time 为 paid_at，添加缺失字段

### 6. user_usage 表
**问题:**
- period_start/period_end 类型应为 DATE 而非 TIMESTAMP

**修复:** 修改类型

### 7. security_events 表
**问题:**
- 本地数据库有 message TEXT NOT NULL
- 本地数据库没有 resolved, resolved_at, resolved_by
- 本地数据库没有 description

**修复:** 根据实际使用情况调整

### 8. security_config 表
**问题:**
- 缺少 config_type VARCHAR(50) NOT NULL
- 缺少 validation_rule TEXT
- 缺少 is_active BOOLEAN DEFAULT true
- 缺少 version INTEGER DEFAULT 1
- 缺少 created_by INTEGER
- 缺少 updated_by INTEGER

**修复:** 添加缺失字段

### 9. security_config_history 表
**问题:**
- 缺少 config_key VARCHAR(100) NOT NULL
- 缺少 version INTEGER NOT NULL
- 缺少 change_reason TEXT

**修复:** 添加缺失字段

### 10. config_history 表
**问题:**
- 缺少 ip_address VARCHAR(45) NOT NULL
- changed_by 应该有外键约束

**修复:** 添加缺失字段

### 11. ip_whitelist 表
**问题:**
- created_by 应改名为 added_by

**修复:** 重命名字段

### 12. permissions 表
**问题:**
- category 应为 NOT NULL

**修复:** 添加约束

### 13. api_configs 表
**问题:**
- 缺少 user_id INTEGER NOT NULL（多租户）

**修复:** 添加 user_id 字段

### 14. topics 表
**问题:**
- 缺少 keyword VARCHAR(255) NOT NULL
- 缺少 user_id INTEGER NOT NULL

**修复:** 添加缺失字段

### 15. images 表
**问题:**
- 缺少 deleted_at TIMESTAMP
- 缺少 is_orphan BOOLEAN DEFAULT false
- 缺少 reference_count INTEGER DEFAULT 0
- 缺少 user_id INTEGER

**修复:** 添加缺失字段

### 16. distillation_config 表
**问题:**
- 缺少 user_id INTEGER（多租户）

**修复:** 添加 user_id 字段

### 17. generation_tasks 表
**问题:**
- distillation_id, album_id, knowledge_base_id, article_setting_id 应该可空
- 缺少快照字段

**修复:** 修改约束，添加快照字段

### 18. articles 表
**问题:**
- 缺少 publishing_status VARCHAR(20)
- 缺少 image_size_bytes INTEGER DEFAULT 0
- 缺少 image_id INTEGER
- 缺少 distillation_keyword_snapshot VARCHAR(255)
- 缺少 topic_question_snapshot TEXT

**修复:** 添加缺失字段

### 19. distillation_usage 表
**问题:**
- 缺少 task_id INTEGER NOT NULL

**修复:** 添加 task_id 字段

### 20. topic_usage 表
**问题:**
- 缺少 distillation_id INTEGER
- 缺少 task_id INTEGER
- 缺少 keyword VARCHAR(255)

**修复:** 添加缺失字段

### 21. platform_accounts 表
**问题:**
- 缺少 cookies TEXT
- 缺少 error_message TEXT
- 缺少 real_username VARCHAR(255)
- credentials 应该可空

**修复:** 添加缺失字段，修改约束

### 22. platforms_config 表
**问题:**
- 缺少 login_url TEXT
- 缺少 selectors JSONB
- 缺少 home_url VARCHAR(500)

**修复:** 添加缺失字段

### 23. publishing_records 表
**问题:**
- 缺少 account_name VARCHAR(100)
- 缺少快照字段

**修复:** 添加缺失字段

### 24. audit_logs 表
**问题:**
- details 类型应为 JSONB 而非 TEXT
- ip_address 应为 NOT NULL

**修复:** 修改类型和约束

### 25. refresh_tokens 表
**问题:**
- 缺少 revoked BOOLEAN DEFAULT false

**修复:** 添加缺失字段

---

## 后续迁移文件检查清单

需要确认以下迁移文件是否正确添加了上述缺失的字段：

- 002: 添加 address, usage_count, invitation_code 等
- 011: 添加 publishing_records.user_id
- 012: 添加 articles.publishing_status
- 013: 修改 conversion_targets 字段可空
- 014: 添加 usage_records, quota_alerts, billing_cycle, display_order
- 015: 添加 duration_days
- 017: 添加存储管理相关表
- 027: 添加订阅管理字段
- 031: 添加配额周期字段
- 043: 添加代理商系统
- 044: 添加折扣系统
- 046: 添加 quota_cycle_type
- 047: 添加加量包系统
- 052: 添加邮箱验证
