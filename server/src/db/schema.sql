-- API配置表
CREATE TABLE IF NOT EXISTS api_configs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('deepseek', 'gemini', 'ollama')),
  api_key TEXT,
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_ollama_config CHECK (
    (provider = 'ollama' AND ollama_base_url IS NOT NULL AND ollama_model IS NOT NULL AND api_key IS NULL)
    OR
    (provider IN ('deepseek', 'gemini') AND api_key IS NOT NULL AND ollama_base_url IS NULL AND ollama_model IS NULL)
  )
);

-- 关键词蒸馏记录表
CREATE TABLE IF NOT EXISTS distillations (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 话题表
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER REFERENCES distillations(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 相册表
CREATE TABLE IF NOT EXISTS albums (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- 转化目标表
CREATE TABLE IF NOT EXISTS conversion_targets (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  company_size VARCHAR(50) NOT NULL,
  features TEXT,
  contact_info VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  target_audience TEXT,
  core_products TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_company_name UNIQUE (company_name)
);

-- 关键词蒸馏配置表
CREATE TABLE IF NOT EXISTS distillation_config (
  id SERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  topic_count INTEGER NOT NULL DEFAULT 12 CHECK (topic_count >= 5 AND topic_count <= 30),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文章设置表
CREATE TABLE IF NOT EXISTS article_settings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文章生成任务表（必须在articles表之前创建）
CREATE TABLE IF NOT EXISTS generation_tasks (
  id SERIAL PRIMARY KEY,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文章表（现在可以安全引用generation_tasks）
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500),
  keyword VARCHAR(255) NOT NULL,
  distillation_id INTEGER REFERENCES distillations(id),
  task_id INTEGER REFERENCES generation_tasks(id) ON DELETE SET NULL,
  requirements TEXT,
  content TEXT NOT NULL,
  image_url VARCHAR(500),
  provider VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_configs_provider ON api_configs(provider);
CREATE INDEX IF NOT EXISTS idx_api_configs_active ON api_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_distillations_keyword ON distillations(keyword);
CREATE INDEX IF NOT EXISTS idx_topics_distillation ON topics(distillation_id);
CREATE INDEX IF NOT EXISTS idx_articles_keyword ON articles(keyword);
CREATE INDEX IF NOT EXISTS idx_articles_distillation ON articles(distillation_id);
CREATE INDEX IF NOT EXISTS idx_articles_task_id ON articles(task_id);
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_album_id ON images(album_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_created_at ON knowledge_bases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_kb_id ON knowledge_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content ON knowledge_documents USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_conversion_targets_company_name ON conversion_targets(company_name);
CREATE INDEX IF NOT EXISTS idx_conversion_targets_industry ON conversion_targets(industry);
CREATE INDEX IF NOT EXISTS idx_conversion_targets_created_at ON conversion_targets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_settings_created_at ON article_settings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_status ON generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_created_at ON generation_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_conversion_target ON generation_tasks(conversion_target_id);
CREATE INDEX IF NOT EXISTS idx_distillation_config_active ON distillation_config(is_active);

-- 图片使用追踪表
CREATE TABLE IF NOT EXISTS image_usage (
  id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(image_id, article_id)
);

-- 图片使用追踪索引
CREATE INDEX IF NOT EXISTS idx_images_usage_count ON images(album_id, usage_count ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_image_usage_image_id ON image_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_usage_article_id ON image_usage(article_id);
