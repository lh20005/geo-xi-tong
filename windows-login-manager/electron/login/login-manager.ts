import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { userInfoExtractor, UserInfo, PlatformSelectors } from './user-info-extractor';
import { syncService } from '../sync/service';
import { storageManager } from '../storage/manager';

/**
 * 登录管理器
 * 使用 WebView 和 Preload 脚本实现登录检测
 * 替代原有的 BrowserView 和 login-detector
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

interface LoginDetectionConfig {
  successUrls?: string[];
  successSelectors?: string[];
  failureSelectors?: string[];
  timeout?: number;
}

interface Platform {
  platform_id: string;
  platform_name: string;
  login_url: string;
  selectors: PlatformSelectors & {
    loginSuccess: string[];
    successUrls?: string[];
  };
  detection?: LoginDetectionConfig;
}

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface StorageData {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

interface LoginResult {
  success: boolean;
  account?: {
    platform_id: string;
    account_name: string;
    real_username?: string;
    credentials: {
      cookies: Cookie[];
      storage: StorageData;
      userInfo: UserInfo;
      loginTime: string;
    };
  };
  message?: string;
  error?: string;
}

class LoginManager {
  private static instance: LoginManager;
  private isLoginInProgress = false;
  private loginResolve: ((result: LoginResult) => void) | null = null;
  private loginReject: ((error: Error) => void) | null = null;

  private constructor() {
    this.setupIpcHandlers();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): LoginManager {
    if (!LoginManager.instance) {
      LoginManager.instance = new LoginManager();
    }
    return LoginManager.instance;
  }

  /**
   * 设置 IPC 处理器
   */
  private setupIpcHandlers(): void {
    // 监听来自 preload 脚本的登录成功消息
    ipcMain.on('login-success', (event, data) => {
      log.info('[LoginManager] Login success received from preload:', data);
      this.handleLoginSuccess(data);
    });

    // 监听来自 preload 脚本的登录失败消息
    ipcMain.on('login-failure', (event, data) => {
      log.info('[LoginManager] Login failure received from preload:', data);
      this.handleLoginFailure(data);
    });
  }

  /**
   * 处理登录成功
   */
  private handleLoginSuccess(data: any): void {
    if (this.loginResolve) {
      this.loginResolve({
        success: true,
        message: data.message || 'Login successful'
      });
      this.loginResolve = null;
      this.loginReject = null;
    }
  }

  /**
   * 处理登录失败
   */
  private handleLoginFailure(data: any): void {
    if (this.loginResolve) {
      this.loginResolve({
        success: false,
        message: data.message || 'Login failed'
      });
      this.loginResolve = null;
      this.loginReject = null;
    }
  }

  /**
   * 使用浏览器登录平台
   * Requirements: 2.1, 2.2, 2.3
   */
  async loginWithBrowser(
    parentWindow: BrowserWindow,
    platform: Platform
  ): Promise<LoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: 'Another login is in progress',
      };
    }

    this.isLoginInProgress = true;
    log.info(`Starting login for platform: ${platform.platform_id}`);

    try {
      // 1. 创建 WebView
      const webViewId = await webViewManager.createWebView(parentWindow, {
        url: platform.login_url,
        partition: `persist:${platform.platform_id}`,
      });

      log.info('WebView created, waiting for user login...');

      // 2. 等待页面加载
      await webViewManager.waitForLoad();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. 获取初始 URL
      const initialUrl = await webViewManager.getCurrentURL();
      log.info(`Initial login URL: ${initialUrl}`);

      // 4. 初始化登录检测（通过 preload 脚本）
      const detectionConfig = {
        initialUrl: initialUrl || platform.login_url,
        successSelectors: platform.selectors.loginSuccess,
        successUrls: platform.selectors.successUrls || platform.detection?.successUrls,
        failureSelectors: platform.detection?.failureSelectors,
      };

      await webViewManager.executeJavaScript(`
        if (window.loginDetection) {
          window.loginDetection.initialize(${JSON.stringify(detectionConfig)});
        }
      `);

      log.info('Login detection initialized');

      // 5. 等待登录成功（通过 Promise）
      const detectionResult = await new Promise<LoginResult>((resolve, reject) => {
        this.loginResolve = resolve;
        this.loginReject = reject;

        // 设置超时
        const timeout = platform.detection?.timeout || 300000; // 默认5分钟
        setTimeout(() => {
          if (this.loginResolve) {
            resolve({
              success: false,
              message: 'Login timeout'
            });
            this.loginResolve = null;
            this.loginReject = null;
          }
        }, timeout);
      });

      // 检查是否被取消
      if (!this.isLoginInProgress) {
        log.info('Login was cancelled during detection');
        return {
          success: false,
          message: 'Login cancelled',
        };
      }

      if (!detectionResult.success) {
        await webViewManager.destroyWebView();
        this.isLoginInProgress = false;
        return detectionResult;
      }

      log.info('Login detected, capturing data...');

      // 6. 等待页面稳定
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 7. 捕获 Cookies（通过 webview API）
      const cookies = await this.captureCookies(parentWindow);
      log.info(`Captured ${cookies.length} cookies`);

      // 8. 捕获 Storage（通过 preload 脚本）
      const storage = await webViewManager.executeJavaScript<StorageData>(`
        window.loginDetection ? window.loginDetection.captureStorage() : { localStorage: {}, sessionStorage: {} }
      `);
      log.info('Storage data captured');

      // 9. 提取用户信息（通过 preload 脚本）
      const userInfo = await webViewManager.executeJavaScript<UserInfo>(`
        window.loginDetection ? window.loginDetection.extractUserInfo(${JSON.stringify(platform.selectors.username)}) : null
      `);

      if (!userInfo || !userInfo.username) {
        await webViewManager.destroyWebView();
        this.isLoginInProgress = false;
        
        return {
          success: false,
          message: 'Failed to extract user information',
        };
      }

      log.info(`User info extracted: ${userInfo.username}`);

      // 10. 构建账号数据
      const account = {
        platform_id: platform.platform_id,
        account_name: userInfo.username,
        real_username: userInfo.username,
        credentials: {
          cookies,
          storage,
          userInfo,
          loginTime: new Date().toISOString(),
        },
      };

      // 11. 保存到本地缓存
      await this.saveAccountLocally(account);

      // 12. 同步到后端
      await this.syncAccountToBackend(account);

      // 13. 清理 WebView
      await webViewManager.destroyWebView();

      this.isLoginInProgress = false;
      log.info('Login completed successfully');

      return {
        success: true,
        account,
        message: 'Login successful',
      };
    } catch (error) {
      log.error('Login failed:', error);
      
      // 清理
      await webViewManager.destroyWebView();
      this.isLoginInProgress = false;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Login failed',
      };
    }
  }

  /**
   * 捕获 Cookies
   */
  private async captureCookies(parentWindow: BrowserWindow): Promise<Cookie[]> {
    try {
      // 通过 webview 的 session 获取 cookies
      const cookies = await parentWindow.webContents.executeJavaScript(`
        (async function() {
          const webview = document.querySelector('webview');
          if (!webview) return [];
          
          const partition = webview.partition;
          // 注意：这里需要通过 Electron API 获取 cookies
          // 由于 webview 的限制，我们需要在主进程中处理
          return [];
        })();
      `);

      return cookies;
    } catch (error) {
      log.error('Failed to capture cookies:', error);
      return [];
    }
  }

  /**
   * 保存账号到本地
   * Requirements: 2.4, 7.1
   */
  private async saveAccountLocally(account: any): Promise<void> {
    try {
      // 获取现有账号
      const existingAccounts = await storageManager.getAccountsCache();

      // 检查是否已存在
      const existingIndex = existingAccounts.findIndex(
        (a) => a.platform_id === account.platform_id && a.account_name === account.account_name
      );

      if (existingIndex >= 0) {
        // 更新现有账号
        existingAccounts[existingIndex] = {
          ...existingAccounts[existingIndex],
          ...account,
          updated_at: new Date(),
        };
      } else {
        // 添加新账号
        existingAccounts.push({
          id: Date.now(),
          ...account,
          is_default: existingAccounts.length === 0, // 第一个账号设为默认
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      // 保存到本地
      await storageManager.saveAccountsCache(existingAccounts);
      log.info('Account saved locally');
    } catch (error) {
      log.error('Failed to save account locally:', error);
      throw error;
    }
  }

  /**
   * 同步账号到后端
   * Requirements: 2.5, 4.1, 4.7
   */
  private async syncAccountToBackend(account: any): Promise<void> {
    try {
      // 使用同步服务
      const result = await syncService.syncAccount(account);

      if (result.success) {
        log.info('Account synced to backend');
      } else {
        log.warn('Account sync failed, added to queue:', result.error);
      }
    } catch (error) {
      log.error('Failed to sync account to backend:', error);
      // 不抛出错误，因为已经保存到本地
    }
  }

  /**
   * 取消登录
   */
  async cancelLogin(): Promise<void> {
    if (!this.isLoginInProgress) {
      return;
    }

    log.info('Cancelling login...');
    
    // 停止检测
    try {
      await webViewManager.executeJavaScript(`
        if (window.loginDetection) {
          window.loginDetection.stop();
        }
      `);
    } catch (error) {
      log.debug('Failed to stop detection:', error);
    }
    
    // 销毁 WebView
    await webViewManager.destroyWebView();
    
    // 拒绝 Promise
    if (this.loginResolve) {
      this.loginResolve({
        success: false,
        message: 'Login cancelled'
      });
      this.loginResolve = null;
      this.loginReject = null;
    }
    
    this.isLoginInProgress = false;
    log.info('Login cancelled successfully');
  }

  /**
   * 获取登录状态
   */
  isLoggingIn(): boolean {
    return this.isLoginInProgress;
  }
}

// 导出单例实例
export const loginManager = LoginManager.getInstance();
export { LoginManager, Platform, LoginResult };
