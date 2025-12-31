import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 抖音号专用登录管理器
 * 使用 WebView 实现，与其他平台保持一致
 * 
 * 核心策略：
 * 1. 使用 webview 标签嵌入登录页面
 * 2. 简单的 URL 变化检测（最可靠）
 * 3. 完整的错误处理和资源清理
 * 4. 详细的日志记录
 */

interface DouyinLoginResult {
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

interface DouyinUserInfo {
  username: string;
  avatar?: string;
}

class DouyinLoginManager {
  private static instance: DouyinLoginManager;
  private parentWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;
  private loginResolve: ((result: boolean) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // 抖音号配置
  private readonly PLATFORM_ID = 'douyin';
  private readonly PLATFORM_NAME = '抖音号';
  private readonly LOGIN_URL = 'https://creator.douyin.com/';
  private readonly SUCCESS_URL_PATTERNS = [
    'creator.douyin.com/creator-micro',
    'creator.douyin.com/home'
  ];
  private readonly USERNAME_SELECTORS = [
    '.name-_lSSDc',
    '.header-_F2uzl .name-_lSSDc',
    '.left-zEzdJX .name-_lSSDc',
    '[class*="name-"][class*="_"]',
    '.semi-navigation-header-username',
    '.username',
    '.user-name',
    '[class*="username"]',
    '[class*="user-name"]'
  ];

  private constructor() {}

  static getInstance(): DouyinLoginManager {
    if (!DouyinLoginManager.instance) {
      DouyinLoginManager.instance = new DouyinLoginManager();
    }
    return DouyinLoginManager.instance;
  }

  /**
   * 开始登录流程
   */
  async login(parentWindow: BrowserWindow): Promise<DouyinLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    this.parentWindow = parentWindow;
    log.info(`[Douyin] 开始登录流程`);

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

      log.info(`[Douyin] 用户信息提取成功: ${userInfo.username}`);

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

      log.info(`[Douyin] 登录成功完成`);
      return {
        success: true,
        account,
        message: '登录成功'
      };

    } catch (error) {
      log.error('[Douyin] 登录失败:', error);
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
    log.info('[Douyin] 取消登录');
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

    log.info('[Douyin] 创建 WebView');

    // 使用 webViewManager 创建 webview
    await webViewManager.createWebView(this.parentWindow, {
      url: this.LOGIN_URL,
      partition: `persist:${this.PLATFORM_ID}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    log.info('[Douyin] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 策略：检测 URL 变化到成功页面
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    log.info('[Douyin] 等待登录成功...');
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
          log.warn('[Douyin] 登录超时');
          resolve(false);
          return;
        }

        // 检查 URL
        try {
          const currentUrl = await webViewManager.getCurrentURL();
          if (!currentUrl) return;
          
          // 检查是否匹配成功 URL 模式
          for (const pattern of this.SUCCESS_URL_PATTERNS) {
            if (currentUrl.includes(pattern)) {
              if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
              }
              log.info(`[Douyin] 登录成功检测到 URL: ${currentUrl}`);
              resolve(true);
              return;
            }
          }
        } catch (error) {
          log.debug('[Douyin] 检查 URL 失败:', error);
        }
      }, 500); // 每500ms检查一次
    });
  }

  /**
   * 等待页面稳定
   */
  private async waitForPageStable(): Promise<void> {
    log.info('[Douyin] 等待页面稳定...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 提取用户信息
   */
  private async extractUserInfo(): Promise<DouyinUserInfo | null> {
    log.info('[Douyin] 提取用户信息...');

    // 尝试所有选择器
    for (const selector of this.USERNAME_SELECTORS) {
      try {
        const username = await webViewManager.executeJavaScript<string | null>(`
          (() => {
            const element = document.querySelector('${selector}');
            return element ? element.textContent.trim() : null;
          })()
        `);

        if (username) {
          log.info(`[Douyin] 用户名提取成功 (${selector}): ${username}`);
          return { username };
        }
      } catch (error) {
        log.debug(`[Douyin] 选择器失败: ${selector}`);
      }
    }

    log.warn('[Douyin] 无法提取用户信息');
    return null;
  }

  /**
   * 捕获登录凭证
   */
  private async captureCredentials(): Promise<{ cookies: Cookie[]; storage: StorageData }> {
    if (!this.parentWindow) {
      throw new Error('父窗口不存在');
    }

    log.info('[Douyin] 捕获登录凭证...');

    // 通过 session 获取 cookies
    const ses = session.fromPartition(`persist:${this.PLATFORM_ID}`);
    const electronCookies = await ses.cookies.get({});
    
    const cookies: Cookie[] = electronCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '',
      path: cookie.path || '/',
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: this.convertSameSite(cookie.sameSite)
    }));

    log.info(`[Douyin] 捕获 ${cookies.length} 个 Cookies`);

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

    log.info(`[Douyin] 捕获 Storage - localStorage: ${Object.keys(localStorage || {}).length}, sessionStorage: ${Object.keys(sessionStorage || {}).length}`);

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
      log.info('[Douyin] 保存账号到本地...');

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
        log.info('[Douyin] 更新现有账号');
      } else {
        existingAccounts.push({
          id: Date.now(),
          ...account,
          is_default: existingAccounts.length === 0,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
        log.info('[Douyin] 添加新账号');
      }

      await storageManager.saveAccountsCache(existingAccounts);
      log.info('[Douyin] 账号保存成功');
    } catch (error) {
      log.error('[Douyin] 保存账号失败:', error);
      throw error;
    }
  }

  /**
   * 同步到后端
   */
  private async syncToBackend(account: any): Promise<void> {
    try {
      log.info('[Douyin] 同步账号到后端...');
      const result = await syncService.syncAccount(account);
      
      if (result.success) {
        log.info('[Douyin] 账号同步成功');
      } else {
        log.warn('[Douyin] 账号同步失败，已加入队列:', result.error);
      }
    } catch (error) {
      log.error('[Douyin] 同步账号失败:', error);
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    log.info('[Douyin] 清理资源...');

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

export const douyinLoginManager = DouyinLoginManager.getInstance();
export { DouyinLoginManager, DouyinLoginResult };
