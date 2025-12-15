import { apiClient } from './client';
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
  const response = await apiClient.get('/article-settings', {
    params: { page, pageSize }
  });
  return response.data;
}

// 创建文章设置
export async function createArticleSetting(
  data: ArticleSettingFormData
): Promise<ArticleSettingResponse> {
  const response = await apiClient.post('/article-settings', data);
  return response.data;
}

// 获取单个文章设置
export async function fetchArticleSettingById(
  id: number
): Promise<ArticleSetting> {
  const response = await apiClient.get(`/article-settings/${id}`);
  return response.data;
}

// 更新文章设置
export async function updateArticleSetting(
  id: number,
  data: Partial<ArticleSettingFormData>
): Promise<ArticleSettingResponse> {
  const response = await apiClient.patch(`/article-settings/${id}`, data);
  return response.data;
}

// 删除文章设置
export async function deleteArticleSetting(id: number): Promise<DeleteResponse> {
  const response = await apiClient.delete(`/article-settings/${id}`);
  return response.data;
}
