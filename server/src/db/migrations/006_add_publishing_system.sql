-- 发布系统相关表 (PostgreSQL)

-- 平台账号表
CREATE TABLE IF NOT EXISTS platform_accounts (
  id SERIAL PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform_id);

-- 发布任务表
CREATE TABLE IF NOT EXISTS publishing_tasks (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  platform_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  config TEXT NOT NULL,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES platform_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_publishing_tasks_article ON publishing_tasks(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_status ON publishing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_scheduled ON publishing_tasks(scheduled_at);

-- 发布日志表
CREATE TABLE IF NOT EXISTS publishing_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES publishing_tasks(id) ON DELETE CASCADE
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

-- 插入平台配置数据
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
