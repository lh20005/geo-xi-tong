/**
 * 蒸馏结果表格视图相关类型定义
 */

/**
 * 带引用次数的话题接口
 */
export interface TopicWithReference {
  id: number;
  distillationId: number;
  keyword: string;
  question: string;
  provider: 'deepseek' | 'gemini' | 'ollama';
  createdAt: string;
  referenceCount: number;
}

/**
 * 统计信息接口
 */
export interface Statistics {
  totalTopics: number;
  totalKeywords: number;
  totalReferences: number;
}

/**
 * 查询结果响应接口
 */
export interface ResultsResponse {
  data: TopicWithReference[];
  total: number;
  page: number;
  pageSize: number;
  statistics: Statistics;
}

/**
 * 查询筛选参数接口
 */
export interface QueryFilters {
  keyword?: string;
  provider?: string;
  search?: string;  // 新增：搜索话题内容
  page?: number;
  pageSize?: number;
}

/**
 * 关键词列表响应接口
 */
export interface KeywordsResponse {
  keywords: string[];
}

/**
 * 删除响应接口
 */
export interface DeleteResponse {
  success: boolean;
  deletedCount: number;
}
