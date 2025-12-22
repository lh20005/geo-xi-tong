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

  async checkAuth(): Promise<{ isAuthenticated: boolean }> {
    return await this.api.checkAuth();
  }

  // 平台登录
  async loginPlatform(platformId: string): Promise<any> {
    return await this.api.loginPlatform(platformId);
  }

  async cancelLogin(): Promise<any> {
    return await this.api.cancelLogin();
  }

  async getLoginStatus(): Promise<{ isLoggingIn: boolean }> {
    return await this.api.getLoginStatus();
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
