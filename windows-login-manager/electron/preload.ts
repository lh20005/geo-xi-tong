import { contextBridge, ipcRenderer } from 'electron';

// 定义暴露给渲染进程的API类型
export interface ElectronAPI {
  // 系统登录
  login: (username: string, password: string) => Promise<any>;
  logout: () => Promise<any>;
  checkAuth: () => Promise<{ isAuthenticated: boolean }>;
  
  // 平台登录
  loginPlatform: (platformId: string) => Promise<any>;
  cancelLogin: () => Promise<any>;
  getLoginStatus: () => Promise<{ isLoggingIn: boolean }>;
  
  // 账号管理
  getAccounts: () => Promise<any[]>;
  deleteAccount: (accountId: number) => Promise<any>;
  setDefaultAccount: (platformId: string, accountId: number) => Promise<any>;
  refreshAccounts: () => Promise<any[]>;
  
  // 配置管理
  getConfig: () => Promise<any>;
  setConfig: (config: any) => Promise<any>;
  clearCache: () => Promise<any>;
  clearAllData: () => Promise<any>;
  
  // 日志管理
  getLogs: () => Promise<string[]>;
  exportLogs: () => Promise<string>;
  clearLogs: () => Promise<any>;
  
  // 同步管理
  getSyncStatus: () => Promise<any>;
  triggerSync: () => Promise<any>;
  clearSyncQueue: () => Promise<any>;
  
  // WebSocket管理
  getWebSocketStatus: () => Promise<any>;
  reconnectWebSocket: () => Promise<any>;
  onAccountEvent: (callback: (event: any) => void) => () => void;
}

// 通过contextBridge安全地暴露API
contextBridge.exposeInMainWorld('electronAPI', {
  // 系统登录
  login: (username: string, password: string) =>
    ipcRenderer.invoke('login', username, password),
  logout: () => ipcRenderer.invoke('logout'),
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  
  // 平台登录
  loginPlatform: (platformId: string) =>
    ipcRenderer.invoke('login-platform', platformId),
  cancelLogin: () => ipcRenderer.invoke('cancel-login'),
  getLoginStatus: () => ipcRenderer.invoke('get-login-status'),
  
  // 账号管理
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  deleteAccount: (accountId: number) =>
    ipcRenderer.invoke('delete-account', accountId),
  setDefaultAccount: (platformId: string, accountId: number) =>
    ipcRenderer.invoke('set-default-account', platformId, accountId),
  refreshAccounts: () => ipcRenderer.invoke('refresh-accounts'),
  
  // 配置管理
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: any) => ipcRenderer.invoke('set-config', config),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  
  // 日志管理
  getLogs: () => ipcRenderer.invoke('get-logs'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  
  // 同步管理
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  triggerSync: () => ipcRenderer.invoke('trigger-sync'),
  clearSyncQueue: () => ipcRenderer.invoke('clear-sync-queue'),
  
  // WebSocket管理
  getWebSocketStatus: () => ipcRenderer.invoke('get-websocket-status'),
  reconnectWebSocket: () => ipcRenderer.invoke('reconnect-websocket'),
  onAccountEvent: (callback: (event: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('account-event', listener);
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('account-event', listener);
    };
  },
} as ElectronAPI);

// 声明全局类型
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
