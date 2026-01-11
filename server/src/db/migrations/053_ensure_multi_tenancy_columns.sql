-- ==================== UP ====================
-- 确保多租户相关列存在
-- 这个迁移用于修复从旧版本升级的数据库

-- 1. publishing_tasks 表添加 user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'publishing_tasks' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE publishing_tasks ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE publishing_tasks ADD CONSTRAINT publishing_tasks_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_id ON publishing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_status ON publishing_tasks(user_id, status);

-- 添加状态检查约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'publishing_tasks_status_check'
  ) THEN
    ALTER TABLE publishing_tasks ADD CONSTRAINT publishing_tasks_status_check 
      CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'timeout'));
  END IF;
END $$;

-- 2. publishing_records 表添加 task_id 和 account_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'publishing_records' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE publishing_records ADD COLUMN task_id INTEGER;
    ALTER TABLE publishing_records ADD CONSTRAINT publishing_records_task_id_fkey 
      FOREIGN KEY (task_id) REFERENCES publishing_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'publishing_records' AND column_name = 'account_name'
  ) THEN
    ALTER TABLE publishing_records ADD COLUMN account_name VARCHAR(100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_publishing_records_task ON publishing_records(task_id);

-- ==================== DOWN ====================
-- ALTER TABLE publishing_tasks DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE publishing_records DROP COLUMN IF EXISTS task_id;
-- ALTER TABLE publishing_records DROP COLUMN IF EXISTS account_name;
