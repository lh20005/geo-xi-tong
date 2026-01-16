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

/**
 * 手动批量输入蒸馏结果
 * 
 * @param keyword 关键词（只能一个）
 * @param questions 蒸馏结果数组（每行一个）
 * @returns 保存结果
 */
export async function createManualDistillation(
  keyword: string,
  questions: string[]
): Promise<{
  success: boolean;
  distillationId: number;
  keyword: string;
  questions: string[];
  count: number;
}> {
  try {
    const response = await apiClient.post('/distillation/manual', {
      keyword,
      questions
    });
    return response.data;
  } catch (error) {
    console.error('手动输入蒸馏结果失败:', error);
    throw error;
  }
}

/**
 * 按关键词删除所有蒸馏结果
 * 
 * @param keyword 关键词
 * @returns 删除结果
 */
export async function deleteTopicsByKeyword(keyword: string): Promise<{
  success: boolean;
  deletedCount: number;
  keyword: string;
}> {
  try {
    const response = await apiClient.delete('/distillation/topics/by-keyword', {
      data: { keyword }
    });
    return response.data;
  } catch (error) {
    console.error('按关键词删除话题失败:', error);
    throw error;
  }
}

/**
 * 按筛选条件删除话题
 * 
 * @param filters 筛选条件
 * @returns 删除结果
 */
export async function deleteTopicsByFilter(filters: {
  keyword?: string;
  provider?: string;
  search?: string;
}): Promise<{
  success: boolean;
  deletedCount: number;
  filters: typeof filters;
}> {
  try {
    const response = await apiClient.delete('/distillation/topics/by-filter', {
      data: filters
    });
    return response.data;
  } catch (error) {
    console.error('按筛选条件删除话题失败:', error);
    throw error;
  }
}
