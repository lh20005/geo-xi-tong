# 数据库迁移完整审计报告

## 审计日期: 2026-01-11

## 审计方法
1. 从本地数据库导出所有表结构
2. 对比001_initial_schema.sql和后续迁移文件
3. 验证每个表的每一列是否正确

---

## 一、001_initial_schema.sql 需要修复的表

### 1. users 表 ❌ 需要修复

**本地数据库实际结构:**
| 列名 | 类型 | 可空 | 默认值 |
|------|------|------|--------|
| id | integer | NO | nextval |
| username | varchar(50) | NO | - |
| password_hash | varchar(255) | NO | - |
| email | varchar(100) | YES | NULL |
| role | varchar(20) | YES | 'user' |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |
| last_login_at | timestamp | YES | NULL |
| name | varchar(100) | YES | NULL |
| is_active | boolean | YES | true |
| invitation_code | varchar(6) | NO | - |
| invited_by_code | varchar(6) | YES | NULL |
| is_temp_password | boolean | YES | false |
| invited_by_agent | integer | YES | NULL |
| first_purchase_discount_used | boolean | YES | false |
| email_verified | boolean | YES | false |

**001迁移当前定义缺失:**
- name
- is_active
- invited_by_agent (由043添加)
- first_purchase_discount_used (由044添加)
- email_verified (由052添加)

**注意:** invitation_code 长度应为 VARCHAR(6) 而非 VARCHAR(20)

---

### 2. orders 表 ❌ 需要修复

**本地数据库实际结构:**
| 列名 | 类型 | 可空 | 默认值 |
|------|------|------|--------|
| id | integer | NO | nextval |
| order_no | varchar(50) | NO | - |
| user_id | integer | YES | NULL |
| plan_id | integer | YES | NULL |
| amount | numeric | NO | - |
| status | varchar(20) | YES | 'pending' |
| payment_method | varchar(20) | YES | NULL |
| transaction_id | varchar(100) | YES | NULL |
| paid_at | timestamp | YES | NULL |
| expired_at | timestamp | YES | NULL |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |
| order_type | varchar(20) | YES | 'purchase' |
| agent_id | integer | YES | NULL |
| profit_sharing | boolean | YES | false |
| expected_commission | numeric | YES | NULL |
| original_price | numeric | YES | NULL |
| discount_rate | integer | YES | 100 |
| is_agent_discount | boolean | YES | false |

**001迁移当前定义问题:**
- 有 payment_time 但代码使用 paid_at
- 缺少: order_type, expired_at, transaction_id, agent_id, profit_sharing, expected_commission, original_price, discount_rate, is_agent_discount

---

### 3. subscription_plans 表 ❌ 需要修复

**本地数据库实际结构:**
| 列名 | 类型 | 可空 | 默认值 |
|------|------|------|--------|
| id | integer | NO | nextval |
| plan_code | varchar(50) | NO | - |
| plan_name | varchar(100) | NO | - |
| price | numeric | NO | - |
| billing_cycle | varchar(20) | YES | 'monthly' |
| is_active | boolean | YES | true |
| display_order | integer | YES | 0 |
| description | text | YES | NULL |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |
| duration_days | integer | NO | 30 |
| agent_discount_rate | integer | YES | 100 |
| quota_cycle_type | varchar(20) | YES | 'monthly' |
| plan_type | varchar(20) | YES | 'base' |

**001迁移当前定义缺失:**
- billing_cycle (由014添加)
- display_order (由014添加)
- duration_days (由015添加)
- agent_discount_rate (由044添加)
- quota_cycle_type (由046添加)
- plan_type (由047添加)

---

### 4. plan_features 表 ✅ 已部分修复

**本地数据库实际结构:**
| 列名 | 类型 | 可空 | 默认值 |
|------|------|------|--------|
| id | integer | NO | nextval |
| plan_id | integer | YES | NULL |
| feature_code | varchar(50) | NO | - |
| feature_name | varchar(100) | NO | - |
| feature_value | integer | NO | - |
| feature_unit | varchar(20) | YES | NULL |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| quota_value | integer | YES | NULL |
| quota_unit | varchar(20) | YES | NULL |

**状态:** quota_value 和 quota_unit 是历史遗留字段，代码不使用，可以保留但设为可空

---

### 5. user_subscriptions 表 ❌ 需要修复

**本地数据库实际结构:**
| 列名 | 类型 | 可空 | 默认值 |
|------|------|------|--------|
| id | integer | NO | nextval |
| user_id | integer | YES | NULL |
| plan_id | integer | YES | NULL |
| status | varchar(20) | YES | 'active' |
| start_date | timestamp | NO | - |
| end_date | timestamp | NO | - |
| auto_renew | boolean | YES | false |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |
| next_plan_id | integer | YES | NULL |
| paused_at | timestamp | YES | NULL |
| pause_reason | text | YES | NULL |
| custom_quotas | jsonb | YES | NULL |
| is_gift | boolean | YES | false |
| gift_reason | text | YES | NULL |
| quota_reset_anchor | timestamp | YES | CURRENT_TIMESTAMP |
| quota_cycle_type | varchar(20) | YES | 'monthly' |
| plan_type | varchar(20) | YES | 'base' |

**001迁移当前定义缺失:**
- next_plan_id
- paused_at (由027添加)
- pause_reason (由027添加)
- custom_quotas (由027添加)
- is_gift (由027添加)
- gift_reason (由027添加)
- quota_reset_anchor (由031添加)
- quota_cycle_type (由031添加)
- plan_type (由047添加)

---

## 二、001中缺失的表（由后续迁移创建）

以下表在001中不存在，由后续迁移创建，需要添加到001:

1. **usage_records** (014) - 使用记录明细表
2. **quota_alerts** (014) - 配额预警表
3. **user_storage_usage** (017) - 用户存储使用表
4. **storage_usage_history** (017) - 存储使用历史表
5. **storage_transactions** (017) - 存储事务表
6. **admin_quota_modifications** (017) - 管理员配额修改日志表
7. **storage_purchases** (018) - 存储购买表
8. **subscription_adjustments** (027) - 订阅调整记录表
9. **agents** (043) - 代理商表
10. **commission_records** (043) - 佣金记录表
11. **profit_sharing_records** (043) - 分账记录表
12. **agent_audit_logs** (043) - 代理商审计日志表
13. **user_booster_quotas** (047) - 用户加量包配额表
14. **verification_codes** (052) - 验证码表
15. **quota_configs** (021/022) - 配额配置表
16. **quota_audit_logs** (021/022) - 配额审计日志表
17. **auth_logs** - 认证日志表
18. **user_sessions** - 用户会话表
19. **encryption_keys** - 加密密钥表
20. **system_api_configs** - 系统API配置表
21. **publish_records** - 发布记录表（旧版）

---

## 三、001中存在但需要修改的表

### 1. api_configs 表
需要添加 user_id 字段（多租户支持）

### 2. distillation_config 表
需要添加 user_id 字段（多租户支持）

### 3. topics 表
需要添加:
- keyword varchar(255) NOT NULL
- user_id integer NOT NULL

### 4. images 表
需要添加:
- deleted_at timestamp
- is_orphan boolean DEFAULT false
- reference_count integer DEFAULT 0
- user_id integer

### 5. articles 表
需要添加:
- image_size_bytes integer DEFAULT 0
- image_id integer
- distillation_keyword_snapshot varchar(255)
- topic_question_snapshot text

### 6. generation_tasks 表
需要添加快照字段:
- conversion_target_name varchar(255)
- conversion_target_industry varchar(100)
- conversion_target_website varchar(500)
- conversion_target_address varchar(500)
- distillation_keyword varchar(255)
- album_name varchar(255)
- knowledge_base_name varchar(255)
- article_setting_name varchar(255)
- article_setting_prompt text

### 7. platform_accounts 表
需要添加:
- real_username varchar(255)

### 8. platforms_config 表
需要添加:
- login_url text
- selectors jsonb
- home_url varchar(500)

### 9. publishing_records 表
需要添加快照字段:
- account_name varchar(100)
- article_title varchar(500)
- article_content text
- article_keyword varchar(255)
- article_image_url text
- topic_question text
- article_setting_name varchar(255)
- distillation_keyword varchar(255)

### 10. conversion_targets 表
需要删除以下字段的 NOT NULL 约束:
- company_size
- features
- contact_info
- target_audience
- core_products

### 11. config_history 表
需要修改:
- changed_by 应该是 NOT NULL
- ip_address 应该是 NOT NULL

### 12. security_config 表
需要添加:
- config_type varchar(50) NOT NULL
- validation_rule text
- is_active boolean DEFAULT true
- version integer DEFAULT 1
- created_by integer
- updated_by integer

### 13. security_config_history 表
需要添加:
- config_key varchar(100) NOT NULL
- version integer NOT NULL
- change_reason text

### 14. security_events 表
需要修改:
- 删除 resolved, resolved_at, resolved_by 字段
- 添加 message text NOT NULL

### 15. user_usage 表
需要修改:
- period_start 类型应为 DATE 而非 TIMESTAMP
- period_end 类型应为 DATE 而非 TIMESTAMP

### 16. refresh_tokens 表
需要添加:
- revoked boolean DEFAULT false

---

## 四、修复策略

### 方案A: 完全重写001（推荐）
将001_initial_schema.sql完全重写，包含所有表的最终结构，删除所有后续迁移文件。

**优点:** 
- 干净、一致
- 新部署只需执行一个迁移文件

**缺点:**
- 工作量大
- 需要仔细验证

### 方案B: 保持现有迁移结构
修复001中的错误，保留后续迁移文件。

**优点:**
- 改动小
- 保留历史记录

**缺点:**
- 迁移文件多，维护困难
- 可能有遗漏

---

## 五、执行计划

1. 完全重写 001_initial_schema.sql，包含所有61个表的完整结构
2. 删除所有后续迁移文件（002-052）
3. 在服务器上删除并重建数据库
4. 执行新的001迁移
5. 验证所有表结构
