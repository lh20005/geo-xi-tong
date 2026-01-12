import { apiClient } from './client';

export interface Platform {
  id: number;
  platform_id: string;
  platform_name: string;
  icon_url: string;
  is_enabled: boolean;
  adapter_class: string;
  required_fields: string[];
  config_schema?: any;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string; // 平台真实用户名
  credentials?: any;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface CreateAccountInput {
  platform_id: string;
  account_name: string;
  credentials: {
    username: string;
    password: string;
    [key: string]: any;
  };
}

/**
 * 获取所有平台配置
 */
export async function getPlatforms(): Promise<Platform[]> {
  const response = await apiClient.get('/publishing/platforms');
  return response.data.data;
}

/**
 * 获取所有账号
 */
export async function getAccounts(): Promise<Account[]> {
  const response = await apiClient.get('/publishing/accounts');
  return response.data.data;
}

/**
 * 根据平台ID获取账号
 */
export async function getAccountsByPlatform(platformId: string): Promise<Account[]> {
  const response = await apiClient.get(`/publishing/accounts/platform/${platformId}`);
  return response.data.data;
}

/**
 * 获取账号详情
 */
export async function getAccountById(accountId: number, includeCredentials: boolean = false): Promise<Account> {
  const response = await apiClient.get(`/publishing/accounts/${accountId}`, {
    params: { includeCredentials }
  });
  return response.data.data;
}

/**
 * 创建账号
 */
export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const response = await apiClient.post('/publishing/accounts', input);
  return response.data.data;
}

/**
 * 更新账号
 */
export async function updateAccount(accountId: number, data: Partial<CreateAccountInput>): Promise<Account> {
  const response = await apiClient.put(`/publishing/accounts/${accountId}`, data);
  return response.data.data;
}

/**
 * 删除账号
 */
export async function deleteAccount(accountId: number): Promise<void> {
  await apiClient.delete(`/publishing/accounts/${accountId}`);
}

/**
 * 设置默认账号
 */
export async function setDefaultAccount(accountId: number, platformId: string): Promise<void> {
  await apiClient.post(`/publishing/accounts/${accountId}/set-default`, { platform_id: platformId });
}

export interface PublishingTask {
  id: number;
  article_id: number;
  platform_id: string;
  platform_name?: string;
  account_id: number;
  account_name?: string;
  real_username?: string; // 平台真实用户名
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
  scheduled_time: string | null;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  config: {
    timeout_minutes?: number;
    headless?: boolean;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  executed_at?: string;
  batch_id?: string; // 批次ID
  batch_order?: number; // 批次内的顺序
  interval_minutes?: number; // 发布间隔（分钟）
}

export interface PublishingLog {
  id: number;
  task_id: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp?: string; // 添加 timestamp 字段
  details?: any;
  created_at: string;
}

export interface CreatePublishingTaskInput {
  article_id: number;
  platform_id: string;
  account_id: number;
  scheduled_time?: string | null;
  config?: {
    headless?: boolean;
    [key: string]: any;
  };
  batch_id?: string;
  batch_order?: number;
  interval_minutes?: number;
}

/**
 * 创建发布任务
 */
export async function createPublishingTask(input: CreatePublishingTaskInput): Promise<PublishingTask> {
  const response = await apiClient.post('/publishing/tasks', input);
  return response.data.data;
}

/**
 * 获取发布任务列表
 */
export async function getPublishingTasks(
  page: number = 1,
  pageSize: number = 10,
  filters?: { status?: string; platform_id?: string; article_id?: number }
): Promise<{ tasks: PublishingTask[]; total: number }> {
  const response = await apiClient.get('/publishing/tasks', {
    params: { page, pageSize, ...filters }
  });
  return response.data.data;
}

/**
 * 获取任务详情
 */
export async function getTaskById(taskId: number): Promise<PublishingTask> {
  const response = await apiClient.get(`/publishing/tasks/${taskId}`);
  return response.data.data;
}

/**
 * 获取任务日志
 */
export async function getTaskLogs(taskId: number): Promise<PublishingLog[]> {
  const response = await apiClient.get(`/publishing/tasks/${taskId}/logs`);
  return response.data.data;
}

/**
 * 重新发布（重试）
 */
export async function retryTask(taskId: number): Promise<PublishingTask> {
  const response = await apiClient.post(`/publishing/tasks/${taskId}/retry`);
  return response.data.data;
}

/**
 * 立即执行任务
 */
export async function executeTask(taskId: number): Promise<void> {
  await apiClient.post(`/publishing/tasks/${taskId}/execute`);
}

/**
 * 取消任务
 */
export async function cancelTask(taskId: number): Promise<void> {
  await apiClient.post(`/publishing/tasks/${taskId}/cancel`);
}

/**
 * 终止任务（强制停止执行中的任务）
 */
export async function terminateTask(taskId: number): Promise<void> {
  await apiClient.post(`/publishing/tasks/${taskId}/terminate`);
}

/**
 * 删除单个任务
 */
export async function deleteTask(taskId: number): Promise<void> {
  await apiClient.delete(`/publishing/tasks/${taskId}`);
}

/**
 * 批量删除任务
 */
export async function batchDeleteTasks(taskIds: number[]): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  const response = await apiClient.post('/publishing/tasks/batch-delete', { taskIds });
  return response.data.data;
}

/**
 * 删除所有任务
 */
export async function deleteAllTasks(status?: string): Promise<{ deletedCount: number }> {
  const response = await apiClient.post('/publishing/tasks/delete-all', { status });
  return response.data.data;
}

/**
 * 使用浏览器登录平台
 */
export async function loginWithBrowser(platformId: string): Promise<{ success: boolean; message?: string; account?: Account }> {
  // 浏览器登录需要用户手动操作，设置更长的超时时间（5分钟）
  const response = await apiClient.post('/publishing/browser-login', 
    { platform_id: platformId },
    { timeout: 300000 } // 5分钟超时
  );
  return response.data;
}

// ==================== 发布记录相关 ====================

export interface PublishingRecord {
  id: number;
  article_id: number | null;
  task_id: number;
  platform_id: string;
  platform_name?: string;
  account_id: number;
  account_name?: string;
  real_username?: string; // 平台真实用户名
  platform_article_id?: string;
  platform_url?: string;
  published_at: string;
  created_at: string;
  // 快照字段
  article_title?: string;
  article_keyword?: string;
  article_content?: string;
  article_image_url?: string;
  topic_question?: string;
  article_setting_name?: string;
  distillation_keyword?: string;
  task_status?: string;
}

export interface PublishingStats {
  total: number;
  today: number;
  week: number;
  month: number;
  byPlatform: Array<{
    platformId: string;
    platformName: string;
    count: number;
  }>;
}

/**
 * 获取发布记录列表
 */
export async function getPublishingRecords(
  page: number = 1,
  pageSize: number = 20,
  filters?: { platform_id?: string; article_id?: number; account_id?: number }
): Promise<{ records: PublishingRecord[]; total: number; page: number; pageSize: number }> {
  const response = await apiClient.get('/publishing/records', {
    params: { page, pageSize, ...filters }
  });
  return response.data.data;
}

/**
 * 获取发布记录详情
 */
export async function getPublishingRecordById(recordId: number): Promise<PublishingRecord> {
  const response = await apiClient.get(`/publishing/records/${recordId}`);
  return response.data.data;
}

/**
 * 删除发布记录
 */
export async function deletePublishingRecord(recordId: number): Promise<void> {
  await apiClient.delete(`/publishing/records/${recordId}`);
}

/**
 * 批量删除发布记录
 */
export async function batchDeletePublishingRecords(ids: number[]): Promise<{ deletedCount: number }> {
  const response = await apiClient.delete('/publishing/records', { data: { ids } });
  return response.data;
}

/**
 * 获取某篇文章的所有发布记录
 */
export async function getArticlePublishingRecords(articleId: number): Promise<{ records: PublishingRecord[]; total: number }> {
  const response = await apiClient.get(`/publishing/articles/${articleId}/records`);
  return response.data.data;
}

/**
 * 获取发布统计数据
 */
export async function getPublishingStats(): Promise<PublishingStats> {
  const response = await apiClient.get('/publishing/stats');
  return response.data.data;
}

// ==================== 批次管理相关 ====================

export interface BatchInfo {
  total_tasks: number;
  pending_tasks: number;
  running_tasks: number;
  success_tasks: number;
  failed_tasks: number;
  cancelled_tasks: number;
  created_at: string;
  interval_minutes: number;
}

/**
 * 停止批次（取消所有待处理任务，终止运行中任务）
 */
export async function stopBatch(batchId: string): Promise<{ cancelledCount: number; terminatedCount: number }> {
  const response = await apiClient.post(`/publishing/batches/${batchId}/stop`);
  return response.data.data;
}

/**
 * 删除批次（删除所有任务）
 */
export async function deleteBatch(batchId: string): Promise<{ deletedCount: number }> {
  const response = await apiClient.delete(`/publishing/batches/${batchId}`);
  return response.data.data;
}

/**
 * 获取批次信息
 */
export async function getBatchInfo(batchId: string): Promise<BatchInfo> {
  const response = await apiClient.get(`/publishing/batches/${batchId}`);
  return response.data.data;
}

/**
 * 订阅任务日志流（SSE）
 * 注意：EventSource 不支持自定义 headers，所以通过 URL 参数传递 token
 */
export function subscribeToTaskLogs(
  taskId: number,
  onLog: (log: PublishingLog) => void,
  onError?: (error: Error) => void
): () => void {
  // 从 localStorage 获取 token
  const token = localStorage.getItem('auth_token');
  if (!token) {
    if (onError) {
      onError(new Error('未登录，无法订阅日志流'));
    }
    return () => {};
  }

  // 通过 URL 参数传递 token（EventSource 不支持自定义 headers）
  const url = `/api/publishing/tasks/${taskId}/logs/stream?token=${encodeURIComponent(token)}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const log = JSON.parse(event.data);
      onLog(log);
    } catch (error) {
      console.error('解析日志数据失败:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('日志流连接错误:', error);
    if (onError) {
      onError(new Error('日志流连接失败'));
    }
    eventSource.close();
  };

  // 返回取消订阅函数
  return () => {
    eventSource.close();
  };
}
