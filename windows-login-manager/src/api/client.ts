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
    console.log('[API Client] 🔄 处理请求:', config.url);
    
    let token: string | null = null;
    
    // 方案1: 尝试从 Electron storage 获取
    if (window.electron) {
      try {
        console.log('[API Client] 📦 尝试从 Electron storage 获取 token...');
        const tokens = await window.electron.storage.getTokens();
        console.log('[API Client] Electron tokens:', tokens);
        
        if (tokens?.authToken) {
          token = tokens.authToken;
          console.log('[API Client] ✅ 从 Electron storage 获取到 token');
        } else {
          console.warn('[API Client] ⚠️ Electron storage 中没有 authToken');
        }
      } catch (error) {
        console.error('[API Client] ❌ Electron storage 获取失败:', error);
      }
    }
    
    // 方案2: 降级到 localStorage
    if (!token) {
      console.log('[API Client] 📦 尝试从 localStorage 获取 token...');
      token = localStorage.getItem('auth_token');
      if (token) {
        console.log('[API Client] ✅ 从 localStorage 获取到 token');
      } else {
        console.warn('[API Client] ⚠️ localStorage 中也没有 token');
      }
    }
    
    // 添加 Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[API Client] ✅ 已添加 Authorization header');
      console.log('[API Client] Token 预览:', token.substring(0, 20) + '...');
    } else {
      console.error('[API Client] ❌ 没有找到任何 token！');
    }
    
    console.log('[API Client] 📤 最终请求配置:', {
      url: config.url,
      method: config.method,
      hasAuth: !!config.headers.Authorization
    });
    
    return config;
  },
  (error) => {
    console.error('[API Client] ❌ 请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 用于防止多个请求同时刷新 token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * 响应拦截器 - 统一错误处理和token刷新
 */
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API Client] ✅ 响应成功:', response.config.url, response.status);
    return response;
  },
  async (error: AxiosError<{ error?: string; details?: string; message?: string }>) => {
    console.error('[API Client] ❌ 响应错误:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    
    const originalRequest = error.config as any;
    
    // 处理401错误（token过期）
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 如果是刷新接口本身返回 401，直接登出
      if (originalRequest.url?.includes('/auth/refresh')) {
        console.error('[API Client] ❌ Refresh token 已失效，需要重新登录');
        isRefreshing = false; // 重置刷新状态
        
        // 清除所有认证信息
        if (window.electron) {
          await window.electron.storage.clearTokens();
        }
        localStorage.clear();
        
        // 触发登出事件
        window.dispatchEvent(new CustomEvent('auth:logout', { 
          detail: { message: '登录已过期，请重新登录' } 
        }));
        
        return Promise.reject(new Error('登录已过期，请重新登录'));
      }
      
      // 如果正在刷新，将请求加入队列
      if (isRefreshing) {
        console.log('[API Client] 🔄 Token 刷新中，请求加入队列...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (!token) {
              // 如果刷新失败，直接拒绝
              return Promise.reject(new Error('Token 刷新失败'));
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient.request(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      console.log('[API Client] 🔄 检测到 401，尝试刷新 token...');
      
      // 尝试刷新 token
      try {
        let refreshToken: string | null = null;
        
        // 从 Electron storage 获取 refresh token
        if (window.electron) {
          const tokens = await window.electron.storage.getTokens();
          refreshToken = tokens?.refreshToken || null;
        }
        
        // 降级到 localStorage
        if (!refreshToken) {
          refreshToken = localStorage.getItem('refresh_token');
        }
        
        if (!refreshToken) {
          throw new Error('没有 refresh token');
        }
        
        console.log('[API Client] 🔄 使用 refresh token 刷新...');
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { 
          refreshToken 
        });
        
        if (response.data.success) {
          const newToken = response.data.data.token;
          console.log('[API Client] ✅ Token 刷新成功');
          
          // 保存新 token
          if (window.electron) {
            await window.electron.storage.saveTokens({
              authToken: newToken,
              refreshToken: refreshToken
            });
          }
          localStorage.setItem('auth_token', newToken);
          
          // 重置刷新状态
          isRefreshing = false;
          
          // 处理队列中的请求
          processQueue(null, newToken);
          
          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient.request(originalRequest);
        } else {
          throw new Error('Token 刷新失败');
        }
      } catch (refreshError: any) {
        console.error('[API Client] ❌ Token 刷新失败:', refreshError);
        
        // 重置刷新状态（关键！）
        isRefreshing = false;
        
        // 处理队列中的请求（传递 null 表示失败）
        processQueue(refreshError, null);
        
        // 清除所有认证信息
        if (window.electron) {
          await window.electron.storage.clearTokens();
        }
        localStorage.clear();
        
        // 触发登出事件
        window.dispatchEvent(new CustomEvent('auth:logout', { 
          detail: { message: '登录已过期，请重新登录' } 
        }));
        
        return Promise.reject(new Error('登录已过期，请重新登录'));
      }
    }
    
    // 提取错误消息
    const message = 
      error.response?.data?.error || 
      error.response?.data?.message ||
      error.message || 
      '请求失败';
    
    console.error('[API Client] 最终错误消息:', message);
    
    // 保留原始错误对象，但添加友好的消息
    const enhancedError = error as any;
    enhancedError.message = message;
    
    // 返回原始错误对象（保留 response 属性）
    return Promise.reject(enhancedError);
  }
);
