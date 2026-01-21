// 时间范围类型
export interface TimeRange {
  startDate: string;
  endDate: string;
  preset: '7d' | '30d' | '90d' | 'custom';
}

// 核心指标数据
export interface MetricsData {
  distillations: {
    total: number;
    today: number;
    yesterday: number;
  };
  articles: {
    total: number;
    today: number;
    yesterday: number;
  };
  publishingTasks: {
    total: number;
    today: number;
    yesterday: number;
  };
  publishingSuccessRate: {
    total: number;
    success: number;
    rate: number;
    previousRate: number;
  };
}

// 趋势数据
export interface TrendsData {
  data: Array<{
    date: string;
    articleCount: number;
    distillationCount: number;
  }>;
}

// 平台分布数据
export interface PlatformDistributionData {
  data: Array<{
    platformId: string;
    platformName: string;
    publishCount: number;
  }>;
}

// 发布状态数据
export interface PublishingStatusData {
  data: Array<{
    status: string;
    count: number;
  }>;
}

// 资源使用数据
export interface ResourceUsageData {
  distillations: {
    total: number;
    used: number;
  };
  topics: {
    total: number;
    used: number;
  };
  images: {
    total: number;
    used: number;
  };
}

// 生成任务数据
export interface GenerationTasksData {
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  avgCompletionTime: number;
  successRate: number;
}

// 资源排行数据
export interface TopResourcesData {
  knowledgeBases: Array<{
    id: number;
    name: string;
    usageCount: number;
  }>;
  conversionTargets: Array<{
    id: number;
    companyName: string;
    usageCount: number;
  }>;
}

// 发布趋势数据
export interface PublishingTrendData {
  dates: string[];
  successCounts: number[];
  failedCounts: number[];
  successRates: number[];
}

// 内容转化漏斗数据（近一周累计）
export interface ContentFunnelData {
  topics: number;
  articles: number;
  successfulPublishes: number;
}

// 周环比对比数据
export interface WeeklyComparisonData {
  thisWeek: {
    distillations: number;
    articles: number;
    publishes: number;
    successRate: number;
  };
  lastWeek: {
    distillations: number;
    articles: number;
    publishes: number;
    successRate: number;
  };
}

// 最近发布记录
export interface RecentPublishingItem {
  id: number;
  articleTitle: string;
  platformName: string;
  status: string;
  createdAt: string;
  errorMessage?: string;
}

// 平台成功率数据
export interface PlatformSuccessRateItem {
  platformName: string;
  totalCount: number;
  successCount: number;
  successRate: number;
}

// 平台账号状态数据
export interface PlatformAccountStatusData {
  totalAccounts: number;
  activeAccounts: number;
  expiredAccounts: number;
  platforms: Array<{
    platformName: string;
    accountCount: number;
    activeCount: number;
    lastPublishTime?: string;
    publishCount: number;
  }>;
}

// Dashboard状态
export interface DashboardState {
  timeRange: TimeRange;
  loading: boolean;
  lastUpdate: Date | null;
  error: string | null;
  metrics: MetricsData | null;
  trends: TrendsData | null;
  platformDistribution: PlatformDistributionData | null;
  publishingStatus: PublishingStatusData | null;
  resourceUsage: ResourceUsageData | null;
  generationTasks: GenerationTasksData | null;
  topResources: TopResourcesData | null;
  publishingTrend: PublishingTrendData | null;
  contentFunnel: ContentFunnelData | null;
  weeklyComparison: WeeklyComparisonData | null;
  recentPublishing: RecentPublishingItem[] | null;
  platformSuccessRate: PlatformSuccessRateItem[] | null;
  platformAccountStatus: PlatformAccountStatusData | null;
}
