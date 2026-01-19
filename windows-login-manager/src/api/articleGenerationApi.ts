import { apiClient } from './client';
import { localArticleSettingApi, localKnowledgeApi } from './local';
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
 * 检查是否在 Electron 环境中
 */
function isElectron(): boolean {
  return !!(window as any).electronAPI || !!(window as any).electron;
}

/**
 * 获取 Electron API
 */
function getElectronAPI() {
  return (window as any).electronAPI || (window as any).electron;
}

const MAX_KNOWLEDGE_SUMMARY_LENGTH = 3000;
const MAX_KNOWLEDGE_DOCS = 3;
const MAX_DOC_SNIPPET_LENGTH = 800;

async function buildLocalKnowledgeSummary(knowledgeBaseId: number): Promise<string> {
  try {
    const result = await localKnowledgeApi.getDocuments(String(knowledgeBaseId));
    if (!result.success || !Array.isArray(result.data)) {
      return '';
    }

    const docs = result.data.slice(0, MAX_KNOWLEDGE_DOCS);
    let summary = '';

    for (const doc of docs) {
      const rawContent = (doc.content || doc.content_preview || '').toString();
      if (!rawContent.trim()) continue;

      const filename = doc.filename || doc.name || '文档';
      const cleaned = rawContent.replace(/\s+/g, ' ').trim();
      const snippet = cleaned.slice(0, MAX_DOC_SNIPPET_LENGTH);
      const block = `【${filename}】${snippet}`;

      if (summary.length + block.length + 1 > MAX_KNOWLEDGE_SUMMARY_LENGTH) {
        summary += block.slice(0, Math.max(0, MAX_KNOWLEDGE_SUMMARY_LENGTH - summary.length));
        break;
      }

      summary += (summary ? '\n' : '') + block;
    }

    return summary;
  } catch (error) {
    console.warn('[ArticleGeneration] 构建知识库摘要失败:', error);
    return '';
  }
}

/**
 * 创建文章生成任务
 */
export async function createTask(config: TaskConfig): Promise<CreateTaskResponse> {
  const knowledgeSummary = isElectron()
    ? (config.knowledgeSummary ?? await buildLocalKnowledgeSummary(config.knowledgeBaseId))
    : config.knowledgeSummary;

  const response = await apiClient.post('/article-generation/tasks', {
    ...config,
    knowledgeSummary,
    resourceSource: isElectron() ? 'local' : config.resourceSource
  });
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
 * 获取相册列表（本地 IPC 调用）
 */
export async function fetchAlbums(): Promise<Album[]> {
  if (isElectron()) {
    const api = getElectronAPI();
    const result = await api.gallery.findAlbums();
    if (result.success && result.data) {
      // 转换本地数据格式为 API 格式
      return result.data.map((album: any) => ({
        id: album.id,
        name: album.name,
        image_count: album.imageCount || album.image_count || 0,
        cover_image: album.coverImage || album.cover_image || null,
        created_at: album.created_at
      }));
    }
    return [];
  }
  // 非 Electron 环境回退到 HTTP API（Web 端）
  const response = await apiClient.get('/gallery/albums');
  return response.data.albums || [];
}

/**
 * 获取知识库列表（本地 IPC 调用）
 */
export async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  if (isElectron()) {
    const api = getElectronAPI();
    const result = await api.localKnowledge.findAll();
    if (result.success && result.data) {
      // 转换本地数据格式为 API 格式
      return result.data.map((kb: any) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description || '',
        document_count: kb.documentCount || kb.document_count || 0,
        created_at: kb.created_at
      }));
    }
    return [];
  }
  // 非 Electron 环境回退到 HTTP API（Web 端）
  const response = await apiClient.get('/knowledge-bases');
  return response.data.knowledgeBases || [];
}

/**
 * 获取文章设置列表
 */
export async function fetchArticleSettings(): Promise<ArticleSetting[]> {
  if (isElectron()) {
    const result = await localArticleSettingApi.findAll({ page: 1, pageSize: 1000 });
    if (!result.success) {
      throw new Error(result.error || '获取文章设置失败');
    }
    return result.data?.data || [];
  }
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
