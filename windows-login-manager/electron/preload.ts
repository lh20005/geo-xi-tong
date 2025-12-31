import { contextBridge, ipcRenderer } from 'electron';

// 定义暴露给渲染进程的API类型
export interface ElectronAPI {
  // 系统登录
  login: (username: string, password: string) => Promise<any>;
  logout: () => Promise<any>;
  checkAuth: () => Promise<{ isAuthenticated: boolean; user?: { id: number; username: string; email?: string; role: string } }>;
  
  // 平台登录
  loginPlatform: (platformId: string) => Promise<any>;
  cancelLogin: (platformId?: string) => Promise<any>;
  getLoginStatus: () => Promise<{ isLoggingIn: boolean }>;
  testAccountLogin: (accountId: number) => Promise<{ success: boolean; message?: string }>;

  // 平台列表
  getPlatforms: () => Promise<any[]>;

  // 服务连通性
  checkServerHealth: () => Promise<{ status: string; message?: string }>;

  // Dashboard
  getDashboardAllData: (params?: { startDate?: string; endDate?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;

  // 转化目标
  getConversionTargets: (params: { page?: number; pageSize?: number; search?: string; sortField?: string; sortOrder?: 'asc' | 'desc' }) => Promise<{ success: boolean; data?: any; error?: string }>;
  createConversionTarget: (payload: { companyName: string; industry?: string; website?: string; address?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateConversionTarget: (id: number, payload: { companyName?: string; industry?: string; website?: string; address?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteConversionTarget: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  getConversionTarget: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  
  // 知识库管理
  getKnowledgeBases: () => Promise<{ success: boolean; data?: any; error?: string }>;
  getKnowledgeBase: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  createKnowledgeBase: (payload: { name: string; description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateKnowledgeBase: (id: number, payload: { name?: string; description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteKnowledgeBase: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  uploadKnowledgeBaseDocuments: (id: number, files: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  getKnowledgeBaseDocument: (docId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteKnowledgeBaseDocument: (docId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  searchKnowledgeBaseDocuments: (id: number, query: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  
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

  // 存储管理
  storage: {
    getTokens: () => Promise<{ authToken: string; refreshToken: string } | null>;
    saveTokens: (tokens: { authToken: string; refreshToken: string }) => Promise<void>;
    clearTokens: () => Promise<void>;
  };
  
  // 事件监听
  onTokensSaved: (callback: (tokens: { authToken: string; refreshToken: string }) => void) => () => void;
}

// 创建 API 对象
const electronAPI = {
  // 系统登录
  login: (username: string, password: string) =>
    ipcRenderer.invoke('login', username, password),
  logout: () => ipcRenderer.invoke('logout'),
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  
  // 平台登录
  loginPlatform: (platformId: string) =>
    ipcRenderer.invoke('login-platform', platformId),
  cancelLogin: (platformId?: string) => ipcRenderer.invoke('cancel-login', platformId),
  getLoginStatus: () => ipcRenderer.invoke('get-login-status'),
  testAccountLogin: (accountId: number) =>
    ipcRenderer.invoke('test-account-login', accountId),

  // 平台列表
  getPlatforms: () => ipcRenderer.invoke('get-platforms'),

  // 服务连通性
  checkServerHealth: () => ipcRenderer.invoke('check-server-health'),

  // Dashboard
  getDashboardAllData: (params?: { startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke('dashboard:get-all', params),

  // 转化目标
  getConversionTargets: (params: { page?: number; pageSize?: number; search?: string; sortField?: string; sortOrder?: 'asc' | 'desc' }) =>
    ipcRenderer.invoke('conversion-targets:list', params),
  createConversionTarget: (payload: { companyName: string; industry?: string; website?: string; address?: string }) =>
    ipcRenderer.invoke('conversion-targets:create', payload),
  updateConversionTarget: (id: number, payload: { companyName?: string; industry?: string; website?: string; address?: string }) =>
    ipcRenderer.invoke('conversion-targets:update', id, payload),
  deleteConversionTarget: (id: number) => ipcRenderer.invoke('conversion-targets:delete', id),
  getConversionTarget: (id: number) => ipcRenderer.invoke('conversion-targets:get', id),
  
  // 知识库管理
  getKnowledgeBases: () => ipcRenderer.invoke('knowledge-base:list'),
  getKnowledgeBase: (id: number) => ipcRenderer.invoke('knowledge-base:get', id),
  createKnowledgeBase: (payload: { name: string; description?: string }) =>
    ipcRenderer.invoke('knowledge-base:create', payload),
  updateKnowledgeBase: (id: number, payload: { name?: string; description?: string }) =>
    ipcRenderer.invoke('knowledge-base:update', id, payload),
  deleteKnowledgeBase: (id: number) => ipcRenderer.invoke('knowledge-base:delete', id),
  uploadKnowledgeBaseDocuments: (id: number, files: any[]) =>
    ipcRenderer.invoke('knowledge-base:upload-documents', id, files),
  getKnowledgeBaseDocument: (docId: number) =>
    ipcRenderer.invoke('knowledge-base:get-document', docId),
  deleteKnowledgeBaseDocument: (docId: number) =>
    ipcRenderer.invoke('knowledge-base:delete-document', docId),
  searchKnowledgeBaseDocuments: (id: number, query: string) =>
    ipcRenderer.invoke('knowledge-base:search-documents', id, query),
  
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

  // 存储管理
  storage: {
    getTokens: () => ipcRenderer.invoke('storage:get-tokens'),
    saveTokens: (tokens: { authToken: string; refreshToken: string }) =>
      ipcRenderer.invoke('storage:save-tokens', tokens),
    clearTokens: () => ipcRenderer.invoke('storage:clear-tokens'),
  },
  
  // 事件监听
  onTokensSaved: (callback: (tokens: { authToken: string; refreshToken: string }) => void) => {
    const listener = (_event: any, tokens: any) => callback(tokens);
    ipcRenderer.on('tokens-saved', listener);
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('tokens-saved', listener);
    };
  },
} as ElectronAPI;

// 通过contextBridge安全地暴露API
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
// 同时暴露为 electron 别名，以兼容现有代码
contextBridge.exposeInMainWorld('electron', electronAPI);

// 声明全局类型
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: ElectronAPI; // 别名
  }
}
