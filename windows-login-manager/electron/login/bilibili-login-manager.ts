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
  private readonly CHECK_INTERVAL = 1000; // 1秒检查间隔（参考 bili.js）

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
        log.error('[Bilibili] 无法提取用户信息，登录流程终止');
        await this.cleanup();
        return {
          success: false,
          message: '无法提取用户信息，请重试'
        };
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

      // 7. 先同步到后端（必须先同步，确保后端有数据）
      const backendAccount = await this.syncToBackend(account);

      // 8. 同步成功后，使用后端返回的账号ID保存到本地
      if (backendAccount && backendAccount.id) {
        (account as any).id = backendAccount.id;
        await this.saveAccount(account);
      } else {
        log.warn('[Bilibili] 后端同步失败，不保存到本地缓存');
      }

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

    // 使用临时 partition，确保每次登录都是全新环境
    this.currentPartition = `login-${this.PLATFORM_ID}-${Date.now()}`;
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
   * 策略：检测 URL 是否到达 member.bilibili.com/platform/home
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

        // 检查 URL 是否到达目标页面（登录成功的标志）
        try {
          const currentUrl = await webViewManager.executeJavaScript<string>(`window.location.href`);
          log.debug(`[Bilibili] 当前URL: ${currentUrl}`);
          
          // 检查是否到达 member.bilibili.com/platform 页面
          if (currentUrl && currentUrl.includes('member.bilibili.com/platform')) {
            if (this.checkInterval) {
              clearInterval(this.checkInterval);
              this.checkInterval = null;
            }
            log.info(`[Bilibili] 登录成功，已到达目标页面: ${currentUrl}`);
            resolve(true);
            return;
          }
          
          // 备选：检查元素是否出现
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
            log.info(`[Bilibili] 登录成功，检测到用户元素`);
            resolve(true);
            return;
          }
        } catch (error) {
          log.debug('[Bilibili] 检查登录状态失败:', error);
        }
      }, this.CHECK_INTERVAL);
    });
  }

  /**
   * 等待页面稳定
   */
  private async waitForPageStable(): Promise<void> {
    log.info('[Bilibili] 等待页面稳定（5秒）...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 增加到5秒，确保cookies完全设置
    log.info('[Bilibili] 页面稳定完成');
  }

  /**
   * 提取用户信息
   * 完全参照 GEO 应用 bili.js 的实现
   * 增加重试机制，确保能获取到用户信息
   */
  private async extractUserInfo(): Promise<BilibiliUserInfo | null> {
    log.info('[Bilibili] 提取用户信息（参照bili.js）...');

    const maxRetries = 5;
    const retryDelay = 2000; // 2秒重试间隔

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.info(`[Bilibili] 第 ${attempt}/${maxRetries} 次尝试获取用户信息...`);

        // 完全按照 bili.js 的方式获取用户信息
        const userInfo = await webViewManager.executeJavaScript<any>(`
          (async () => {
            try {
              console.log('[Bilibili] 开始获取用户信息（参照bili.js）');
              
              // 方法1：先尝试从页面元素获取用户名（作为备选）
              let usernameFromElement = null;
              try {
                const nameElement = document.querySelector('span.right-entry-text');
                if (nameElement && nameElement.textContent) {
                  usernameFromElement = nameElement.textContent.trim();
                  console.log('[Bilibili] 从页面元素获取到用户名:', usernameFromElement);
                }
              } catch (e) {
                console.log('[Bilibili] 从页面元素获取用户名失败');
              }
              
              // 方法2：参照 bili.js - 尝试请求 Bilibili API 获取用户信息
              const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
                method: 'GET',
                credentials: 'include', // 包含cookies
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': navigator.userAgent
                }
              });

              if (response.ok) {
                const userData = await response.json();
                console.log('[Bilibili] API返回数据:', JSON.stringify(userData));
                
                // 参照 bili.js: 检查 userData.data.uname
                if (userData && userData.data && userData.data.uname) {
                  console.log('[Bilibili] 登录成功，用户信息:', userData.data.uname);
                  
                  // 参照 bili.js 返回格式
                  return {
                    username: userData.data.uname,
                    avatar: userData.data.face || ''
                  };
                } else if (userData && userData.code === -101) {
                  // 未登录状态
                  console.log('[Bilibili] API返回未登录状态，code:', userData.code);
                } else {
                  console.log('[Bilibili] API返回数据中没有用户名，userData:', JSON.stringify(userData));
                }
              } else {
                console.log('[Bilibili] API请求失败，状态码:', response.status);
              }
              
              // 如果API失败但页面元素有用户名，使用页面元素的值
              if (usernameFromElement) {
                console.log('[Bilibili] API失败，使用页面元素获取的用户名:', usernameFromElement);
                return {
                  username: usernameFromElement,
                  avatar: ''
                };
              }
            } catch (error) {
              console.error('[Bilibili] 请求API出错:', error);
            }
            
            return null;
          })()
        `);

        if (userInfo && userInfo.username) {
          log.info(`[Bilibili] 用户名提取成功: ${userInfo.username}`);
          return userInfo;
        }

        // 如果没有获取到，等待后重试
        if (attempt < maxRetries) {
          log.warn(`[Bilibili] 第 ${attempt} 次尝试未获取到用户信息，${retryDelay/1000}秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        log.error(`[Bilibili] 第 ${attempt} 次提取用户信息失败:`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    log.error('[Bilibili] 所有尝试都失败，无法提取用户信息');
    return null;
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
  private async syncToBackend(account: any): Promise<any> {
    try {
      log.info('[Bilibili] 同步账号到后端...');
      const result = await syncService.syncAccount(account);
      
      if (result.success) {
        log.info('[Bilibili] 账号同步成功');
        return result.account; // 返回后端创建的账号对象
      } else {
        log.error('[Bilibili] 账号同步失败:', result.error);

        throw new Error(result.error || '同步失败');
      }
    } catch (error) {
      log.error('[Bilibili] 同步账号失败:', error);
      throw error;
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
