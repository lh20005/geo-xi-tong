import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { cookieManager, Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 抖音号专用登录管理器
 * 基于头条登录器的成功经验实现
 * 
 * 核心策略：
 * 1. 使用独立的 BrowserWindow 确保稳定性
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
  private loginWindow: BrowserWindow | null = null;
  private isLoginInProgress = false;
  private isCancelled = false;

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
    log.info(`[Douyin] 开始登录流程`);

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
        this.cleanup(); // 确保清理资源
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

      log.info(`[Douyin] 用户信息提取成功: ${userInfo.username}`);

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

      log.info(`[Douyin] 登录成功完成`);
      return {
        success: true,
        account,
        message: '登录成功'
      };

    } catch (error) {
      log.error('[Douyin] 登录失败:', error);
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
    log.info('[Douyin] 取消登录');
    this.isCancelled = true;
    this.cleanup();
  }

  /**
   * 创建登录窗口
   */
  private async createLoginWindow(parent: BrowserWindow): Promise<void> {
    log.info('[Douyin] 创建登录窗口');

    // 使用临时 session（每次登录都是全新的）
    // 使用时间戳确保每次都是新的 session
    const sessionName = `${this.PLATFORM_ID}-login-${Date.now()}`;
    const ses = session.fromPartition(sessionName, {
      cache: false // 不缓存，确保是全新的
    });

    // 清除所有数据，确保是干净的登录环境
    await ses.clearStorageData({
      storages: ['cookies', 'localstorage', 'cachestorage']
    });

    log.info('[Douyin] 已清除 session 数据，确保全新登录');

    // 配置 session - 使用移动端 User-Agent（抖音创作者平台推荐）
    ses.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 创建登录窗口
    this.loginWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      parent: parent,
      modal: false, // 改为非模态，允许独立操作
      show: false,
      title: '抖音号登录',
      // 显示标题栏和关闭按钮
      frame: true,
      titleBarStyle: 'default',
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
        log.info('[Douyin] 登录窗口已显示');
      }
    });

    // 监听窗口关闭
    this.loginWindow.on('closed', () => {
      log.info('[Douyin] 登录窗口已关闭');
      if (this.isLoginInProgress) {
        this.isCancelled = true;
        this.isLoginInProgress = false; // 重置登录状态
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

    log.info(`[Douyin] 加载登录页面: ${this.LOGIN_URL}`);

    return new Promise((resolve, reject) => {
      if (!this.loginWindow) {
        reject(new Error('登录窗口不存在'));
        return;
      }

      const timeout = setTimeout(() => {
        if (!this.isCancelled) {
          reject(new Error('加载登录页面超时'));
        }
      }, 30000);

      // 监听窗口关闭
      const handleClose = () => {
        clearTimeout(timeout);
        if (this.isCancelled) {
          reject(new Error('登录已取消'));
        }
      };

      this.loginWindow.once('closed', handleClose);

      this.loginWindow.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        if (this.loginWindow) {
          this.loginWindow.removeListener('closed', handleClose);
        }
        log.info('[Douyin] 登录页面加载完成');
        resolve();
      });

      this.loginWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        if (this.loginWindow) {
          this.loginWindow.removeListener('closed', handleClose);
        }
        log.error(`[Douyin] 页面加载失败: ${errorCode} - ${errorDescription}`);
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

    log.info('[Douyin] 等待登录成功...');
    const startTime = Date.now();
    const timeout = 300000; // 5分钟

    return new Promise((resolve) => {
      if (!this.loginWindow) {
        resolve(false);
        return;
      }

      let checkInterval: NodeJS.Timeout | null = null;

      // 监听窗口关闭事件
      const handleWindowClose = () => {
        log.info('[Douyin] 用户关闭了登录窗口');
        if (checkInterval) {
          clearInterval(checkInterval);
        }
        this.isCancelled = true;
        resolve(false);
      };

      this.loginWindow.once('closed', handleWindowClose);

      checkInterval = setInterval(() => {
        // 检查是否取消或窗口已关闭
        if (this.isCancelled || !this.loginWindow || this.loginWindow.isDestroyed()) {
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          resolve(false);
          return;
        }

        // 检查超时
        if (Date.now() - startTime > timeout) {
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          log.warn('[Douyin] 登录超时');
          resolve(false);
          return;
        }

        // 检查 URL
        try {
          const currentUrl = this.loginWindow.webContents.getURL();
          
          // 检查是否匹配成功 URL 模式
          for (const pattern of this.SUCCESS_URL_PATTERNS) {
            if (currentUrl.includes(pattern)) {
              if (checkInterval) {
                clearInterval(checkInterval);
              }
              log.info(`[Douyin] 登录成功检测到 URL: ${currentUrl}`);
              resolve(true);
              return;
            }
          }
        } catch (error) {
          // 窗口可能已被销毁
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          resolve(false);
          return;
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
    if (!this.loginWindow) {
      return null;
    }

    log.info('[Douyin] 提取用户信息...');

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
    if (!this.loginWindow) {
      throw new Error('登录窗口不存在');
    }

    log.info('[Douyin] 捕获登录凭证...');

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

    log.info(`[Douyin] 捕获 ${cookies.length} 个 Cookies`);

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

    log.info(`[Douyin] 捕获 Storage - localStorage: ${Object.keys(localStorage).length}, sessionStorage: ${Object.keys(sessionStorage).length}`);

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
        // 更新现有账号
        existingAccounts[existingIndex] = {
          ...existingAccounts[existingIndex],
          ...account,
          updated_at: new Date()
        };
        log.info('[Douyin] 更新现有账号');
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
      // 不抛出错误，因为已经保存到本地
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    log.info('[Douyin] 清理资源...');

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

export const douyinLoginManager = DouyinLoginManager.getInstance();
export { DouyinLoginManager, DouyinLoginResult };
