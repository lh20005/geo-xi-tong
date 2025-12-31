import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 网易号专用登录管理器
 * 基于 GEO 应用的 wy.js 实现
 * 
 * 核心策略：
 * 1. 检测用户名元素 .topBar__user>span (第3个元素)
 * 2. 检查间隔: 1000ms
 */

interface WangyiLoginResult {
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

interface WangyiUserInfo {
  username: string;
  avatar?: string;
}

class WangyiLoginManager {
  private static instance: WangyiLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private loginResolve: ((result: boolean) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // 网易号配置 - 从 GEO 应用 wy.js 提取
  private readonly PLATFORM_ID = 'wangyi';
  private readonly PLATFORM_NAME = '网易号';
  private readonly LOGIN_URL = 'https://mp.163.com/login.html';
  private readonly SUCCESS_URL_PATTERN = 'mp.163.com/';
  private readonly USERNAME_SELECTOR = '.topBar__user>span';
  private readonly AVATAR_SELECTOR = '.topBar__user>span>img';
  private readonly CHECK_INTERVAL = 1000; // 1秒检查间隔

  // 当前登录使用的临时 partition
  private currentPartition: string = '';

  private constructor() {}

  static getInstance(): WangyiLoginManager {
    if (!WangyiLoginManager.instance) {
      WangyiLoginManager.instance = new WangyiLoginManager();
    }
    return WangyiLoginManager.instance;
  }

  /**
   * 开始登录流程
   */
  async login(parentWindow: BrowserWindow): Promise<WangyiLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Wangyi] 开始登录流程`);

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

      log.info(`[Wangyi] 用户信息提取成功: ${userInfo.username}`);

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

      log.info(`[Wangyi] 登录成功完成`);
      return {
        success: true,
        account,
        message: '登录成功'
      };

    } catch (error) {
      log.error('[Wangyi] 登录失败:', error);
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
    log.info('[Wangyi] 取消登录');
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

    log.info('[Wangyi] 创建 WebView');

    // 使用临时 partition，确保每次登录都是全新的会话
    this.currentPartition = `temp-login-${this.PLATFORM_ID}-${Date.now()}`;
    log.info(`[Wangyi] 使用临时 partition: ${this.currentPartition}`);

    await webViewManager.createWebView(this.parentWindow, {
      url: this.LOGIN_URL,
      partition: this.currentPartition,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    log.info('[Wangyi] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 策略：检测用户名元素出现（第3个span元素）
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    log.info('[Wangyi] 等待登录成功...');
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
          log.warn('[Wangyi] 登录超时');
          resolve(false);
          return;
        }

        // 检查用户名元素是否出现（第3个span元素）
        try {
          const username = await webViewManager.executeJavaScript<string | null>(`
            (() => {
              const elements = document.querySelectorAll('${this.USERNAME_SELECTOR}');
              if (elements.length >= 3) {
                return elements[2].textContent.trim();
              }
              return null;
            })()
          `);

          if (username) {
            if (this.checkInterval) {
              clearInterval(this.checkInterval);
              this.checkInterval = null;
            }
            log.info(`[Wangyi] 登录成功检测到用户名: ${username}`);
            resolve(true);
            return;
          }
        } catch (error) {
          log.debug('[Wangyi] 检查用户名元素失败:', error);
        }
      }, this.CHECK_INTERVAL);
    });
  }

  /**
   * 等待页面稳定
   */
  private async waitForPageStable(): Promise<void> {
    log.info('[Wangyi] 等待页面稳定...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 提取用户信息
   * 注意：用户名在第3个span元素中
   */
  private async extractUserInfo(): Promise<WangyiUserInfo | null> {
    log.info('[Wangyi] 提取用户信息...');

    try {
      const username = await webViewManager.executeJavaScript<string | null>(`
        (() => {
          const elements = document.querySelectorAll('${this.USERNAME_SELECTOR}');
          if (elements.length >= 3) {
            return elements[2].textContent.trim();
          }
          return null;
        })()
      `);

      const avatar = await webViewManager.executeJavaScript<string | null>(`
        (() => {
          const element = document.querySelector('${this.AVATAR_SELECTOR}');
          return element ? element.src : null;
        })()
      `);

      if (username) {
        log.info(`[Wangyi] 用户名提取成功: ${username}`);
        return { username, avatar: avatar || undefined };
      }

      log.warn('[Wangyi] 无法提取用户信息');
      return null;
    } catch (error) {
      log.error('[Wangyi] 提取用户信息失败:', error);
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

    log.info('[Wangyi] 捕获登录凭证...');

    // 通过 session 获取 cookies
    const ses = session.fromPartition(this.currentPartition);
    const electronCookies = await ses.cookies.get({});
    
    const cookies: Cookie[] = electronCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.163.com',
      path: cookie.path || '/',
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: this.convertSameSite(cookie.sameSite)
    }));

    log.info(`[Wangyi] 捕获 ${cookies.length} 个 Cookies`);

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

    log.info(`[Wangyi] 捕获 Storage - localStorage: ${Object.keys(localStorage || {}).length}, sessionStorage: ${Object.keys(sessionStorage || {}).length}`);

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
      log.info('[Wangyi] 保存账号到本地...');

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
        log.info('[Wangyi] 更新现有账号');
      } else {
        existingAccounts.push({
          id: Date.now(),
          ...account,
          is_default: existingAccounts.length === 0,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
        log.info('[Wangyi] 添加新账号');
      }

      await storageManager.saveAccountsCache(existingAccounts);
      log.info('[Wangyi] 账号保存成功');
    } catch (error) {
      log.error('[Wangyi] 保存账号失败:', error);
      throw error;
    }
  }

  /**
   * 同步到后端
   */
  private async syncToBackend(account: any): Promise<void> {
    try {
      log.info('[Wangyi] 同步账号到后端...');
      const result = await syncService.syncAccount(account);
      
      if (result.success) {
        log.info('[Wangyi] 账号同步成功');
      } else {
        log.warn('[Wangyi] 账号同步失败，已加入队列:', result.error);
      }
    } catch (error) {
      log.error('[Wangyi] 同步账号失败:', error);
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    log.info('[Wangyi] 清理资源...');

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

export const wangyiLoginManager = WangyiLoginManager.getInstance();
export { WangyiLoginManager, WangyiLoginResult };
