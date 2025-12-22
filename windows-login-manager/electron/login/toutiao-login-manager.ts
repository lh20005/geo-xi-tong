import { BrowserWindow, BrowserView, session } from 'electron';
import log from 'electron-log';
import { cookieManager, Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 头条号专用登录管理器
 * 基于最佳实践重新实现，确保稳定性和可靠性
 * 
 * 核心策略：
 * 1. 使用独立的 session 确保隔离
 * 2. 简单的 URL 变化检测（最可靠）
 * 3. 完整的错误处理和资源清理
 * 4. 详细的日志记录
 */

interface ToutiaoLoginResult {
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

interface ToutiaoUserInfo {
  username: string;
  avatar?: string;
}

class ToutiaoLoginManager {
  private static instance: ToutiaoLoginManager;
  private loginWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;

  // 头条号配置
  private readonly PLATFORM_ID = 'toutiao';
  private readonly PLATFORM_NAME = '头条号';
  private readonly LOGIN_URL = 'https://mp.toutiao.com/auth/page/login';
  private readonly SUCCESS_URL_PATTERNS = [
    'mp.toutiao.com/profile_v4',
    'mp.toutiao.com/creator'
  ];
  private readonly USERNAME_SELECTORS = [
    '.auth-avator-name',
    '.user-name',
    '.username',
    '.account-name',
    '[class*="username"]',
    '[class*="user-name"]',
    '.semi-navigation-header-username'
  ];

  private constructor() {}

  static getInstance(): ToutiaoLoginManager {
    if (!ToutiaoLoginManager.instance) {
      ToutiaoLoginManager.instance = new ToutiaoLoginManager();
    }
    return ToutiaoLoginManager.instance;
  }

  /**
   * 开始登录流程
   */
  async login(parentWindow: BrowserWindow): Promise<ToutiaoLoginResult> {
    if (this.isLoginInProgress) {
      return {
        success: false,
        message: '登录正在进行中，请稍候'
      };
    }

    this.isLoginInProgress = true;
    this.isCancelled = false;
    log.info(`[Toutiao] 开始登录流程`);

    try {
      // 1. 创建登录窗口
      await this.createLoginWindow(parentWindow);
      if (!this.loginWindow) {
        throw new Error('无法创建登录窗口');
      }

      // 2. 加载登录页面
      await this.loadLoginPage();

      // 3. 等待登录成功
      const loginSuccess = await this.waitForLoginSuccess();
      if (!loginSuccess) {
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

      // 4. 等待页面稳定
      await this.waitForPageStable();

      // 5. 提取用户信息
      const userInfo = await this.extractUserInfo();
      if (!userInfo || !userInfo.username) {
        throw new Error('无法提取用户信息');
      }

      log.info(`[Toutiao] 用户信息提取成功: ${userInfo.username}`);

      // 6. 捕获登录凭证
      const credentials = await this.captureCredentials();

      // 7. 构建账号数据
      const account = {
        platform_id: this.PLATFORM_ID,
        account_name: userInfo.username,
        real_username: userInfo.username,
        credentials: {
          ...credentials,
          loginTime: new Date().toISOString()
        }
      };

      // 8. 保存账号
      await this.saveAccount(account);

      // 9. 同步到后端
      await this.syncToBackend(account);

      // 10. 清理资源
      this.cleanup();

      log.info(`[Toutiao] 登录成功完成`);
      return {
        success: true,
        account,
        message: '登录成功'
      };

    } catch (error) {
      log.error('[Toutiao] 登录失败:', error);
      this.cleanup();

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
    log.info('[Toutiao] 取消登录');
    this.isCancelled = true;
    this.cleanup();
  }

  /**
   * 创建登录窗口
   */
  private async createLoginWindow(parent: BrowserWindow): Promise<void> {
    log.info('[Toutiao] 创建登录窗口');

    // 创建独立的 session
    const ses = session.fromPartition(`persist:${this.PLATFORM_ID}`, {
      cache: true
    });

    // 配置 session
    ses.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 创建登录窗口
    this.loginWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      parent: parent,
      modal: true,
      show: false,
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });

    // 窗口准备好后显示
    this.loginWindow.once('ready-to-show', () => {
      if (this.loginWindow && !this.isCancelled) {
        this.loginWindow.show();
        log.info('[Toutiao] 登录窗口已显示');
      }
    });

    // 监听窗口关闭
    this.loginWindow.on('closed', () => {
      log.info('[Toutiao] 登录窗口已关闭');
      if (this.isLoginInProgress) {
        this.isCancelled = true;
      }
      this.loginWindow = null;
    });
  }

  /**
   * 加载登录页面
   */
  private async loadLoginPage(): Promise<void> {
    if (!this.loginWindow) {
      throw new Error('登录窗口不存在');
    }

    log.info(`[Toutiao] 加载登录页面: ${this.LOGIN_URL}`);

    return new Promise((resolve, reject) => {
      if (!this.loginWindow) {
        reject(new Error('登录窗口不存在'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('加载登录页面超时'));
      }, 30000);

      this.loginWindow.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        log.info('[Toutiao] 登录页面加载完成');
        resolve();
      });

      this.loginWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        log.error(`[Toutiao] 页面加载失败: ${errorCode} - ${errorDescription}`);
        // 不拒绝，因为某些错误不影响登录
        resolve();
      });

      this.loginWindow.loadURL(this.LOGIN_URL);
    });
  }

  /**
   * 等待登录成功
   * 策略：检测 URL 变化到成功页面
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    if (!this.loginWindow) {
      return false;
    }

    log.info('[Toutiao] 等待登录成功...');
    const startTime = Date.now();
    const timeout = 300000; // 5分钟

    return new Promise((resolve) => {
      if (!this.loginWindow) {
        resolve(false);
        return;
      }

      const checkInterval = setInterval(() => {
        // 检查是否取消
        if (this.isCancelled || !this.loginWindow) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        // 检查超时
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          log.warn('[Toutiao] 登录超时');
          resolve(false);
          return;
        }

        // 检查 URL
        const currentUrl = this.loginWindow.webContents.getURL();
        
        // 检查是否匹配成功 URL 模式
        for (const pattern of this.SUCCESS_URL_PATTERNS) {
          if (currentUrl.includes(pattern)) {
            clearInterval(checkInterval);
            log.info(`[Toutiao] 登录成功检测到 URL: ${currentUrl}`);
            resolve(true);
            return;
          }
        }
      }, 500); // 每500ms检查一次
    });
  }

  /**
   * 等待页面稳定
   */
  private async waitForPageStable(): Promise<void> {
    log.info('[Toutiao] 等待页面稳定...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 提取用户信息
   */
  private async extractUserInfo(): Promise<ToutiaoUserInfo | null> {
    if (!this.loginWindow) {
      return null;
    }

    log.info('[Toutiao] 提取用户信息...');

    // 尝试所有选择器
    for (const selector of this.USERNAME_SELECTORS) {
      try {
        const username = await this.loginWindow.webContents.executeJavaScript(`
          (() => {
            const element = document.querySelector('${selector}');
            return element ? element.textContent.trim() : null;
          })()
        `);

        if (username) {
          log.info(`[Toutiao] 用户名提取成功 (${selector}): ${username}`);
          return { username };
        }
      } catch (error) {
        log.debug(`[Toutiao] 选择器失败: ${selector}`);
      }
    }

    log.warn('[Toutiao] 无法提取用户信息');
    return null;
  }

  /**
   * 捕获登录凭证
   */
  private async captureCredentials(): Promise<{ cookies: Cookie[]; storage: StorageData }> {
    if (!this.loginWindow) {
      throw new Error('登录窗口不存在');
    }

    log.info('[Toutiao] 捕获登录凭证...');

    // 捕获 Cookies
    const ses = this.loginWindow.webContents.session;
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

    log.info(`[Toutiao] 捕获 ${cookies.length} 个 Cookies`);

    // 捕获 Storage
    const localStorage = await this.loginWindow.webContents.executeJavaScript(`
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

    const sessionStorage = await this.loginWindow.webContents.executeJavaScript(`
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

    log.info(`[Toutiao] 捕获 Storage - localStorage: ${Object.keys(localStorage).length}, sessionStorage: ${Object.keys(sessionStorage).length}`);

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
      log.info('[Toutiao] 保存账号到本地...');

      const existingAccounts = await storageManager.getAccountsCache();
      const existingIndex = existingAccounts.findIndex(
        a => a.platform_id === account.platform_id && a.account_name === account.account_name
      );

      if (existingIndex >= 0) {
        // 更新现有账号
        existingAccounts[existingIndex] = {
          ...existingAccounts[existingIndex],
          ...account,
          updated_at: new Date()
        };
        log.info('[Toutiao] 更新现有账号');
      } else {
        // 添加新账号
        existingAccounts.push({
          id: Date.now(),
          ...account,
          is_default: existingAccounts.length === 0,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
        log.info('[Toutiao] 添加新账号');
      }

      await storageManager.saveAccountsCache(existingAccounts);
      log.info('[Toutiao] 账号保存成功');
    } catch (error) {
      log.error('[Toutiao] 保存账号失败:', error);
      throw error;
    }
  }

  /**
   * 同步到后端
   */
  private async syncToBackend(account: any): Promise<void> {
    try {
      log.info('[Toutiao] 同步账号到后端...');
      const result = await syncService.syncAccount(account);
      
      if (result.success) {
        log.info('[Toutiao] 账号同步成功');
      } else {
        log.warn('[Toutiao] 账号同步失败，已加入队列:', result.error);
      }
    } catch (error) {
      log.error('[Toutiao] 同步账号失败:', error);
      // 不抛出错误，因为已经保存到本地
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    log.info('[Toutiao] 清理资源...');

    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.close();
    }

    this.loginWindow = null;
    this.isLoginInProgress = false;
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

export const toutiaoLoginManager = ToutiaoLoginManager.getInstance();
export { ToutiaoLoginManager, ToutiaoLoginResult };
