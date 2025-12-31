import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 百家号专用登录管理器
 * 参照GEO应用的bjh.js实现
 * 
 * GEO应用关键代码：
 * - 登录检测: .UjPPKm89R4RrZTKhwG5H (头像元素)
 * - 用户名选择器: .user-name (需要split(',')[1])
 * - 需要触发鼠标悬停事件: .p7Psc5P3uJ5lyxeI0ETR
 * - 检查间隔: 500ms (最快)
 */

interface BaijiahaoLoginResult {
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
      };
      loginTime: string;
    };
  };
  message?: string;
  error?: string;
}

class BaijiahaoLoginManager {
  private static instance: BaijiahaoLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private checkInterval: NodeJS.Timeout | null = null;

  // 百家号配置 - 从GEO应用的bjh.js提取
  private readonly PLATFORM_ID = 'baijiahao';
  private readonly PLATFORM_NAME = '百家号';
  private readonly LOGIN_URL = 'https://baijiahao.baidu.com/builder/author/register/index';
  private readonly SUCCESS_URL_PATTERNS = [
    'baijiahao.baidu.com/builder/rc/home'
  ];
  
  // 从GEO应用bjh.js提取的选择器
  private readonly AVATAR_SELECTOR = '.UjPPKm89R4RrZTKhwG5H'; // 用于检测登录成功
  private readonly USERNAME_SELECTOR = '.user-name';
  private readonly HOVER_SELECTOR = '.p7Psc5P3uJ5lyxeI0ETR'; // 需要触发鼠标悬停
  private readonly CHECK_INTERVAL = 500; // GEO应用使用500ms间隔（最快）

  // 当前登录使用的临时 partition
  private currentPartition: string = '';

  private constructor() {}

  static getInstance(): BaijiahaoLoginManager {
    if (!BaijiahaoLoginManager.instance) {
      BaijiahaoLoginManager.instance = new BaijiahaoLoginManager();
    }
    return BaijiahaoLoginManager.instance;
  }

  async login(parentWindow: BrowserWindow): Promise<BaijiahaoLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Baijiahao] 开始登录流程`);

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

      // 3. 触发鼠标悬停事件 - 按照GEO应用bjh.js的方式
      await this.triggerMouseOver();

      // 4. 等待页面稳定
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. 提取用户信息 - 完全按照GEO应用的方式
      const userInfo = await this.extractUserInfo();
      if (!userInfo || !userInfo.username) {
        await this.cleanup();
        return { success: false, message: '无法提取用户信息' };
      }

      log.info(`[Baijiahao] 用户信息提取成功: ${userInfo.username}`);

      // 6. 获取 Cookies
      const cookies = await this.getCookies();
      log.info(`[Baijiahao] 获取到 ${cookies.length} 个Cookie`);

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
        log.warn('[Baijiahao] 后端同步失败，不保存到本地缓存');
      }

      // 11. 清理
      await this.cleanup();

      this.isLoginInProgress = false;
      log.info('[Baijiahao] 登录完成');

      return {
        success: true,
        account,
        message: '登录成功'
      };
    } catch (error) {
      log.error('[Baijiahao] 登录失败:', error);
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
    log.info('[Baijiahao] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 参照GEO应用bjh.js: 检测头像元素 .UjPPKm89R4RrZTKhwG5H
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    return new Promise((resolve) => {
      let checkCount = 0;
      const maxChecks = 600; // 500ms * 600 = 5分钟超时

      this.checkInterval = setInterval(async () => {
        if (this.isCancelled) {
          if (this.checkInterval) clearInterval(this.checkInterval);
          resolve(false);
          return;
        }

        checkCount++;
        if (checkCount > maxChecks) {
          log.warn('[Baijiahao] 登录超时');
          if (this.checkInterval) clearInterval(this.checkInterval);
          resolve(false);
          return;
        }

        try {
          // 按照GEO应用bjh.js的检测逻辑：检测头像元素的src属性
          const isLoggedIn = await webViewManager.executeJavaScript<boolean>(`
            (function() {
              const imgElement = document.querySelector('${this.AVATAR_SELECTOR}');
              if (imgElement) {
                const srcValue = imgElement.getAttribute('src');
                if (srcValue) {
                  console.log('[Baijiahao] 检测到登录成功，头像:', srcValue);
                  return true;
                }
              }
              return false;
            })();
          `);

          if (isLoggedIn) {
            log.info('[Baijiahao] 登录成功');
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
   * 触发鼠标悬停事件
   * 按照GEO应用bjh.js的方式
   */
  private async triggerMouseOver(): Promise<void> {
    try {
      await webViewManager.executeJavaScript(`
        (function() {
          console.log('[Baijiahao] 触发鼠标悬停事件');
          const element = document.querySelector('${this.HOVER_SELECTOR}');
          if (element) {
            const mouseOverEvent = new MouseEvent('mouseover', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            element.dispatchEvent(mouseOverEvent);
            console.log('[Baijiahao] 鼠标悬停事件已触发');
          } else {
            console.log('[Baijiahao] 未找到悬停目标元素');
          }
        })();
      `);
    } catch (error) {
      log.warn('[Baijiahao] 触发鼠标悬停失败:', error);
    }
  }

  /**
   * 提取用户信息
   * 完全按照GEO应用bjh.js的方式
   * 注意：用户名需要 split(',')[1]
   */
  private async extractUserInfo(): Promise<{ username: string; avatar?: string } | null> {
    try {
      const userInfo = await webViewManager.executeJavaScript<any>(`
        (function() {
          console.log('[Baijiahao] 开始提取用户信息');
          
          // 提取头像 - 按照GEO应用bjh.js
          let avatar = '';
          try {
            const imgElement = document.querySelector('${this.AVATAR_SELECTOR}');
            if (imgElement) {
              avatar = imgElement.getAttribute('src') || '';
              console.log('[Baijiahao] 头像:', avatar);
            }
          } catch (e) {
            console.log('[Baijiahao] 获取头像失败:', e);
          }

          // 提取用户名 - 按照GEO应用bjh.js (需要split(',')[1])
          const nameElement = document.querySelector('${this.USERNAME_SELECTOR}');
          if (!nameElement || !nameElement.textContent) {
            console.log('[Baijiahao] 未找到用户名元素');
            return null;
          }

          const nameText = nameElement.textContent;
          console.log('[Baijiahao] 原始用户名文本:', nameText);
          
          // 按照GEO应用的方式处理：split(',')[1]
          const nameParts = nameText.split(',');
          const username = nameParts.length > 1 ? nameParts[1].trim() : nameText.trim();
          console.log('[Baijiahao] 处理后的用户名:', username);

          return {
            username,
            avatar
          };
        })();
      `);

      return userInfo;
    } catch (error) {
      log.error('[Baijiahao] 提取用户信息失败:', error);
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
        domain: cookie.domain || '.baidu.com',
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as any
      }));
    } catch (error) {
      log.error('[Baijiahao] 获取Cookie失败:', error);
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
      log.error('[Baijiahao] 获取Storage失败:', error);
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
      log.info('[Baijiahao] 账号已保存到本地');
    } catch (error) {
      log.error('[Baijiahao] 保存账号到本地失败:', error);
      throw error;
    }
  }

  private async syncAccountToBackend(account: any): Promise<any> {
    try {
      const result = await syncService.syncAccount(account);
      if (result.success) {
        log.info('[Baijiahao] 账号已同步到后端');
        return result.account; // 返回后端创建的账号对象
      } else {
        log.error('[Baijiahao] 账号同步失败:', result.error);
        throw new Error(result.error || '同步失败');
      }
    } catch (error) {
      log.error('[Baijiahao] 同步账号到后端失败:', error);
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
      log.error('[Baijiahao] 清理资源失败:', error);
    }
  }

  async cancelLogin(): Promise<void> {
    if (!this.isLoginInProgress) return;

    log.info('[Baijiahao] 取消登录');
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

export const baijiahaoLoginManager = BaijiahaoLoginManager.getInstance();
export { BaijiahaoLoginManager };
