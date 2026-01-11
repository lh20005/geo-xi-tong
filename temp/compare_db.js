// 本地数据库结构
const localDB = `admin_quota_modifications|id|integer|NO
admin_quota_modifications|admin_id|integer|NO
admin_quota_modifications|user_id|integer|NO
admin_quota_modifications|feature_type|character varying|NO
admin_quota_modifications|old_quota|bigint|NO
admin_quota_modifications|new_quota|bigint|NO
admin_quota_modifications|reason|text|YES
admin_quota_modifications|created_at|timestamp without time zone|YES
agent_audit_logs|id|integer|NO
agent_audit_logs|agent_id|integer|YES
agent_audit_logs|action_type|character varying|NO
agent_audit_logs|operator_id|integer|YES
agent_audit_logs|old_value|jsonb|YES
agent_audit_logs|new_value|jsonb|YES
agent_audit_logs|ip_address|character varying|YES
agent_audit_logs|user_agent|text|YES
agent_audit_logs|created_at|timestamp without time zone|YES
agents|id|integer|NO
agents|user_id|integer|NO
agents|status|character varying|NO
agents|commission_rate|numeric|NO
agents|wechat_openid|character varying|YES
agents|wechat_nickname|character varying|YES
agents|wechat_bindtime|timestamp without time zone|YES
agents|receiver_added|boolean|YES
agents|total_earnings|numeric|YES
agents|settled_earnings|numeric|YES
agents|pending_earnings|numeric|YES
agents|created_at|timestamp without time zone|YES
agents|updated_at|timestamp without time zone|YES
agents|invitation_code|character varying|YES
albums|id|integer|NO
albums|name|character varying|NO
albums|created_at|timestamp without time zone|YES
albums|updated_at|timestamp without time zone|YES
albums|user_id|integer|NO
api_configs|id|integer|NO
api_configs|provider|character varying|NO
api_configs|api_key|text|YES
api_configs|is_active|boolean|YES
api_configs|created_at|timestamp without time zone|YES
api_configs|updated_at|timestamp without time zone|YES
api_configs|ollama_base_url|character varying|YES
api_configs|ollama_model|character varying|YES
api_configs|user_id|integer|NO`;
