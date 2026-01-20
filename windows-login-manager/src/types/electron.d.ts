// Electron API类型定义
type ApiResult<T = any> = { success: boolean; data?: T; error?: string };
type UnknownRecord = Record<string, any>;
type UnknownArray = any[];
export interface ElectronAPI {
  // 系统登录
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<unknown>;
  checkAuth: () => Promise<{ isAuthenticated: boolean; user?: { id: number; username: string; email?: string; role: string } }>;

  // 平台登录
  loginPlatform: (platformId: string) => Promise<LoginResult>;
  cancelLogin: (platformId?: string) => Promise<unknown>;
  getLoginStatus: () => Promise<{ isLoggingIn: boolean }>;
  testAccountLogin: (accountId: number) => Promise<{ success: boolean; message?: string }>;

  // 平台列表
  getPlatforms: () => Promise<Platform[]>;

  // 服务连通性
  checkServerHealth: () => Promise<{ status: string; message?: string }>;

  // Dashboard
  getDashboardAllData: (params?: { startDate?: string; endDate?: string }) => Promise<ApiResult>;

  // 转化目标
  getConversionTargets: (params: { page?: number; pageSize?: number; search?: string; sortField?: string; sortOrder?: 'asc' | 'desc' }) => Promise<ApiResult>;
  createConversionTarget: (payload: { companyName: string; industry?: string; website?: string; address?: string }) => Promise<ApiResult>;
  updateConversionTarget: (id: number, payload: { companyName?: string; industry?: string; website?: string; address?: string }) => Promise<ApiResult>;
  deleteConversionTarget: (id: number) => Promise<ApiResult>;
  getConversionTarget: (id: number) => Promise<ApiResult>;

  // 知识库管理
  getKnowledgeBases: () => Promise<ApiResult>;
  getKnowledgeBase: (id: number) => Promise<ApiResult>;
  createKnowledgeBase: (payload: { name: string; description?: string }) => Promise<ApiResult>;
  updateKnowledgeBase: (id: number, payload: { name?: string; description?: string }) => Promise<ApiResult>;
  deleteKnowledgeBase: (id: number) => Promise<ApiResult>;
  uploadKnowledgeBaseDocuments: (id: number, files: UnknownArray) => Promise<ApiResult>;
  getKnowledgeBaseDocument: (docId: number) => Promise<ApiResult>;
  deleteKnowledgeBaseDocument: (docId: number) => Promise<ApiResult>;
  searchKnowledgeBaseDocuments: (id: number, query: string) => Promise<ApiResult>;

  // 账号管理
  getAccounts: () => Promise<Account[]>;
  deleteAccount: (accountId: number) => Promise<unknown>;
  setDefaultAccount: (platformId: string, accountId: number) => Promise<unknown>;
  refreshAccounts: () => Promise<Account[]>;

  // 配置管理
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<unknown>;
  clearCache: () => Promise<unknown>;
  clearAllData: () => Promise<unknown>;

  // 日志管理
  getLogs: () => Promise<string[]>;
  exportLogs: () => Promise<string>;
  clearLogs: () => Promise<unknown>;

  // 同步管理
  getSyncStatus: () => Promise<unknown>;
  triggerSync: () => Promise<unknown>;
  clearSyncQueue: () => Promise<unknown>;

  // WebSocket管理
  getWebSocketStatus: () => Promise<unknown>;
  reconnectWebSocket: () => Promise<unknown>;
  onAccountEvent: (callback: (event: unknown) => void) => () => void;

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
    create: (params: UnknownRecord) => Promise<ApiResult>;
    findAll: (params?: UnknownRecord) => Promise<ApiResult>;
    findById: (id: string) => Promise<ApiResult>;
    update: (id: string, params: UnknownRecord) => Promise<ApiResult>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    search: (params: UnknownRecord) => Promise<ApiResult>;
    deleteBatch: (ids: string[]) => Promise<ApiResult>;
    deleteAll: () => Promise<ApiResult>;
    getStats: () => Promise<ApiResult>;
    getKeywordStats: () => Promise<ApiResult>;
    markAsPublished: (id: string, publishedAt?: string) => Promise<{ success: boolean; error?: string }>;
    findUnpublished: () => Promise<ApiResult>;
    checkArticleExists: (params: { taskId: number; title: string }) => Promise<{ success: boolean; data?: { exists: boolean }; error?: string }>;
  };

  // 任务管理（本地 SQLite）
  task: {
    create: (params: UnknownRecord) => Promise<ApiResult>;
    findAll: (params?: UnknownRecord) => Promise<ApiResult>;
    findById: (id: string) => Promise<ApiResult>;
    updateStatus: (id: string, status: string, errorMessage?: string) => Promise<{ success: boolean; error?: string }>;
    cancel: (id: string) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    findPending: () => Promise<ApiResult>;
    findByBatchId: (batchId: string) => Promise<ApiResult>;
    cancelBatch: (batchId: string) => Promise<ApiResult>;
    deleteBatch: (batchId: string) => Promise<ApiResult>;
    getBatchStats: (batchId: string) => Promise<ApiResult>;
    getStats: () => Promise<ApiResult>;
    getLogs: (taskId: string) => Promise<ApiResult>;
    createRecord: (params: UnknownRecord) => Promise<ApiResult>;
    updateRecord: (id: string, params: UnknownRecord) => Promise<{ success: boolean; error?: string }>;
  };

  // 发布执行（本地 Playwright）
  publish: {
    executeSingle: (taskId: string) => Promise<ApiResult>;
    executeBatch: (batchId: string) => Promise<{ success: boolean; message?: string; error?: string }>;
    stopBatch: (batchId: string) => Promise<ApiResult>;
    getBatchStatus: (batchId: string) => Promise<ApiResult>;
    startScheduler: () => Promise<{ success: boolean; message?: string; error?: string }>;
    stopScheduler: () => Promise<{ success: boolean; message?: string; error?: string }>;
    getSchedulerStatus: () => Promise<ApiResult>;
    reserveQuota: (quotaType: string, amount?: number, taskInfo?: UnknownRecord) => Promise<ApiResult>;
    confirmQuota: (reservationId: number, result?: UnknownRecord) => Promise<ApiResult>;
    releaseQuota: (reservationId: number, reason?: string) => Promise<ApiResult>;
    getQuotaInfo: () => Promise<ApiResult>;
    reportResult: (report: UnknownRecord) => Promise<{ success: boolean; message?: string; error?: string }>;
    flushPendingAnalytics: () => Promise<{ success: boolean; error?: string }>;
  };

  publishingRecord: {
    findAll: (params?: UnknownRecord) => Promise<ApiResult>;
    findById: (id: number) => Promise<ApiResult>;
    delete: (id: number) => Promise<{ success: boolean; error?: string }>;
    batchDelete: (ids: number[]) => Promise<ApiResult>;
    getStats: () => Promise<ApiResult>;
  };

  // 浏览器自动化（本地 Playwright）
  browser: {
    launch: (options?: { headless?: boolean; userDataDir?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
    close: () => Promise<{ success: boolean; message?: string; error?: string }>;
    screenshot: (options?: { fullPage?: boolean; path?: string }) => Promise<ApiResult>;
    navigateTo: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<{ success: boolean; error?: string }>;
    getCurrentUrl: () => Promise<ApiResult>;
    getPageContent: () => Promise<ApiResult>;
    evaluate: (script: string) => Promise<ApiResult>;
    setCookies: (cookies: UnknownArray, url?: string) => Promise<{ success: boolean; error?: string }>;
    getCookies: (url?: string) => Promise<ApiResult>;
    checkLoginStatus: (accountId: string) => Promise<ApiResult>;
    checkAllLoginStatus: () => Promise<ApiResult>;
    getStatus: () => Promise<ApiResult>;
  };

  // 本地账号管理（本地 SQLite + 加密）
  localAccount: {
    create: (params: UnknownRecord) => Promise<ApiResult>;
    findAll: () => Promise<ApiResult>;
    findById: (id: string) => Promise<ApiResult>;
    findByPlatform: (platformId: string) => Promise<ApiResult>;
    update: (id: string, params: UnknownRecord) => Promise<ApiResult>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    setDefault: (platformId: string, accountId: string) => Promise<{ success: boolean; error?: string }>;
    getDefault: (platformId: string) => Promise<ApiResult>;
    updateLoginStatus: (id: string, status: string, errorMessage?: string) => Promise<{ success: boolean; error?: string }>;
    saveCookies: (id: string, cookies: UnknownArray) => Promise<{ success: boolean; error?: string }>;
    getCookies: (id: string) => Promise<ApiResult>;
    getStats: () => Promise<ApiResult>;
    exists: (platformId: string, platformUserId: string) => Promise<ApiResult>;
  };

  // 本地知识库管理（本地文件系统）
  localKnowledge: {
    create: (params: UnknownRecord) => Promise<ApiResult>;
    findAll: () => Promise<ApiResult>;
    findById: (id: string) => Promise<ApiResult>;
    update: (id: string, params: UnknownRecord) => Promise<ApiResult>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    upload: (kbId: string, files: UnknownArray) => Promise<ApiResult>;
    getDocuments: (kbId: string) => Promise<ApiResult>;
    getDocument: (docId: string) => Promise<ApiResult>;
    deleteDocument: (docId: string) => Promise<{ success: boolean; error?: string }>;
    search: (kbId: string, query: string) => Promise<ApiResult>;
    parse: (filePath: string) => Promise<ApiResult>;
    getStats: () => Promise<ApiResult>;
  };

  topic: {
    create: (params: UnknownRecord) => Promise<ApiResult>;
    findAll: (params?: UnknownRecord) => Promise<ApiResult>;
    findById: (id: number) => Promise<ApiResult>;
    update: (id: number, params: UnknownRecord) => Promise<ApiResult>;
    delete: (id: number) => Promise<{ success: boolean; error?: string }>;
    deleteBatch: (ids: number[]) => Promise<ApiResult>;
    getByDistillation: (distillationId: number) => Promise<ApiResult>;
    search: (searchTerm: string) => Promise<ApiResult>;
    findUnused: (limit?: number) => Promise<ApiResult>;
    findRecent: (limit?: number) => Promise<ApiResult>;
    getStats: () => Promise<ApiResult>;
    exists: (id: number) => Promise<ApiResult>;
  };

  // 本地图库管理（本地文件系统）
  gallery: {
    createAlbum: (params: UnknownRecord) => Promise<ApiResult>;
    findAlbums: () => Promise<ApiResult>;
    getAlbum: (albumId: number) => Promise<ApiResult>;
    updateAlbum: (albumId: number, params: UnknownRecord) => Promise<ApiResult>;
    deleteAlbum: (albumId: number) => Promise<{ success: boolean; error?: string }>;
    uploadImage: (albumId: number, files: UnknownArray) => Promise<ApiResult>;
    findImages: (albumId: number) => Promise<ApiResult>;
    getImage: (imageId: number) => Promise<ApiResult>;
    deleteImage: (imageId: number) => Promise<{ success: boolean; error?: string }>;
    deleteImages: (imageIds: number[]) => Promise<ApiResult>;
    moveImage: (imageId: number, targetAlbumId: number) => Promise<{ success: boolean; error?: string }>;
    getStats: () => Promise<ApiResult>;
    readImageFile: (imageId: number) => Promise<ApiResult>;
  };

  // 数据同步（与服务器同步）
  dataSync: {
    backup: () => Promise<ApiResult>;
    restore: (snapshotId: number) => Promise<ApiResult>;
    getSnapshots: () => Promise<ApiResult>;
    deleteSnapshot: (snapshotId: number) => Promise<{ success: boolean; error?: string }>;  // ✅ 修复
    exportLocal: (exportPath?: string) => Promise<ApiResult>;
    importLocal: (importPath: string) => Promise<ApiResult>;
    getLocalStats: () => Promise<ApiResult>;
  };

  // 工具函数
  utils: {
    getLocalFileUrl: (filePath: string) => string;
  };

  invoke: <T = any>(channel: string, ...args: UnknownArray) => Promise<T>;

  onTokensSaved: (callback: (tokens: { authToken: string; refreshToken: string }) => void) => () => void;
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
  [key: string]: unknown;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: ElectronAPI; // 别名，方便使用
    __closeWebView?: () => Promise<{ success: boolean; error?: string }>; // WebView关闭函数
  }
}
