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
