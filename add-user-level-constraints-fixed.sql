-- 添加用户级唯一约束 - 修复多租户隔离问题
-- 生成时间: 2025-12-30
-- 说明: 确保不同用户可以创建同名的资源，但同一用户不能创建重复名称

-- 1. 相册名称
ALTER TABLE albums
ADD CONSTRAINT unique_user_album_name UNIQUE (user_id, name);

-- 2. 文章设置名称
ALTER TABLE article_settings
ADD CONSTRAINT unique_user_article_setting_name UNIQUE (user_id, name);

-- 3. 知识库名称
ALTER TABLE knowledge_bases
ADD CONSTRAINT unique_user_knowledge_base_name UNIQUE (user_id, name);

-- 4. 平台账号 (用户+平台+平台ID的组合唯一)
ALTER TABLE platform_accounts
ADD CONSTRAINT unique_user_platform_account UNIQUE (user_id, platform, platform_id);

-- 验证约束
SELECT 
  t.table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname IN ('albums', 'article_settings', 'knowledge_bases', 'platform_accounts')
  AND c.contype = 'u'
  AND c.conname LIKE 'unique_user%'
ORDER BY t.relname, c.conname;
