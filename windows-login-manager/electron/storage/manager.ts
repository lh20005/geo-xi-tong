import { safeStorage, app } from 'electron';
import Store from 'electron-store';
import log from 'electron-log';
import crypto from 'crypto';

/**
 * 存储管理器
 * 使用Electron safeStorage API实现加密存储
 * Requirements: 7.1, 7.2, 7.7, 11.9
 * 
 * 重要说明：
 * electron-store 的数据存储在 app.getPath('userData') 目录：
 * - macOS: ~/Library/Application Support/<app-name>/
 * - Windows: %APPDATA%/<app-name>/
 * - Linux: ~/.config/<app-name>/
 * 
 * 这个目录是用户特定的，不会被打包进 app.asar 中。
 * 每个用户安装应用后都会有一个全新的空目录。
 */

// 定义存储的数据类型
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AppConfig {
  serverUrl: string;
  autoSync: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark' | 'system';
}

interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string;
  credentials?: any;
  is_default: boolean;
  status: 'active' | 'inactive' | 'expired';
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
}

// 存储版本标记 - 用于检测首次安装或强制重新登录
// 使用 package.json 中的版本号，每次发布新版本都会触发清理
const STORAGE_INITIALIZED_KEY = '_storage_initialized';
// 从 package.json 读取版本号，确保每次发布新版本都会清除旧的认证数据
const CURRENT_STORAGE_VERSION = app.getVersion(); // 例如 "1.0.0"

// 创建加密存储实例
const store = new Store({
  name: 'platform-login-manager',
  encryptionKey: 'your-encryption-key-here', // 在生产环境中应该使用更安全的密钥管理
});

/**
 * 初始化存储 - 确保首次启动时是干净状态
 * 这个函数会在打包后的生产环境中检查是否需要清理旧数据
 * 
 * 重要：这个函数会在每次版本更新时清除认证数据，
 * 确保用户需要重新登录，防止旧版本的敏感数据泄露
 */
function initializeStorage(): void {
  try {
    const storedVersion = store.get(STORAGE_INITIALIZED_KEY) as string | undefined;
    
    // 如果版本不匹配或不存在，说明是首次安装或版本更新，需要重置
    if (storedVersion !== CURRENT_STORAGE_VERSION) {
      log.info(`Storage initialization: version mismatch (stored: ${storedVersion}, current: ${CURRENT_STORAGE_VERSION})`);
      log.info('Clearing ALL authentication data for fresh start...');
      
      // 清除所有认证相关数据（Electron Store）
      store.delete('auth_tokens');
      store.delete('user');
      store.delete('accounts_cache');
      
      // 设置版本标记
      store.set(STORAGE_INITIALIZED_KEY, CURRENT_STORAGE_VERSION);
      
      log.info('✅ Storage initialized successfully - user will see clean login page');
    } else {
      log.info('Storage version matches, skipping cleanup');
    }
  } catch (error) {
    log.error('Error initializing storage:', error);
    // 出错时也尝试清理，确保安全
    try {
      store.delete('auth_tokens');
      store.delete('user');
      store.delete('accounts_cache');
      store.set(STORAGE_INITIALIZED_KEY, CURRENT_STORAGE_VERSION);
      log.info('Storage cleared due to initialization error');
    } catch (e) {
      log.error('Failed to clear data on error:', e);
    }
  }
}

// 在打包后的生产环境中执行初始化
// 注意：这会在每次版本更新时清除认证数据
if (app.isPackaged) {
  initializeStorage();
}

class StorageManager {
  private static instance: StorageManager;
  private isEncryptionAvailable: boolean;

  private constructor() {
    // 检查加密是否可用
    this.isEncryptionAvailable = safeStorage.isEncryptionAvailable();
    
    if (!this.isEncryptionAvailable) {
      log.warn('Encryption is not available on this system');
    } else {
      log.info('Encryption is available');
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * 加密数据
   * Requirements: 7.2, 11.1
   */
  private encrypt(data: string): string {
    try {
      if (this.isEncryptionAvailable) {
        // 使用Electron safeStorage API
        const buffer = safeStorage.encryptString(data);
        return buffer.toString('base64');
      } else {
        // 降级到AES-256加密
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('fallback-key', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
      }
    } catch (error) {
      log.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * 解密数据
   * Requirements: 7.2, 11.1
   */
  private decrypt(encryptedData: string): string {
    try {
      if (this.isEncryptionAvailable) {
        // 使用Electron safeStorage API
        const buffer = Buffer.from(encryptedData, 'base64');
        return safeStorage.decryptString(buffer);
      } else {
        // 降级到AES-256解密
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('fallback-key', 'salt', 32);
        
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
      }
    } catch (error) {
      log.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * 保存配置
   * Requirements: 7.1
   */
  async saveConfig(config: AppConfig): Promise<void> {
    try {
      store.set('config', config);
      log.info('Config saved successfully');
    } catch (error) {
      log.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * 获取配置
   * Requirements: 7.4
   */
  async getConfig(): Promise<AppConfig | null> {
    try {
      const config = store.get('config') as AppConfig;
      const defaultConfig = this.getDefaultConfig();
      
      if (!config) {
        log.info('No config found, returning default');
        return defaultConfig;
      }

      // 生产环境下，始终使用硬编码的服务器地址
      if (app.isPackaged) {
        return { ...config, serverUrl: defaultConfig.serverUrl };
      }

      return config;
    } catch (error) {
      log.error('Failed to get config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   * 生产环境使用硬编码的服务器地址
   */
  private getDefaultConfig(): AppConfig {
    // 判断是否为生产环境
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    // 生产环境使用硬编码的服务器地址（注意：必须带 www）
    const serverUrl = isDev 
      ? (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000')
      : 'https://www.jzgeo.cc';
    
    return {
      serverUrl,
      autoSync: true,
      logLevel: 'info',
      theme: 'system',
    };
  }

  /**
   * 保存账号缓存（加密）
   * Requirements: 7.1, 7.2, 11.4
   */
  async saveAccountsCache(accounts: Account[]): Promise<void> {
    try {
      const encrypted = this.encrypt(JSON.stringify(accounts));
      store.set('accounts_cache', encrypted);
      
      log.info(`Saved ${accounts.length} accounts to cache`);
    } catch (error) {
      log.error('Failed to save accounts cache:', error);
      throw error;
    }
  }

  /**
   * 获取账号缓存
   * Requirements: 7.4
   */
  async getAccountsCache(): Promise<Account[]> {
    try {
      const encrypted = store.get('accounts_cache') as string;
      
      if (!encrypted) {
        log.info('No accounts cache found');
        return [];
      }

      const decrypted = this.decrypt(encrypted);
      const accounts: Account[] = JSON.parse(decrypted);
      
      log.info(`Retrieved ${accounts.length} accounts from cache`);
      return accounts;
    } catch (error) {
      log.error('Failed to get accounts cache:', error);
      return [];
    }
  }

  /**
   * 保存用户信息
   * Requirements: 7.1, 7.7
   */
  async saveUser(user: { id: number; username: string; email?: string; role: string }): Promise<void> {
    try {
      store.set('user', user);
      log.info(`User info saved: ${user.username}`);
    } catch (error) {
      log.error('Failed to save user info:', error);
      throw error;
    }
  }

  /**
   * 获取用户信息
   * Requirements: 7.4
   */
  async getUser(): Promise<{ id: number; username: string; email?: string; role: string } | null> {
    try {
      const user = store.get('user') as { id: number; username: string; email?: string; role: string } | undefined;
      
      if (!user) {
        log.info('No user info found');
        return null;
      }

      return user;
    } catch (error) {
      log.error('Failed to get user info:', error);
      return null;
    }
  }

  /**
   * 清除用户信息
   * Requirements: 7.5
   */
  async clearUser(): Promise<void> {
    try {
      store.delete('user');
      log.info('User info cleared');
    } catch (error) {
      log.error('Failed to clear user info:', error);
      throw error;
    }
  }

  /**
   * 清除所有缓存
   * Requirements: 7.5
   */
  async clearCache(): Promise<void> {
    try {
      store.delete('accounts_cache');
      log.info('Cache cleared');
    } catch (error) {
      log.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * 清除所有数据
   * Requirements: 7.5
   */
  async clearAll(): Promise<void> {
    try {
      store.clear();
      log.info('All data cleared');
    } catch (error) {
      log.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * 获取存储路径
   */
  getStoragePath(): string {
    return store.path;
  }

  /**
   * 检查存储是否损坏
   * Requirements: 7.6
   */
  async checkIntegrity(): Promise<boolean> {
    try {
      // 尝试读取存储
      store.get('config');
      return true;
    } catch (error) {
      log.error('Storage integrity check failed:', error);
      return false;
    }
  }

  /**
   * 获取 tokens（用于 API 认证）
   */
  async getTokens(): Promise<{ authToken: string; refreshToken: string } | null> {
    try {
      const encryptedData = store.get('auth_tokens') as string | undefined;
      if (!encryptedData) {
        return null;
      }
      
      const decrypted = this.decrypt(encryptedData);
      return JSON.parse(decrypted);
    } catch (error) {
      log.error('Failed to get tokens:', error);
      return null;
    }
  }

  /**
   * 保存 tokens
   */
  async saveTokens(tokens: { authToken: string; refreshToken: string }): Promise<void> {
    try {
      const encrypted = this.encrypt(JSON.stringify(tokens));
      store.set('auth_tokens', encrypted);
      log.info('Tokens saved successfully');
    } catch (error) {
      log.error('Failed to save tokens:', error);
      throw error;
    }
  }

  /**
   * 清除 tokens
   */
  async clearTokens(): Promise<void> {
    try {
      store.delete('auth_tokens');
      log.info('Tokens cleared successfully');
    } catch (error) {
      log.error('Failed to clear tokens:', error);
      throw error;
    }
  }

  /**
   * 修复损坏的存储
   * Requirements: 7.6
   */
  async repair(): Promise<void> {
    try {
      log.warn('Attempting to repair storage...');
      
      // 备份当前存储
      const backupPath = `${store.path}.backup`;
      // 这里应该实现备份逻辑
      
      // 清除损坏的数据
      await this.clearAll();
      
      // 重新初始化默认配置
      await this.saveConfig(this.getDefaultConfig());
      
      log.info('Storage repaired successfully');
    } catch (error) {
      log.error('Failed to repair storage:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const storageManager = StorageManager.getInstance();
export { StorageManager, AppConfig, Account, TokenData };
