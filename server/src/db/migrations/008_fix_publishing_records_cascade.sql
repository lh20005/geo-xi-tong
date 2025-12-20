-- 修复发布记录的级联删除问题
-- 发布记录应该是历史记录，不应该因为删除任务而被删除

-- 删除旧的外键约束
ALTER TABLE publishing_records 
DROP CONSTRAINT publishing_records_task_id_fkey;

-- 添加新的外键约束（改为 ON DELETE SET NULL）
ALTER TABLE publishing_records 
ADD CONSTRAINT publishing_records_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES publishing_tasks(id) ON DELETE SET NULL;

-- 为 task_id 字段改为可空
ALTER TABLE publishing_records 
ALTER COLUMN task_id DROP NOT NULL;
