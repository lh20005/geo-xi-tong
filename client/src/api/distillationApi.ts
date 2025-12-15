import axios from 'axios';

export interface DistillationUsageStats {
  distillationId: number;
  keyword: string;
  provider: string;
  usageCount: number;
  lastUsedAt: string | null;
  topicCount: number;
  createdAt: string;
}

export interface RecommendedDistillation {
  distillationId: number;
  keyword: string;
  usageCount: number;
  topicCount: number;
  isRecommended: boolean;
  recommendReason: string;
}

/**
 * 获取带使用统计的蒸馏结果列表
 */
export async function getDistillationsWithStats(
  page: number = 1,
  pageSize: number = 10,
  sortBy: 'created_at' | 'usage_count' = 'usage_count',
  sortOrder: 'asc' | 'desc' = 'asc',
  filterUsage: 'all' | 'used' | 'unused' = 'all'
): Promise<{ distillations: DistillationUsageStats[]; total: number }> {
  const response = await axios.get('/api/distillation/stats', {
    params: { page, pageSize, sortBy, sortOrder, filterUsage }
  });
  return response.data;
}

/**
 * 获取推荐的蒸馏结果（按使用次数升序）
 * 用于文章生成时智能选择蒸馏结果
 */
export async function getRecommendedDistillations(
  limit: number = 10
): Promise<RecommendedDistillation[]> {
  const response = await axios.get('/api/distillation/recommended', {
    params: { limit }
  });
  return response.data;
}

/**
 * 获取蒸馏结果详情
 */
export async function getDistillationDetail(
  distillationId: number
): Promise<DistillationUsageStats | null> {
  const response = await axios.get(`/api/distillation/${distillationId}`);
  return response.data;
}

/**
 * 获取使用历史
 */
export async function getUsageHistory(
  distillationId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<{
  distillationId: number;
  keyword: string;
  totalUsageCount: number;
  usageHistory: Array<{
    id: number;
    taskId: number;
    articleId: number;
    articleTitle: string;
    usedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const response = await axios.get(`/api/distillation/${distillationId}/usage`, {
    params: { page, pageSize }
  });
  return response.data;
}
