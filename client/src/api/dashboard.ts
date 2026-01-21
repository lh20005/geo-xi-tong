import { apiClient } from './client';
import type {
  MetricsData,
  TrendsData,
  PlatformDistributionData,
  PublishingStatusData,
  ResourceUsageData,
  GenerationTasksData,
  TopResourcesData,
  PublishingTrendData,
  ContentFunnelData,
  WeeklyComparisonData,
  RecentPublishingItem,
  PlatformSuccessRateItem,
  PlatformAccountStatusData
} from '../types/dashboard';

/**
 * Dashboard API客户端
 * 提供工作台所需的各类统计数据查询接口
 */

interface QueryParams {
  startDate?: string;
  endDate?: string;
}

/**
 * 获取核心业务指标
 */
export async function getMetrics(params?: QueryParams): Promise<MetricsData> {
  try {
    const response = await apiClient.get('/dashboard/metrics', { params });
    return response.data;
  } catch (error) {
    console.error('获取核心指标失败:', error);
    throw error;
  }
}

/**
 * 获取内容生产趋势数据
 */
export async function getTrends(params?: QueryParams): Promise<TrendsData> {
  try {
    const response = await apiClient.get('/dashboard/trends', { params });
    return response.data;
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    throw error;
  }
}

/**
 * 获取发布平台分布
 */
export async function getPlatformDistribution(params?: QueryParams): Promise<PlatformDistributionData> {
  try {
    const response = await apiClient.get('/dashboard/platform-distribution', { params });
    return response.data;
  } catch (error) {
    console.error('获取平台分布失败:', error);
    throw error;
  }
}

/**
 * 获取发布任务状态分布
 */
export async function getPublishingStatus(params?: QueryParams): Promise<PublishingStatusData> {
  try {
    const response = await apiClient.get('/dashboard/publishing-status', { params });
    return response.data;
  } catch (error) {
    console.error('获取发布状态失败:', error);
    throw error;
  }
}

/**
 * 获取资源使用效率
 */
export async function getResourceUsage(params?: QueryParams): Promise<ResourceUsageData> {
  try {
    const response = await apiClient.get('/dashboard/resource-usage', { params });
    return response.data;
  } catch (error) {
    console.error('获取资源使用率失败:', error);
    throw error;
  }
}

/**
 * 获取文章生成任务概览
 */
export async function getGenerationTasks(params?: QueryParams): Promise<GenerationTasksData> {
  try {
    const response = await apiClient.get('/dashboard/generation-tasks', { params });
    return response.data;
  } catch (error) {
    console.error('获取生成任务概览失败:', error);
    throw error;
  }
}

/**
 * 获取知识库和转化目标使用排行
 */
export async function getTopResources(params?: QueryParams): Promise<TopResourcesData> {
  try {
    const response = await apiClient.get('/dashboard/top-resources', { params });
    return response.data;
  } catch (error) {
    console.error('获取资源排行失败:', error);
    throw error;
  }
}

/**
 * 获取文章详细统计
 */
export async function getArticleStats() {
  try {
    const response = await apiClient.get('/dashboard/article-stats');
    return response.data;
  } catch (error) {
    console.error('获取文章统计失败:', error);
    throw error;
  }
}

/**
 * 获取关键词分布
 */
export async function getKeywordDistribution() {
  try {
    const response = await apiClient.get('/dashboard/keyword-distribution');
    return response.data;
  } catch (error) {
    console.error('获取关键词分布失败:', error);
    throw error;
  }
}

/**
 * 获取月度对比数据
 */
export async function getMonthlyComparison() {
  try {
    const response = await apiClient.get('/dashboard/monthly-comparison');
    return response.data;
  } catch (error) {
    console.error('获取月度对比失败:', error);
    throw error;
  }
}

/**
 * 获取24小时活动分布
 */
export async function getHourlyActivity() {
  try {
    const response = await apiClient.get('/dashboard/hourly-activity');
    return response.data;
  } catch (error) {
    console.error('获取活动分布失败:', error);
    throw error;
  }
}

/**
 * 获取成功率数据
 */
export async function getSuccessRates() {
  try {
    const response = await apiClient.get('/dashboard/success-rates');
    return response.data;
  } catch (error) {
    console.error('获取成功率失败:', error);
    throw error;
  }
}

/**
 * 获取发布趋势数据
 */
export async function getPublishingTrend(params?: QueryParams): Promise<PublishingTrendData> {
  try {
    const response = await apiClient.get('/dashboard/publishing-trend', { params });
    return response.data;
  } catch (error) {
    console.error('获取发布趋势失败:', error);
    // 返回空数据
    return { dates: [], successCounts: [], failedCounts: [], successRates: [] };
  }
}

/**
 * 获取内容转化漏斗数据（近一周累计）
 */
export async function getContentFunnel(params?: QueryParams): Promise<ContentFunnelData> {
  try {
    const response = await apiClient.get('/dashboard/content-funnel', { params });
    return response.data;
  } catch (error) {
    console.error('获取内容漏斗失败:', error);
    return { topics: 0, articles: 0, successfulPublishes: 0 };
  }
}

/**
 * 获取周环比对比数据
 */
export async function getWeeklyComparison(): Promise<WeeklyComparisonData> {
  try {
    const response = await apiClient.get('/dashboard/weekly-comparison');
    return response.data;
  } catch (error) {
    console.error('获取周环比失败:', error);
    return {
      thisWeek: { distillations: 0, articles: 0, publishes: 0, successRate: 0 },
      lastWeek: { distillations: 0, articles: 0, publishes: 0, successRate: 0 }
    };
  }
}

/**
 * 获取最近发布记录
 */
export async function getRecentPublishing(): Promise<RecentPublishingItem[]> {
  try {
    const response = await apiClient.get('/dashboard/recent-publishing');
    return response.data;
  } catch (error) {
    console.error('获取最近发布失败:', error);
    return [];
  }
}

/**
 * 获取平台发布成功率
 */
export async function getPlatformSuccessRate(): Promise<PlatformSuccessRateItem[]> {
  try {
    const response = await apiClient.get('/dashboard/platform-success-rate');
    return response.data;
  } catch (error) {
    console.error('获取平台成功率失败:', error);
    return [];
  }
}

/**
 * 获取平台账号状态
 */
export async function getPlatformAccountStatus(): Promise<PlatformAccountStatusData> {
  try {
    const response = await apiClient.get('/dashboard/platform-account-status');
    return response.data;
  } catch (error) {
    console.error('获取平台账号状态失败:', error);
    return {
      totalAccounts: 0,
      activeAccounts: 0,
      expiredAccounts: 0,
      platforms: []
    };
  }
}

/**
 * 获取所有Dashboard数据
 * 并行请求所有API以提高加载速度
 */
export async function getAllDashboardData(params?: QueryParams) {
  try {
    const [
      metrics,
      resourceUsage,
      publishingTrend,
      contentFunnel,
      weeklyComparison,
      platformSuccessRate,
      platformAccountStatus
    ] = await Promise.all([
      getMetrics(params),
      getResourceUsage(params),
      getPublishingTrend(params),
      getContentFunnel(params),
      getWeeklyComparison(),
      getPlatformSuccessRate(),
      getPlatformAccountStatus()
    ]);

    return {
      metrics,
      resourceUsage,
      publishingTrend,
      contentFunnel,
      weeklyComparison,
      platformSuccessRate,
      platformAccountStatus
    };
  } catch (error) {
    console.error('获取Dashboard数据失败:', error);
    throw error;
  }
}
