-- 添加timeout状态到publishing_tasks表

-- 删除旧的状态约束
ALTER TABLE publishing_tasks 
  DROP CONSTRAINT IF EXISTS publishing_tasks_status_check;

-- 添加新的状态约束，包含timeout
ALTER TABLE publishing_tasks 
  ADD CONSTRAINT publishing_tasks_status_check 
  CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'timeout'));

-- 添加索引以优化超时任务查询
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_running_started 
  ON publishing_tasks(status, started_at) 
  WHERE status = 'running';

-- 注释
COMMENT ON CONSTRAINT publishing_tasks_status_check ON publishing_tasks IS 
  '任务状态约束：pending(待执行), running(执行中), success(成功), failed(失败), cancelled(已取消), timeout(超时)';
