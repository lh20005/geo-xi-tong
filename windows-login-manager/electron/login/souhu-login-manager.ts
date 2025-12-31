import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 搜狐号专用登录管理器
 * 严格按照 GEO 应用的 sh.js 实现
 * 
 * 核心逻辑：
 * 1. 检测 .user-name 元素的文本内容
 * 2. 如果存在用户名，则登录成功
 * 3. 获取头像 .user-pic 的 src 属性
 * 4. 获取 document.cookie
 */

interface SouhuLoginResult {
  success: boolean;
  account?: {
    platform_id: string;
    account_name: string;
    real_username: string;
    credentials: {
      cookies: Cookie[];
      storage: StorageData;
      loginTime: string;
    };
  };
  message?: string;
  error?: string;
}

class SouhuLoginManager {
  private static instance: SouhuLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private loginResolve: ((result: boolean) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // 搜狐号配置
  private readonly PLATFORM_ID = 'souhu';
  private readonly LOGIN_URL = 'https://mp.sohu.com/mpfe/v4/login';
  private readonly CHECK_INTERVAL = 1000; // 1秒检查间隔

  // 当前登录使用的临时 partition
  private currentPartition: string = '';

  private constructor() {}

  static getInstance(): SouhuLoginManager {
    if (!SouhuLoginManager.instance) {
      SouhuLoginManager.instance = new SouhuLoginManager();
    }
    return SouhuLoginManager.instance;
  }

  /**
   * 开始登录流程
   */
  async login(parentWindow: BrowserWindow): Promise<SouhuLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Souhu] 开始登录流程`);

    try {
      // 1. 创建 WebView
      await this.createWebView();

      // 2. 等待登录成功
      const userInfo = await this.waitForLoginSuccess();
      if (!userInfo) {
        await this.cleanup();
        if (this.isCancelled) {
          return { success: false, message: '登录已取消' };
        }
        return { success: false, message: '登录超时或失败' };
      }

      log.info(`[Souhu] 登录成功，用户名: ${userInfo.name}`);

      // 3. 捕获登录凭证
      const credentials = await this.captureCredentials();

      // 4. 构建账号数据
      const account = {
        platform_id: this.PLATFORM_ID,
        account_name: userInfo.name,
        real_username: userInfo.name,
        credentials: {
          ...credentials,
          loginTime: new Date().toISOString()
        }
      };

      // 5. 同步到后端
      const backendAccount = await this.syncToBackend(account);

      // 6. 保存到本地
      if (backendAccount && backendAccount.id) {
        (account as any).id = backendAccount.id;
        await this.saveAccount(account);
      }

      // 7. 清理资源
      await this.cleanup();

      return {
        success: true,
        account,
        message: '登录成功'
      };

    } catch (error) {
      log.error('[Souhu] 登录失败:', error);
      await this.cleanup();

      if (this.isCancelled) {
        return { success: false, message: '登录已取消' };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: '登录失败'
      };
    }
  }

  /**
   * 取消登录
   */
  async cancelLogin(): Promise<void> {
    log.info('[Souhu] 取消登录');
    this.isCancelled = true;
    
    if (this.loginResolve) {
      this.loginResolve(false);
      this.loginResolve = null;
    }
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    await this.cleanup();
  }

  /**
   * 创建 WebView
   */
  private async createWebView(): Promise<void> {
    if (!this.parentWindow) {
      throw new Error('父窗口不存在');
    }

    log.info('[Souhu] 创建 WebView');

    // 使用临时 partition，确保每次登录都是全新环境
    this.currentPartition = `login-${this.PLATFORM_ID}-${Date.now()}`;
    log.info(`[Souhu] 使用临时 partition: ${this.currentPartition}`);

    await webViewManager.createWebView(this.parentWindow, {
      url: this.LOGIN_URL,
      partition: this.currentPartition,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    log.info('[Souhu] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 严格按照 GEO 应用逻辑：检测 .user-name 元素的文本内容
   */
  private async waitForLoginSuccess(): Promise<{ name: string; avatar: string | null } | null> {
    log.info('[Souhu] 等待登录成功...');
    const startTime = Date.now();
    const timeout = 300000; // 5分钟

    return new Promise((resolve) => {
      this.checkInterval = setInterval(async () => {
        // 检查是否取消
        if (this.isCancelled) {
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
          }
          resolve(null);
          return;
        }

        // 检查超时
        if (Date.now() - startTime > timeout) {
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
          }
          log.warn('[Souhu] 登录超时');
          resolve(null);
          return;
        }

        try {
          // 严格按照 GEO 应用逻辑：检测 .user-name 元素
          const result = await webViewManager.executeJavaScript<{ name: string | null; avatar: string | null }>(`
            (() => {
              let name = null;
              let avatar = null;
              
              // 检测用户名
              const userNameEl = document.querySelector('.user-name');
              if (userNameEl) {
                name = userNameEl.textContent;
              }
              
              // 获取头像
              const avatarEl = document.querySelector('.user-pic');
              if (avatarEl) {
                try {
                  avatar = avatarEl.getAttribute('src');
                } catch(e) {}
              }
              
              return { name, avatar };
            })()
          `);

          if (result.name !== null && result.name !== undefined && result.name.trim() !== '') {
            if (this.checkInterval) {
              clearInterval(this.checkInterval);
              this.checkInterval = null;
            }
            log.info(`[Souhu] ✅ 登录成功！用户名: ${result.name}`);
            resolve({ name: result.name.trim(), avatar: result.avatar });
            return;
          }

          log.debug('[Souhu] 还未登录成功，继续等待...');
        } catch (error) {
          log.debug('[Souhu] 检查登录状态失败:', error);
        }
      }, this.CHECK_INTERVAL);
    });
  }

  /**
   * 捕获登录凭证
   */
  private async captureCredentials(): Promise<{ cookies: Cookie[]; storage: StorageData }> {
    log.info('[Souhu] 捕获登录凭证...');

    // 通过 session 获取 cookies
    const ses = session.fromPartition(this.currentPartition);
    const electronCookies = await ses.cookies.get({});
    
    const cookies: Cookie[] = electronCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.sohu.com',
      path: cookie.path || '/',
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: this.convertSameSite(cookie.sameSite)
    }));

    log.info(`[Souhu] 捕获 ${cookies.length} 个 Cookies`);

    // 捕获 Storage
    const localStorage = await webViewManager.executeJavaScript<Record<string, string>>(`
      (() => {
        const data = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) data[key] = localStorage.getItem(key);
          }
        } catch (e) {}
        return data;
      })()
    `);

    const sessionStorage = await webViewManager.executeJavaScript<Record<string, string>>(`
      (() => {
        const data = {};
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) data[key] = sessionStorage.getItem(key);
          }
        } catch (e) {}
        return data;
      })()
    `);

    return {
      cookies,
      storage: {
        localStorage: localStorage || {},
        sessionStorage: sessionStorage || {}
      }
    };
  }

  /**
   * 保存账号到本地
   */
  private async saveAccount(account: any): Promise<void> {
    try {
      log.info('[Souhu] 保存账号到本地...');

      const existingAccounts = await storageManager.getAccountsCache();
      const existingIndex = existingAccounts.findIndex(
        a => a.platform_id === account.platform_id && a.account_name === account.account_name
      );

      if (existingIndex >= 0) {
        existingAccounts[existingIndex] = {
          ...existingAccounts[existingIndex],
          ...account,
          updated_at: new Date()
        };
      } else {
        existingAccounts.push({
          id: Date.now(),
          ...account,
          is_default: existingAccounts.length === 0,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      await storageManager.saveAccountsCache(existingAccounts);
      log.info('[Souhu] 账号保存成功');
    } catch (error) {
      log.error('[Souhu] 保存账号失败:', error);
      throw error;
    }
  }

  /**
   * 同步到后端
   */
  private async syncToBackend(account: any): Promise<any> {
    try {
      log.info('[Souhu] 同步账号到后端...');
      const result = await syncService.syncAccount(account);
      
      if (result.success) {
        log.info('[Souhu] 账号同步成功');
        return result.account;
      } else {
        log.error('[Souhu] 账号同步失败:', result.error);
        throw new Error(result.error || '同步失败');
      }
    } catch (error) {
      log.error('[Souhu] 同步账号失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    log.info('[Souhu] 清理资源...');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    await webViewManager.destroyWebView();

    this.parentWindow = null;
    this.isLoginInProgress = false;
    this.loginResolve = null;
  }

  /**
   * 转换 SameSite 属性
   */
  private convertSameSite(sameSite: string | undefined): 'Strict' | 'Lax' | 'None' | undefined {
    if (!sameSite) return undefined;
    switch (sameSite.toLowerCase()) {
      case 'strict': return 'Strict';
      case 'lax': return 'Lax';
      case 'none': return 'None';
      case 'no_restriction': return 'None';
      default: return undefined;
    }
  }

  /**
   * 检查是否正在登录
   */
  isLoggingIn(): boolean {
    return this.isLoginInProgress;
  }
}

export const souhuLoginManager = SouhuLoginManager.getInstance();
export { SouhuLoginManager, SouhuLoginResult };
