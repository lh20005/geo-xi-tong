/**
 * 发布任务 API（本地IPC调用）
 * 改造说明：发布任务已迁移到Windows端本地执行，使用IPC通信
 */

export interface PublishingTask {
  id: string; // UUID格式
  user_id: number;
  article_id: string | null;
  account_id: string;
  platform_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  config: string; // JSON字符串
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  batch_id: string | null;
  batch_order: number;
  interval_minutes: number;
  reservation_id: string | null;
  article_title: string | null;
  article_content: string | null;
  article_keyword: string | null;
  article_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishingLog {
  id: number;
  task_id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  details: string | null;
  created_at: string;
}

export interface CreatePublishingTaskInput {
  user_id: number;
  article_id?: string;
  account_id: string;
  platform_id: string;
  config?: {
    headless?: boolean;
    timeout_minutes?: number;
    [key: string]: any;
  };
  scheduled_at?: string | null;
  batch_id?: string;
  batch_order?: number;
  interval_minutes?: number;
  // 快照字段（用于任务执行时文章已删除的情况）
  article_title?: string;
  article_content?: string;
  article_keyword?: string;
  article_image_url?: string;
}

export interface TaskQueryParams {
  user_id: number;
  page?: number;
  pageSize?: number;
  status?: string;
  platform_id?: string;
  batch_id?: string;
}

export interface BatchInfo {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

/**
 * 检查是否在Electron环境中
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electron !== undefined;
}

/**
 * 创建发布任务（本地IPC）
 */
export async function createPublishingTask(input: CreatePublishingTaskInput): Promise<PublishingTask> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:create', input);
  
  if (!result.success) {
    throw new Error(result.error || '创建任务失败');
  }
  
  return result.data;
}

/**
 * 执行发布任务（本地IPC）
 */
export async function executeTask(taskId: string): Promise<void> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:execute', taskId);
  
  if (!result.success) {
    throw new Error(result.error || '执行任务失败');
  }
}

/**
 * 获取发布任务列表（本地IPC）
 */
export async function getPublishingTasks(params: TaskQueryParams): Promise<{
  data: PublishingTask[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:findAll', params);
  
  if (!result.success) {
    throw new Error(result.error || '获取任务列表失败');
  }
  
  return result.data;
}

/**
 * 获取任务详情（本地IPC）
 */
export async function getTaskById(taskId: string): Promise<PublishingTask> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:findById', taskId);
  
  if (!result.success) {
    throw new Error(result.error || '获取任务详情失败');
  }
  
  return result.data;
}

/**
 * 获取任务日志（本地IPC）
 */
export async function getTaskLogs(taskId: string): Promise<PublishingLog[]> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:getLogs', taskId);
  
  if (!result.success) {
    throw new Error(result.error || '获取任务日志失败');
  }
  
  return result.data;
}

/**
 * 取消任务（本地IPC）
 */
export async function cancelTask(taskId: string): Promise<void> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:cancel', taskId);
  
  if (!result.success) {
    throw new Error(result.error || '取消任务失败');
  }
}

/**
 * 删除单个任务（本地IPC）
 */
export async function deleteTask(taskId: string, userId?: number): Promise<void> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:delete', taskId, userId);
  
  if (!result.success) {
    throw new Error(result.error || '删除任务失败');
  }
}

/**
 * 批量删除任务（本地IPC）
 */
export async function batchDeleteTasks(taskIds: string[]): Promise<{
  successCount: number;
  failCount: number;
  errors: string[];
}> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:batchDelete', taskIds);
  
  if (!result.success) {
    throw new Error(result.error || '批量删除任务失败');
  }
  
  return result.data;
}

/**
 * 获取批次信息（本地IPC）
 */
export async function getBatchInfo(batchId: string): Promise<BatchInfo> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:getBatchInfo', batchId);
  
  if (!result.success) {
    throw new Error(result.error || '获取批次信息失败');
  }
  
  return result.data;
}

/**
 * 停止批次（本地IPC）
 */
export async function stopBatch(batchId: string): Promise<{ cancelledCount: number }> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:stopBatch', batchId);
  
  if (!result.success) {
    throw new Error(result.error || '停止批次失败');
  }
  
  return result.data;
}

/**
 * 删除批次（本地IPC）
 */
export async function deleteBatch(batchId: string): Promise<{ deletedCount: number }> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:deleteBatch', batchId);
  
  if (!result.success) {
    throw new Error(result.error || '删除批次失败');
  }
  
  return result.data;
}

/**
 * 获取任务统计（本地IPC）
 */
export async function getTaskStats(userId: number): Promise<{
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  byPlatform: Array<{ platform_id: string; count: number; success: number }>;
}> {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('task:getStats', userId);
  
  if (!result.success) {
    throw new Error(result.error || '获取统计数据失败');
  }
  
  return result.data;
}

/**
 * 订阅任务日志流（本地IPC）
 * 注意：这是通过事件监听实现的，不是IPC handle
 */
export function subscribeToTaskLogs(
  taskId: string,
  onLog: (log: PublishingLog & { timestamp: string }) => void
): () => void {
  if (!isElectron()) {
    throw new Error('发布任务功能仅在桌面应用中可用');
  }

  // 设置日志回调
  window.electron.invoke('task:setLogCallback', taskId);

  // 监听日志事件
  const handler = (_event: any, log: any) => {
    if (log.taskId === taskId) {
      onLog(log);
    }
  };

  window.electron.on('task-log', handler);

  // 返回取消订阅函数
  return () => {
    window.electron.off('task-log', handler);
  };
}

/**
 * 重试任务（重新创建为pending状态）
 */
export async function retryTask(taskId: string): Promise<PublishingTask> {
  // 获取原任务信息
  const task = await getTaskById(taskId);
  
  // 创建新任务
  return await createPublishingTask({
    user_id: task.user_id,
    article_id: task.article_id || undefined,
    account_id: task.account_id,
    platform_id: task.platform_id,
    config: typeof task.config === 'string' ? JSON.parse(task.config) : task.config,
    article_title: task.article_title || undefined,
    article_content: task.article_content || undefined,
    article_keyword: task.article_keyword || undefined,
    article_image_url: task.article_image_url || undefined,
  });
}
