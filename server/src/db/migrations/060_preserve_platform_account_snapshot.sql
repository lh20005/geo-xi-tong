-- ==================== UP ====================
-- 迁移：为发布任务和发布记录表添加平台账号快照字段
-- 问题：删除平台账号后，发布任务页面和发布记录页面的账号信息消失
-- 原因：通过 LEFT JOIN platform_accounts 获取账号信息，删除后返回 NULL
-- 解决方案：在表中添加快照字段，保存账号信息

-- 1. 为 publishing_tasks 表添加快照字段
ALTER TABLE publishing_tasks 
ADD COLUMN IF NOT EXISTS account_name_snapshot VARCHAR(255),
ADD COLUMN IF NOT EXISTS real_username_snapshot VARCHAR(255);

-- 2. 为 publishing_records 表添加快照字段
ALTER TABLE publishing_records 
ADD COLUMN IF NOT EXISTS real_username_snapshot VARCHAR(255);

-- 3. 从现有关联数据填充 publishing_tasks 快照字段
UPDATE publishing_tasks pt
SET 
  account_name_snapshot = pa.account_name,
  real_username_snapshot = pa.real_username
FROM platform_accounts pa
WHERE pt.account_id = pa.id
  AND pt.account_name_snapshot IS NULL;

-- 4. 从现有关联数据填充 publishing_records 快照字段
UPDATE publishing_records pr
SET real_username_snapshot = pa.real_username
FROM platform_accounts pa
WHERE pr.account_id = pa.id
  AND pr.real_username_snapshot IS NULL;

-- 5. 创建触发器函数：在创建发布任务时自动填充账号快照
CREATE OR REPLACE FUNCTION sync_publishing_task_account_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NOT NULL AND (NEW.account_name_snapshot IS NULL OR NEW.real_username_snapshot IS NULL) THEN
    SELECT account_name, real_username
    INTO NEW.account_name_snapshot, NEW.real_username_snapshot
    FROM platform_accounts
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建触发器
DROP TRIGGER IF EXISTS trigger_sync_publishing_task_account_snapshot ON publishing_tasks;
CREATE TRIGGER trigger_sync_publishing_task_account_snapshot
BEFORE INSERT ON publishing_tasks
FOR EACH ROW
EXECUTE FUNCTION sync_publishing_task_account_snapshot();

-- 7. 创建触发器函数：在创建发布记录时自动填充账号快照
CREATE OR REPLACE FUNCTION sync_publishing_record_account_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NOT NULL AND NEW.real_username_snapshot IS NULL THEN
    SELECT real_username INTO NEW.real_username_snapshot
    FROM platform_accounts
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建触发器
DROP TRIGGER IF EXISTS trigger_sync_publishing_record_account_snapshot ON publishing_records;
CREATE TRIGGER trigger_sync_publishing_record_account_snapshot
BEFORE INSERT ON publishing_records
FOR EACH ROW
EXECUTE FUNCTION sync_publishing_record_account_snapshot();

-- 9. 添加字段注释
COMMENT ON COLUMN publishing_tasks.account_name_snapshot IS '账号名称快照（删除账号后仍保留）';
COMMENT ON COLUMN publishing_tasks.real_username_snapshot IS '真实用户名快照（删除账号后仍保留）';
COMMENT ON COLUMN publishing_records.real_username_snapshot IS '真实用户名快照（删除账号后仍保留）';

-- ==================== DOWN ====================
-- 回滚：删除快照字段和触发器

-- 1. 删除触发器
DROP TRIGGER IF EXISTS trigger_sync_publishing_task_account_snapshot ON publishing_tasks;
DROP TRIGGER IF EXISTS trigger_sync_publishing_record_account_snapshot ON publishing_records;

-- 2. 删除触发器函数
DROP FUNCTION IF EXISTS sync_publishing_task_account_snapshot();
DROP FUNCTION IF EXISTS sync_publishing_record_account_snapshot();

-- 3. 删除快照字段
ALTER TABLE publishing_tasks 
DROP COLUMN IF EXISTS account_name_snapshot,
DROP COLUMN IF EXISTS real_username_snapshot;

ALTER TABLE publishing_records 
DROP COLUMN IF EXISTS real_username_snapshot;
