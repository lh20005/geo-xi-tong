import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { browserViewManager } from './browser-view-manager';
import { cookieManager, Cookie, StorageData } from './cookie-manager';
import { userInfoExtractor, UserInfo, PlatformSelectors } from './user-info-extractor';
import { loginDetector, LoginDetectionConfig } from './login-detector';
import { syncService } from '../sync/service';
import { storageManager } from '../storage/manager';
import { apiClient } from '../api/client';

/**
 * 登录管理器
 * 整合BrowserView、Cookie捕获、用户信息提取，实现完整登录流程
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

interface Platform {
  platform_id: string;
  platform_name: string;
  login_url: string;
  selectors: PlatformSelectors & {
    loginSuccess: string[];
  };
  detection?: LoginDetectionConfig;
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

  private constructor() {}

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
      // 1. 创建BrowserView
      const view = await browserViewManager.createBrowserView(parentWindow, {
        url: platform.login_url,
        partition: `persist:${platform.platform_id}`,
      });

      log.info('BrowserView created, waiting for user login...');

      // 2. 等待页面加载
      try {
        await browserViewManager.waitForLoad();
      } catch (error) {
        // 如果是因为取消导致的错误，直接返回
        if (!this.isLoginInProgress) {
          log.info('Login was cancelled during page load');
          return {
            success: false,
            message: 'Login cancelled',
          };
        }
        throw error;
      }

      // 3. 配置登录检测
      const detectionConfig: LoginDetectionConfig = {
        successSelectors: platform.selectors.loginSuccess,
        successUrls: platform.detection?.successUrls,
        failureSelectors: platform.detection?.failureSelectors,
        timeout: platform.detection?.timeout || 300000, // 默认5分钟
      };

      // 4. 等待登录成功
      const detectionResult = await loginDetector.waitForLoginSuccess(view, detectionConfig);

      // 检查是否被取消
      if (!this.isLoginInProgress) {
        log.info('Login was cancelled during detection');
        return {
          success: false,
          message: 'Login cancelled',
        };
      }

      if (!detectionResult.success) {
        await browserViewManager.destroyBrowserView();
        this.isLoginInProgress = false;
        
        // 如果是用户取消，不显示错误
        if (detectionResult.message === 'Login cancelled') {
          return {
            success: false,
            message: 'Login cancelled',
          };
        }
        
        return {
          success: false,
          message: detectionResult.message,
        };
      }

      log.info('Login detected, capturing data...');

      // 5. 等待页面稳定
      await loginDetector.waitForPageStable(view, 2000);

      // 6. 捕获Cookie
      const cookies = await cookieManager.captureCookies(view);
      log.info(`Captured ${cookies.length} cookies`);

      // 7. 捕获Storage
      const storage = await cookieManager.captureStorage(view);
      log.info('Storage data captured');

      // 8. 提取用户信息
      const userInfo = await userInfoExtractor.extractUserInfo(view, platform.selectors);

      if (!userInfo || !userInfo.username) {
        await browserViewManager.destroyBrowserView();
        this.isLoginInProgress = false;
        
        return {
          success: false,
          message: 'Failed to extract user information',
        };
      }

      log.info(`User info extracted: ${userInfo.username}`);

      // 9. 构建账号数据
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

      // 10. 保存到本地缓存
      await this.saveAccountLocally(account);

      // 11. 同步到后端
      await this.syncAccountToBackend(account);

      // 12. 清理BrowserView
      await browserViewManager.destroyBrowserView();

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
      await browserViewManager.destroyBrowserView();
      this.isLoginInProgress = false;

      // 如果是因为取消导致的错误，不显示错误消息
      if (error instanceof Error && error.message.includes('No BrowserView available')) {
        log.info('Login was cancelled (BrowserView destroyed)');
        return {
          success: false,
          message: 'Login cancelled',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Login failed',
      };
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
   * 重新登录（使用已保存的凭证）
   */
  async relogin(
    parentWindow: BrowserWindow,
    platform: Platform,
    credentials: {
      cookies: Cookie[];
      storage: StorageData;
    }
  ): Promise<LoginResult> {
    try {
      log.info(`Re-login for platform: ${platform.platform_id}`);

      // 创建BrowserView
      const view = await browserViewManager.createBrowserView(parentWindow, {
        url: platform.login_url,
        partition: `persist:${platform.platform_id}`,
      });

      // 等待页面加载
      await browserViewManager.waitForLoad();

      // 恢复Cookie
      await cookieManager.setCookies(view, credentials.cookies);
      log.info('Cookies restored');

      // 恢复Storage
      await cookieManager.restoreStorage(view, credentials.storage);
      log.info('Storage restored');

      // 刷新页面
      await browserViewManager.navigateTo(platform.login_url);
      await browserViewManager.waitForLoad();

      // 检查登录状态
      const isLoggedIn = await loginDetector.checkLoginStatus(view, {
        successSelectors: platform.selectors.loginSuccess,
        successUrls: platform.detection?.successUrls,
      });

      await browserViewManager.destroyBrowserView();

      if (isLoggedIn) {
        log.info('Re-login successful');
        return {
          success: true,
          message: 'Re-login successful',
        };
      } else {
        log.warn('Re-login failed, credentials may be expired');
        return {
          success: false,
          message: 'Credentials expired, please login again',
        };
      }
    } catch (error) {
      log.error('Re-login failed:', error);
      await browserViewManager.destroyBrowserView();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Re-login failed',
      };
    }
  }

  /**
   * 检查账号登录状态
   */
  async checkAccountStatus(
    parentWindow: BrowserWindow,
    platform: Platform,
    credentials: {
      cookies: Cookie[];
      storage: StorageData;
    }
  ): Promise<boolean> {
    try {
      const view = await browserViewManager.createBrowserView(parentWindow, {
        url: platform.login_url,
        partition: `persist:${platform.platform_id}-check`,
      });

      await browserViewManager.waitForLoad();
      await cookieManager.setCookies(view, credentials.cookies);
      await cookieManager.restoreStorage(view, credentials.storage);
      await browserViewManager.navigateTo(platform.login_url);
      await browserViewManager.waitForLoad();

      const isLoggedIn = await loginDetector.checkLoginStatus(view, {
        successSelectors: platform.selectors.loginSuccess,
        successUrls: platform.detection?.successUrls,
      });

      await browserViewManager.destroyBrowserView();
      return isLoggedIn;
    } catch (error) {
      log.error('Failed to check account status:', error);
      await browserViewManager.destroyBrowserView();
      return false;
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
    
    // 取消登录检测
    loginDetector.cancelDetection();
    
    // 销毁 BrowserView
    await browserViewManager.destroyBrowserView();
    
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
