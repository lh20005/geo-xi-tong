// Electron API类型定义
export interface ElectronAPI {
  // 系统登录
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<any>;
  checkAuth: () => Promise<{ isAuthenticated: boolean; user?: { id: number; username: string; email?: string; role: string } }>;

  // 平台登录
  loginPlatform: (platformId: string) => Promise<LoginResult>;
  cancelLogin: (platformId?: string) => Promise<any>;
  getLoginStatus: () => Promise<{ isLoggingIn: boolean }>;
  testAccountLogin: (accountId: number) => Promise<{ success: boolean; message?: string }>;

  // 平台列表
  getPlatforms: () => Promise<Platform[]>;

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
  getAccounts: () => Promise<Account[]>;
  deleteAccount: (accountId: number) => Promise<any>;
  setDefaultAccount: (platformId: string, accountId: number) => Promise<any>;
  refreshAccounts: () => Promise<Account[]>;

  // 配置管理
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<any>;
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

  // 软件更新
  updater: {
    getVersion: () => Promise<string>;
    getStatus: () => Promise<UpdateStatus>;
    checkForUpdates: () => Promise<{ success: boolean; message: string; updateAvailable?: boolean }>;
    downloadUpdate: () => Promise<{ success: boolean; message: string }>;
    installUpdate: () => Promise<{ success: boolean; message: string }>;
    getInfo: () => Promise<UpdateInfoResult>;
    onStatusChanged: (callback: (status: UpdateStatus) => void) => () => void;
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
    checkArticleExists: (params: { taskId: number; title: string }) => Promise<{ success: boolean; data?: { exists: boolean }; error?: string }>;
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
    confirmQuota: (reservationId: number, result?: object) => Promise<{ success: boolean; data?: any; error?: string }>;  // ✅ 修复
    releaseQuota: (reservationId: number, reason?: string) => Promise<{ success: boolean; data?: any; error?: string }>;  // ✅ 修复
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
    restore: (snapshotId: number) => Promise<{ success: boolean; data?: any; error?: string }>;  // ✅ 修复
    getSnapshots: () => Promise<{ success: boolean; data?: any; error?: string }>;
    deleteSnapshot: (snapshotId: number) => Promise<{ success: boolean; error?: string }>;  // ✅ 修复
    exportLocal: (exportPath?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    importLocal: (importPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getLocalStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // 工具函数
  utils: {
    getLocalFileUrl: (filePath: string) => string;
  };
}

// 更新状态类型
export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  message: string;
  progress?: number;
  version?: string;
  releaseNotes?: string;
  releaseDate?: string;
  error?: string;
}

// 更新信息类型
export interface UpdateInfoResult {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface LoginResult {
  success: boolean;
  account?: Account;
  message?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: {
    id: number;
    username: string;
    email?: string;
    role: string;
  };
}

export interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string;
  credentials?: {
    username: string;
    password: string;
    cookies?: Cookie[];
    loginTime?: string;
    userInfo?: UserInfo;
  };
  is_default: boolean;
  status: 'active' | 'inactive' | 'expired';
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
}

export interface Platform {
  platform_id: string;
  platform_name: string;
  icon_url?: string;
  login_url: string;
  selectors: {
    username: string[];
    loginSuccess: string[];
  };
  enabled: boolean;
}

export interface AppConfig {
  serverUrl: string;
  autoSync: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark' | 'system';
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface UserInfo {
  username: string;
  avatar?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: ElectronAPI; // 别名，方便使用
    __closeWebView?: () => Promise<{ success: boolean; error?: string }>; // WebView关闭函数
  }
}
