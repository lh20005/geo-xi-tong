import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 微信公众号专用登录管理器
 * 参照GEO应用的wxgzh.js实现
 * 
 * GEO应用关键代码：
 * - 用户名选择器: .weui-desktop_name
 * - 头像选择器: .weui-desktop-account__img
 * - 粉丝数选择器: .weui-desktop-user_sum span (第2个)
 * - 检查间隔: 2000ms
 */

interface WechatLoginResult {
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
        followerCount?: string;
      };
      loginTime: string;
    };
  };
  message?: string;
  error?: string;
}

class WechatLoginManager {
  private static instance: WechatLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private checkInterval: NodeJS.Timeout | null = null;

  // 微信公众号配置 - 从GEO应用的wxgzh.js提取
  private readonly PLATFORM_ID = 'wechat';
  private readonly PLATFORM_NAME = '微信公众号';
  private readonly LOGIN_URL = 'https://mp.weixin.qq.com/';
  private readonly SUCCESS_URL_PATTERNS = [
    'mp.weixin.qq.com/cgi-bin'
  ];
  
  // 从GEO应用wxgzh.js提取的选择器
  private readonly USERNAME_SELECTOR = '.weui-desktop_name';
  private readonly AVATAR_SELECTOR = '.weui-desktop-account__img';
  private readonly FOLLOWER_SELECTOR = '.weui-desktop-user_sum span';
  private readonly CHECK_INTERVAL = 2000; // GEO应用使用2秒间隔

  // 当前登录使用的临时 partition
  private currentPartition: string = '';

  private constructor() {}

  static getInstance(): WechatLoginManager {
    if (!WechatLoginManager.instance) {
      WechatLoginManager.instance = new WechatLoginManager();
    }
    return WechatLoginManager.instance;
  }

  async login(parentWindow: BrowserWindow): Promise<WechatLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Wechat] 开始登录流程`);

    try {
      // 1. 创建 WebView
      await this.createWebView();

      // 2. 等待登录成功
      const loginSuccess = await this.waitForLoginSuccess();
      if (!loginSuccess) {
        await this.cleanup();
        if (this.isCancelled) {
          return { success: false, message: '登录已取消' };
        }
        return { success: false, message: '登录超时或失败' };
      }

      // 3. 等待页面稳定
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. 提取用户信息 - 完全按照GEO应用的方式
      const userInfo = await this.extractUserInfo();
      if (!userInfo || !userInfo.username) {
        await this.cleanup();
        return { success: false, message: '无法提取用户信息' };
      }

      log.info(`[Wechat] 用户信息提取成功: ${userInfo.username}`);

      // 5. 获取 Cookies
      const cookies = await this.getCookies();
      log.info(`[Wechat] 获取到 ${cookies.length} 个Cookie`);

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
        log.warn('[Wechat] 后端同步失败，不保存到本地缓存');
      }

      // 10. 清理
      await this.cleanup();

      this.isLoginInProgress = false;
      log.info('[Wechat] 登录完成');

      return {
        success: true,
        account,
        message: '登录成功'
      };
    } catch (error) {
      log.error('[Wechat] 登录失败:', error);
      await this.cleanup();
      this.isLoginInProgress = false;

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: '登录失败'
      };
    }
  }

  private async createWebView(): Promise<void> {
    // 使用临时 partition，确保每次登录都是全新环境
    this.currentPartition = `login-${this.PLATFORM_ID}-${Date.now()}`;
    
    await webViewManager.createWebView(this.parentWindow!, {
      url: this.LOGIN_URL,
      partition: this.currentPartition
    });

    await webViewManager.waitForLoad();
    log.info('[Wechat] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 参照GEO应用wxgzh.js: 检测 .weui-desktop_name 元素
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
          log.warn('[Wechat] 登录超时');
          if (this.checkInterval) clearInterval(this.checkInterval);
          resolve(false);
          return;
        }

        try {
          // 按照GEO应用wxgzh.js的检测逻辑
          const isLoggedIn = await webViewManager.executeJavaScript<boolean>(`
            (function() {
              const nameElement = document.querySelector('${this.USERNAME_SELECTOR}');
              if (nameElement && nameElement.textContent && nameElement.textContent.trim()) {
                console.log('[Wechat] 检测到登录成功，用户名:', nameElement.textContent);
                return true;
              }
              return false;
            })();
          `);

          if (isLoggedIn) {
            log.info('[Wechat] 登录成功');
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
   * 完全按照GEO应用wxgzh.js的方式
   */
  private async extractUserInfo(): Promise<{ username: string; avatar?: string; followerCount?: string } | null> {
    try {
      const userInfo = await webViewManager.executeJavaScript<any>(`
        (function() {
          console.log('[Wechat] 开始提取用户信息');
          
          // 提取用户名 - 按照GEO应用wxgzh.js
          const nameElement = document.querySelector('${this.USERNAME_SELECTOR}');
          if (!nameElement || !nameElement.textContent) {
            console.log('[Wechat] 未找到用户名元素');
            return null;
          }

          const username = nameElement.textContent.trim();
          console.log('[Wechat] 用户名:', username);

          // 提取头像 - 按照GEO应用wxgzh.js
          let avatar = '';
          try {
            const avatarElement = document.querySelector('${this.AVATAR_SELECTOR}');
            if (avatarElement) {
              avatar = avatarElement.getAttribute('src') || '';
              console.log('[Wechat] 头像:', avatar);
            }
          } catch (e) {
            console.log('[Wechat] 获取头像失败:', e);
          }

          // 提取粉丝数 - 按照GEO应用wxgzh.js (第2个span元素)
          let followerCount = '';
          try {
            const followerElements = document.querySelectorAll('${this.FOLLOWER_SELECTOR}');
            if (followerElements && followerElements.length > 1) {
              followerCount = followerElements[1].textContent || '';
              console.log('[Wechat] 粉丝数:', followerCount);
            }
          } catch (e) {
            console.log('[Wechat] 获取粉丝数失败:', e);
          }

          return {
            username,
            avatar,
            followerCount
          };
        })();
      `);

      return userInfo;
    } catch (error) {
      log.error('[Wechat] 提取用户信息失败:', error);
      return null;
    }
  }

  private async getCookies(): Promise<Cookie[]> {
    try {
      const partition = this.currentPartition;
      const ses = session.fromPartition(partition);
      const cookies = await ses.cookies.get({});

      return cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.weixin.qq.com',
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as any
      }));
    } catch (error) {
      log.error('[Wechat] 获取Cookie失败:', error);
      return [];
    }
  }

  private async getStorage(): Promise<StorageData> {
    try {
      const storage = await webViewManager.executeJavaScript<StorageData>(`
        (function() {
          const localStorageData = {};
          const sessionStorageData = {};

          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) localStorageData[key] = localStorage.getItem(key) || '';
            }
          } catch (e) {}

          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key) sessionStorageData[key] = sessionStorage.getItem(key) || '';
            }
          } catch (e) {}

          return { localStorage: localStorageData, sessionStorage: sessionStorageData };
        })();
      `);

      return storage || { localStorage: {}, sessionStorage: {} };
    } catch (error) {
      log.error('[Wechat] 获取Storage失败:', error);
      return { localStorage: {}, sessionStorage: {} };
    }
  }

  private async saveAccountLocally(account: any): Promise<void> {
    try {
      log.info('[Wechat] 保存账号到本地 SQLite...');

      const result = await syncService.saveAccountToLocal({
        platform_id: account.platform_id,
        account_name: account.account_name,
        real_username: account.real_username,
        credentials: account.credentials
      });

      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }

      log.info(`[Wechat] 账号保存到本地 SQLite 成功, ID: ${result.accountId}`);
    } catch (error) {
      log.error('[Wechat] 保存账号到本地 SQLite 失败:', error);
      throw error;
    }
  }

  private async syncAccountToBackend(account: any): Promise<any> {
    try {
      const result = await syncService.syncAccount(account);
      if (result.success) {
        log.info('[Wechat] 账号已同步到后端');
        return result.account; // 返回后端创建的账号对象
      } else {
        log.error('[Wechat] 账号同步失败:', result.error);
        throw new Error(result.error || '同步失败');
      }
    } catch (error) {
      log.error('[Wechat] 同步账号到后端失败:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      await webViewManager.destroyWebView();
    } catch (error) {
      log.error('[Wechat] 清理资源失败:', error);
    }
  }

  async cancelLogin(): Promise<void> {
    if (!this.isLoginInProgress) return;

    log.info('[Wechat] 取消登录');
    this.isCancelled = true;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    await this.cleanup();
    this.isLoginInProgress = false;
  }

  isLoggingIn(): boolean {
    return this.isLoginInProgress;
  }
}

export const wechatLoginManager = WechatLoginManager.getInstance();
export { WechatLoginManager };
