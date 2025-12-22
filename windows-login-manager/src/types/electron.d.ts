// Electron API类型定义
export interface ElectronAPI {
  // 平台登录
  loginPlatform: (platformId: string) => Promise<LoginResult>;
  
  // 账号管理
  getAccounts: () => Promise<Account[]>;
  deleteAccount: (accountId: number) => Promise<void>;
  setDefaultAccount: (platformId: string, accountId: number) => Promise<void>;
  
  // 配置管理
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<void>;
  
  // 日志管理
  getLogs: () => Promise<string[]>;
  exportLogs: () => Promise<string>;
}

export interface LoginResult {
  success: boolean;
  account?: Account;
  message?: string;
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
  }
}
