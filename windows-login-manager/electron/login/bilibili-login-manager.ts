import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 哔哩哔哩专用登录管理器
 * 基于 GEO 应用的 bili.js 实现
 * 
 * 核心策略：
 * 1. 检测元素 span.right-entry-text
 * 2. 使用 API 获取用户信息: https://api.bilibili.com/x/web-interface/nav
 * 3. 检查间隔: 2000ms
 */

interface BilibiliLoginResult {
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

interface BilibiliUserInfo {
  username: string;
  avatar?: string;
}

class BilibiliLoginManager {
  private static instance: BilibiliLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private loginResolve: ((result: boolean) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // 哔哩哔哩配置 - 从 GEO 应用 bili.js 提取
  private readonly PLATFORM_ID = 'bilibili';
  private readonly PLATFORM_NAME = '哔哩哔哩';
  private readonly LOGIN_URL = 'https://member.bilibili.com/platform/home';
  private readonly SUCCESS_URL_PATTERN = 'member.bilibili.com/platform';
  private readonly DETECT_SELECTOR = 'span.right-entry-text';
  private readonly USER_API = 'https://api.bilibili.com/x/web-interface/nav';
  private readonly CHECK_INTERVAL = 2000; // 2秒检查间隔

  // 当前登录使用的临时 partition
  private currentPartition: string = '';

  private constructor() {}

  static getInstance(): BilibiliLoginManager {
    if (!BilibiliLoginManager.instance) {
      BilibiliLoginManager.instance = new BilibiliLoginManager();
    }
    return BilibiliLoginManager.instance;
  }

  /**
   * 开始登录流程
   */
  async login(parentWindow: BrowserWindow): Promise<BilibiliLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Bilibili] 开始登录流程`);

    try {
      // 1. 创建 WebView
      await this.createWebView();

      // 2. 等待登录成功
      const loginSuccess = await this.waitForLoginSuccess();
      if (!loginSuccess) {
        await this.cleanup();
        if (this.isCancelled) {
          return {
            success: false,
            message: '登录已取消'
          };
        }
        return {
          success: false,
          message: '登录超时或失败'
        };
      }

      // 3. 等待页面稳定
      await this.waitForPageStable();

      // 4. 提取用户信息
      const userInfo = await this.extractUserInfo();
      if (!userInfo || !userInfo.username) {
        throw new Error('无法提取用户信息');
      }

      log.info(`[Bilibili] 用户信息提取成功: ${userInfo.username}`);

      // 5. 捕获登录凭证
      const credentials = await this.captureCredentials();

      // 6. 构建账号数据
      const account = {
        platform_id: this.PLATFORM_ID,
        account_name: userInfo.username,
        real_username: userInfo.username,
        credentials: {
          ...credentials,
          loginTime: new Date().toISOString()
        }
      };

      // 7. 保存账号
      await this.saveAccount(account);

      // 8. 同步到后端
      await this.syncToBackend(account);

      // 9. 清理资源
      await this.cleanup();

      log.info(`[Bilibili] 登录成功完成`);
      return {
        success: true,
        account,
        message: '登录成功'
      };

    } catch (error) {
      log.error('[Bilibili] 登录失败:', error);
      await this.cleanup();

      if (this.isCancelled) {
        return {
          success: false,
          message: '登录已取消'
        };
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
    log.info('[Bilibili] 取消登录');
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

    log.info('[Bilibili] 创建 WebView');

    // 使用临时 partition，确保每次登录都是全新的会话
    this.currentPartition = `temp-login-${this.PLATFORM_ID}-${Date.now()}`;
    log.info(`[Bilibili] 使用临时 partition: ${this.currentPartition}`);

    await webViewManager.createWebView(this.parentWindow, {
      url: this.LOGIN_URL,
      partition: this.currentPartition,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    log.info('[Bilibili] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 策略：检测特定元素出现
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    log.info('[Bilibili] 等待登录成功...');
    const startTime = Date.now();
    const timeout = 300000; // 5分钟

    return new Promise((resolve) => {
      this.loginResolve = resolve;

      this.checkInterval = setInterval(async () => {
        // 检查是否取消
        if (this.isCancelled) {
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
          }
          resolve(false);
          return;
        }

        // 检查超时
        if (Date.now() - startTime > timeout) {
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
          }
          log.warn('[Bilibili] 登录超时');
          resolve(false);
          return;
        }

        // 检查元素是否出现
        try {
          const hasElement = await webViewManager.executeJavaScript<boolean>(`
            (() => {
              const element = document.querySelector('${this.DETECT_SELECTOR}');
              return element !== null;
            })()
          `);

          if (hasElement) {
            if (this.checkInterval) {
              clearInterval(this.checkInterval);
              this.checkInterval = null;
            }
            log.info(`[Bilibili] 登录成功检测到元素`);
            resolve(true);
            return;
          }
        } catch (error) {
          log.debug('[Bilibili] 检查元素失败:', error);
        }
      }, this.CHECK_INTERVAL);
    });
  }

  /**
   * 等待页面稳定
   */
  private async waitForPageStable(): Promise<void> {
    log.info('[Bilibili] 等待页面稳定...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 提取用户信息
   * 使用 API 获取用户信息
   */
  private async extractUserInfo(): Promise<BilibiliUserInfo | null> {
    log.info('[Bilibili] 提取用户信息...');

    try {
      // 使用 API 获取用户信息
      const userInfo = await webViewManager.executeJavaScript<any>(`
        (async () => {
          try {
            const response = await fetch('${this.USER_API}');
            const data = await response.json();
            return {
              username: data.data?.uname || '',
              avatar: data.data?.face || ''
            };
          } catch (error) {
            console.error('获取用户信息失败:', error);
            return null;
          }
        })()
      `);

      if (userInfo && userInfo.username) {
        log.info(`[Bilibili] 用户名提取成功: ${userInfo.username}`);
        return userInfo;
      }

      log.warn('[Bilibili] 无法提取用户信息');
      return null;
    } catch (error) {
      log.error('[Bilibili] 提取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 捕获登录凭证
   */
  private async captureCredentials(): Promise<{ cookies: Cookie[]; storage: StorageData }> {
    if (!this.parentWindow) {
      throw new Error('父窗口不存在');
    }

    log.info('[Bilibili] 捕获登录凭证...');

    // 通过 session 获取 cookies
    const ses = session.fromPartition(this.currentPartition);
    const electronCookies = await ses.cookies.get({});
    
    const cookies: Cookie[] = electronCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.bilibili.com',
      path: cookie.path || '/',
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: this.convertSameSite(cookie.sameSite)
    }));

    log.info(`[Bilibili] 捕获 ${cookies.length} 个 Cookies`);

    // 捕获 Storage
    const localStorage = await webViewManager.executeJavaScript<Record<string, string>>(`
      (() => {
        const data = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              data[key] = localStorage.getItem(key);
            }
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
            if (key) {
              data[key] = sessionStorage.getItem(key);
            }
          }
        } catch (e) {}
        return data;
      })()
    `);

    log.info(`[Bilibili] 捕获 Storage - localStorage: ${Object.keys(localStorage || {}).length}, sessionStorage: ${Object.keys(sessionStorage || {}).length}`);

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
      log.info('[Bilibili] 保存账号到本地...');

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
        log.info('[Bilibili] 更新现有账号');
      } else {
        existingAccounts.push({
          id: Date.now(),
          ...account,
          is_default: existingAccounts.length === 0,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
        log.info('[Bilibili] 添加新账号');
      }

      await storageManager.saveAccountsCache(existingAccounts);
      log.info('[Bilibili] 账号保存成功');
    } catch (error) {
      log.error('[Bilibili] 保存账号失败:', error);
      throw error;
    }
  }

  /**
   * 同步到后端
   */
  private async syncToBackend(account: any): Promise<void> {
    try {
      log.info('[Bilibili] 同步账号到后端...');
      const result = await syncService.syncAccount(account);
      
      if (result.success) {
        log.info('[Bilibili] 账号同步成功');
      } else {
        log.warn('[Bilibili] 账号同步失败，已加入队列:', result.error);
      }
    } catch (error) {
      log.error('[Bilibili] 同步账号失败:', error);
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    log.info('[Bilibili] 清理资源...');

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
      case 'strict':
        return 'Strict';
      case 'lax':
        return 'Lax';
      case 'none':
        return 'no_restriction' as any;
      default:
        return undefined;
    }
  }

  /**
   * 检查是否正在登录
   */
  isLoggingIn(): boolean {
    return this.isLoginInProgress;
  }
}

export const bilibiliLoginManager = BilibiliLoginManager.getInstance();
export { BilibiliLoginManager, BilibiliLoginResult };
