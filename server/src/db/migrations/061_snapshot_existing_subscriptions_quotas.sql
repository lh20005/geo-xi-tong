-- 迁移：为现有活跃订阅保存配额快照
-- 问题：之前用户购买套餐时没有保存配额快照到 custom_quotas
-- 导致管理员修改商品卡配额后，已购买用户的配额也被同步更新
-- 修复：为所有 custom_quotas 为空的活跃订阅，保存当前套餐配额作为快照

-- 为现有活跃订阅补充配额快照
UPDATE user_subscriptions us
SET custom_quotas = (
    SELECT jsonb_object_agg(pf.feature_code, pf.feature_value)
    FROM plan_features pf
    WHERE pf.plan_id = us.plan_id
),
updated_at = CURRENT_TIMESTAMP
WHERE us.status = 'active'
  AND (us.custom_quotas IS NULL OR us.custom_quotas = '{}'::jsonb);

-- 记录更新了多少条记录
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '已为 % 个活跃订阅补充配额快照', updated_count;
END $$;

-- 添加注释说明
COMMENT ON COLUMN user_subscriptions.custom_quotas IS '用户购买时的配额快照，用于保证已购买用户不受后续商品卡配额修改的影响';
