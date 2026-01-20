/**
 * 本地发布模块类型定义
 */

export interface LocalTask {
  id: number;
  article_id: number;
  account_id: number;
  platform_id: string;
  user_id: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
  config: TaskConfig;
  scheduled_at?: string;
  retry_count: number;
  max_retries: number;
  batch_id?: string;
  batch_order?: number;
  interval_minutes?: number;
  // 文章快照
  article_title?: string;
  article_content?: string;
  article_keyword?: string;
  article_image_url?: string;
  // 账号快照
  account_name_snapshot?: string;
  real_username_snapshot?: string;
  // 时间戳
  created_at?: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface TaskConfig {
  timeout_minutes?: number;
  headless?: boolean;
  [key: string]: any;
}

export interface AccountCredentials {
  cookies?: Cookie[];
  username: string;
  password: string;
  [key: string]: any;
}

export interface Account {
  id: number;
  user_id: number;
  platform_id: string;
  account_name: string;
  real_username?: string;
  credentials: AccountCredentials;
  is_online: boolean;
  offline_reason?: string;
  last_used_at?: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  url?: string;
  partitionKey?: string;
  [key: string]: any;
}

export interface Article {
  id: number;
  title: string;
  content: string;
  keyword?: string;
  images?: string[];
}

export interface PublishingConfig {
  title?: string;
  category?: string;
  tags?: string[];
  cover_image?: string;
  [key: string]: any;
}

export type LogLevel = 'info' | 'warning' | 'error';

export type LogCallback = (level: LogLevel, message: string, details?: any) => void;

export interface TaskLogEvent {
  taskId: number;
  level: LogLevel;
  message: string;
  timestamp: string;
  details?: any;
}

export interface TaskStatusEvent {
  taskId: number;
  status: string;
  error_message?: string;
}

export interface QueueStatusEvent {
  isRunning: boolean;
  executingBatches: string[];
}

export interface TaskFullResponse {
  success: boolean;
  data?: {
    task: LocalTask;
    account: Account;
  };
  message?: string;
}

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
