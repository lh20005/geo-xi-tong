-- 迁移 024: 添加企业图库和知识库配额支持
-- 创建时间: 2026-01-04
-- 说明: 为所有用户初始化 gallery_albums 和 knowledge_bases 配额，并同步现有数据

-- 1. 为所有有订阅的用户初始化相册配额（使用 DISTINCT 避免重复订阅）
INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
SELECT DISTINCT ON (us.user_id)
  us.user_id,
  'gallery_albums' as feature_code,
  COALESCE((SELECT COUNT(*) FROM albums WHERE user_id = us.user_id), 0) as usage_count,
  CURRENT_DATE as period_start,
  CURRENT_DATE + INTERVAL '31 days' as period_end
FROM user_subscriptions us
WHERE us.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM user_usage uu 
    WHERE uu.user_id = us.user_id 
      AND uu.feature_code = 'gallery_albums'
      AND uu.period_end > CURRENT_TIMESTAMP
  )
ORDER BY us.user_id, us.created_at DESC;

-- 2. 为所有有订阅的用户初始化知识库配额（使用 DISTINCT 避免重复订阅）
INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
SELECT DISTINCT ON (us.user_id)
  us.user_id,
  'knowledge_bases' as feature_code,
  COALESCE((SELECT COUNT(*) FROM knowledge_bases WHERE user_id = us.user_id), 0) as usage_count,
  CURRENT_DATE as period_start,
  CURRENT_DATE + INTERVAL '31 days' as period_end
FROM user_subscriptions us
WHERE us.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM user_usage uu 
    WHERE uu.user_id = us.user_id 
      AND uu.feature_code = 'knowledge_bases'
      AND uu.period_end > CURRENT_TIMESTAMP
  )
ORDER BY us.user_id, us.created_at DESC;

-- 3. 为已创建相册的用户添加使用记录（如果还没有）
INSERT INTO usage_records (user_id, feature_code, resource_type, resource_id, amount, created_at)
SELECT 
  a.user_id,
  'gallery_albums' as feature_code,
  'album' as resource_type,
  a.id as resource_id,
  1 as amount,
  a.created_at
FROM albums a
WHERE NOT EXISTS (
  SELECT 1 FROM usage_records ur 
  WHERE ur.user_id = a.user_id 
    AND ur.feature_code = 'gallery_albums'
    AND ur.resource_id = a.id
    AND ur.resource_type = 'album'
);

-- 4. 为已创建知识库的用户添加使用记录（如果还没有）
INSERT INTO usage_records (user_id, feature_code, resource_type, resource_id, amount, created_at)
SELECT 
  kb.user_id,
  'knowledge_bases' as feature_code,
  'knowledge_base' as resource_type,
  kb.id as resource_id,
  1 as amount,
  kb.created_at
FROM knowledge_bases kb
WHERE NOT EXISTS (
  SELECT 1 FROM usage_records ur 
  WHERE ur.user_id = kb.user_id 
    AND ur.feature_code = 'knowledge_bases'
    AND ur.resource_id = kb.id
    AND ur.resource_type = 'knowledge_base'
);

-- 5. 验证数据一致性
DO $$
DECLARE
  inconsistent_count INTEGER;
BEGIN
  -- 检查相册数据一致性
  SELECT COUNT(*) INTO inconsistent_count
  FROM user_usage uu
  WHERE uu.feature_code = 'gallery_albums'
    AND uu.usage_count != (
      SELECT COUNT(*) FROM albums WHERE user_id = uu.user_id
    );
  
  IF inconsistent_count > 0 THEN
    RAISE NOTICE '警告: 发现 % 个用户的相册配额数据不一致', inconsistent_count;
  ELSE
    RAISE NOTICE '✓ 相册配额数据一致性验证通过';
  END IF;
  
  -- 检查知识库数据一致性
  SELECT COUNT(*) INTO inconsistent_count
  FROM user_usage uu
  WHERE uu.feature_code = 'knowledge_bases'
    AND uu.usage_count != (
      SELECT COUNT(*) FROM knowledge_bases WHERE user_id = uu.user_id
    );
  
  IF inconsistent_count > 0 THEN
    RAISE NOTICE '警告: 发现 % 个用户的知识库配额数据不一致', inconsistent_count;
  ELSE
    RAISE NOTICE '✓ 知识库配额数据一致性验证通过';
  END IF;
END $$;

-- 6. 输出统计信息
DO $$
DECLARE
  album_quota_count INTEGER;
  kb_quota_count INTEGER;
  album_record_count INTEGER;
  kb_record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO album_quota_count FROM user_usage WHERE feature_code = 'gallery_albums';
  SELECT COUNT(*) INTO kb_quota_count FROM user_usage WHERE feature_code = 'knowledge_bases';
  SELECT COUNT(*) INTO album_record_count FROM usage_records WHERE feature_code = 'gallery_albums';
  SELECT COUNT(*) INTO kb_record_count FROM usage_records WHERE feature_code = 'knowledge_bases';
  
  RAISE NOTICE '=== 迁移完成统计 ===';
  RAISE NOTICE '相册配额记录: %', album_quota_count;
  RAISE NOTICE '知识库配额记录: %', kb_quota_count;
  RAISE NOTICE '相册使用记录: %', album_record_count;
  RAISE NOTICE '知识库使用记录: %', kb_record_count;
END $$;
