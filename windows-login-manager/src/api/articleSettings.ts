import { apiClient } from './client';
import { isElectron, localArticleSettingApi } from './index';
import type {
  ArticleSetting,
  ArticleSettingFormData,
  ArticleSettingsListResponse,
  ArticleSettingResponse,
  DeleteResponse,
} from '../types/articleSettings';

// 获取文章设置列表
export async function fetchArticleSettings(
  page: number = 1,
  pageSize: number = 10
): Promise<ArticleSettingsListResponse> {
  if (isElectron()) {
    const result = await localArticleSettingApi.findAll({ page, pageSize });
    if (!result.success) {
      throw new Error(result.error || '获取文章设置列表失败');
    }
    return {
      settings: result.data?.data || [],
      total: result.data?.total || 0,
      page: result.data?.page || page,
      pageSize: result.data?.pageSize || pageSize,
    };
  }

  const response = await apiClient.get('/article-settings', {
    params: { page, pageSize }
  });
  return response.data;
}

// 创建文章设置
export async function createArticleSetting(
  data: ArticleSettingFormData
): Promise<ArticleSettingResponse> {
  if (isElectron()) {
    const result = await localArticleSettingApi.create(data);
    if (!result.success) {
      throw new Error(result.error || '创建文章设置失败');
    }
    return result.data;
  }
  const response = await apiClient.post('/article-settings', data);
  return response.data;
}

// 获取单个文章设置
export async function fetchArticleSettingById(
  id: number
): Promise<ArticleSetting> {
  if (isElectron()) {
    const result = await localArticleSettingApi.findById(id);
    if (!result.success) {
      throw new Error(result.error || '获取文章设置失败');
    }
    return result.data;
  }
  const response = await apiClient.get(`/article-settings/${id}`);
  return response.data;
}

// 更新文章设置
export async function updateArticleSetting(
  id: number,
  data: Partial<ArticleSettingFormData>
): Promise<ArticleSettingResponse> {
  if (isElectron()) {
    const result = await localArticleSettingApi.update(id, data);
    if (!result.success) {
      throw new Error(result.error || '更新文章设置失败');
    }
    return result.data;
  }
  const response = await apiClient.patch(`/article-settings/${id}`, data);
  return response.data;
}

// 删除文章设置
export async function deleteArticleSetting(id: number): Promise<DeleteResponse> {
  if (isElectron()) {
    const result = await localArticleSettingApi.delete(id);
    if (!result.success) {
      throw new Error(result.error || '删除文章设置失败');
    }
    return { success: true };
  }
  const response = await apiClient.delete(`/article-settings/${id}`);
  return response.data;
}
