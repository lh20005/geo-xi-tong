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
 * 请求拦截器 - 自动添加认证token
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
      
      // 尝试刷新token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const newToken = response.data.data.token;
          localStorage.setItem('auth_token', newToken);
          
          console.log('[Auth] Token刷新成功');
          
          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient.request(originalRequest);
        } catch (refreshError) {
          console.error('[Auth] Token刷新失败:', refreshError);
          // 刷新失败，清除token并跳转到登录页
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_info');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // 没有refreshToken，跳转到登录页
        console.log('[Auth] 没有refresh token，跳转到登录页');
        localStorage.clear();
        window.location.href = '/login';
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
