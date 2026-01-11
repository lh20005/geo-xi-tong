-- ==================== UP ====================
-- 初始数据库结构
-- 
-- 描述：创建所有基础表和索引（包含多租户支持）
-- 日期：2025-12-27
-- 更新：2026-01-11 - 添加所有多租户 user_id 字段

-- ========================================
-- 1. 用户和认证相关表
-- ========================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  invitation_code VARCHAR(20) UNIQUE,
  invited_by_code VARCHAR(20),
  is_temp_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_invitation_code ON users(invitation_code);
CREATE INDEX IF NOT EXISTS idx_users_invited_by_code ON users(invited_by_code);

-- 刷新令牌表（会话管理）
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- 登录尝试记录表
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- 密码历史表
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at DESC);

-- ========================================
-- 2. 订阅和支付相关表
-- ========================================

-- 套餐配置表
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  plan_code VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 套餐功能配额表
CREATE TABLE IF NOT EXISTS plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  quota_value INTEGER NOT NULL,
  quota_unit VARCHAR(20),
  feature_value INTEGER,
  feature_unit VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);

-- 用户订阅表
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);

-- 用户使用量统计表
CREATE TABLE IF NOT EXISTS user_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_usage_user_feature_period_key UNIQUE (user_id, feature_code, period_start)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_feature ON user_usage(feature_code);

-- 配置变更历史表
CREATE TABLE IF NOT EXISTS product_config_history (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id),
  changed_by INTEGER REFERENCES users(id),
  change_type VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_config_history_plan_id ON product_config_history(plan_id);


-- ========================================
-- 3. 安全和审计相关表
-- ========================================

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 安全事件表
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  description TEXT,
  details TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);

-- 安全告警表
CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_is_read ON security_alerts(is_read);

-- 安全配置表
CREATE TABLE IF NOT EXISTS security_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 安全配置历史表
CREATE TABLE IF NOT EXISTS security_config_history (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES security_config(id) ON DELETE CASCADE,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配置历史表
CREATE TABLE IF NOT EXISTS config_history (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_config_history_created_at ON config_history(created_at DESC);

-- IP白名单表
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip_address);

-- ========================================
-- 4. 权限管理相关表
-- ========================================

-- 权限定义表
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户权限关联表
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);


-- ========================================
-- 5. 内容管理相关表（包含多租户 user_id）
-- ========================================

-- API配置表
CREATE TABLE IF NOT EXISTS api_configs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('deepseek', 'gemini', 'ollama')),
  api_key TEXT,
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_configs_provider ON api_configs(provider);
CREATE INDEX IF NOT EXISTS idx_api_configs_active ON api_configs(is_active);

-- 关键词蒸馏记录表（多租户）
CREATE TABLE IF NOT EXISTS distillations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_distillations_user_id ON distillations(user_id);
CREATE INDEX IF NOT EXISTS idx_distillations_keyword ON distillations(keyword);

-- 话题表
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER REFERENCES distillations(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topics_distillation ON topics(distillation_id);

-- 相册表（多租户）
CREATE TABLE IF NOT EXISTS albums (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at DESC);

-- 图片表
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(500) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  size INTEGER NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_images_album_id ON images(album_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_usage_count ON images(album_id, usage_count ASC, created_at ASC);

-- 知识库表（多租户）
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_created_at ON knowledge_bases(created_at DESC);

-- 知识文档表
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id SERIAL PRIMARY KEY,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_kb_id ON knowledge_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at DESC);

-- 转化目标表（多租户）
CREATE TABLE IF NOT EXISTS conversion_targets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  company_size VARCHAR(50),
  features TEXT,
  contact_info VARCHAR(255),
  website VARCHAR(500),
  target_audience TEXT,
  core_products TEXT,
  address VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversion_targets_user_id ON conversion_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_targets_company_name ON conversion_targets(company_name);
CREATE INDEX IF NOT EXISTS idx_conversion_targets_created_at ON conversion_targets(created_at DESC);

-- 关键词蒸馏配置表
CREATE TABLE IF NOT EXISTS distillation_config (
  id SERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  topic_count INTEGER NOT NULL DEFAULT 12 CHECK (topic_count >= 5 AND topic_count <= 30),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_distillation_config_active ON distillation_config(is_active);

-- 文章设置表（多租户）
CREATE TABLE IF NOT EXISTS article_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_article_settings_user_id ON article_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_article_settings_created_at ON article_settings(created_at DESC);

-- 文章生成任务表（多租户）
CREATE TABLE IF NOT EXISTS generation_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  article_setting_id INTEGER NOT NULL REFERENCES article_settings(id) ON DELETE CASCADE,
  conversion_target_id INTEGER REFERENCES conversion_targets(id) ON DELETE SET NULL,
  requested_count INTEGER NOT NULL CHECK (requested_count > 0),
  generated_count INTEGER DEFAULT 0 CHECK (generated_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  selected_distillation_ids TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id ON generation_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_status ON generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_created_at ON generation_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_conversion_target ON generation_tasks(conversion_target_id);

-- 文章表（多租户）
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  keyword VARCHAR(255) NOT NULL,
  distillation_id INTEGER REFERENCES distillations(id),
  topic_id INTEGER REFERENCES topics(id),
  task_id INTEGER REFERENCES generation_tasks(id) ON DELETE SET NULL,
  requirements TEXT,
  content TEXT NOT NULL,
  image_url VARCHAR(500),
  provider VARCHAR(20) NOT NULL,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_keyword ON articles(keyword);
CREATE INDEX IF NOT EXISTS idx_articles_distillation ON articles(distillation_id);
CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_task_id ON articles(task_id);
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);


-- 图片使用追踪表
CREATE TABLE IF NOT EXISTS image_usage (
  id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(image_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_image_usage_image_id ON image_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_usage_article_id ON image_usage(article_id);

-- 话题使用记录表
CREATE TABLE IF NOT EXISTS topic_usage (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_usage_topic_id ON topic_usage(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_usage_article_id ON topic_usage(article_id);

-- 蒸馏使用记录表
CREATE TABLE IF NOT EXISTS distillation_usage (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_distillation_usage_distillation_id ON distillation_usage(distillation_id);
CREATE INDEX IF NOT EXISTS idx_distillation_usage_article_id ON distillation_usage(article_id);

-- ========================================
-- 6. 发布系统相关表（多租户）
-- ========================================

-- 平台账号表（多租户）
CREATE TABLE IF NOT EXISTS platform_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  platform_id VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  credentials TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform_id);

-- 发布任务表
CREATE TABLE IF NOT EXISTS publishing_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  platform_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  config TEXT NOT NULL,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  batch_id VARCHAR(50),
  batch_order INTEGER DEFAULT 0,
  interval_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_id ON publishing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_status ON publishing_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_article ON publishing_tasks(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_status ON publishing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_scheduled ON publishing_tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_batch_id ON publishing_tasks(batch_id);

-- 发布日志表
CREATE TABLE IF NOT EXISTS publishing_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES publishing_tasks(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publishing_logs_task ON publishing_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_publishing_logs_level ON publishing_logs(level);

-- 平台配置表
CREATE TABLE IF NOT EXISTS platforms_config (
  id SERIAL PRIMARY KEY,
  platform_id VARCHAR(50) UNIQUE NOT NULL,
  platform_name VARCHAR(100) NOT NULL,
  icon_url VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  adapter_class VARCHAR(100) NOT NULL,
  required_fields TEXT NOT NULL,
  config_schema TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 发布记录表（多租户）
CREATE TABLE IF NOT EXISTS publishing_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES publishing_tasks(id) ON DELETE SET NULL,
  account_id INTEGER REFERENCES platform_accounts(id) ON DELETE SET NULL,
  platform_id VARCHAR(50) NOT NULL,
  platform_article_id VARCHAR(255),
  platform_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  publishing_status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publishing_records_user_id ON publishing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_article_id ON publishing_records(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_task ON publishing_records(task_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_platform_id ON publishing_records(platform_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_status ON publishing_records(status);

-- ========================================
-- 7. 插入平台配置数据
-- ========================================

INSERT INTO platforms_config (platform_id, platform_name, icon_url, adapter_class, required_fields) VALUES
('wangyi', '网易号', '/icons/wangyi.png', 'WangyiAdapter', '["username", "password"]'),
('souhu', '搜狐号', '/icons/souhu.png', 'SouhuAdapter', '["username", "password"]'),
('baijiahao', '百家号', '/icons/baijiahao.png', 'BaijiahaoAdapter', '["username", "password"]'),
('toutiao', '头条号', '/icons/toutiao.png', 'ToutiaoAdapter', '["username", "password"]'),
('qie', '企鹅号', '/icons/qie.png', 'QieAdapter', '["username", "password"]'),
('wechat', '微信公众号', '/icons/wechat.png', 'WechatAdapter', '[]'),
('xiaohongshu', '小红书', '/icons/xiaohongshu.png', 'XiaohongshuAdapter', '["username", "password"]'),
('douyin', '抖音号', '/icons/douyin.png', 'DouyinAdapter', '["username", "password"]'),
('bilibili', '哔哩哔哩', '/icons/bilibili.png', 'BilibiliAdapter', '["username", "password"]'),
('zhihu', '知乎', '/icons/zhihu.png', 'ZhihuAdapter', '["username", "password"]'),
('jianshu', '简书', '/icons/jianshu.png', 'JianshuAdapter', '["username", "password"]'),
('csdn', 'CSDN', '/icons/csdn.png', 'CSDNAdapter', '["username", "password"]')
ON CONFLICT (platform_id) DO NOTHING;

-- ========================================
-- 8. 插入基础套餐数据
-- ========================================

INSERT INTO subscription_plans (plan_code, plan_name, price, duration_days, is_active, description)
VALUES 
  ('free', '体验版', 0, 30, true, '免费体验套餐'),
  ('professional', '专业版', 99, 30, true, '专业版套餐'),
  ('enterprise', '企业版', 299, 30, true, '企业版套餐')
ON CONFLICT (plan_code) DO NOTHING;

-- 插入套餐功能配额（体验版）
INSERT INTO plan_features (plan_id, feature_code, feature_name, quota_value, quota_unit, feature_value, feature_unit)
SELECT p.id, f.feature_code, f.feature_name, f.quota_value, f.quota_unit, f.quota_value, f.quota_unit
FROM subscription_plans p
CROSS JOIN (
  VALUES 
    ('articles_per_month', '每月文章数', 10, '篇'),
    ('publish_per_month', '每月发布数', 20, '次'),
    ('keyword_distillation', '关键词蒸馏', 5, '次'),
    ('platform_accounts', '平台账号数', 3, '个'),
    ('albums', '相册数量', 3, '个'),
    ('knowledge_bases', '知识库数量', 2, '个'),
    ('storage_space', '存储空间', 100, 'MB')
) AS f(feature_code, feature_name, quota_value, quota_unit)
WHERE p.plan_code = 'free'
ON CONFLICT DO NOTHING;

-- 插入套餐功能配额（专业版）
INSERT INTO plan_features (plan_id, feature_code, feature_name, quota_value, quota_unit, feature_value, feature_unit)
SELECT p.id, f.feature_code, f.feature_name, f.quota_value, f.quota_unit, f.quota_value, f.quota_unit
FROM subscription_plans p
CROSS JOIN (
  VALUES 
    ('articles_per_month', '每月文章数', 100, '篇'),
    ('publish_per_month', '每月发布数', 200, '次'),
    ('keyword_distillation', '关键词蒸馏', 50, '次'),
    ('platform_accounts', '平台账号数', 10, '个'),
    ('albums', '相册数量', 20, '个'),
    ('knowledge_bases', '知识库数量', 10, '个'),
    ('storage_space', '存储空间', 1024, 'MB')
) AS f(feature_code, feature_name, quota_value, quota_unit)
WHERE p.plan_code = 'professional'
ON CONFLICT DO NOTHING;

-- 插入套餐功能配额（企业版，-1表示无限）
INSERT INTO plan_features (plan_id, feature_code, feature_name, quota_value, quota_unit, feature_value, feature_unit)
SELECT p.id, f.feature_code, f.feature_name, f.quota_value, f.quota_unit, f.quota_value, f.quota_unit
FROM subscription_plans p
CROSS JOIN (
  VALUES 
    ('articles_per_month', '每月文章数', -1, '篇'),
    ('publish_per_month', '每月发布数', -1, '次'),
    ('keyword_distillation', '关键词蒸馏', -1, '次'),
    ('platform_accounts', '平台账号数', -1, '个'),
    ('albums', '相册数量', -1, '个'),
    ('knowledge_bases', '知识库数量', -1, '个'),
    ('storage_space', '存储空间', -1, 'MB')
) AS f(feature_code, feature_name, quota_value, quota_unit)
WHERE p.plan_code = 'enterprise'
ON CONFLICT DO NOTHING;

-- ==================== DOWN ====================
-- 回滚初始结构（删除所有表）
-- 警告：这将删除所有数据！

DROP TABLE IF EXISTS distillation_usage CASCADE;
DROP TABLE IF EXISTS topic_usage CASCADE;
DROP TABLE IF EXISTS image_usage CASCADE;
DROP TABLE IF EXISTS publishing_logs CASCADE;
DROP TABLE IF EXISTS publishing_tasks CASCADE;
DROP TABLE IF EXISTS publishing_records CASCADE;
DROP TABLE IF EXISTS platforms_config CASCADE;
DROP TABLE IF EXISTS platform_accounts CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS generation_tasks CASCADE;
DROP TABLE IF EXISTS article_settings CASCADE;
DROP TABLE IF EXISTS distillation_config CASCADE;
DROP TABLE IF EXISTS conversion_targets CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
DROP TABLE IF EXISTS knowledge_bases CASCADE;
DROP TABLE IF EXISTS images CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS distillations CASCADE;
DROP TABLE IF EXISTS api_configs CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS ip_whitelist CASCADE;
DROP TABLE IF EXISTS security_config_history CASCADE;
DROP TABLE IF EXISTS security_config CASCADE;
DROP TABLE IF EXISTS config_history CASCADE;
DROP TABLE IF EXISTS security_alerts CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS product_config_history CASCADE;
DROP TABLE IF EXISTS user_usage CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS plan_features CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS password_history CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
