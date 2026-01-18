/**
 * 本地蒸馏结果 API
 * 从本地 PostgreSQL 数据库获取蒸馏结果
 */

import { ResultsResponse, QueryFilters, KeywordsResponse, DeleteResponse } from '../types/distillationResults';

/**
 * 获取带引用次数的蒸馏结果列表（从本地数据库）
 */
export async function fetchLocalResultsWithReferences(
  filters: QueryFilters = {}
): Promise<ResultsResponse> {
  const result = await window.electron.invoke('distillation:local:getResults', filters);
  
  if (!result.success) {
    throw new Error(result.error || '获取蒸馏结果失败');
  }
  
  return result.data;
}

/**
 * 获取所有唯一的关键词列表（从本地数据库）
 */
export async function fetchLocalKeywords(): Promise<KeywordsResponse> {
  const result = await window.electron.invoke('distillation:local:getKeywords');
  
  if (!result.success) {
    throw new Error(result.error || '获取关键词列表失败');
  }
  
  return result.data;
}

/**
 * 批量删除话题（从本地数据库）
 */
export async function deleteLocalTopics(topicIds: number[]): Promise<DeleteResponse> {
  const result = await window.electron.invoke('distillation:local:deleteTopics', topicIds);
  
  if (!result.success) {
    throw new Error(result.error || '删除话题失败');
  }
  
  return result.data;
}

/**
 * 按关键词删除所有蒸馏结果（从本地数据库）
 */
export async function deleteLocalTopicsByKeyword(keyword: string): Promise<{
  success: boolean;
  deletedCount: number;
  keyword: string;
}> {
  const result = await window.electron.invoke('distillation:local:deleteTopicsByKeyword', keyword);
  
  if (!result.success) {
    throw new Error(result.error || '按关键词删除话题失败');
  }
  
  return { success: true, ...result.data };
}
