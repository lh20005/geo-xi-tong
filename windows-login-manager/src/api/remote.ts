/**
 * 远程 API 封装
 * 通过 HTTP 调用服务器端 API
 * 
 * 改造后：服务器只负责认证、配额验证、AI 生成、订阅管理等
 */

import { apiClient } from './client';

// ==================== 认证相关 ====================

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    refreshToken: string;
    user: {
      id: number;
      username: string;
      email?: string;
      role: string;
    };
  };
  error?: string;
}

export const remoteAuthApi = {
  login: async (params: LoginParams): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', params);
    return response.data;
  },
  
  register: async (params: { username: string; email: string; password: string }) => {
    const response = await apiClient.post('/auth/register', params);
    return response.data;
  },
  
  refresh: async (refreshToken: string) => {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data;
  },
  
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
  
  checkAuth: async () => {
    const response = await apiClient.get('/auth/check');
    return response.data;
  },
};

// ==================== 配额管理 ====================

export interface QuotaInfo {
  quotas: {
    article_generation: { used: number; limit: number; reserved: number };
    publish: { used: number; limit: number; reserved: number };
    knowledge_upload: { used: number; limit: number; reserved: number };
    image_upload: { used: number; limit: number; reserved: number };
  };
}

export interface ReserveQuotaParams {
  quotaType: 'article_generation' | 'publish' | 'knowledge_upload' | 'image_upload';
  amount?: number;
  clientId?: string;
  taskInfo?: object;
}

export interface ReserveQuotaResponse {
  success: boolean;
  reservationId: string;
  expiresAt: string;
  remainingQuota: number;
}

export const remoteQuotaApi = {
  getInfo: async (): Promise<QuotaInfo> => {
    const response = await apiClient.get('/quota/info');
    return response.data;
  },
  
  reserve: async (params: ReserveQuotaParams): Promise<ReserveQuotaResponse> => {
    const response = await apiClient.post('/quota/reserve', params);
    return response.data;
  },
  
  confirm: async (reservationId: string, result?: object) => {
    const response = await apiClient.post('/quota/confirm', { reservationId, result });
    return response.data;
  },
  
  release: async (reservationId: string, reason?: string) => {
    const response = await apiClient.post('/quota/release', { reservationId, reason });
    return response.data;
  },
};

// ==================== AI 文章生成 ====================

export interface GenerateArticleParams {
  keyword: string;
  topicId?: number;
  knowledgeBaseIds?: number[];
  imageId?: number;
  requirements?: string;
  provider?: 'deepseek' | 'gemini' | 'ollama';
  conversionTargetId?: number;
  articleSettingId?: number;
}

export interface GeneratedArticle {
  generationId: string;
  article: {
    title: string;
    content: string;
    keyword: string;
    imageUrl?: string;
  };
  expiresAt: string;
}

export const remoteArticleGenerationApi = {
  generate: async (params: GenerateArticleParams): Promise<GeneratedArticle> => {
    const response = await apiClient.post('/article-generation/generate', params);
    return response.data;
  },
  
  confirm: async (generationId: string) => {
    const response = await apiClient.post('/article-generation/confirm', { generationId });
    return response.data;
  },
  
  retrieve: async (generationId: string) => {
    const response = await apiClient.get(`/article-generation/retrieve/${generationId}`);
    return response.data;
  },
  
  getPending: async () => {
    const response = await apiClient.get('/article-generation/pending');
    return response.data;
  },
};

// ==================== 蒸馏相关 ====================

export interface DistillParams {
  keyword: string;
  provider?: 'deepseek' | 'gemini' | 'ollama';
  topicCount?: number;
}

export interface DistillResult {
  id: number;
  keyword: string;
  topics: Array<{
    id: number;
    question: string;
  }>;
}

export const remoteDistillationApi = {
  distill: async (params: DistillParams): Promise<DistillResult> => {
    const response = await apiClient.post('/distillation/distill', params);
    return response.data;
  },
  
  getHistory: async (page?: number, pageSize?: number) => {
    const response = await apiClient.get('/distillation/history', {
      params: { page, pageSize }
    });
    return response.data;
  },
  
  getTopics: async (distillationId: number) => {
    const response = await apiClient.get(`/distillation/${distillationId}/topics`);
    return response.data;
  },
  
  deleteTopic: async (topicId: number) => {
    const response = await apiClient.delete(`/distillation/topics/${topicId}`);
    return response.data;
  },
  
  deleteDistillation: async (distillationId: number) => {
    const response = await apiClient.delete(`/distillation/${distillationId}`);
    return response.data;
  },
};

// ==================== 订阅管理 ====================

export interface SubscriptionProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
  quotas: {
    article_generation: number;
    publish: number;
    knowledge_upload: number;
    image_upload: number;
  };
}

export interface UserSubscription {
  id: number;
  productId: number;
  productName: string;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  quotas: {
    article_generation: { used: number; limit: number };
    publish: { used: number; limit: number };
    knowledge_upload: { used: number; limit: number };
    image_upload: { used: number; limit: number };
  };
}

export const remoteSubscriptionApi = {
  getProducts: async (): Promise<SubscriptionProduct[]> => {
    const response = await apiClient.get('/subscription/products');
    return response.data.data;
  },
  
  getMy: async (): Promise<UserSubscription> => {
    const response = await apiClient.get('/subscription/my');
    return response.data.data;
  },
  
  createOrder: async (productId: number) => {
    const response = await apiClient.post('/subscription/create-order', { productId });
    return response.data;
  },
};

// ==================== 支付相关 ====================

export const remotePaymentApi = {
  createWechatNative: async (orderNo: string) => {
    const response = await apiClient.post('/payment/wechat/native', { orderNo });
    return response.data;
  },
  
  getOrderStatus: async (orderNo: string) => {
    const response = await apiClient.get(`/payment/order/${orderNo}`);
    return response.data;
  },
};

// ==================== 数据同步 ====================

export interface SyncSnapshot {
  id: string;
  metadata: {
    version: string;
    articleCount: number;
    accountCount: number;
    createdAt: string;
  };
  uploadedAt: string;
  lastDownloadedAt?: string;
  expiresAt: string;
  size: number;
}

export const remoteSyncApi = {
  upload: async (snapshot: Blob, checksum: string, metadata: object) => {
    const formData = new FormData();
    formData.append('snapshot', snapshot);
    formData.append('checksum', checksum);
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await apiClient.post('/sync/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  getSnapshots: async (): Promise<{ snapshots: SyncSnapshot[]; maxSnapshots: number; maxSizeBytes: number }> => {
    const response = await apiClient.get('/sync/snapshots');
    return response.data;
  },
  
  download: async (snapshotId: string): Promise<Blob> => {
    const response = await apiClient.get(`/sync/download/${snapshotId}`, {
      responseType: 'blob'
    });
    return response.data;
  },
  
  deleteSnapshot: async (snapshotId: string) => {
    const response = await apiClient.delete(`/sync/snapshots/${snapshotId}`);
    return response.data;
  },
};

// ==================== 分析上报 ====================

export interface PublishReport {
  taskId: string;
  platform: string;
  status: 'success' | 'failed';
  duration: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    articleLength?: number;
    imageCount?: number;
    retryCount?: number;
  };
}

export const remoteAnalyticsApi = {
  reportPublish: async (report: PublishReport) => {
    const response = await apiClient.post('/analytics/publish-report', report);
    return response.data;
  },
  
  reportPublishBatch: async (reports: PublishReport[]) => {
    const response = await apiClient.post('/analytics/publish-report/batch', { reports });
    return response.data;
  },
  
  // 管理员接口
  getOverview: async (startDate?: string, endDate?: string) => {
    const response = await apiClient.get('/admin/analytics/overview', {
      params: { startDate, endDate }
    });
    return response.data;
  },
  
  getPlatformStats: async (platformId: string, startDate?: string, endDate?: string) => {
    const response = await apiClient.get(`/admin/analytics/platform/${platformId}`, {
      params: { startDate, endDate }
    });
    return response.data;
  },
  
  getErrors: async (params: { platform?: string; errorCode?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }) => {
    const response = await apiClient.get('/admin/analytics/errors', { params });
    return response.data;
  },
  
  getUserStats: async (params: { startDate?: string; endDate?: string; sortBy?: string; page?: number; pageSize?: number }) => {
    const response = await apiClient.get('/admin/analytics/users', { params });
    return response.data;
  },
};

// ==================== 适配器版本 ====================

export interface AdapterVersion {
  platform: string;
  version: string;
  updatedAt: string;
}

export const remoteAdapterApi = {
  getVersions: async (): Promise<{ adapters: Record<string, AdapterVersion>; minClientVersion: string }> => {
    const response = await apiClient.get('/adapters/versions');
    return response.data;
  },
  
  download: async (platform: string): Promise<string> => {
    const response = await apiClient.get(`/adapters/${platform}/download`);
    return response.data;
  },
  
  getChangelog: async (platform: string) => {
    const response = await apiClient.get(`/adapters/${platform}/changelog`);
    return response.data;
  },
};

// ==================== 用户管理（管理员） ====================

export const remoteUserApi = {
  getUsers: async (params?: { page?: number; pageSize?: number; search?: string }) => {
    const response = await apiClient.get('/users', { params });
    return response.data;
  },
  
  getUser: async (id: number) => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },
  
  createUser: async (data: { username: string; email: string; password: string; role?: string }) => {
    const response = await apiClient.post('/users', data);
    return response.data;
  },
  
  updateUser: async (id: number, data: Partial<{ username: string; email: string; role: string }>) => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  },
  
  deleteUser: async (id: number) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },
};

// ==================== 代理商管理 ====================

export const remoteAgentApi = {
  getAgents: async (params?: { page?: number; pageSize?: number }) => {
    const response = await apiClient.get('/agents', { params });
    return response.data;
  },
  
  getAgent: async (id: number) => {
    const response = await apiClient.get(`/agents/${id}`);
    return response.data;
  },
  
  createAgent: async (data: any) => {
    const response = await apiClient.post('/agents', data);
    return response.data;
  },
  
  updateAgent: async (id: number, data: any) => {
    const response = await apiClient.put(`/agents/${id}`, data);
    return response.data;
  },
  
  deleteAgent: async (id: number) => {
    const response = await apiClient.delete(`/agents/${id}`);
    return response.data;
  },
};

// ==================== 平台配置（服务器端） ====================

export interface Platform {
  id: number;
  platform_id: string;
  platform_name: string;
  icon_url: string;
  is_enabled: boolean;
  adapter_class: string;
  required_fields: string[];
  config_schema?: any;
}

export const remotePlatformApi = {
  getPlatforms: async (): Promise<Platform[]> => {
    const response = await apiClient.get('/publishing/platforms');
    return response.data.data;
  },
  
  getPlatform: async (platformId: string): Promise<Platform> => {
    const response = await apiClient.get(`/publishing/platforms/${platformId}`);
    return response.data.data;
  },
};

// ==================== 转化目标（服务器端） ====================

export interface ConversionTarget {
  id: number;
  companyName: string;
  industry?: string;
  companySize?: string;
  features?: string;
  contactInfo?: string;
  website?: string;
  targetAudience?: string;
  coreProducts?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export const remoteConversionTargetApi = {
  getList: async (params: { page?: number; pageSize?: number; search?: string }) => {
    const response = await apiClient.get('/conversion-targets', { params });
    return response.data;
  },
  
  get: async (id: number): Promise<ConversionTarget> => {
    const response = await apiClient.get(`/conversion-targets/${id}`);
    return response.data.data;
  },
  
  create: async (data: Partial<ConversionTarget>) => {
    const response = await apiClient.post('/conversion-targets', data);
    return response.data;
  },
  
  update: async (id: number, data: Partial<ConversionTarget>) => {
    const response = await apiClient.put(`/conversion-targets/${id}`, data);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await apiClient.delete(`/conversion-targets/${id}`);
    return response.data;
  },
};

// ==================== 文章设置（服务器端） ====================

export interface ArticleSetting {
  id: number;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

export const remoteArticleSettingApi = {
  getList: async () => {
    const response = await apiClient.get('/article-settings');
    return response.data;
  },
  
  get: async (id: number): Promise<ArticleSetting> => {
    const response = await apiClient.get(`/article-settings/${id}`);
    return response.data.data;
  },
  
  create: async (data: { name: string; prompt: string }) => {
    const response = await apiClient.post('/article-settings', data);
    return response.data;
  },
  
  update: async (id: number, data: { name?: string; prompt?: string }) => {
    const response = await apiClient.put(`/article-settings/${id}`, data);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await apiClient.delete(`/article-settings/${id}`);
    return response.data;
  },
};

// ==================== 蒸馏配置（服务器端） ====================

export interface DistillationConfig {
  id: number;
  prompt: string;
  topicCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const remoteDistillationConfigApi = {
  get: async (): Promise<DistillationConfig> => {
    const response = await apiClient.get('/distillation-config');
    return response.data.data;
  },
  
  update: async (data: { prompt?: string; topicCount?: number }) => {
    const response = await apiClient.put('/distillation-config', data);
    return response.data;
  },
};
