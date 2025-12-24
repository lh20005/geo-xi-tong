import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';
import type { 
  RegistrationData, 
  LoginData, 
  AuthResponse, 
  InvitationStats,
  User,
  UserListResponse
} from '../types/user';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器 - 添加 token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // 响应拦截器 - 处理错误
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token 过期，尝试刷新
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const response = await axios.post(`${config.apiUrl}/auth/refresh`, {
                refreshToken,
              });
              
              if (response.data.success) {
                localStorage.setItem('auth_token', response.data.data.token);
                // 重试原请求
                error.config.headers.Authorization = `Bearer ${response.data.data.token}`;
                return axios.request(error.config);
              }
            } catch (refreshError) {
              // 刷新失败，清除 token 并跳转到登录页
              localStorage.removeItem('auth_token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user_info');
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // 认证相关
  async register(data: RegistrationData): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', data);
    return response.data;
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', data);
    return response.data;
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refresh_token');
    await this.client.post('/auth/logout', { refreshToken });
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  }

  // 用户资料相关
  async getProfile(): Promise<{ success: boolean; data: User }> {
    const response = await this.client.get('/users/profile');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put('/users/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  // 邀请相关
  async getInvitationStats(): Promise<{ success: boolean; data: InvitationStats }> {
    const response = await this.client.get('/invitations/stats');
    return response.data;
  }

  async validateInvitationCode(invitationCode: string): Promise<{ 
    success: boolean; 
    data: { valid: boolean; inviterUsername?: string } 
  }> {
    const response = await this.client.post('/invitations/validate', { invitationCode });
    return response.data;
  }

  // 管理员相关
  async getUsers(page: number = 1, pageSize: number = 10, search?: string): Promise<UserListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (search) {
      params.append('search', search);
    }
    const response = await this.client.get(`/admin/users?${params.toString()}`);
    return response.data;
  }

  async getUserDetails(id: number): Promise<{ success: boolean; data: User }> {
    const response = await this.client.get(`/admin/users/${id}`);
    return response.data;
  }

  async updateUser(id: number, data: { username?: string; role?: 'admin' | 'user' }): Promise<{ 
    success: boolean; 
    data: User; 
    message: string 
  }> {
    const response = await this.client.put(`/admin/users/${id}`, data);
    return response.data;
  }

  async resetPassword(id: number): Promise<{ 
    success: boolean; 
    data: { temporaryPassword: string }; 
    message: string 
  }> {
    const response = await this.client.post(`/admin/users/${id}/reset-password`);
    return response.data;
  }

  async deleteUser(id: number): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/admin/users/${id}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
