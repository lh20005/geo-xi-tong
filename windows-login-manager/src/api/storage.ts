import { apiClient } from './client';

export interface StorageUsage {
  userId: number;
  imageStorageBytes: number;
  documentStorageBytes: number;
  articleStorageBytes: number;
  totalStorageBytes: number;
  imageCount: number;
  documentCount: number;
  articleCount: number;
  storageQuotaBytes: number;
  purchasedStorageBytes: number;
  availableBytes: number;
  usagePercentage: number;
}

export interface StorageBreakdown {
  images: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
  documents: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
  articles: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usagePercentage: number;
  reason?: string;
}

export interface StorageAlert {
  id: number;
  userId: number;
  alertType: 'warning' | 'critical' | 'depleted';
  thresholdPercentage: number;
  currentUsageBytes: number;
  quotaBytes: number;
  isSent: boolean;
  createdAt: string;
}

/**
 * 获取当前存储使用情况
 */
export const getStorageUsage = async (): Promise<StorageUsage> => {
  const response = await apiClient.get('/storage/usage');
  return response.data.data;
};

/**
 * 获取存储明细
 */
export const getStorageBreakdown = async (): Promise<StorageBreakdown> => {
  const response = await apiClient.get('/storage/breakdown');
  return response.data.data;
};

/**
 * 检查文件上传配额
 */
export const checkQuota = async (
  fileSizeBytes: number,
  resourceType: 'image' | 'document' | 'article'
): Promise<QuotaCheckResult> => {
  const response = await apiClient.post('/storage/check-quota', {
    fileSizeBytes,
    resourceType,
  });
  return response.data.data;
};

/**
 * 获取存储使用历史
 */
export const getStorageHistory = async (
  startDate: string,
  endDate: string
): Promise<any[]> => {
  const response = await apiClient.get('/storage/history', {
    params: { startDate, endDate },
  });
  return response.data.data;
};

/**
 * 获取存储事务日志
 */
export const getStorageTransactions = async (
  page: number = 1,
  pageSize: number = 20
): Promise<any> => {
  const response = await apiClient.get('/storage/transactions', {
    params: { page, pageSize },
  });
  return response.data.data;
};

/**
 * 获取待处理的警报
 */
export const getPendingAlerts = async (): Promise<StorageAlert[]> => {
  const response = await apiClient.get('/storage/alerts');
  return response.data.data;
};

/**
 * 格式化字节为可读格式
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === -1) return '无限';
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
