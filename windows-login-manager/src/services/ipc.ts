/**
 * IPC Bridge Service
 * 封装所有IPC调用，提供类型安全的接口
 */

class IPCBridge {
  private api = window.electronAPI;

  // 系统登录
  async login(username: string, password: string): Promise<any> {
    return await this.api.login(username, password);
  }

  async logout(): Promise<any> {
    return await this.api.logout();
  }

  async checkAuth(): Promise<{ isAuthenticated: boolean; user?: any }> {
    return await this.api.checkAuth();
  }

  // 平台登录
  async loginPlatform(platformId: string): Promise<any> {
    return await this.api.loginPlatform(platformId);
  }

  async cancelLogin(platformId?: string): Promise<any> {
    return await this.api.cancelLogin(platformId);
  }

  async getLoginStatus(): Promise<{ isLoggingIn: boolean }> {
    return await this.api.getLoginStatus();
  }

  // 测试账号登录
  async testAccountLogin(accountId: string | number): Promise<{ success: boolean; message?: string }> {
    const resolvedId = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;
    return await this.api.testAccountLogin(resolvedId);
  }

  // 平台列表
  async getPlatforms(): Promise<any[]> {
    return await this.api.getPlatforms();
  }

  // 服务连通性
  async checkServerHealth(): Promise<{ status: string; message?: string }> {
    return await this.api.checkServerHealth();
  }

  // Dashboard
  async getDashboardAllData(params?: { startDate?: string; endDate?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.getDashboardAllData(params);
  }

  // 转化目标
  async getConversionTargets(params: { page?: number; pageSize?: number; search?: string; sortField?: string; sortOrder?: 'asc' | 'desc' }): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.getConversionTargets(params);
  }

  async createConversionTarget(payload: { companyName: string; industry?: string; website?: string; address?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.createConversionTarget(payload);
  }

  async updateConversionTarget(id: number, payload: { companyName?: string; industry?: string; website?: string; address?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.updateConversionTarget(id, payload);
  }

  async deleteConversionTarget(id: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.deleteConversionTarget(id);
  }

  async getConversionTarget(id: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.getConversionTarget(id);
  }

  // 知识库管理
  async getKnowledgeBases(): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.getKnowledgeBases();
  }

  async getKnowledgeBase(id: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.getKnowledgeBase(id);
  }

  async createKnowledgeBase(payload: { name: string; description?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.createKnowledgeBase(payload);
  }

  async updateKnowledgeBase(id: number, payload: { name?: string; description?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.updateKnowledgeBase(id, payload);
  }

  async deleteKnowledgeBase(id: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.deleteKnowledgeBase(id);
  }

  async uploadKnowledgeBaseDocuments(id: number, files: any[]): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.uploadKnowledgeBaseDocuments(id, files);
  }

  async getKnowledgeBaseDocument(docId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.getKnowledgeBaseDocument(docId);
  }

  async deleteKnowledgeBaseDocument(docId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.deleteKnowledgeBaseDocument(docId);
  }

  async searchKnowledgeBaseDocuments(id: number, query: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.api.searchKnowledgeBaseDocuments(id, query);
  }

  onAccountEvent(callback: (event: any) => void): () => void {
    return this.api.onAccountEvent(callback);
  }

  // 账号管理
  async getAccounts(): Promise<any[]> {
    return await this.api.getAccounts();
  }

  async deleteAccount(accountId: number): Promise<any> {
    return await this.api.deleteAccount(accountId);
  }

  async setDefaultAccount(platformId: string, accountId: number): Promise<any> {
    return await this.api.setDefaultAccount(platformId, accountId);
  }

  async refreshAccounts(): Promise<any[]> {
    return await this.api.refreshAccounts();
  }

  // 配置管理
  async getConfig(): Promise<any> {
    return await this.api.getConfig();
  }

  async setConfig(config: any): Promise<any> {
    return await this.api.setConfig(config);
  }

  async clearCache(): Promise<any> {
    return await this.api.clearCache();
  }

  async clearAllData(): Promise<any> {
    return await this.api.clearAllData();
  }

  // 日志管理
  async getLogs(): Promise<string[]> {
    return await this.api.getLogs();
  }

  async exportLogs(): Promise<string> {
    return await this.api.exportLogs();
  }

  async clearLogs(): Promise<any> {
    return await this.api.clearLogs();
  }

  // 同步管理
  async getSyncStatus(): Promise<any> {
    return await this.api.getSyncStatus();
  }

  async triggerSync(): Promise<any> {
    return await this.api.triggerSync();
  }

  async clearSyncQueue(): Promise<any> {
    return await this.api.clearSyncQueue();
  }
}

export const ipcBridge = new IPCBridge();
export default ipcBridge;
