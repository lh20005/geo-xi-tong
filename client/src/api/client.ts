import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * 统一的 API 客户端
 * 所有 API 请求都应该通过这个客户端进行
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 响应拦截器 - 统一错误处理
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; details?: string }>) => {
    // 提取错误消息
    const message = 
      error.response?.data?.error || 
      error.message || 
      '请求失败';
    
    // 返回统一的 Error 对象
    return Promise.reject(new Error(message));
  }
);
