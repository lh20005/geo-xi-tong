import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 简书专用登录管理器
 * 参照GEO应用的js.js实现
 * 
 * GEO应用关键代码：
 * - 登录检测: .avatar>img (第1个元素的src属性)
 * - 用户名选择器: .main-top .name
 * - 粉丝数选择器: .main-top .meta-block p (第2个)
 * - 需要触发鼠标悬停: .user
 * - 需要点击: .user li a
 * - 检查间隔: 1000ms
 */

interface JianshuLoginResult {
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

class JianshuLoginManager {
  private static instance: JianshuLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private checkInterval: NodeJS.Timeout | null = null;

  // 简书配置 - 从GEO应用的js.js提取
  private readonly PLATFORM_ID = 'jianshu';
  private readonly PLATFORM_NAME = '简书';
  private readonly LOGIN_URL = 'https://www.jianshu.com/sign_in';
  private readonly SUCCESS_URL_PATTERNS = [
    'www.jianshu.com/'
  ];
  
  // 从GEO应用js.js提取的选择器
  private readonly AVATAR_SELECTOR = '.avatar>img'; // 用于检测登录成功
  private readonly USERNAME_SELECTOR = '.main-top .name';
  private readonly FOLLOWER_SELECTOR = '.main-top .meta-block p';
  private readonly HOVER_SELECTOR = '.user'; // 需要触发鼠标悬停
  private readonly CLICK_SELECTOR = '.user li a'; // 需要点击
  private readonly CHECK_INTERVAL = 1000; // GEO应用使用1秒间隔

  // 当前登录使用的临时 partition
  private currentPartition: string = '';

  private constructor() {}

  static getInstance(): JianshuLoginManager {
    if (!JianshuLoginManager.instance) {
      JianshuLoginManager.instance = new JianshuLoginManager();
    }
    return JianshuLoginManager.instance;
  }

  async login(parentWindow: BrowserWindow): Promise<JianshuLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Jianshu] 开始登录流程`);

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

      // 3. 触发鼠标悬停和点击 - 按照GEO应用js.js的方式
      await this.triggerMouseOverAndClick();

      // 4. 等待页面稳定
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. 提取用户信息 - 完全按照GEO应用的方式
      const userInfo = await this.extractUserInfo();
      if (!userInfo || !userInfo.username) {
        await this.cleanup();
        return { success: false, message: '无法提取用户信息' };
      }

      log.info(`[Jianshu] 用户信息提取成功: ${userInfo.username}`);

      // 6. 获取 Cookies
      const cookies = await this.getCookies();
      log.info(`[Jianshu] 获取到 ${cookies.length} 个Cookie`);

      // 7. 获取 Storage
      const storage = await this.getStorage();

      // 8. 构建账号数据
      const account = {
        platform_id: this.PLATFORM_ID,
        account_name: userInfo.username,
        real_username: userInfo.username,
        credentials: {
          cookies,
          storage,
          userInfo,
          loginTime: new Date().toISOString()
        }
      };

      // 9. 先同步到后端（必须先同步，确保后端有数据）
      const backendAccount = await this.syncAccountToBackend(account);
      
      // 10. 同步成功后，使用后端返回的账号ID保存到本地
      if (backendAccount && backendAccount.id) {
        (account as any).id = backendAccount.id;
        await this.saveAccountLocally(account);
      } else {
        log.warn('[Jianshu] 后端同步失败，不保存到本地缓存');
      }

      // 11. 清理
      await this.cleanup();

      this.isLoginInProgress = false;
      log.info('[Jianshu] 登录完成');

      return {
        success: true,
        account,
        message: '登录成功'
      };
    } catch (error) {
      log.error('[Jianshu] 登录失败:', error);
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
    log.info('[Jianshu] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 参照GEO应用js.js: 检测 .avatar>img 元素的src属性
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    return new Promise((resolve) => {
      let checkCount = 0;
      const maxChecks = 300; // 1秒 * 300 = 5分钟超时

      this.checkInterval = setInterval(async () => {
        if (this.isCancelled) {
          if (this.checkInterval) clearInterval(this.checkInterval);
          resolve(false);
          return;
        }

        checkCount++;
        if (checkCount > maxChecks) {
          log.warn('[Jianshu] 登录超时');
          if (this.checkInterval) clearInterval(this.checkInterval);
          resolve(false);
          return;
        }

        try {
          // 按照GEO应用js.js的检测逻辑：检测第1个.avatar>img元素的src
          const isLoggedIn = await webViewManager.executeJavaScript<boolean>(`
            (function() {
              const imgElements = document.querySelectorAll('${this.AVATAR_SELECTOR}');
              if (imgElements && imgElements.length > 0) {
                const firstImg = imgElements[0];
                const srcValue = firstImg.getAttribute('src');
                if (srcValue) {
                  console.log('[Jianshu] 检测到登录成功，头像:', srcValue);
                  return true;
                }
              }
              return false;
            })();
          `);

          if (isLoggedIn) {
            log.info('[Jianshu] 登录成功');
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
   * 触发鼠标悬停和点击
   * 按照GEO应用js.js的方式
   */
  private async triggerMouseOverAndClick(): Promise<void> {
    try {
      await webViewManager.executeJavaScript(`
        (function() {
          console.log('[Jianshu] 触发鼠标悬停和点击');
          
          // 触发鼠标悬停
          const element = document.querySelector('${this.HOVER_SELECTOR}');
          if (element) {
            const mouseOverEvent = new MouseEvent('mouseover', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            element.dispatchEvent(mouseOverEvent);
            console.log('[Jianshu] 鼠标悬停事件已触发');
            
            // 点击链接
            const linkElement = document.querySelector('${this.CLICK_SELECTOR}');
            if (linkElement) {
              linkElement.click();
              console.log('[Jianshu] 点击事件已触发');
            } else {
              console.log('[Jianshu] 未找到点击目标元素');
            }
          } else {
            console.log('[Jianshu] 未找到悬停目标元素');
          }
        })();
      `);
    } catch (error) {
      log.warn('[Jianshu] 触发鼠标悬停和点击失败:', error);
    }
  }

  /**
   * 提取用户信息
   * 完全按照GEO应用js.js的方式
   */
  private async extractUserInfo(): Promise<{ username: string; avatar?: string; followerCount?: string } | null> {
    try {
      const userInfo = await webViewManager.executeJavaScript<any>(`
        (function() {
          console.log('[Jianshu] 开始提取用户信息');
          
          // 提取头像 - 按照GEO应用js.js (第1个元素)
          let avatar = '';
          try {
            const imgElements = document.querySelectorAll('${this.AVATAR_SELECTOR}');
            if (imgElements && imgElements.length > 0) {
              avatar = imgElements[0].getAttribute('src') || '';
              console.log('[Jianshu] 头像:', avatar);
            }
          } catch (e) {
            console.log('[Jianshu] 获取头像失败:', e);
          }

          // 提取用户名 - 按照GEO应用js.js
          const nameElement = document.querySelector('${this.USERNAME_SELECTOR}');
          if (!nameElement || !nameElement.textContent) {
            console.log('[Jianshu] 未找到用户名元素');
            return null;
          }

          const username = nameElement.textContent.trim();
          console.log('[Jianshu] 用户名:', username);

          // 提取粉丝数 - 按照GEO应用js.js (第2个p元素)
          let followerCount = '';
          try {
            const followerElements = document.querySelectorAll('${this.FOLLOWER_SELECTOR}');
            if (followerElements && followerElements.length > 1) {
              followerCount = followerElements[1].textContent || '';
              console.log('[Jianshu] 粉丝数:', followerCount);
            }
          } catch (e) {
            console.log('[Jianshu] 获取粉丝数失败:', e);
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
      log.error('[Jianshu] 提取用户信息失败:', error);
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
        domain: cookie.domain || '.jianshu.com',
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as any
      }));
    } catch (error) {
      log.error('[Jianshu] 获取Cookie失败:', error);
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
      log.error('[Jianshu] 获取Storage失败:', error);
      return { localStorage: {}, sessionStorage: {} };
    }
  }

  private async saveAccountLocally(account: any): Promise<void> {
    try {
      const existingAccounts = await storageManager.getAccountsCache();
      const existingIndex = existingAccounts.findIndex(
        (a) => a.platform_id === account.platform_id && a.real_username === account.real_username
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
          is_default: existingAccounts.filter(a => a.platform_id === account.platform_id).length === 0,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      await storageManager.saveAccountsCache(existingAccounts);
      log.info('[Jianshu] 账号已保存到本地');
    } catch (error) {
      log.error('[Jianshu] 保存账号到本地失败:', error);
      throw error;
    }
  }

  private async syncAccountToBackend(account: any): Promise<any> {
    try {
      const result = await syncService.syncAccount(account);
      if (result.success) {
        log.info('[Jianshu] 账号已同步到后端');
        return result.account; // 返回后端创建的账号对象
      } else {
        log.error('[Jianshu] 账号同步失败:', result.error);
        throw new Error(result.error || '同步失败');
      }
    } catch (error) {
      log.error('[Jianshu] 同步账号到后端失败:', error);
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
      log.error('[Jianshu] 清理资源失败:', error);
    }
  }

  async cancelLogin(): Promise<void> {
    if (!this.isLoginInProgress) return;

    log.info('[Jianshu] 取消登录');
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

export const jianshuLoginManager = JianshuLoginManager.getInstance();
export { JianshuLoginManager };
