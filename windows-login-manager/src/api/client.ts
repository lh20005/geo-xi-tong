import axios, { AxiosInstance, AxiosError } from 'axios';

// 获取 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * 统一的 API 客户端
 * 所有 API 请求都应该通过这个客户端进行
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器 - 自动添加认证token
 */
apiClient.interceptors.request.use(
  async (config) => {
    // 在 Electron 环境中，使用 IPC 获取 token
    if (window.electron) {
      try {
        const tokens = await window.electron.storage.getTokens();
        console.log('[API Client] 获取到的 tokens:', tokens ? '存在' : '不存在');
        if (tokens?.authToken) {
          config.headers.Authorization = `Bearer ${tokens.authToken}`;
          console.log('[API Client] 已添加 Authorization header');
        } else {
          console.warn('[API Client] 没有找到 authToken');
        }
      } catch (error) {
        console.error('[API Client] 获取 token 失败:', error);
      }
    } else {
      // 降级到 localStorage（开发环境）
      const token = localStorage.getItem('auth_token');
      console.log('[API Client] localStorage token:', token ? '存在' : '不存在');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    console.log('[API Client] 请求配置:', {
      url: config.url,
      method: config.method,
      hasAuth: !!config.headers.Authorization
    });
    
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 响应拦截器 - 统一错误处理和token刷新
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; details?: string }>) => {
    const originalRequest = error.config as any;
    
    // 处理401错误（token过期）
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // 在 Electron 环境中处理 token 刷新
      if (window.electron) {
        try {
          console.log('[Auth] Access token 过期，尝试刷新...');
          const tokens = await window.electron.storage.getTokens();
          
          if (tokens?.refreshToken) {
            const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { 
              refreshToken: tokens.refreshToken 
            });
            
            if (response.data.success) {
              const newToken = response.data.data.token;
              
              // 保存新 token
              await window.electron.storage.saveTokens({
                authToken: newToken,
                refreshToken: tokens.refreshToken
              });
              
              console.log('[Auth] Token 刷新成功，重试原始请求');
              
              // 重试原始请求
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return apiClient.request(originalRequest);
            } else {
              throw new Error('Token 刷新失败');
            }
          } else {
            throw new Error('没有 refresh token');
          }
        } catch (refreshError: any) {
          console.error('[Auth] Token 刷新失败:', refreshError.response?.data?.message || refreshError.message);
          
          // 刷新失败，清除所有认证信息并通知主进程
          await window.electron.storage.clearTokens();
          
          // 触发登出事件（让 App.tsx 处理）
          window.dispatchEvent(new CustomEvent('auth:logout', { 
            detail: { message: '登录已过期，请重新登录' } 
          }));
          
          return Promise.reject(new Error('登录已过期，请重新登录'));
        }
      } else {
        // 降级到 localStorage（开发环境）
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            console.log('[Auth] Access token 过期，尝试刷新...');
            const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
            
            if (response.data.success) {
              const newToken = response.data.data.token;
              localStorage.setItem('auth_token', newToken);
              
              console.log('[Auth] Token 刷新成功，重试原始请求');
              
              // 重试原始请求
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return apiClient.request(originalRequest);
            } else {
              throw new Error('Token 刷新失败');
            }
          } catch (refreshError: any) {
            console.error('[Auth] Token 刷新失败:', refreshError.response?.data?.message || refreshError.message);
            localStorage.clear();
            return Promise.reject(new Error('登录已过期，请重新登录'));
          }
        } else {
          localStorage.clear();
          return Promise.reject(new Error('请先登录'));
        }
      }
    }
    
    // 提取错误消息
    const message = 
      error.response?.data?.error || 
      error.message || 
      '请求失败';
    
    // 返回统一的 Error 对象
    return Promise.reject(new Error(message));
  }
);
