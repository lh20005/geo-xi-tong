import { apiClient } from './client';
import type {
  TaskConfig,
  CreateTaskResponse,
  TaskListResponse,
  TaskDetailResponse,
  DistillationHistory,
  Album,
  KnowledgeBase,
  ArticleSetting,
  ConversionTarget
} from '../types/articleGeneration';

/**
 * 创建文章生成任务
 */
export async function createTask(config: TaskConfig): Promise<CreateTaskResponse> {
  const response = await apiClient.post('/article-generation/tasks', config);
  return response.data;
}

/**
 * 获取任务列表
 */
export async function fetchTasks(page: number = 1, pageSize: number = 10): Promise<TaskListResponse> {
  const response = await apiClient.get('/article-generation/tasks', {
    params: { page, pageSize }
  });
  return response.data;
}

/**
 * 获取任务详情
 */
export async function fetchTaskDetail(taskId: number): Promise<TaskDetailResponse> {
  const response = await apiClient.get(`/article-generation/tasks/${taskId}`);
  return response.data;
}

/**
 * 获取蒸馏历史列表
 */
export async function fetchDistillations(): Promise<DistillationHistory[]> {
  const response = await apiClient.get('/distillation/history');
  return response.data;
}

/**
 * 获取相册列表
 */
export async function fetchAlbums(): Promise<Album[]> {
  const response = await apiClient.get('/gallery/albums');
  return response.data.albums || [];
}

/**
 * 获取知识库列表
 */
export async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  const response = await apiClient.get('/knowledge-bases');
  return response.data.knowledgeBases || [];
}

/**
 * 获取文章设置列表
 */
export async function fetchArticleSettings(): Promise<ArticleSetting[]> {
  const response = await apiClient.get('/article-settings');
  return response.data.settings || [];
}

/**
 * 获取转化目标列表
 */
export async function fetchConversionTargets(): Promise<ConversionTarget[]> {
  const response = await apiClient.get('/conversion-targets');
  return response.data.data?.targets || [];
}

/**
 * 删除单个任务
 */
export async function deleteTask(taskId: number): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete(`/article-generation/tasks/${taskId}`);
  return response.data;
}

/**
 * 批量删除任务
 */
export async function batchDeleteTasks(taskIds: number[]): Promise<{ 
  success: boolean; 
  message: string; 
  deletedCount: number;
  deletedIds: number[];
}> {
  const response = await apiClient.post('/article-generation/tasks/batch-delete', { taskIds });
  return response.data;
}

/**
 * 删除所有任务
 */
export async function deleteAllTasks(): Promise<{ success: boolean; message: string; deletedCount: number }> {
  const response = await apiClient.delete('/article-generation/tasks');
  return response.data;
}

/**
 * 终止任务
 */
export async function cancelTask(taskId: number): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post(`/article-generation/tasks/${taskId}/cancel`);
  return response.data;
}
