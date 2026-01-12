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
          console.log('[Auth] Access token 过期，尝试刷新...');
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          
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
          
          // 刷新失败，清除所有认证信息
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_info');
          
          // 显示友好提示
          const message = refreshError.response?.data?.message || '登录已过期，请重新登录';
          
          // 使用 setTimeout 确保在当前请求完成后再跳转
          setTimeout(() => {
            // 跳转到落地页登录页面（空字符串时使用当前域名）
            const landingUrl = import.meta.env.VITE_LANDING_URL || window.location.origin;
            window.location.href = `${landingUrl}/login?expired=true&message=${encodeURIComponent(message)}`;
          }, 100);
          
          return Promise.reject(new Error(message));
        }
      } else {
        // 没有refreshToken，清除并跳转到登录页
        console.log('[Auth] 没有 refresh token，跳转到登录页');
        localStorage.clear();
        
        setTimeout(() => {
          const landingUrl = import.meta.env.VITE_LANDING_URL || window.location.origin;
          window.location.href = `${landingUrl}/login?expired=true&message=${encodeURIComponent('请先登录')}`;
        }, 100);
        
        return Promise.reject(new Error('请先登录'));
      }
    }
    
    // 提取错误消息
    const message = 
      error.response?.data?.error || 
      error.message || 
      '请求失败';
    
    // 保留原始错误对象，但添加友好的消息
    const enhancedError = error as any;
    enhancedError.message = message;
    
    // 返回原始错误对象（保留 response 属性）
    return Promise.reject(enhancedError);
  }
);
