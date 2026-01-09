-- ========================================
-- 迁移 023: 添加缺失的配额检查和记录
-- 创建时间: 2026-01-04
-- 描述: 确保所有功能都有正确的配额检查和记录
-- ========================================

-- 本迁移主要是代码层面的修复，数据库层面只需要验证

-- 验证所有必需的功能代码存在
DO $$
DECLARE
  v_missing_features TEXT[];
BEGIN
  -- 检查必需的功能代码
  SELECT ARRAY_AGG(feature_code)
  INTO v_missing_features
  FROM (
    SELECT unnest(ARRAY[
      'articles_per_month',
      'publish_per_month',
      'keyword_distillation',
      'platform_accounts'
    ]) AS feature_code
  ) required
  WHERE NOT EXISTS (
    SELECT 1 FROM plan_features pf
    WHERE pf.feature_code = required.feature_code
  );
  
  IF array_length(v_missing_features, 1) > 0 THEN
    RAISE EXCEPTION '缺少必需的功能代码: %', array_to_string(v_missing_features, ', ');
  END IF;
  
  RAISE NOTICE '✅ 所有必需的功能代码都存在';
END $$;

-- 验证所有有订阅的用户都有配额记录
DO $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_missing_count
  FROM user_subscriptions us
  JOIN plan_features pf ON pf.plan_id = us.plan_id
  WHERE us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
    AND pf.feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
    AND NOT EXISTS (
      SELECT 1 FROM user_usage uu
      WHERE uu.user_id = us.user_id
        AND uu.feature_code = pf.feature_code
        AND uu.period_end > CURRENT_TIMESTAMP
    );
  
  IF v_missing_count > 0 THEN
    RAISE NOTICE '⚠️  发现 % 条缺失的配额记录，正在初始化...', v_missing_count;
    
    -- 初始化缺失的配额记录
    INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
    SELECT 
      us.user_id,
      pf.feature_code,
      0 AS usage_count,
      DATE_TRUNC('month', CURRENT_DATE) AS period_start,
      DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' AS period_end,
      DATE_TRUNC('month', CURRENT_DATE) AS last_reset_at
    FROM user_subscriptions us
    JOIN plan_features pf ON pf.plan_id = us.plan_id
    WHERE us.status = 'active'
      AND us.end_date > CURRENT_TIMESTAMP
      AND pf.feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
      AND NOT EXISTS (
        SELECT 1 FROM user_usage uu
        WHERE uu.user_id = us.user_id
          AND uu.feature_code = pf.feature_code
          AND uu.period_end > CURRENT_TIMESTAMP
      )
    ON CONFLICT (user_id, feature_code, period_start) DO NOTHING;
    
    RAISE NOTICE '✅ 已初始化 % 条配额记录', v_missing_count;
  ELSE
    RAISE NOTICE '✅ 所有用户都有完整的配额记录';
  END IF;
END $$;

-- ========================================
-- 迁移完成
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ 迁移 023 成功完成';
  RAISE NOTICE '   - 验证了所有必需的功能代码';
  RAISE NOTICE '   - 初始化了缺失的配额记录';
  RAISE NOTICE '   ';
  RAISE NOTICE '⚠️  注意：还需要在代码层面添加配额检查和记录';
  RAISE NOTICE '   - distillation.ts: 添加配额检查和记录';
  RAISE NOTICE '   - platformAccounts.ts: 添加配额检查和记录';
  RAISE NOTICE '   - publishingTasks.ts: 添加配额记录';
END $$;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
