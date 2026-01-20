/**
 * Electron API 类型声明
 * 用于渲染进程中访问 window.electronAPI 和 window.publishing
 */

// 任务日志事件
export interface TaskLogEvent {
  taskId: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  details?: any;
}

// 任务状态事件
export interface TaskStatusEvent {
  taskId: number;
  status: string;
  error_message?: string;
}

// 队列状态事件
export interface QueueStatusEvent {
  isRunning: boolean;
  executingBatches: string[];
}

// 发布任务管理 API
export interface PublishingAPI {
  // 队列控制
  startQueue: () => Promise<{ success: boolean; error?: string }>;
  stopQueue: () => Promise<{ success: boolean; error?: string }>;
  getQueueStatus: () => Promise<QueueStatusEvent>;
  
  // 任务执行
  executeTask: (taskId: number) => Promise<{ success: boolean; error?: string }>;
  executeBatch: (batchId: string) => Promise<{ success: boolean; error?: string }>;
  stopTask: (taskId: number) => Promise<{ success: boolean }>;
  stopBatch: (batchId: string) => Promise<{ success: boolean }>;
  
  // 事件监听
  onTaskLog: (callback: (data: TaskLogEvent) => void) => () => void;
  onTaskStatus: (callback: (data: TaskStatusEvent) => void) => () => void;
  onQueueStatus: (callback: (data: QueueStatusEvent) => void) => () => void;
}

// 扩展 Window 接口
declare global {
  interface Window {
    publishing?: PublishingAPI;
  }
}

export {};
