/**
 * 蒸馏结果表格视图API客户端
 */

import { apiClient } from './client';
import { 
  ResultsResponse, 
  QueryFilters, 
  KeywordsResponse,
  DeleteResponse 
} from '../types/distillationResults';

/**
 * 获取带引用次数的蒸馏结果列表
 * 
 * @param filters 查询筛选参数
 * @returns 包含数据、分页信息和统计信息的响应
 */
export async function fetchResultsWithReferences(
  filters: QueryFilters = {}
): Promise<ResultsResponse> {
  try {
    const response = await apiClient.get<ResultsResponse>('/distillation/results', {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error('获取蒸馏结果列表失败:', error);
    throw error;
  }
}

/**
 * 获取所有唯一的关键词列表
 * 
 * @returns 关键词列表
 */
export async function fetchAllKeywords(): Promise<KeywordsResponse> {
  try {
    const response = await apiClient.get<KeywordsResponse>('/distillation/keywords');
    return response.data;
  } catch (error) {
    console.error('获取关键词列表失败:', error);
    throw error;
  }
}

/**
 * 批量删除话题
 * 
 * @param topicIds 要删除的话题ID数组
 * @returns 删除结果
 */
export async function deleteTopics(topicIds: number[]): Promise<DeleteResponse> {
  try {
    const response = await apiClient.delete<DeleteResponse>('/distillation/topics', {
      data: { topicIds }
    });
    return response.data;
  } catch (error) {
    console.error('批量删除话题失败:', error);
    throw error;
  }
}
