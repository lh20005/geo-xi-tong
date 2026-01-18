-- ========================================
-- GEO 系统 Windows 端 PostgreSQL 初始化迁移
-- 文件: 001_init.sql
-- 创建时间: 2026-01-15
-- 更新时间: 2026-01-17 (迁移到 PostgreSQL)
-- 说明: 创建所有本地数据表
-- ========================================

-- ========================================
-- 1. 文章表（对应服务器 articles 表）
-- ========================================
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT,
    keyword TEXT NOT NULL,
    distillation_id INTEGER,
    topic_id INTEGER,
    task_id INTEGER,
    image_id INTEGER,
    requirements TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    image_size_bytes INTEGER DEFAULT 0,
    provider TEXT NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    publishing_status TEXT,
    published_at TIMESTAMP,
    distillation_keyword_snapshot TEXT,
    topic_question_snapshot TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_keyword ON articles(keyword);
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);

-- ========================================
-- 2. 相册表（对应服务器 albums 表）
-- ========================================
CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);

-- ========================================
-- 3. 图片表（对应服务器 images 表）
-- ========================================
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    album_id INTEGER,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    usage_count INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,
    is_orphan BOOLEAN DEFAULT FALSE,
    reference_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_album_id ON images(album_id);
CREATE INDEX IF NOT EXISTS idx_images_usage_count ON images(album_id, usage_count ASC, created_at ASC);

-- ========================================
-- 4. 知识库表（对应服务器 knowledge_bases 表）
-- ========================================
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);

-- ========================================
-- 5. 知识文档表（对应服务器 knowledge_documents 表）
-- ========================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id SERIAL PRIMARY KEY,
    knowledge_base_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_kb_id ON knowledge_documents(knowledge_base_id);

-- ========================================
-- 6. 平台账号表（对应服务器 platform_accounts 表）
-- ========================================
CREATE TABLE IF NOT EXISTS platform_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    platform_id TEXT,
    account_name TEXT,
    real_username TEXT,
    credentials TEXT,
    cookies TEXT,
    status TEXT DEFAULT 'inactive',
    is_default BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_status ON platform_accounts(status);

-- ========================================
-- 7. 发布任务表（对应服务器 publishing_tasks 表）
-- ========================================
CREATE TABLE IF NOT EXISTS publishing_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    article_id INTEGER,
    account_id INTEGER NOT NULL,
    platform_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    config TEXT NOT NULL,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    batch_id TEXT,
    batch_order INTEGER DEFAULT 0,
    interval_minutes INTEGER DEFAULT 0,
    reservation_id INTEGER,
    article_title TEXT,
    article_content TEXT,
    article_keyword TEXT,
    article_image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_id ON publishing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_status ON publishing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_article ON publishing_tasks(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_batch_id ON publishing_tasks(batch_id);

-- ========================================
-- 8. 发布记录表（对应服务器 publishing_records 表）
-- ========================================
CREATE TABLE IF NOT EXISTS publishing_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    article_id INTEGER,
    task_id INTEGER,
    account_id INTEGER NOT NULL,
    account_name TEXT,
    platform_id TEXT NOT NULL,
    platform_article_id TEXT,
    platform_url TEXT,
    status TEXT DEFAULT 'pending',
    publishing_status TEXT DEFAULT 'draft',
    published_at TIMESTAMP,
    error_message TEXT,
    article_title TEXT,
    article_content TEXT,
    article_keyword TEXT,
    article_image_url TEXT,
    topic_question TEXT,
    article_setting_name TEXT,
    distillation_keyword TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishing_records_user_id ON publishing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_article_id ON publishing_records(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_platform_id ON publishing_records(platform_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_status ON publishing_records(status);

-- ========================================
-- 9. 发布日志表（对应服务器 publishing_logs 表）
-- ========================================
CREATE TABLE IF NOT EXISTS publishing_logs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishing_logs_task ON publishing_logs(task_id);

-- ========================================
-- 10. 转化目标表（对应服务器 conversion_targets 表）
-- ========================================
CREATE TABLE IF NOT EXISTS conversion_targets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    industry TEXT,
    company_size TEXT,
    features TEXT,
    contact_info TEXT,
    website TEXT,
    target_audience TEXT,
    core_products TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_targets_user_id ON conversion_targets(user_id);

-- ========================================
-- 11. 蒸馏记录表（对应服务器 distillations 表）
-- ========================================
CREATE TABLE IF NOT EXISTS distillations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    topic_count INTEGER DEFAULT 0,
    provider TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distillations_user_id ON distillations(user_id);
CREATE INDEX IF NOT EXISTS idx_distillations_keyword ON distillations(keyword);

-- ========================================
-- 12. 话题表（对应服务器 topics 表）
-- ========================================
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    distillation_id INTEGER,
    keyword TEXT NOT NULL,
    question TEXT NOT NULL,
    category TEXT,
    priority INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_distillation ON topics(distillation_id);

-- ========================================
-- 13. 文章设置表（对应服务器 article_settings 表）
-- ========================================
CREATE TABLE IF NOT EXISTS article_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_settings_user_id ON article_settings(user_id);

-- ========================================
-- 14. 蒸馏配置表（对应服务器 distillation_config 表）
-- ========================================
CREATE TABLE IF NOT EXISTS distillation_config (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    topic_count INTEGER NOT NULL DEFAULT 12,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distillation_config_user_id ON distillation_config(user_id);

-- ========================================
-- 15. 图片使用追踪表（对应服务器 image_usage 表）
-- ========================================
CREATE TABLE IF NOT EXISTS image_usage (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(image_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_image_usage_image_id ON image_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_usage_article_id ON image_usage(article_id);

-- ========================================
-- 16. 本地配置表（新增，用于存储本地设置）
-- ========================================
CREATE TABLE IF NOT EXISTS local_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 17. 待上报分析队列（用于离线上报）
-- ========================================
CREATE TABLE IF NOT EXISTS pending_analytics (
    id SERIAL PRIMARY KEY,
    report_type TEXT NOT NULL,
    report_data TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_analytics_type ON pending_analytics(report_type);

-- ========================================
-- 18. 适配器版本缓存表（用于热更新）
-- ========================================
CREATE TABLE IF NOT EXISTS adapter_versions (
    platform TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    code_path TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 19. 数据同步状态表
-- ========================================
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_backup_at TIMESTAMP,
    last_restore_at TIMESTAMP,
    last_snapshot_id INTEGER,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 插入默认同步状态记录（PostgreSQL 使用 ON CONFLICT）
INSERT INTO sync_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
