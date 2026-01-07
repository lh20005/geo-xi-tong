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
 * 格式化存储空间（MB 单位）
 */
export const formatStorageMB = (mb: number): string => {
  if (mb === -1) return '无限';
  if (mb === 0) return '0 MB';
  
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }
  
  return `${mb} MB`;
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
