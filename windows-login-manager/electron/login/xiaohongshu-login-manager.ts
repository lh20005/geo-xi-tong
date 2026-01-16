import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 小红书专用登录管理器
 * 参照GEO应用的xhs.js实现
 * 
 * 核心策略：
 * 1. 使用 webview 标签嵌入登录页面
 * 2. 检测 .account-name 元素判断登录成功
 * 3. 提取真实用户名并保存
 */

interface XiaohongshuLoginResult {
  success: boolean;
  account?: {
    platform_id: string;
    account_name: string;
    real_username: string;
    credentials: {
      cookies: Cookie[];
      storage: StorageData;
      userInfo: {
        username: string;
        avatar?: string;
        account?: string;
      };
      loginTime: string;
    };
  };
  message?: string;
  error?: string;
}

class XiaohongshuLoginManager {
  private static instance: XiaohongshuLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private loginResolve: ((result: boolean) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // 小红书配置 - 从GEO应用的xhs.js提取
  private readonly PLATFORM_ID = 'xiaohongshu';
  private readonly PLATFORM_NAME = '小红书';
  private readonly LOGIN_URL = 'https://creator.xiaohongshu.com/login';
  private readonly SUCCESS_URL_PATTERNS = [
    'creator.xiaohongshu.com/new/home',
    'creator.xiaohongshu.com/creator'
  ];
  
  // 从GEO应用xhs.js提取的选择器
  private readonly USERNAME_SELECTOR = '.account-name';
  private readonly AVATAR_SELECTOR = '.avatar img';
  private readonly ACCOUNT_SELECTOR = '.others.description-text div';
  private readonly CHECK_INTERVAL = 2000; // GEO应用使用2秒间隔

  // 当前登录使用的临时 partition
  private currentPartition: string = '';

  private constructor() {}

  static getInstance(): XiaohongshuLoginManager {
    if (!XiaohongshuLoginManager.instance) {
      XiaohongshuLoginManager.instance = new XiaohongshuLoginManager();
    }
    return XiaohongshuLoginManager.instance;
  }

  /**
   * 开始登录流程
   */
  async login(parentWindow: BrowserWindow): Promise<XiaohongshuLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Xiaohongshu] 开始登录流程`);

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
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. 提取用户信息 - 按照GEO应用的方式
      const userInfo = await this.extractUserInfo();
      if (!userInfo || !userInfo.username) {
        await this.cleanup();
        return {
          success: false,
          message: '无法提取用户信息'
        };
      }

      log.info(`[Xiaohongshu] 用户信息提取成功: ${userInfo.username}`);

      // 5. 获取 Cookies
      const cookies = await this.getCookies();
      log.info(`[Xiaohongshu] 获取到 ${cookies.length} 个Cookie`);

      // 6. 获取 Storage
      const storage = await this.getStorage();

      // 7. 构建账号数据
      const account = {
        platform_id: this.PLATFORM_ID,
        account_name: userInfo.username,
        real_username: userInfo.username, // 真实用户名
        credentials: {
          cookies,
          storage,
          userInfo,
          loginTime: new Date().toISOString()
        }
      };

      // 8. 先同步到后端（必须先同步，确保后端有数据）
      const backendAccount = await this.syncAccountToBackend(account);
      
      // 9. 同步成功后，使用后端返回的账号ID保存到本地
      if (backendAccount && backendAccount.id) {
        (account as any).id = backendAccount.id;
        await this.saveAccountLocally(account);
      } else {
        log.warn('[Xiaohongshu] 后端同步失败，不保存到本地缓存');
      }

      // 10. 清理
      await this.cleanup();

      this.isLoginInProgress = false;
      log.info('[Xiaohongshu] 登录完成');

      return {
        success: true,
        account,
        message: '登录成功'
      };
    } catch (error) {
      log.error('[Xiaohongshu] 登录失败:', error);
      await this.cleanup();
      this.isLoginInProgress = false;

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: '登录失败'
      };
    }
  }

  /**
   * 创建 WebView
   */
  private async createWebView(): Promise<void> {
    // 使用临时 partition，确保每次登录都是全新环境
    this.currentPartition = `login-${this.PLATFORM_ID}-${Date.now()}`;
    log.info(`[Xiaohongshu] 使用临时 partition: ${this.currentPartition}`);

    await webViewManager.createWebView(this.parentWindow!, {
      url: this.LOGIN_URL,
      partition: this.currentPartition
    });

    await webViewManager.waitForLoad();
    log.info('[Xiaohongshu] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 参照GEO应用xhs.js的检测逻辑
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    return new Promise((resolve) => {
      let checkCount = 0;
      const maxChecks = 150; // 2秒 * 150 = 5分钟超时

      this.checkInterval = setInterval(async () => {
        if (this.isCancelled) {
          if (this.checkInterval) clearInterval(this.checkInterval);
          resolve(false);
          return;
        }

        checkCount++;
        if (checkCount > maxChecks) {
          log.warn('[Xiaohongshu] 登录超时');
          if (this.checkInterval) clearInterval(this.checkInterval);
          resolve(false);
          return;
        }

        try {
          // 检测登录成功的标志 - 按照GEO应用的方式
          const isLoggedIn = await webViewManager.executeJavaScript<boolean>(`
            (function() {
              const nameElement = document.querySelector('${this.USERNAME_SELECTOR}');
              if (nameElement && nameElement.textContent) {
                console.log('[Xiaohongshu] 检测到登录成功');
                return true;
              }
              return false;
            })();
          `);

          if (isLoggedIn) {
            log.info('[Xiaohongshu] 登录成功');
            if (this.checkInterval) clearInterval(this.checkInterval);
            resolve(true);
          }
        } catch (error) {
          // 继续检测
        }
      }, this.CHECK_INTERVAL);
    });
  }

  /**
   * 提取用户信息
   * 完全按照GEO应用xhs.js的方式
   */
  private async extractUserInfo(): Promise<{ username: string; avatar?: string; account?: string } | null> {
    try {
      const userInfo = await webViewManager.executeJavaScript<any>(`
        (function() {
          // 按照GEO应用xhs.js的方式提取
          const nameElement = document.querySelector('${this.USERNAME_SELECTOR}');
          if (!nameElement) {
            console.log('[Xiaohongshu] 未找到用户名元素');
            return null;
          }

          const username = nameElement.textContent.trim();
          console.log('[Xiaohongshu] 用户名:', username);

          let avatar = '';
          try {
            const avatarElement = document.querySelector('${this.AVATAR_SELECTOR}');
            if (avatarElement) {
              avatar = avatarElement.getAttribute('src') || '';
              console.log('[Xiaohongshu] 头像:', avatar);
            }
          } catch (e) {
            console.log('[Xiaohongshu] 获取头像失败');
          }

          let account = '';
          try {
            const accountElement = document.querySelector('${this.ACCOUNT_SELECTOR}');
            if (accountElement) {
              account = accountElement.textContent.trim();
              console.log('[Xiaohongshu] 账号:', account);
            }
          } catch (e) {
            console.log('[Xiaohongshu] 获取账号失败');
          }

          return {
            username,
            avatar,
            account
          };
        })();
      `);

      return userInfo;
    } catch (error) {
      log.error('[Xiaohongshu] 提取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 获取 Cookies
   */
  private async getCookies(): Promise<Cookie[]> {
    try {
      const partition = this.currentPartition;
      const ses = session.fromPartition(partition);
      const cookies = await ses.cookies.get({});

      return cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.xiaohongshu.com',
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as any
      }));
    } catch (error) {
      log.error('[Xiaohongshu] 获取Cookie失败:', error);
      return [];
    }
  }

  /**
   * 获取 Storage
   */
  private async getStorage(): Promise<StorageData> {
    try {
      const storage = await webViewManager.executeJavaScript<StorageData>(`
        (function() {
          const localStorageData = {};
          const sessionStorageData = {};

          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                localStorageData[key] = localStorage.getItem(key) || '';
              }
            }
          } catch (e) {}

          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key) {
                sessionStorageData[key] = sessionStorage.getItem(key) || '';
              }
            }
          } catch (e) {}

          return {
            localStorage: localStorageData,
            sessionStorage: sessionStorageData
          };
        })();
      `);

      return storage || { localStorage: {}, sessionStorage: {} };
    } catch (error) {
      log.error('[Xiaohongshu] 获取Storage失败:', error);
      return { localStorage: {}, sessionStorage: {} };
    }
  }

  /**
   * 保存账号到本地 SQLite
   */
  private async saveAccountLocally(account: any): Promise<void> {
    try {
      log.info('[Xiaohongshu] 保存账号到本地 SQLite...');

      const result = await syncService.saveAccountToLocal({
        platform_id: account.platform_id,
        account_name: account.account_name,
        real_username: account.real_username,
        credentials: account.credentials
      });

      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }

      log.info(`[Xiaohongshu] 账号保存到本地 SQLite 成功, ID: ${result.accountId}`);
    } catch (error) {
      log.error('[Xiaohongshu] 保存账号到本地 SQLite 失败:', error);
      throw error;
    }
  }

  /**
   * 同步账号到后端
   * 返回后端创建的账号对象（包含ID）
   */
  private async syncAccountToBackend(account: any): Promise<any> {
    try {
      const result = await syncService.syncAccount(account);
      if (result.success) {
        log.info('[Xiaohongshu] 账号已同步到后端');
        return result.account; // 返回后端创建的账号对象
      } else {
        log.error('[Xiaohongshu] 账号同步失败:', result.error);
        throw new Error(result.error || '同步失败');
      }
    } catch (error) {
      log.error('[Xiaohongshu] 同步账号到后端失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      await webViewManager.destroyWebView();
    } catch (error) {
      log.error('[Xiaohongshu] 清理资源失败:', error);
    }
  }

  /**
   * 取消登录
   */
  async cancelLogin(): Promise<void> {
    if (!this.isLoginInProgress) {
      return;
    }

    log.info('[Xiaohongshu] 取消登录');
    this.isCancelled = true;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    await this.cleanup();

    if (this.loginResolve) {
      this.loginResolve(false);
      this.loginResolve = null;
    }

    this.isLoginInProgress = false;
  }

  /**
   * 获取登录状态
   */
  isLoggingIn(): boolean {
    return this.isLoginInProgress;
  }
}

export const xiaohongshuLoginManager = XiaohongshuLoginManager.getInstance();
export { XiaohongshuLoginManager };
