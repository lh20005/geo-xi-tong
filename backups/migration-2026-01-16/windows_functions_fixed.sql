-- PostgreSQL 函数定义（已清理格式）
-- 生成时间: 2026-01-16
-- 说明: 移除了 pg_dump 的 + 续行符

-- 1. 同步话题关键词快照
CREATE OR REPLACE FUNCTION public.sync_topic_keyword_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- 如果没有提供 keyword，从 distillations 表获取
    IF NEW.keyword IS NULL AND NEW.distillation_id IS NOT NULL THEN
        SELECT keyword INTO NEW.keyword
        FROM distillations
        WHERE id = NEW.distillation_id;
    END IF;

    -- 如果没有提供 user_id，从 distillations 表获取
    IF NEW.user_id IS NULL AND NEW.distillation_id IS NOT NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM distillations
        WHERE id = NEW.distillation_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. 增加图片引用计数
CREATE OR REPLACE FUNCTION public.increment_image_reference(p_image_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE images
  SET reference_count = COALESCE(reference_count, 0) + 1,
      usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = p_image_id;
END;
$function$;

-- 3. 更新文章图片大小
CREATE OR REPLACE FUNCTION public.update_article_image_size()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  img_size INTEGER;
BEGIN
  -- 当文章的 image_url 变化时，更新 image_size_bytes
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' THEN
    -- 尝试从 images 表获取大小
    SELECT size INTO img_size FROM images WHERE filepath = NEW.image_url LIMIT 1;

    IF img_size IS NOT NULL THEN
      NEW.image_size_bytes := img_size;
    ELSE
      -- 如果图片不在 images 表中（可能已删除），保持原值或设为0
      NEW.image_size_bytes := COALESCE(NEW.image_size_bytes, 0);
    END IF;
  ELSE
    NEW.image_size_bytes := 0;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. 检查图片是否被引用
CREATE OR REPLACE FUNCTION public.is_image_referenced(image_filepath character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM articles WHERE image_url = image_filepath
  );
END;
$function$;

-- 5. 软删除图片
CREATE OR REPLACE FUNCTION public.soft_delete_image(image_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  img_filepath VARCHAR;
  is_ref BOOLEAN;
BEGIN
  -- 获取图片路径
  SELECT filepath INTO img_filepath FROM images WHERE id = image_id;

  IF img_filepath IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 检查是否被文章引用
  is_ref := is_image_referenced(img_filepath);

  -- 更新为软删除状态
  UPDATE images
  SET deleted_at = NOW(),
      is_orphan = is_ref
  WHERE id = image_id;

  RETURN TRUE;
END;
$function$;

-- 6. 同步文章蒸馏快照
CREATE OR REPLACE FUNCTION public.sync_article_distillation_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 当设置了 topic_id 时，从 topics 表获取快照
  IF NEW.topic_id IS NOT NULL THEN
    SELECT
      COALESCE(t.keyword, d.keyword),
      t.question
    INTO
      NEW.distillation_keyword_snapshot,
      NEW.topic_question_snapshot
    FROM topics t
    LEFT JOIN distillations d ON t.distillation_id = d.id
    WHERE t.id = NEW.topic_id;
  -- 当只有 distillation_id 时，从 distillations 表获取
  ELSIF NEW.distillation_id IS NOT NULL AND NEW.distillation_keyword_snapshot IS NULL THEN
    SELECT keyword INTO NEW.distillation_keyword_snapshot
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. 减少图片引用计数
CREATE OR REPLACE FUNCTION public.decrement_image_reference(p_image_id integer)
 RETURNS TABLE(should_delete boolean, filepath character varying, image_user_id integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_ref_count INTEGER;
  v_deleted_at TIMESTAMP;
  v_filepath VARCHAR;
  v_user_id INTEGER;
BEGIN
  -- 减少引用计数
  UPDATE images
  SET reference_count = GREATEST(COALESCE(reference_count, 0) - 1, 0)
  WHERE id = p_image_id
  RETURNING reference_count, deleted_at, images.filepath, images.user_id
  INTO v_ref_count, v_deleted_at, v_filepath, v_user_id;

  -- 判断是否需要真正删除
  -- 条件：reference_count = 0 且已软删除
  IF v_ref_count = 0 AND v_deleted_at IS NOT NULL THEN
    -- 删除数据库记录
    DELETE FROM images WHERE id = p_image_id;
    RETURN QUERY SELECT TRUE, v_filepath, v_user_id;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::VARCHAR, v_user_id;
  END IF;
END;
$function$;

-- 8. 更新 updated_at 列
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

-- 9. 同步发布记录账号快照
CREATE OR REPLACE FUNCTION public.sync_publishing_record_account_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.account_id IS NOT NULL AND NEW.real_username_snapshot IS NULL THEN
    SELECT real_username INTO NEW.real_username_snapshot
    FROM platform_accounts
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$function$;


-- 10. 同步发布任务账号快照
CREATE OR REPLACE FUNCTION public.sync_publishing_task_account_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.account_id IS NOT NULL AND (NEW.account_name_snapshot IS NULL OR NEW.real_username_snapshot IS NULL) THEN
    SELECT account_name, real_username
    INTO NEW.account_name_snapshot, NEW.real_username_snapshot
    FROM platform_accounts
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 11. 同步转化目标快照
CREATE OR REPLACE FUNCTION public.sync_conversion_target_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 当设置了 conversion_target_id 且快照字段为空时，自动填充
  IF NEW.conversion_target_id IS NOT NULL THEN
    SELECT
      company_name, industry, website, address
    INTO
      NEW.conversion_target_name,
      NEW.conversion_target_industry,
      NEW.conversion_target_website,
      NEW.conversion_target_address
    FROM conversion_targets
    WHERE id = NEW.conversion_target_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 12. 同步话题快照
CREATE OR REPLACE FUNCTION public.sync_topic_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.distillation_id IS NOT NULL THEN
    IF NEW.keyword IS NULL OR NEW.keyword = '' THEN
      SELECT keyword INTO NEW.keyword FROM distillations WHERE id = NEW.distillation_id;
    END IF;
    IF NEW.user_id IS NULL THEN
      SELECT user_id INTO NEW.user_id FROM distillations WHERE id = NEW.distillation_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


-- 13. 同步话题使用关键词快照
CREATE OR REPLACE FUNCTION public.sync_topic_usage_keyword_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.distillation_id IS NOT NULL AND NEW.keyword IS NULL THEN
    SELECT keyword INTO NEW.keyword
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;
  RETURN NEW;
END;
$function$;
