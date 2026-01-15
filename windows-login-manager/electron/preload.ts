import { contextBridge, ipcRenderer } from 'electron';

// 本地文件协议名称
const LOCAL_FILE_PROTOCOL = 'local-file';

/**
 * 将本地文件路径转换为协议 URL
 * @param filePath 本地文件路径
 * @returns 协议 URL
 */
function getLocalFileUrl(filePath: string): string {
  if (!filePath) return '';
  // 确保路径使用正斜杠
  let normalizedPath = filePath.replace(/\\/g, '/');
  // 确保路径以斜杠开头（对于绝对路径）
  // URL 格式应该是 local-file:///path/to/file（三个斜杠）
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  return `${LOCAL_FILE_PROTOCOL}://${normalizedPath}`;
}

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
  
  // 知识库管理（服务器端）
  getKnowledgeBases: () => Promise<{ success: boolean; data?: any; error?: string }>;
  getKnowledgeBase: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  createKnowledgeBase: (payload: { name: string; description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateKnowledgeBase: (id: number, payload: { name?: string; description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteKnowledgeBase: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  uploadKnowledgeBaseDocuments: (id: number, files: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  getKnowledgeBaseDocument: (docId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteKnowledgeBaseDocument: (docId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  searchKnowledgeBaseDocuments: (id: number, query: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  
  // 账号管理（服务器端）
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

  // 软件更新
  updater: {
    getVersion: () => Promise<string>;
    getStatus: () => Promise<any>;
    checkForUpdates: () => Promise<{ success: boolean; message: string; updateAvailable?: boolean }>;
    downloadUpdate: () => Promise<{ success: boolean; message: string }>;
    installUpdate: () => Promise<{ success: boolean; message: string }>;
    getInfo: () => Promise<{
      currentVersion: string;
      latestVersion?: string;
      updateAvailable: boolean;
      releaseNotes?: string;
      releaseDate?: string;
    }>;
    onStatusChanged: (callback: (status: any) => void) => () => void;
  };

  // ========== Phase 6: 本地数据 API ==========
  
  // 文章管理（本地 SQLite）
  article: {
    create: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    findAll: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    findById: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    update: (id: string, params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    search: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteBatch: (ids: string[]) => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteAll: () => Promise<{ success: boolean; data?: any; error?: string }>;
    getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
    getKeywordStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
    markAsPublished: (id: string, publishedAt?: string) => Promise<{ success: boolean; error?: string }>;
    findUnpublished: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // 任务管理（本地 SQLite）
  task: {
    create: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    findAll: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    findById: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateStatus: (id: string, status: string, errorMessage?: string) => Promise<{ success: boolean; error?: string }>;
    cancel: (id: string) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    findPending: () => Promise<{ success: boolean; data?: any; error?: string }>;
    findByBatchId: (batchId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    cancelBatch: (batchId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteBatch: (batchId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getBatchStats: (batchId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
    getLogs: (taskId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    createRecord: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateRecord: (id: string, params: any) => Promise<{ success: boolean; error?: string }>;
  };

  // 发布执行（本地 Playwright）
  publish: {
    executeSingle: (taskId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    executeBatch: (batchId: string) => Promise<{ success: boolean; message?: string; error?: string }>;
    stopBatch: (batchId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getBatchStatus: (batchId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    startScheduler: () => Promise<{ success: boolean; message?: string; error?: string }>;
    stopScheduler: () => Promise<{ success: boolean; message?: string; error?: string }>;
    getSchedulerStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
    reserveQuota: (quotaType: string, amount?: number, taskInfo?: object) => Promise<{ success: boolean; data?: any; error?: string }>;
    confirmQuota: (reservationId: string, result?: object) => Promise<{ success: boolean; data?: any; error?: string }>;
    releaseQuota: (reservationId: string, reason?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getQuotaInfo: () => Promise<{ success: boolean; data?: any; error?: string }>;
    reportResult: (report: any) => Promise<{ success: boolean; message?: string; error?: string }>;
    flushPendingAnalytics: () => Promise<{ success: boolean; error?: string }>;
  };

  // 浏览器自动化（本地 Playwright）
  browser: {
    launch: (options?: { headless?: boolean; userDataDir?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
    close: () => Promise<{ success: boolean; message?: string; error?: string }>;
    screenshot: (options?: { fullPage?: boolean; path?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    navigateTo: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<{ success: boolean; error?: string }>;
    getCurrentUrl: () => Promise<{ success: boolean; data?: any; error?: string }>;
    getPageContent: () => Promise<{ success: boolean; data?: any; error?: string }>;
    evaluate: (script: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    setCookies: (cookies: any[], url?: string) => Promise<{ success: boolean; error?: string }>;
    getCookies: (url?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    checkLoginStatus: (accountId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    checkAllLoginStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
    getStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // 本地账号管理（本地 SQLite + 加密）
  localAccount: {
    create: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    findAll: () => Promise<{ success: boolean; data?: any; error?: string }>;
    findById: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    findByPlatform: (platformId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    update: (id: string, params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    setDefault: (platformId: string, accountId: string) => Promise<{ success: boolean; error?: string }>;
    getDefault: (platformId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateLoginStatus: (id: string, status: string, errorMessage?: string) => Promise<{ success: boolean; error?: string }>;
    saveCookies: (id: string, cookies: any[]) => Promise<{ success: boolean; error?: string }>;
    getCookies: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
    exists: (platformId: string, platformUserId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // 本地知识库管理（本地文件系统）
  localKnowledge: {
    create: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    findAll: () => Promise<{ success: boolean; data?: any; error?: string }>;
    findById: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    update: (id: string, params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    upload: (kbId: string, files: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
    getDocuments: (kbId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getDocument: (docId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteDocument: (docId: string) => Promise<{ success: boolean; error?: string }>;
    search: (kbId: string, query: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    parse: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // 本地图库管理（本地文件系统）
  gallery: {
    createAlbum: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    findAlbums: () => Promise<{ success: boolean; data?: any; error?: string }>;
    getAlbum: (albumId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateAlbum: (albumId: string, params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteAlbum: (albumId: string) => Promise<{ success: boolean; error?: string }>;
    uploadImage: (albumId: string, files: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
    findImages: (albumId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getImage: (imageId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteImage: (imageId: string) => Promise<{ success: boolean; error?: string }>;
    deleteImages: (imageIds: string[]) => Promise<{ success: boolean; data?: any; error?: string }>;
    moveImage: (imageId: string, targetAlbumId: string) => Promise<{ success: boolean; error?: string }>;
    getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
    readImageFile: (imageId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // 数据同步（与服务器同步）
  dataSync: {
    backup: () => Promise<{ success: boolean; data?: any; error?: string }>;
    restore: (snapshotId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getSnapshots: () => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteSnapshot: (snapshotId: string) => Promise<{ success: boolean; error?: string }>;
    exportLocal: (exportPath?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    importLocal: (importPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getLocalStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // 工具函数
  utils: {
    getLocalFileUrl: (filePath: string) => string;
  };
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
  
  // 知识库管理（服务器端）
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
  
  // 账号管理（服务器端）
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

  // 软件更新
  updater: {
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    getStatus: () => ipcRenderer.invoke('updater:get-status'),
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    getInfo: () => ipcRenderer.invoke('updater:get-info'),
    onStatusChanged: (callback: (status: any) => void) => {
      const listener = (_event: any, status: any) => callback(status);
      ipcRenderer.on('updater:status-changed', listener);
      return () => {
        ipcRenderer.removeListener('updater:status-changed', listener);
      };
    },
  },

  // ========== Phase 6: 本地数据 API ==========

  // 文章管理（本地 SQLite）
  article: {
    create: (params: any) => ipcRenderer.invoke('article:create', params),
    findAll: (params?: any) => ipcRenderer.invoke('article:findAll', params),
    findById: (id: string) => ipcRenderer.invoke('article:findById', id),
    update: (id: string, params: any) => ipcRenderer.invoke('article:update', id, params),
    delete: (id: string) => ipcRenderer.invoke('article:delete', id),
    search: (params: any) => ipcRenderer.invoke('article:search', params),
    deleteBatch: (ids: string[]) => ipcRenderer.invoke('article:deleteBatch', ids),
    deleteAll: () => ipcRenderer.invoke('article:deleteAll'),
    getStats: () => ipcRenderer.invoke('article:getStats'),
    getKeywordStats: () => ipcRenderer.invoke('article:getKeywordStats'),
    markAsPublished: (id: string, publishedAt?: string) => ipcRenderer.invoke('article:markAsPublished', id, publishedAt),
    findUnpublished: () => ipcRenderer.invoke('article:findUnpublished'),
  },

  // 任务管理（本地 SQLite）
  task: {
    create: (params: any) => ipcRenderer.invoke('task:create', params),
    findAll: (params?: any) => ipcRenderer.invoke('task:findAll', params),
    findById: (id: string) => ipcRenderer.invoke('task:findById', id),
    updateStatus: (id: string, status: string, errorMessage?: string) => ipcRenderer.invoke('task:updateStatus', id, status, errorMessage),
    cancel: (id: string) => ipcRenderer.invoke('task:cancel', id),
    delete: (id: string) => ipcRenderer.invoke('task:delete', id),
    findPending: () => ipcRenderer.invoke('task:findPending'),
    findByBatchId: (batchId: string) => ipcRenderer.invoke('task:findByBatchId', batchId),
    cancelBatch: (batchId: string) => ipcRenderer.invoke('task:cancelBatch', batchId),
    deleteBatch: (batchId: string) => ipcRenderer.invoke('task:deleteBatch', batchId),
    getBatchStats: (batchId: string) => ipcRenderer.invoke('task:getBatchStats', batchId),
    getStats: () => ipcRenderer.invoke('task:getStats'),
    getLogs: (taskId: string) => ipcRenderer.invoke('task:getLogs', taskId),
    createRecord: (params: any) => ipcRenderer.invoke('task:createRecord', params),
    updateRecord: (id: string, params: any) => ipcRenderer.invoke('task:updateRecord', id, params),
  },

  // 发布执行（本地 Playwright）
  publish: {
    executeSingle: (taskId: string) => ipcRenderer.invoke('publish:executeSingle', taskId),
    executeBatch: (batchId: string) => ipcRenderer.invoke('publish:executeBatch', batchId),
    stopBatch: (batchId: string) => ipcRenderer.invoke('publish:stopBatch', batchId),
    getBatchStatus: (batchId: string) => ipcRenderer.invoke('publish:getBatchStatus', batchId),
    startScheduler: () => ipcRenderer.invoke('publish:startScheduler'),
    stopScheduler: () => ipcRenderer.invoke('publish:stopScheduler'),
    getSchedulerStatus: () => ipcRenderer.invoke('publish:getSchedulerStatus'),
    reserveQuota: (quotaType: string, amount?: number, taskInfo?: object) => ipcRenderer.invoke('publish:reserveQuota', quotaType, amount, taskInfo),
    confirmQuota: (reservationId: string, result?: object) => ipcRenderer.invoke('publish:confirmQuota', reservationId, result),
    releaseQuota: (reservationId: string, reason?: string) => ipcRenderer.invoke('publish:releaseQuota', reservationId, reason),
    getQuotaInfo: () => ipcRenderer.invoke('publish:getQuotaInfo'),
    reportResult: (report: any) => ipcRenderer.invoke('publish:reportResult', report),
    flushPendingAnalytics: () => ipcRenderer.invoke('publish:flushPendingAnalytics'),
  },

  // 浏览器自动化（本地 Playwright）
  browser: {
    launch: (options?: { headless?: boolean; userDataDir?: string }) => ipcRenderer.invoke('browser:launch', options),
    close: () => ipcRenderer.invoke('browser:close'),
    screenshot: (options?: { fullPage?: boolean; path?: string }) => ipcRenderer.invoke('browser:screenshot', options),
    navigateTo: (url: string, options?: { waitUntil?: string; timeout?: number }) => ipcRenderer.invoke('browser:navigateTo', url, options),
    getCurrentUrl: () => ipcRenderer.invoke('browser:getCurrentUrl'),
    getPageContent: () => ipcRenderer.invoke('browser:getPageContent'),
    evaluate: (script: string) => ipcRenderer.invoke('browser:evaluate', script),
    setCookies: (cookies: any[], url?: string) => ipcRenderer.invoke('browser:setCookies', cookies, url),
    getCookies: (url?: string) => ipcRenderer.invoke('browser:getCookies', url),
    checkLoginStatus: (accountId: string) => ipcRenderer.invoke('browser:checkLoginStatus', accountId),
    checkAllLoginStatus: () => ipcRenderer.invoke('browser:checkAllLoginStatus'),
    getStatus: () => ipcRenderer.invoke('browser:getStatus'),
  },

  // 本地账号管理（本地 SQLite + 加密）
  localAccount: {
    create: (params: any) => ipcRenderer.invoke('account:local:create', params),
    findAll: () => ipcRenderer.invoke('account:local:findAll'),
    findById: (id: string) => ipcRenderer.invoke('account:local:findById', id),
    findByPlatform: (platformId: string) => ipcRenderer.invoke('account:local:findByPlatform', platformId),
    update: (id: string, params: any) => ipcRenderer.invoke('account:local:update', id, params),
    delete: (id: string) => ipcRenderer.invoke('account:local:delete', id),
    setDefault: (platformId: string, accountId: string) => ipcRenderer.invoke('account:local:setDefault', platformId, accountId),
    getDefault: (platformId: string) => ipcRenderer.invoke('account:local:getDefault', platformId),
    updateLoginStatus: (id: string, status: string, errorMessage?: string) => ipcRenderer.invoke('account:local:updateLoginStatus', id, status, errorMessage),
    saveCookies: (id: string, cookies: any[]) => ipcRenderer.invoke('account:local:saveCookies', id, cookies),
    getCookies: (id: string) => ipcRenderer.invoke('account:local:getCookies', id),
    getStats: () => ipcRenderer.invoke('account:local:getStats'),
    exists: (platformId: string, platformUserId: string) => ipcRenderer.invoke('account:local:exists', platformId, platformUserId),
  },

  // 本地知识库管理（本地文件系统）
  localKnowledge: {
    create: (params: any) => ipcRenderer.invoke('knowledge:local:create', params),
    findAll: () => ipcRenderer.invoke('knowledge:local:findAll'),
    findById: (id: string) => ipcRenderer.invoke('knowledge:local:findById', id),
    update: (id: string, params: any) => ipcRenderer.invoke('knowledge:local:update', id, params),
    delete: (id: string) => ipcRenderer.invoke('knowledge:local:delete', id),
    upload: (kbId: string, files: any[]) => ipcRenderer.invoke('knowledge:local:upload', kbId, files),
    getDocuments: (kbId: string) => ipcRenderer.invoke('knowledge:local:getDocuments', kbId),
    getDocument: (docId: string) => ipcRenderer.invoke('knowledge:local:getDocument', docId),
    deleteDocument: (docId: string) => ipcRenderer.invoke('knowledge:local:deleteDocument', docId),
    search: (kbId: string, query: string) => ipcRenderer.invoke('knowledge:local:search', kbId, query),
    parse: (filePath: string) => ipcRenderer.invoke('knowledge:local:parse', filePath),
    getStats: () => ipcRenderer.invoke('knowledge:local:getStats'),
  },

  // 本地图库管理（本地文件系统）
  gallery: {
    createAlbum: (params: any) => ipcRenderer.invoke('gallery:createAlbum', params),
    findAlbums: () => ipcRenderer.invoke('gallery:findAlbums'),
    getAlbum: (albumId: string) => ipcRenderer.invoke('gallery:getAlbum', albumId),
    updateAlbum: (albumId: string, params: any) => ipcRenderer.invoke('gallery:updateAlbum', albumId, params),
    deleteAlbum: (albumId: string) => ipcRenderer.invoke('gallery:deleteAlbum', albumId),
    uploadImage: (albumId: string, files: any[]) => ipcRenderer.invoke('gallery:uploadImage', albumId, files),
    findImages: (albumId: string) => ipcRenderer.invoke('gallery:findImages', albumId),
    getImage: (imageId: string) => ipcRenderer.invoke('gallery:getImage', imageId),
    deleteImage: (imageId: string) => ipcRenderer.invoke('gallery:deleteImage', imageId),
    deleteImages: (imageIds: string[]) => ipcRenderer.invoke('gallery:deleteImages', imageIds),
    moveImage: (imageId: string, targetAlbumId: string) => ipcRenderer.invoke('gallery:moveImage', imageId, targetAlbumId),
    getStats: () => ipcRenderer.invoke('gallery:getStats'),
    readImageFile: (imageId: string) => ipcRenderer.invoke('gallery:readImageFile', imageId),
  },

  // 数据同步（与服务器同步）
  dataSync: {
    backup: () => ipcRenderer.invoke('sync:backup'),
    restore: (snapshotId: string) => ipcRenderer.invoke('sync:restore', snapshotId),
    getSnapshots: () => ipcRenderer.invoke('sync:getSnapshots'),
    deleteSnapshot: (snapshotId: string) => ipcRenderer.invoke('sync:deleteSnapshot', snapshotId),
    exportLocal: (exportPath?: string) => ipcRenderer.invoke('sync:exportLocal', exportPath),
    importLocal: (importPath: string) => ipcRenderer.invoke('sync:importLocal', importPath),
    getLocalStats: () => ipcRenderer.invoke('sync:getLocalStats'),
  },

  // 工具函数
  utils: {
    getLocalFileUrl: (filePath: string) => getLocalFileUrl(filePath),
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
