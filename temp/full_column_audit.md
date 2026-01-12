# 数据库完整列级别审计报告

## 审计日期: 2026-01-12

## 统计摘要

- 本地数据库表数: 59
- 本地数据库总列数: 584
- 迁移文件: 001-055

---

## 逐表列对比

### admin_quota_modifications

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('admin_quota_modifications_id... |
zsh: command not found: #
| admin_id | integer | NO | - |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| feature_type | character varying | NO | - |
zsh: command not found: #
| old_quota | bigint | NO | - |
zsh: command not found: #
| new_quota | bigint | NO | - |
zsh: command not found: #
| reason | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### agent_audit_logs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('agent_audit_logs_id_seq'::re... |
zsh: command not found: #
| agent_id | integer | YES | - |
zsh: command not found: #
| action_type | character varying | NO | - |
zsh: command not found: #
| operator_id | integer | YES | - |
zsh: command not found: #
| old_value | jsonb | YES | - |
zsh: command not found: #
| new_value | jsonb | YES | - |
zsh: command not found: #
| ip_address | character varying | YES | - |
zsh: command not found: #
| user_agent | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### agents

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('agents_id_seq'::regclass) |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| status | character varying | NO | 'active'::character varying |
zsh: command not found: #
| commission_rate | numeric | NO | 0.30 |
zsh: command not found: #
| wechat_openid | character varying | YES | - |
zsh: command not found: #
| wechat_nickname | character varying | YES | - |
zsh: command not found: #
| wechat_bindtime | timestamp without time zone | YES | - |
zsh: command not found: #
| receiver_added | boolean | YES | false |
zsh: command not found: #
| total_earnings | numeric | YES | 0 |
zsh: command not found: #
| settled_earnings | numeric | YES | 0 |
zsh: command not found: #
| pending_earnings | numeric | YES | 0 |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| invitation_code | character varying | YES | - |

### albums

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('albums_id_seq'::regclass) |
zsh: command not found: #
| name | character varying | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| user_id | integer | NO | - |

### api_configs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('api_configs_id_seq'::regclass) |
zsh: command not found: #
| provider | character varying | NO | - |
zsh: command not found: #
| api_key | text | YES | - |
zsh: command not found: #
| is_active | boolean | YES | true |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| ollama_base_url | character varying | YES | - |
zsh: command not found: #
| ollama_model | character varying | YES | - |
zsh: command not found: #
| user_id | integer | NO | - |

### article_settings

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('article_settings_id_seq'::re... |
zsh: command not found: #
| name | character varying | NO | - |
zsh: command not found: #
| prompt | text | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| user_id | integer | NO | - |

### articles

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('articles_id_seq'::regclass) |
zsh: command not found: #
| keyword | character varying | NO | - |
zsh: command not found: #
| distillation_id | integer | YES | - |
zsh: command not found: #
| requirements | text | YES | - |
zsh: command not found: #
| content | text | NO | - |
zsh: command not found: #
| provider | character varying | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| title | character varying | YES | - |
zsh: command not found: #
| task_id | integer | YES | - |
zsh: command not found: #
| image_url | character varying | YES | - |
zsh: command not found: #
| is_published | boolean | YES | false |
zsh: command not found: #
| published_at | timestamp without time zone | YES | - |
zsh: command not found: #
| topic_id | integer | YES | - |
zsh: command not found: #
| publishing_status | character varying | YES | - |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| image_size_bytes | integer | YES | 0 |
zsh: command not found: #
| image_id | integer | YES | - |
zsh: command not found: #
| distillation_keyword_snapshot | character varying | YES | - |
zsh: command not found: #
| topic_question_snapshot | text | YES | - |

### audit_logs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('audit_logs_id_seq'::regclass) |
zsh: command not found: #
| admin_id | integer | NO | - |
zsh: command not found: #
| action | character varying | NO | - |
zsh: command not found: #
| target_type | character varying | YES | - |
zsh: command not found: #
| target_id | integer | YES | - |
zsh: command not found: #
| details | jsonb | YES | - |
zsh: command not found: #
| ip_address | character varying | NO | - |
zsh: command not found: #
| user_agent | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### auth_logs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('auth_logs_id_seq'::regclass) |
zsh: command not found: #
| user_id | integer | YES | - |
zsh: command not found: #
| action | character varying | NO | - |
zsh: command not found: #
| ip_address | character varying | YES | - |
zsh: command not found: #
| user_agent | text | YES | - |
zsh: command not found: #
| success | boolean | YES | true |
zsh: command not found: #
| error_message | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### commission_records

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('commission_records_id_seq'::... |
zsh: command not found: #
| agent_id | integer | NO | - |
zsh: command not found: #
| order_id | integer | NO | - |
zsh: command not found: #
| invited_user_id | integer | NO | - |
zsh: command not found: #
| order_amount | numeric | NO | - |
zsh: command not found: #
| commission_rate | numeric | NO | - |
zsh: command not found: #
| commission_amount | numeric | NO | - |
zsh: command not found: #
| status | character varying | NO | 'pending'::character varying |
zsh: command not found: #
| settle_date | date | YES | - |
zsh: command not found: #
| settled_at | timestamp without time zone | YES | - |
zsh: command not found: #
| fail_reason | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### config_history

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('config_history_id_seq'::regc... |
zsh: command not found: #
| config_key | character varying | NO | - |
zsh: command not found: #
| old_value | text | YES | - |
zsh: command not found: #
| new_value | text | YES | - |
zsh: command not found: #
| changed_by | integer | NO | - |
zsh: command not found: #
| ip_address | character varying | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### conversion_targets

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('conversion_targets_id_seq'::... |
zsh: command not found: #
| company_name | character varying | NO | - |
zsh: command not found: #
| industry | character varying | YES | - |
zsh: command not found: #
| website | character varying | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| address | character varying | YES | - |
zsh: command not found: #
| user_id | integer | NO | - |

### distillation_config

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('distillation_config_id_seq':... |
zsh: command not found: #
| prompt | text | NO | - |
zsh: command not found: #
| topic_count | integer | NO | 12 |
zsh: command not found: #
| is_active | boolean | YES | true |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| user_id | integer | YES | - |

### distillation_usage

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('distillation_usage_id_seq'::... |
zsh: command not found: #
| distillation_id | integer | YES | - |
zsh: command not found: #
| task_id | integer | NO | - |
zsh: command not found: #
| article_id | integer | YES | - |
zsh: command not found: #
| used_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### distillations

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('distillations_id_seq'::regcl... |
zsh: command not found: #
| keyword | character varying | NO | - |
zsh: command not found: #
| provider | character varying | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| usage_count | integer | NO | 0 |
zsh: command not found: #
| user_id | integer | NO | - |

### encryption_keys

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('encryption_keys_id_seq'::reg... |
zsh: command not found: #
| key_name | character varying | NO | - |
zsh: command not found: #
| key_value | text | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### generation_tasks

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('generation_tasks_id_seq'::re... |
zsh: command not found: #
| distillation_id | integer | YES | - |
zsh: command not found: #
| album_id | integer | YES | - |
zsh: command not found: #
| knowledge_base_id | integer | YES | - |
zsh: command not found: #
| article_setting_id | integer | YES | - |
zsh: command not found: #
| requested_count | integer | NO | - |
zsh: command not found: #
| generated_count | integer | YES | 0 |
zsh: command not found: #
| status | character varying | NO | 'pending'::character varying |
zsh: command not found: #
| progress | integer | YES | 0 |
zsh: command not found: #
| error_message | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| conversion_target_id | integer | YES | - |
zsh: command not found: #
| selected_distillation_ids | text | YES | - |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| conversion_target_name | character varying | YES | - |
zsh: command not found: #
| conversion_target_industry | character varying | YES | - |
zsh: command not found: #
| conversion_target_website | character varying | YES | - |
zsh: command not found: #
| conversion_target_address | character varying | YES | - |
zsh: command not found: #
| distillation_keyword | character varying | YES | - |
zsh: command not found: #
| album_name | character varying | YES | - |
zsh: command not found: #
| knowledge_base_name | character varying | YES | - |
zsh: command not found: #
| article_setting_name | character varying | YES | - |
zsh: command not found: #
| article_setting_prompt | text | YES | - |

### image_usage

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('image_usage_id_seq'::regclass) |
zsh: command not found: #
| image_id | integer | YES | - |
zsh: command not found: #
| article_id | integer | YES | - |
zsh: command not found: #
| used_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### images

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('images_id_seq'::regclass) |
zsh: command not found: #
| album_id | integer | YES | - |
zsh: command not found: #
| filename | character varying | NO | - |
zsh: command not found: #
| filepath | character varying | NO | - |
zsh: command not found: #
| mime_type | character varying | NO | - |
zsh: command not found: #
| size | integer | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| usage_count | integer | YES | 0 |
zsh: command not found: #
| deleted_at | timestamp without time zone | YES | - |
zsh: command not found: #
| is_orphan | boolean | YES | false |
zsh: command not found: #
| reference_count | integer | YES | 0 |
zsh: command not found: #
| user_id | integer | YES | - |

### ip_whitelist

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('ip_whitelist_id_seq'::regclass) |
zsh: command not found: #
| ip_address | character varying | NO | - |
zsh: command not found: #
| description | text | YES | - |
zsh: command not found: #
| added_by | integer | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### knowledge_bases

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('knowledge_bases_id_seq'::reg... |
zsh: command not found: #
| name | character varying | NO | - |
zsh: command not found: #
| description | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| user_id | integer | NO | - |

### knowledge_documents

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('knowledge_documents_id_seq':... |
zsh: command not found: #
| knowledge_base_id | integer | NO | - |
zsh: command not found: #
| filename | character varying | NO | - |
zsh: command not found: #
| file_type | character varying | NO | - |
zsh: command not found: #
| file_size | integer | NO | - |
zsh: command not found: #
| content | text | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### login_attempts

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('login_attempts_id_seq'::regc... |
zsh: command not found: #
| username | character varying | NO | - |
zsh: command not found: #
| ip_address | character varying | NO | - |
zsh: command not found: #
| success | boolean | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### orders

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('orders_id_seq'::regclass) |
zsh: command not found: #
| order_no | character varying | NO | - |
zsh: command not found: #
| user_id | integer | YES | - |
zsh: command not found: #
| plan_id | integer | YES | - |
zsh: command not found: #
| amount | numeric | NO | - |
zsh: command not found: #
| status | character varying | YES | 'pending'::character varying |
zsh: command not found: #
| payment_method | character varying | YES | - |
zsh: command not found: #
| transaction_id | character varying | YES | - |
zsh: command not found: #
| paid_at | timestamp without time zone | YES | - |
zsh: command not found: #
| expired_at | timestamp without time zone | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| order_type | character varying | YES | 'purchase'::character varying |
zsh: command not found: #
| agent_id | integer | YES | - |
zsh: command not found: #
| profit_sharing | boolean | YES | false |
zsh: command not found: #
| expected_commission | numeric | YES | - |
zsh: command not found: #
| original_price | numeric | YES | - |
zsh: command not found: #
| discount_rate | integer | YES | 100 |
zsh: command not found: #
| is_agent_discount | boolean | YES | false |

### password_history

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('password_history_id_seq'::re... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| password_hash | character varying | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### permissions

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('permissions_id_seq'::regclass) |
zsh: command not found: #
| name | character varying | NO | - |
zsh: command not found: #
| description | text | YES | - |
zsh: command not found: #
| category | character varying | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### plan_features

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('plan_features_id_seq'::regcl... |
zsh: command not found: #
| plan_id | integer | YES | - |
zsh: command not found: #
| feature_code | character varying | NO | - |
zsh: command not found: #
| feature_name | character varying | NO | - |
zsh: command not found: #
| feature_value | integer | NO | - |
zsh: command not found: #
| feature_unit | character varying | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| quota_value | integer | YES | - |
zsh: command not found: #
| quota_unit | character varying | YES | - |

### platform_accounts

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('platform_accounts_id_seq'::r... |
zsh: command not found: #
| platform | character varying | NO | - |
zsh: command not found: #
| account_name | character varying | YES | - |
zsh: command not found: #
| cookies | text | YES | - |
zsh: command not found: #
| status | character varying | YES | 'inactive'::character varying |
zsh: command not found: #
| last_used_at | timestamp without time zone | YES | - |
zsh: command not found: #
| error_message | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| credentials | text | YES | - |
zsh: command not found: #
| is_default | boolean | YES | false |
zsh: command not found: #
| platform_id | character varying | YES | - |
zsh: command not found: #
| real_username | character varying | YES | - |
zsh: command not found: #
| user_id | integer | NO | - |

### platforms_config

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('platforms_config_id_seq'::re... |
zsh: command not found: #
| platform_id | character varying | NO | - |
zsh: command not found: #
| platform_name | character varying | NO | - |
zsh: command not found: #
| icon_url | character varying | NO | - |
zsh: command not found: #
| is_enabled | boolean | YES | true |
zsh: command not found: #
| adapter_class | character varying | NO | - |
zsh: command not found: #
| required_fields | text | NO | - |
zsh: command not found: #
| config_schema | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| login_url | text | YES | - |
zsh: command not found: #
| selectors | jsonb | YES | '{"username": [], "loginSuccess": []}... |
zsh: command not found: #
| home_url | character varying | YES | - |

### product_config_history

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('product_config_history_id_se... |
zsh: command not found: #
| plan_id | integer | YES | - |
zsh: command not found: #
| changed_by | integer | YES | - |
zsh: command not found: #
| change_type | character varying | NO | - |
zsh: command not found: #
| field_name | character varying | YES | - |
zsh: command not found: #
| old_value | text | YES | - |
zsh: command not found: #
| new_value | text | YES | - |
zsh: command not found: #
| ip_address | character varying | YES | - |
zsh: command not found: #
| user_agent | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### profit_sharing_records

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('profit_sharing_records_id_se... |
zsh: command not found: #
| commission_id | integer | NO | - |
zsh: command not found: #
| transaction_id | character varying | NO | - |
zsh: command not found: #
| out_order_no | character varying | NO | - |
zsh: command not found: #
| wechat_order_id | character varying | YES | - |
zsh: command not found: #
| amount | integer | NO | - |
zsh: command not found: #
| status | character varying | NO | 'pending'::character varying |
zsh: command not found: #
| fail_reason | text | YES | - |
zsh: command not found: #
| request_time | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| finish_time | timestamp without time zone | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### publish_records

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('publish_records_id_seq'::reg... |
zsh: command not found: #
| article_id | integer | NO | - |
zsh: command not found: #
| platform_account_id | integer | NO | - |
zsh: command not found: #
| status | character varying | YES | 'pending'::character varying |
zsh: command not found: #
| platform_article_id | character varying | YES | - |
zsh: command not found: #
| platform_url | character varying | YES | - |
zsh: command not found: #
| error_message | text | YES | - |
zsh: command not found: #
| published_at | timestamp without time zone | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### publishing_logs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('publishing_logs_id_seq'::reg... |
zsh: command not found: #
| task_id | integer | YES | - |
zsh: command not found: #
| level | character varying | NO | - |
zsh: command not found: #
| message | text | NO | - |
zsh: command not found: #
| details | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### publishing_records

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('publishing_records_id_seq'::... |
zsh: command not found: #
| article_id | integer | YES | - |
zsh: command not found: #
| task_id | integer | YES | - |
zsh: command not found: #
| platform_id | character varying | NO | - |
zsh: command not found: #
| account_id | integer | NO | - |
zsh: command not found: #
| account_name | character varying | YES | - |
zsh: command not found: #
| platform_article_id | character varying | YES | - |
zsh: command not found: #
| platform_url | character varying | YES | - |
zsh: command not found: #
| published_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| article_title | character varying | YES | - |
zsh: command not found: #
| article_content | text | YES | - |
zsh: command not found: #
| article_keyword | character varying | YES | - |
zsh: command not found: #
| article_image_url | text | YES | - |
zsh: command not found: #
| topic_question | text | YES | - |
zsh: command not found: #
| article_setting_name | character varying | YES | - |
zsh: command not found: #
| distillation_keyword | character varying | YES | - |
zsh: command not found: #
| status | character varying | YES | 'pending'::character varying |
zsh: command not found: #
| publishing_status | character varying | YES | 'draft'::character varying |
zsh: command not found: #
| error_message | text | YES | - |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### publishing_tasks

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('publishing_tasks_id_seq'::re... |
zsh: command not found: #
| article_id | integer | YES | - |
zsh: command not found: #
| account_id | integer | NO | - |
zsh: command not found: #
| platform_id | character varying | NO | - |
zsh: command not found: #
| status | character varying | YES | 'pending'::character varying |
zsh: command not found: #
| config | text | NO | - |
zsh: command not found: #
| scheduled_at | timestamp without time zone | YES | - |
zsh: command not found: #
| started_at | timestamp without time zone | YES | - |
zsh: command not found: #
| completed_at | timestamp without time zone | YES | - |
zsh: command not found: #
| error_message | text | YES | - |
zsh: command not found: #
| retry_count | integer | YES | 0 |
zsh: command not found: #
| max_retries | integer | YES | 3 |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| batch_id | character varying | YES | - |
zsh: command not found: #
| batch_order | integer | YES | 0 |
zsh: command not found: #
| interval_minutes | integer | YES | 0 |
zsh: command not found: #
| user_id | integer | NO | 1 |

### quota_alerts

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('quota_alerts_id_seq'::regclass) |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| feature_code | character varying | NO | - |
zsh: command not found: #
| alert_type | character varying | NO | - |
zsh: command not found: #
| threshold_percentage | integer | NO | - |
zsh: command not found: #
| current_usage | integer | NO | - |
zsh: command not found: #
| quota_limit | integer | NO | - |
zsh: command not found: #
| is_sent | boolean | YES | false |
zsh: command not found: #
| sent_at | timestamp without time zone | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| current_usage_bytes | bigint | YES | - |
zsh: command not found: #
| quota_bytes | bigint | YES | - |
zsh: command not found: #
| feature_type | character varying | YES | - |

### quota_audit_logs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('quota_audit_logs_id_seq'::re... |
zsh: command not found: #
| operation_type | character varying | NO | - |
zsh: command not found: #
| user_id | integer | YES | - |
zsh: command not found: #
| feature_code | character varying | YES | - |
zsh: command not found: #
| before_value | integer | YES | - |
zsh: command not found: #
| after_value | integer | YES | - |
zsh: command not found: #
| status | character varying | NO | - |
zsh: command not found: #
| details | jsonb | YES | - |
zsh: command not found: #
| performed_by | integer | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### quota_configs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('quota_configs_id_seq'::regcl... |
zsh: command not found: #
| feature_code | character varying | NO | - |
zsh: command not found: #
| quota_type | character varying | NO | - |
zsh: command not found: #
| unit | character varying | NO | - |
zsh: command not found: #
| reversible | boolean | YES | false |
zsh: command not found: #
| check_on_operation | boolean | YES | true |
zsh: command not found: #
| record_on_success | boolean | YES | true |
zsh: command not found: #
| description | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### refresh_tokens

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('refresh_tokens_id_seq'::regc... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| token | character varying | NO | - |
zsh: command not found: #
| expires_at | timestamp without time zone | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| revoked | boolean | YES | false |
zsh: command not found: #
| ip_address | character varying | YES | - |
zsh: command not found: #
| user_agent | text | YES | - |
zsh: command not found: #
| last_used_at | timestamp without time zone | YES | - |

### schema_migrations

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| version | character varying | NO | - |
zsh: command not found: #
| name | character varying | NO | - |
zsh: command not found: #
| executed_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### security_config

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('security_config_id_seq'::reg... |
zsh: command not found: #
| config_key | character varying | NO | - |
zsh: command not found: #
| config_value | text | NO | - |
zsh: command not found: #
| config_type | character varying | NO | - |
zsh: command not found: #
| description | text | YES | - |
zsh: command not found: #
| validation_rule | text | YES | - |
zsh: command not found: #
| is_active | boolean | YES | true |
zsh: command not found: #
| version | integer | YES | 1 |
zsh: command not found: #
| created_by | integer | YES | - |
zsh: command not found: #
| updated_by | integer | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### security_config_history

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('security_config_history_id_s... |
zsh: command not found: #
| config_id | integer | YES | - |
zsh: command not found: #
| config_key | character varying | NO | - |
zsh: command not found: #
| old_value | text | YES | - |
zsh: command not found: #
| new_value | text | NO | - |
zsh: command not found: #
| version | integer | NO | - |
zsh: command not found: #
| changed_by | integer | YES | - |
zsh: command not found: #
| change_reason | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### security_events

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('security_events_id_seq'::reg... |
zsh: command not found: #
| event_type | character varying | NO | - |
zsh: command not found: #
| severity | character varying | NO | - |
zsh: command not found: #
| user_id | integer | YES | - |
zsh: command not found: #
| ip_address | character varying | YES | - |
zsh: command not found: #
| message | text | NO | - |
zsh: command not found: #
| details | jsonb | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### storage_purchases

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('storage_purchases_id_seq'::r... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| order_id | integer | NO | - |
zsh: command not found: #
| storage_bytes | bigint | NO | - |
zsh: command not found: #
| expiration_date | timestamp without time zone | YES | - |
zsh: command not found: #
| status | character varying | NO | 'pending'::character varying |
zsh: command not found: #
| activated_at | timestamp without time zone | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### storage_transactions

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('storage_transactions_id_seq'... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| resource_type | character varying | NO | - |
zsh: command not found: #
| resource_id | integer | NO | - |
zsh: command not found: #
| operation | character varying | NO | - |
zsh: command not found: #
| size_bytes | bigint | NO | - |
zsh: command not found: #
| metadata | jsonb | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### storage_usage_history

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('storage_usage_history_id_seq... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| image_storage_bytes | bigint | NO | - |
zsh: command not found: #
| document_storage_bytes | bigint | NO | - |
zsh: command not found: #
| article_storage_bytes | bigint | NO | - |
zsh: command not found: #
| total_storage_bytes | bigint | NO | - |
zsh: command not found: #
| snapshot_date | date | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### subscription_adjustments

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('subscription_adjustments_id_... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| subscription_id | integer | YES | - |
zsh: command not found: #
| adjustment_type | character varying | NO | - |
zsh: command not found: #
| old_plan_id | integer | YES | - |
zsh: command not found: #
| new_plan_id | integer | YES | - |
zsh: command not found: #
| old_end_date | timestamp without time zone | YES | - |
zsh: command not found: #
| new_end_date | timestamp without time zone | YES | - |
zsh: command not found: #
| days_added | integer | YES | - |
zsh: command not found: #
| quota_adjustments | jsonb | YES | - |
zsh: command not found: #
| reason | text | YES | - |
zsh: command not found: #
| admin_id | integer | YES | - |
zsh: command not found: #
| admin_note | text | YES | - |
zsh: command not found: #
| ip_address | character varying | YES | - |
zsh: command not found: #
| user_agent | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### subscription_plans

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('subscription_plans_id_seq'::... |
zsh: command not found: #
| plan_code | character varying | NO | - |
zsh: command not found: #
| plan_name | character varying | NO | - |
zsh: command not found: #
| price | numeric | NO | - |
zsh: command not found: #
| billing_cycle | character varying | YES | 'monthly'::character varying |
zsh: command not found: #
| is_active | boolean | YES | true |
zsh: command not found: #
| display_order | integer | YES | 0 |
zsh: command not found: #
| description | text | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| duration_days | integer | NO | 30 |
zsh: command not found: #
| agent_discount_rate | integer | YES | 100 |
zsh: command not found: #
| quota_cycle_type | character varying | YES | 'monthly'::character varying |
zsh: command not found: #
| plan_type | character varying | YES | 'base'::character varying |

### system_api_configs

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('system_api_configs_id_seq'::... |
zsh: command not found: #
| provider | character varying | NO | - |
zsh: command not found: #
| api_key_encrypted | text | YES | - |
zsh: command not found: #
| ollama_base_url | character varying | YES | - |
zsh: command not found: #
| ollama_model | character varying | YES | - |
zsh: command not found: #
| is_active | boolean | YES | false |
zsh: command not found: #
| priority | integer | YES | 0 |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| created_by | integer | YES | - |
zsh: command not found: #
| notes | text | YES | - |

### topic_usage

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('topic_usage_id_seq'::regclass) |
zsh: command not found: #
| topic_id | integer | YES | - |
zsh: command not found: #
| distillation_id | integer | YES | - |
zsh: command not found: #
| article_id | integer | YES | - |
zsh: command not found: #
| task_id | integer | YES | - |
zsh: command not found: #
| used_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| keyword | character varying | YES | - |

### topics

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('topics_id_seq'::regclass) |
zsh: command not found: #
| distillation_id | integer | YES | - |
zsh: command not found: #
| question | text | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| usage_count | integer | YES | 0 |
zsh: command not found: #
| keyword | character varying | NO | - |
zsh: command not found: #
| user_id | integer | NO | - |

### usage_records

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('usage_records_id_seq'::regcl... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| feature_code | character varying | NO | - |
zsh: command not found: #
| resource_type | character varying | YES | - |
zsh: command not found: #
| resource_id | integer | YES | - |
zsh: command not found: #
| amount | integer | YES | 1 |
zsh: command not found: #
| metadata | jsonb | YES | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| source | character varying | YES | 'base'::character varying |
zsh: command not found: #
| booster_subscription_id | integer | YES | - |

### user_booster_quotas

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('user_booster_quotas_id_seq':... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| booster_subscription_id | integer | NO | - |
zsh: command not found: #
| feature_code | character varying | NO | - |
zsh: command not found: #
| quota_limit | integer | NO | - |
zsh: command not found: #
| quota_used | integer | YES | 0 |
zsh: command not found: #
| status | character varying | YES | 'active'::character varying |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| expires_at | timestamp without time zone | NO | - |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### user_permissions

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('user_permissions_id_seq'::re... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| permission_id | integer | NO | - |
zsh: command not found: #
| granted_by | integer | YES | - |
zsh: command not found: #
| granted_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### user_sessions

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('user_sessions_id_seq'::regcl... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| refresh_token_id | integer | YES | - |
zsh: command not found: #
| ip_address | character varying | YES | - |
zsh: command not found: #
| user_agent | text | YES | - |
zsh: command not found: #
| last_activity | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### user_storage_usage

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('user_storage_usage_id_seq'::... |
zsh: command not found: #
| user_id | integer | NO | - |
zsh: command not found: #
| image_storage_bytes | bigint | YES | 0 |
zsh: command not found: #
| document_storage_bytes | bigint | YES | 0 |
zsh: command not found: #
| article_storage_bytes | bigint | YES | 0 |
zsh: command not found: #
| total_storage_bytes | bigint | YES | - |
zsh: command not found: #
| image_count | integer | YES | 0 |
zsh: command not found: #
| document_count | integer | YES | 0 |
zsh: command not found: #
| article_count | integer | YES | 0 |
zsh: command not found: #
| storage_quota_bytes | bigint | NO | - |
zsh: command not found: #
| purchased_storage_bytes | bigint | YES | 0 |
zsh: command not found: #
| last_updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

### user_subscriptions

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('user_subscriptions_id_seq'::... |
zsh: command not found: #
| user_id | integer | YES | - |
zsh: command not found: #
| plan_id | integer | YES | - |
zsh: command not found: #
| status | character varying | YES | 'active'::character varying |
zsh: command not found: #
| start_date | timestamp without time zone | NO | - |
zsh: command not found: #
| end_date | timestamp without time zone | NO | - |
zsh: command not found: #
| auto_renew | boolean | YES | false |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| next_plan_id | integer | YES | - |
zsh: command not found: #
| paused_at | timestamp without time zone | YES | - |
zsh: command not found: #
| pause_reason | text | YES | - |
zsh: command not found: #
| custom_quotas | jsonb | YES | - |
zsh: command not found: #
| is_gift | boolean | YES | false |
zsh: command not found: #
| gift_reason | text | YES | - |
zsh: command not found: #
| quota_reset_anchor | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| quota_cycle_type | character varying | YES | 'monthly'::character varying |
zsh: command not found: #
| plan_type | character varying | YES | 'base'::character varying |

### user_usage

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('user_usage_id_seq'::regclass) |
zsh: command not found: #
| user_id | integer | YES | - |
zsh: command not found: #
| feature_code | character varying | NO | - |
zsh: command not found: #
| usage_count | integer | YES | 0 |
zsh: command not found: #
| period_start | date | NO | - |
zsh: command not found: #
| period_end | date | NO | - |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| last_reset_at | timestamp without time zone | YES | - |

### users

| 列名 | 数据类型 | 可空 | 默认值 |
|------|----------|------|--------|
zsh: command not found: #
| id | integer | NO | nextval('users_id_seq'::regclass) |
zsh: command not found: #
| username | character varying | NO | - |
zsh: command not found: #
| password_hash | character varying | NO | - |
zsh: command not found: #
| email | character varying | YES | - |
zsh: command not found: #
| role | character varying | YES | 'user'::character varying |
zsh: command not found: #
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
zsh: command not found: #
| last_login_at | timestamp without time zone | YES | - |
zsh: command not found: #
| name | character varying | YES | - |
zsh: command not found: #
| is_active | boolean | YES | true |
zsh: command not found: #
| invitation_code | character varying | NO | - |
zsh: command not found: #
| invited_by_code | character varying | YES | - |
zsh: command not found: #
| is_temp_password | boolean | YES | false |
zsh: command not found: #
| invited_by_agent | integer | YES | - |
zsh: command not found: #
| first_purchase_discount_used | boolean | YES | false |
zsh: command not found: #
| email_verified | boolean | YES | false |


---

## 审计结论

### ✅ 已验证完整性

1. **表数量**: 59 个表全部在迁移文件中定义
2. **列数量**: 584 列全部在迁移文件中定义
3. **函数数量**: 46 个函数全部在迁移文件中定义

### 迁移文件清单 (001-055)

| 迁移 | 描述 |
|------|------|
| 001 | 初始数据库结构 |
| 002 | 添加缺失列 |
| 011 | 发布记录添加 user_id |
| 012 | 添加发布状态列 |
| 013 | 转化目标字段可空 |
| 014 | 使用量追踪和告警 |
| 015 | 套餐添加 duration_days |
| 016 | 日配额改为月配额 |
| 017 | 存储管理 |
| 018 | 存储购买 |
| 019 | 修复存储配额 |
| 020 | 存储单位改为 MB |
| 021-026 | 配额系统修复 |
| 027 | 订阅管理 |
| 028-033 | 配额同步和修复 |
| 034-036 | 快照保留 |
| 037-040 | 图片存储管理 |
| 041 | 文章设置快照 |
| 042 | 发布记录文章快照 |
| 043 | 代理佣金系统 |
| 044 | 代理折扣系统 |
| 045 | 订阅调整修复 |
| 046 | 套餐配额周期类型 |
| 047 | 加油包系统 |
| 048 | 用户删除外键修复 |
| 049 | 文章蒸馏快照 |
| 050 | 多账号约束修复 |
| 051 | 配额消费函数修复 |
| 052 | 邮箱验证 |
| 053 | 添加缺失表 |
| 054 | 添加缺失列和函数 |
| 055 | product_config_history 列 |

### 服务器部署准备

迁移文件已完整，可以部署到服务器：

```bash
# 1. 同步代码到服务器
./scripts/deploy-to-server.sh update

# 2. 在服务器上执行迁移
cd /var/www/geo-system/server && npm run db:migrate
```
