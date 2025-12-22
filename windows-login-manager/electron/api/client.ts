import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import log from 'electron-log';
import { storageManager } from '../storage/manager';

/**
 * API客户端
 * 实现HTTP请求封装、认证Token管理、自动刷新和错误处理
 * Requirements: 4.2, 4.8, 11.2
 */

// API响应类型
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
        
        if (tokens && tokens.accessToken) {
          // 添加Authorization header
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
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
                originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              }

              // 通知所有等待的请求
              this.refreshSubscribers.forEach((callback) => callback(newTokens.accessToken));
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
      const { token, refreshToken, expiresIn } = response.data.data;

      // 保存Token
      await storageManager.saveTokens(
        token,
        refreshToken,
        expiresIn
      );

      log.info('Login successful');
      return {
        accessToken: token,
        refreshToken,
        expiresIn
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
      await storageManager.saveTokens(
        token,
        tokens.refreshToken, // 保持原有的refreshToken
        expiresIn
      );

      log.info('Token refreshed successfully');
      return {
        accessToken: token,
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
  async getAccount(accountId: number): Promise<Account> {
    try {
      const response = await this.axiosInstance.get<{ success: boolean; data: Account }>(`/api/publishing/accounts/${accountId}`);
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
