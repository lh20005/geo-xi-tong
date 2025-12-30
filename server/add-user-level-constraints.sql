-- 添加用户级唯一约束
-- 生成时间: 2025-12-30T06:40:50.318Z

-- 相册名称
ALTER TABLE albums
ADD CONSTRAINT unique_user_name UNIQUE (user_id, name);

-- 文章设置名称
ALTER TABLE article_settings
ADD CONSTRAINT unique_user_name UNIQUE (user_id, name);

-- 知识库名称
ALTER TABLE knowledge_bases
ADD CONSTRAINT unique_user_name UNIQUE (user_id, name);

-- 平台账号
ALTER TABLE platform_accounts
ADD CONSTRAINT unique_user_platform_platform_id UNIQUE (user_id, platform, platform_id);

