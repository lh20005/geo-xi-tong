import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import log from 'electron-log';
import { storageManager } from '../storage/manager';
import FormData from 'form-data';
import fs from 'fs';

/**
 * API客户端
 * 实现HTTP请求封装、认证Token管理、自动刷新和错误处理
 * Requirements: 4.2, 4.8, 11.2
 */

// API响应类型
interface AuthResponse {
  authToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: {
    id: number;
    username: string;
    email?: string;
    role: string;
  };
}

interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string;
  credentials?: any;
  is_default: boolean;
  status: 'active' | 'inactive' | 'expired';
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
}

interface Platform {
  platform_id: string;
  platform_name: string;
  icon_url?: string;
  login_url: string;
  selectors: {
    username: string[];
    loginSuccess: string[];
  };
  enabled: boolean;
}

interface CreateAccountInput {
  platform_id: string;
  account_name: string;
  real_username?: string;
  credentials?: any;
  is_default?: boolean;
}

interface UpdateAccountInput {
  account_name?: string;
  real_username?: string;
  credentials?: any;
  is_default?: boolean;
  status?: 'active' | 'inactive' | 'expired';
}

class APIClient {
  private static instance: APIClient;
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  private constructor() {
    // 创建axios实例
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 设置请求拦截器
    this.setupRequestInterceptor();
    
    // 设置响应拦截器
    this.setupResponseInterceptor();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  /**
   * 设置基础URL
   */
  async setBaseURL(url: string): Promise<void> {
    // 验证URL是否使用HTTPS（生产环境）
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      log.warn('API URL should use HTTPS in production');
    }
    
    this.axiosInstance.defaults.baseURL = url;
    log.info(`API base URL set to: ${url}`);
  }

  /**
   * 设置请求拦截器
   * Requirements: 4.2, 11.2
   */
  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // 获取Token
        const tokens = await storageManager.getTokens();
        
        if (tokens && tokens.authToken) {
          // 添加Authorization header
          config.headers.Authorization = `Bearer ${tokens.authToken}`;
        }

        // 确保使用HTTPS（生产环境）
        if (config.baseURL && !config.baseURL.startsWith('https://') && 
            !config.baseURL.includes('localhost')) {
          log.warn('Request not using HTTPS:', config.url);
        }

        log.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        log.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 设置响应拦截器
   * Requirements: 4.8
   */
  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => {
        log.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // 处理401错误（Token过期）
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // 如果正在刷新Token，等待刷新完成
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                resolve(this.axiosInstance(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            // 尝试刷新Token
            const newTokens = await this.refreshToken();
            
            if (newTokens) {
              // 更新请求头
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newTokens.authToken}`;
              }

              // 通知所有等待的请求
              this.refreshSubscribers.forEach((callback) => callback(newTokens.authToken));
              this.refreshSubscribers = [];

              // 重试原始请求
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            log.error('Token refresh failed:', refreshError);
            // 清除Token
            await storageManager.clearTokens();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // 记录错误
        log.error('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });

        return Promise.reject(error);
      }
    );
  }

  /**
   * 登录
   * Requirements: 6.2
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.axiosInstance.post('/api/auth/login', {
        username,
        password,
      });

      // 服务端返回格式: { success: true, data: { token, refreshToken, expiresIn, user } }
      const { token, refreshToken, expiresIn, user } = response.data.data;

      // 保存Token
      await storageManager.saveTokens({
        authToken: token,
        refreshToken: refreshToken
      });

      log.info('Login successful');
      return {
        authToken: token,
        refreshToken,
        expiresIn,
        user
      };
    } catch (error) {
      log.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * 刷新Token
   * Requirements: 4.8, 6.3
   */
  async refreshToken(): Promise<AuthResponse | null> {
    try {
      const tokens = await storageManager.getTokens();
      
      if (!tokens || !tokens.refreshToken) {
        log.warn('No refresh token available');
        return null;
      }

      const response = await this.axiosInstance.post('/api/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });

      // 服务端返回格式: { success: true, data: { token, expiresIn } }
      const { token, expiresIn } = response.data.data;

      // 保存新Token
      await storageManager.saveTokens({
        authToken: token,
        refreshToken: tokens.refreshToken // 保持原有的refreshToken
      });

      log.info('Token refreshed successfully');
      return {
        authToken: token,
        refreshToken: tokens.refreshToken,
        expiresIn
      };
    } catch (error) {
      log.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * 登出
   * Requirements: 6.3
   */
  async logout(): Promise<void> {
    try {
      await this.axiosInstance.post('/api/auth/logout');
      await storageManager.clearTokens();
      log.info('Logout successful');
    } catch (error) {
      log.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * 创建账号
   * Requirements: 6.1, 12.1
   */
  async createAccount(account: CreateAccountInput): Promise<Account> {
    try {
      const response = await this.axiosInstance.post<{ success: boolean; data: Account; message?: string; isNew?: boolean }>('/api/publishing/accounts', account);
      log.info(`Account ${response.data.isNew ? 'created' : 'updated'}: ${account.platform_id}`);
      return response.data.data;
    } catch (error) {
      log.error('Failed to create account:', error);
      throw error;
    }
  }

  /**
   * 更新账号
   * Requirements: 6.1, 12.1
   */
  async updateAccount(accountId: number, account: UpdateAccountInput): Promise<Account> {
    try {
      const response = await this.axiosInstance.put<{ success: boolean; data: Account; message?: string }>(
        `/api/publishing/accounts/${accountId}`,
        account
      );
      log.info(`Account updated: ${accountId}`);
      return response.data.data;
    } catch (error) {
      log.error('Failed to update account:', error);
      throw error;
    }
  }

  /**
   * 删除账号
   * Requirements: 6.1, 12.1
   */
  async deleteAccount(accountId: number): Promise<void> {
    try {
      await this.axiosInstance.delete(`/api/publishing/accounts/${accountId}`);
      log.info(`Account deleted: ${accountId}`);
    } catch (error) {
      log.error('Failed to delete account:', error);
      throw error;
    }
  }

  /**
   * 获取所有账号
   * Requirements: 6.1, 12.1
   */
  async getAccounts(): Promise<Account[]> {
    try {
      const response = await this.axiosInstance.get<{ success: boolean; data: Account[] }>('/api/publishing/accounts');
      log.info(`Retrieved ${response.data.data.length} accounts`);
      return response.data.data;
    } catch (error) {
      log.error('Failed to get accounts:', error);
      throw error;
    }
  }

  /**
   * 获取单个账号
   * Requirements: 6.1, 12.1
   */
  async getAccount(accountId: number, includeCredentials: boolean = false): Promise<Account> {
    try {
      const url = includeCredentials 
        ? `/api/publishing/accounts/${accountId}?includeCredentials=true`
        : `/api/publishing/accounts/${accountId}`;
      const response = await this.axiosInstance.get<{ success: boolean; data: Account }>(url);
      return response.data.data;
    } catch (error) {
      log.error('Failed to get account:', error);
      throw error;
    }
  }

  /**
   * 设置默认账号
   * Requirements: 6.1, 12.1
   */
  async setDefaultAccount(platformId: string, accountId: number): Promise<void> {
    try {
      await this.axiosInstance.post(`/api/publishing/accounts/${accountId}/set-default`, {
        platform_id: platformId,
      });
      log.info(`Set default account: ${accountId} for platform: ${platformId}`);
    } catch (error) {
      log.error('Failed to set default account:', error);
      throw error;
    }
  }

  /**
   * 获取平台列表
   * Requirements: 1.5, 12.3
   */
  async getPlatforms(): Promise<Platform[]> {
    try {
      const response = await this.axiosInstance.get<Platform[]>('/api/platforms');
      log.info(`Retrieved ${response.data.length} platforms`);
      return response.data;
    } catch (error) {
      log.error('Failed to get platforms:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async getHealth(): Promise<{ status: string; message?: string }> {
    const response = await this.axiosInstance.get<{ status: string; message?: string }>('/api/health');
    return response.data;
  }

  /**
   * Dashboard: 获取所有工作台数据（并行）
   */
  async getDashboardAllData(params?: { startDate?: string; endDate?: string }): Promise<{
    metrics: any;
    trends: any;
    platformDistribution: any;
    publishingStatus: any;
    resourceUsage: any;
    generationTasks: any;
    topResources: any;
    articleStats: any;
    keywordDistribution: any;
    monthlyComparison: any;
    hourlyActivity: any;
    successRates: any;
  }> {
    const [
      metrics,
      trends,
      platformDistribution,
      publishingStatus,
      resourceUsage,
      generationTasks,
      topResources,
      articleStats,
      keywordDistribution,
      monthlyComparison,
      hourlyActivity,
      successRates,
    ] = await Promise.all([
      this.axiosInstance.get('/api/dashboard/metrics', { params }).then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/trends', { params }).then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/platform-distribution', { params }).then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/publishing-status', { params }).then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/resource-usage', { params }).then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/generation-tasks', { params }).then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/top-resources', { params }).then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/article-stats').then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/keyword-distribution').then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/monthly-comparison').then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/hourly-activity').then((r) => r.data),
      this.axiosInstance.get('/api/dashboard/success-rates').then((r) => r.data),
    ]);

    return {
      metrics,
      trends,
      platformDistribution,
      publishingStatus,
      resourceUsage,
      generationTasks,
      topResources,
      articleStats,
      keywordDistribution,
      monthlyComparison,
      hourlyActivity,
      successRates,
    };
  }

  /**
   * Conversion Targets: 列表
   */
  async getConversionTargets(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> {
    const response = await this.axiosInstance.get('/api/conversion-targets', { params });
    return response.data;
  }

  /**
   * Conversion Targets: 创建
   */
  async createConversionTarget(data: {
    companyName: string;
    industry?: string;
    website?: string;
    address?: string;
  }): Promise<any> {
    const response = await this.axiosInstance.post('/api/conversion-targets', data);
    return response.data;
  }

  /**
   * Conversion Targets: 更新
   */
  async updateConversionTarget(
    id: number,
    data: { companyName?: string; industry?: string; website?: string; address?: string }
  ): Promise<any> {
    const response = await this.axiosInstance.patch(`/api/conversion-targets/${id}`, data);
    return response.data;
  }

  /**
   * Conversion Targets: 删除
   */
  async deleteConversionTarget(id: number): Promise<any> {
    const response = await this.axiosInstance.delete(`/api/conversion-targets/${id}`);
    return response.data;
  }

  /**
   * Conversion Targets: 详情
   */
  async getConversionTarget(id: number): Promise<any> {
    const response = await this.axiosInstance.get(`/api/conversion-targets/${id}`);
    return response.data;
  }

  /**
   * Knowledge Base: 列表
   */
  async getKnowledgeBases(): Promise<any> {
    const response = await this.axiosInstance.get('/api/knowledge-bases');
    return response.data;
  }

  /**
   * Knowledge Base: 详情
   */
  async getKnowledgeBase(id: number): Promise<any> {
    const response = await this.axiosInstance.get(`/api/knowledge-bases/${id}`);
    return response.data;
  }

  /**
   * Knowledge Base: 创建
   */
  async createKnowledgeBase(data: { name: string; description?: string }): Promise<any> {
    const response = await this.axiosInstance.post('/api/knowledge-bases', data);
    return response.data;
  }

  /**
   * Knowledge Base: 更新
   */
  async updateKnowledgeBase(id: number, data: { name?: string; description?: string }): Promise<any> {
    const response = await this.axiosInstance.patch(`/api/knowledge-bases/${id}`, data);
    return response.data;
  }

  /**
   * Knowledge Base: 删除
   */
  async deleteKnowledgeBase(id: number): Promise<any> {
    const response = await this.axiosInstance.delete(`/api/knowledge-bases/${id}`);
    return response.data;
  }

  /**
   * Knowledge Base: 上传文档
   */
  async uploadKnowledgeBaseDocuments(id: number, files: any[]): Promise<any> {
    const formData = new FormData();
    
    // 使用文件流添加文件到 FormData
    files.forEach((fileData) => {
      const fileStream = fs.createReadStream(fileData.path);
      formData.append('files', fileStream, {
        filename: fileData.name,
        contentType: fileData.type || 'application/octet-stream'
      });
    });
    
    const response = await this.axiosInstance.post(`/api/knowledge-bases/${id}/documents`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return response.data;
  }

  /**
   * Knowledge Base: 获取文档详情
   */
  async getKnowledgeBaseDocument(docId: number): Promise<any> {
    const response = await this.axiosInstance.get(`/api/knowledge-bases/documents/${docId}`);
    return response.data;
  }

  /**
   * Knowledge Base: 删除文档
   */
  async deleteKnowledgeBaseDocument(docId: number): Promise<any> {
    const response = await this.axiosInstance.delete(`/api/knowledge-bases/documents/${docId}`);
    return response.data;
  }

  /**
   * Knowledge Base: 搜索文档
   */
  async searchKnowledgeBaseDocuments(id: number, query: string): Promise<any> {
    const response = await this.axiosInstance.get(`/api/knowledge-bases/${id}/documents/search`, {
      params: { query }
    });
    return response.data;
  }

  // ==================== 配额预扣减 API ====================

  /**
   * 预扣减配额
   * Requirements: 改造方案 - 配额预扣减机制
   */
  async reserveQuota(params: {
    quotaType: 'article_generation' | 'publish' | 'knowledge_upload' | 'image_upload';
    amount?: number;
    clientId?: string;
    taskInfo?: object;
  }): Promise<{
    success: boolean;
    reservationId?: string;
    expiresAt?: string;
    remainingQuota?: number;
    error?: string;
    errorCode?: string;
    currentQuota?: number;
  }> {
    try {
      const response = await this.axiosInstance.post('/api/quota/reserve', params);
      log.info(`Quota reserved: ${params.quotaType}, reservationId: ${response.data.reservationId}`);
      return response.data;
    } catch (error: any) {
      log.error('Failed to reserve quota:', error);
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * 确认消费配额
   * Requirements: 改造方案 - 配额预扣减机制
   */
  async confirmQuota(params: {
    reservationId: string;
    result?: object;
  }): Promise<{
    success: boolean;
    consumed?: number;
    remainingQuota?: number;
    error?: string;
    errorCode?: string;
  }> {
    try {
      const response = await this.axiosInstance.post('/api/quota/confirm', params);
      log.info(`Quota confirmed: ${params.reservationId}`);
      return response.data;
    } catch (error: any) {
      log.error('Failed to confirm quota:', error);
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * 释放预留配额
   * Requirements: 改造方案 - 配额预扣减机制
   */
  async releaseQuota(params: {
    reservationId: string;
    reason?: string;
    errorCode?: string;
  }): Promise<{
    success: boolean;
    released?: number;
    remainingQuota?: number;
    error?: string;
  }> {
    try {
      const response = await this.axiosInstance.post('/api/quota/release', params);
      log.info(`Quota released: ${params.reservationId}`);
      return response.data;
    } catch (error: any) {
      log.error('Failed to release quota:', error);
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * 获取配额信息（包含预留）
   * Requirements: 改造方案 - 配额预扣减机制
   */
  async getQuotaInfo(): Promise<{
    quotas: {
      [key: string]: {
        used: number;
        limit: number;
        reserved: number;
        available: number;
      };
    };
  }> {
    try {
      const response = await this.axiosInstance.get('/api/quota/info');
      return response.data;
    } catch (error) {
      log.error('Failed to get quota info:', error);
      throw error;
    }
  }

  // ==================== 分析上报 API ====================

  /**
   * 上报发布结果
   * Requirements: 改造方案 - 分析上报功能
   */
  async reportPublish(report: {
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
  }): Promise<{ success: boolean }> {
    try {
      const response = await this.axiosInstance.post('/api/analytics/publish-report', report);
      log.debug(`Publish report sent: ${report.taskId}`);
      return response.data;
    } catch (error) {
      log.error('Failed to report publish:', error);
      // 不抛出错误，分析上报失败不应影响主流程
      return { success: false };
    }
  }

  /**
   * 批量上报发布结果
   * Requirements: 改造方案 - 分析上报功能（离线队列）
   */
  async reportPublishBatch(reports: Array<{
    taskId: string;
    platform: string;
    status: 'success' | 'failed';
    duration: number;
    errorCode?: string;
    errorMessage?: string;
    metadata?: object;
  }>): Promise<{ success: boolean; processed?: number }> {
    try {
      const response = await this.axiosInstance.post('/api/analytics/publish-report/batch', { reports });
      log.info(`Batch publish report sent: ${reports.length} reports`);
      return response.data;
    } catch (error) {
      log.error('Failed to batch report publish:', error);
      return { success: false };
    }
  }

  // ==================== 数据同步 API ====================

  /**
   * 上传数据快照
   * Requirements: 改造方案 - 数据同步功能
   */
  async uploadSnapshot(file: Buffer, checksum: string, metadata: object): Promise<{
    success: boolean;
    snapshotId?: string;
    uploadedAt?: string;
    deletedOldSnapshots?: number;
    remainingSnapshots?: number;
    error?: string;
  }> {
    try {
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('snapshot', file, { filename: 'snapshot.db' });
      formData.append('checksum', checksum);
      formData.append('metadata', JSON.stringify(metadata));

      const response = await this.axiosInstance.post('/api/sync/upload', formData, {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      log.info('Snapshot uploaded successfully');
      return response.data;
    } catch (error: any) {
      log.error('Failed to upload snapshot:', error);
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * 获取快照列表
   * Requirements: 改造方案 - 数据同步功能
   */
  async getSnapshots(): Promise<{
    snapshots: Array<{
      id: string;
      metadata: object;
      uploadedAt: string;
      lastDownloadedAt?: string;
      expiresAt: string;
      size: number;
    }>;
    maxSnapshots: number;
    maxSizeBytes: number;
  }> {
    try {
      const response = await this.axiosInstance.get('/api/sync/snapshots');
      return response.data;
    } catch (error) {
      log.error('Failed to get snapshots:', error);
      throw error;
    }
  }

  /**
   * 下载快照
   * Requirements: 改造方案 - 数据同步功能
   */
  async downloadSnapshot(snapshotId: string): Promise<Buffer> {
    try {
      const response = await this.axiosInstance.get(`/api/sync/download/${snapshotId}`, {
        responseType: 'arraybuffer'
      });
      log.info(`Snapshot downloaded: ${snapshotId}`);
      return Buffer.from(response.data);
    } catch (error) {
      log.error('Failed to download snapshot:', error);
      throw error;
    }
  }

  /**
   * 删除快照
   * Requirements: 改造方案 - 数据同步功能
   */
  async deleteSnapshot(snapshotId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.axiosInstance.delete(`/api/sync/snapshots/${snapshotId}`);
      log.info(`Snapshot deleted: ${snapshotId}`);
      return response.data;
    } catch (error) {
      log.error('Failed to delete snapshot:', error);
      throw error;
    }
  }

  // ==================== 适配器版本 API ====================

  /**
   * 获取适配器版本列表
   * Requirements: 改造方案 - 适配器热更新
   */
  async getAdapterVersions(): Promise<{
    adapters: {
      [platform: string]: {
        version: string;
        updatedAt: string;
      };
    };
    minClientVersion: string;
  }> {
    try {
      const response = await this.axiosInstance.get('/api/adapters/versions');
      return response.data;
    } catch (error) {
      log.error('Failed to get adapter versions:', error);
      throw error;
    }
  }

  /**
   * 下载适配器代码
   * Requirements: 改造方案 - 适配器热更新
   */
  async downloadAdapter(platform: string): Promise<string> {
    try {
      const response = await this.axiosInstance.get(`/api/adapters/${platform}/download`);
      log.info(`Adapter downloaded: ${platform}`);
      return response.data.code;
    } catch (error) {
      log.error('Failed to download adapter:', error);
      throw error;
    }
  }

  /**
   * 带重试的请求
   * Requirements: 4.4
   */
  async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          log.warn(`Request failed, retrying (${attempt + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError!;
  }
}

// 导出单例实例
export const apiClient = APIClient.getInstance();
export {
  APIClient,
  AuthResponse,
  Account,
  Platform,
  CreateAccountInput,
  UpdateAccountInput,
};
