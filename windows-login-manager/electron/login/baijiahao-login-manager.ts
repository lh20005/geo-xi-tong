import { BrowserWindow, session } from 'electron';
import log from 'electron-log';
import { webViewManager } from './webview-manager';
import { Cookie, StorageData } from './cookie-manager';
import { storageManager } from '../storage/manager';
import { syncService } from '../sync/service';

/**
 * 百家号专用登录管理器
 * 参照头条号成功模式重写
 * 
 * 核心策略：
 * 1. 使用 webview 标签嵌入登录页面
 * 2. 检测 URL 跳转到 /builder/rc/home 判断登录成功
 * 3. 使用 session.fromPartition 获取 Cookie
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
  private loginResolve: ((result: boolean) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // 百家号配置
  private readonly PLATFORM_ID = 'baijiahao';
  private readonly PLATFORM_NAME = '百家号';
  private readonly LOGIN_URL = 'https://baijiahao.baidu.com/builder/author/register/index';
  private readonly SUCCESS_URL_PATTERNS = [
    'baijiahao.baidu.com/builder/rc/home'
  ];
  
  // 用户名选择器
  private readonly USERNAME_SELECTORS = [
    '.user-name',
    '.author-name',
    '.username',
    '[class*="user-name"]'
  ];
  
  // 头像选择器
  private readonly AVATAR_SELECTOR = '.UjPPKm89R4RrZTKhwG5H';
  
  // 需要触发悬停的元素
  private readonly HOVER_SELECTOR = '.p7Psc5P3uJ5lyxeI0ETR';

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

      // 2. 等待登录成功（检测URL跳转）
      const loginSuccess = await this.waitForLoginSuccess();
      if (!loginSuccess) {
        await this.cleanup();
        if (this.isCancelled) {
          return { success: false, message: '登录已取消' };
        }
        return { success: false, message: '登录超时或失败' };
      }

      // 3. 等待页面稳定
      log.info('[Baijiahao] 等待页面稳定...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. 触发鼠标悬停事件（显示用户名）
      await this.triggerMouseOver();
      
      // 关键：等待更长时间让用户名元素完全加载
      log.info('[Baijiahao] 等待用户名元素加载...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 5. 提取用户信息
      const userInfo = await this.extractUserInfo();
      const username = userInfo?.username || `百家号用户_${Date.now()}`;
      log.info(`[Baijiahao] 用户信息: ${username}`);

      // 6. 捕获登录凭证
      const credentials = await this.captureCredentials();
      log.info(`[Baijiahao] 获取到 ${credentials.cookies.length} 个Cookie`);

      if (credentials.cookies.length === 0) {
        await this.cleanup();
        return { success: false, message: '未能获取到Cookie，登录可能失败' };
      }

      // 7. 构建账号数据
      const account = {
        platform_id: this.PLATFORM_ID,
        account_name: username,
        real_username: username,
        credentials: {
          cookies: credentials.cookies,
          storage: credentials.storage,
          userInfo: userInfo || { username },
          loginTime: new Date().toISOString()
        }
      };

      // 8. 先同步到后端
      const backendAccount = await this.syncAccountToBackend(account);
      
      // 9. 同步成功后，使用后端返回的账号ID保存到本地
      if (backendAccount && backendAccount.id) {
        (account as any).id = backendAccount.id;
        await this.saveAccountLocally(account);
      } else {
        log.warn('[Baijiahao] 后端同步失败，不保存到本地缓存');
      }

      // 10. 清理
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
    if (!this.parentWindow) {
      throw new Error('父窗口不存在');
    }

    // 使用临时 partition，确保每次登录都是全新环境
    this.currentPartition = `login-${this.PLATFORM_ID}-${Date.now()}`;
    log.info(`[Baijiahao] 使用临时 partition: ${this.currentPartition}`);
    
    await webViewManager.createWebView(this.parentWindow, {
      url: this.LOGIN_URL,
      partition: this.currentPartition
    });

    await webViewManager.waitForLoad();
    log.info('[Baijiahao] WebView 创建成功');
  }

  /**
   * 等待登录成功
   * 策略：检测 URL 跳转到成功页面（参照头条号）
   */
  private async waitForLoginSuccess(): Promise<boolean> {
    log.info('[Baijiahao] 等待登录成功（检测URL跳转）...');
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
          log.warn('[Baijiahao] 登录超时');
          resolve(false);
          return;
        }

        // 检查 URL（使用 webViewManager.getCurrentURL，参照头条号）
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
              log.info(`[Baijiahao] ✅ 登录成功！检测到 URL: ${currentUrl}`);
              resolve(true);
              return;
            }
          }
        } catch (error) {
          // 继续检测
        }
      }, 500); // 每500ms检查一次
    });
  }

  /**
   * 触发鼠标悬停事件（显示用户名）
   */
  private async triggerMouseOver(): Promise<void> {
    try {
      log.info('[Baijiahao] 触发鼠标悬停事件...');
      await webViewManager.executeJavaScript(`
        (function() {
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
   * 根据实际页面结构：
   * 用户名在 #header-wrapper 中的链接里，格式如："晚上好,超说新商业"
   * 需要提取逗号后面的部分
   */
  private async extractUserInfo(): Promise<{ username: string; avatar?: string } | null> {
    log.info('[Baijiahao] 提取用户信息...');

    try {
      const result = await webViewManager.executeJavaScript<{ username: string; avatar?: string } | null>(`
        (function() {
          console.log('[Baijiahao] ========== 开始提取用户信息 ==========');
          
          // 获取头像
          let avatar = '';
          try {
            const imgElement = document.querySelector('#header-wrapper img[alt="头像"]');
            if (imgElement) {
              avatar = imgElement.getAttribute('src') || '';
              console.log('[Baijiahao] ✅ 头像:', avatar);
            } else {
              console.log('[Baijiahao] ❌ 未找到头像元素');
            }
          } catch (e) {
            console.log('[Baijiahao] ❌ 获取头像失败:', e);
          }
          
          let username = '';
          
          // 方法1：查找 #header-wrapper 中所有链接
          console.log('[Baijiahao] --- 方法1：查找 #header-wrapper 中的链接 ---');
          try {
            const headerWrapper = document.querySelector('#header-wrapper');
            if (headerWrapper) {
              console.log('[Baijiahao] 找到 #header-wrapper');
              const links = headerWrapper.querySelectorAll('a');
              console.log('[Baijiahao] 找到', links.length, '个链接');
              
              for (let i = 0; i < links.length; i++) {
                const link = links[i];
                const text = link.textContent || '';
                console.log('[Baijiahao] 链接', i, '文本:', text);
                
                if (text.includes(',') || text.includes('，')) {
                  const parts = text.split(/[,，]/);
                  console.log('[Baijiahao] 分割结果:', parts);
                  if (parts.length > 1 && parts[1].trim()) {
                    username = parts[1].trim();
                    console.log('[Baijiahao] ✅ 方法1成功，用户名:', username);
                    break;
                  }
                }
              }
            } else {
              console.log('[Baijiahao] ❌ 未找到 #header-wrapper');
            }
          } catch (e) {
            console.log('[Baijiahao] ❌ 方法1失败:', e);
          }
          
          // 方法2：查找所有包含"好"的链接
          if (!username) {
            console.log('[Baijiahao] --- 方法2：查找包含"好"的链接 ---');
            try {
              const allLinks = document.querySelectorAll('a');
              console.log('[Baijiahao] 页面总共', allLinks.length, '个链接');
              
              for (let i = 0; i < allLinks.length; i++) {
                const link = allLinks[i];
                const text = link.textContent || '';
                
                if (text.includes('好') && (text.includes(',') || text.includes('，'))) {
                  console.log('[Baijiahao] 找到候选链接:', text);
                  const parts = text.split(/[,，]/);
                  if (parts.length > 1 && parts[1].trim()) {
                    username = parts[1].trim();
                    console.log('[Baijiahao] ✅ 方法2成功，用户名:', username);
                    break;
                  }
                }
              }
            } catch (e) {
              console.log('[Baijiahao] ❌ 方法2失败:', e);
            }
          }
          
          // 方法3：使用 .user-name 选择器
          if (!username) {
            console.log('[Baijiahao] --- 方法3：使用 .user-name 选择器 ---');
            try {
              const nameElement = document.querySelector('.user-name');
              if (nameElement) {
                const nameText = nameElement.textContent || nameElement.innerText || '';
                console.log('[Baijiahao] .user-name 文本:', nameText);
                
                if (nameText.includes(',') || nameText.includes('，')) {
                  const parts = nameText.split(/[,，]/);
                  username = parts[1] ? parts[1].trim() : nameText.trim();
                } else {
                  username = nameText.trim();
                }
                console.log('[Baijiahao] ✅ 方法3成功，用户名:', username);
              } else {
                console.log('[Baijiahao] ❌ 未找到 .user-name 元素');
              }
            } catch (e) {
              console.log('[Baijiahao] ❌ 方法3失败:', e);
            }
          }
          
          // 方法4：打印页面HTML结构用于调试
          if (!username) {
            console.log('[Baijiahao] --- 方法4：打印页面结构用于调试 ---');
            try {
              const header = document.querySelector('#header-wrapper');
              if (header) {
                console.log('[Baijiahao] #header-wrapper HTML:', header.innerHTML.substring(0, 500));
              }
              
              // 打印所有包含"好"的元素
              const allElements = document.querySelectorAll('*');
              let count = 0;
              for (const el of allElements) {
                const text = el.textContent || '';
                if (text.includes('好') && text.length < 50) {
                  console.log('[Baijiahao] 包含"好"的元素:', el.tagName, el.className, text);
                  count++;
                  if (count > 10) break; // 只打印前10个
                }
              }
            } catch (e) {
              console.log('[Baijiahao] ❌ 方法4失败:', e);
            }
          }
          
          console.log('[Baijiahao] ========== 提取结束 ==========');
          console.log('[Baijiahao] 最终用户名:', username || '未提取到');
          
          if (!username) {
            return null;
          }
          
          return { username, avatar };
        })();
      `);

      if (result && result.username) {
        log.info(`[Baijiahao] ✅ 用户名提取成功: ${result.username}`);
        return result;
      }

      log.warn('[Baijiahao] ⚠️ 所有方法都未能提取用户名，请查看浏览器控制台日志');
      return null;
    } catch (error) {
      log.error('[Baijiahao] 提取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 捕获登录凭证（参照头条号成功模式）
   */
  private async captureCredentials(): Promise<{ cookies: Cookie[]; storage: StorageData }> {
    log.info('[Baijiahao] 捕获登录凭证...');

    // 通过 session 获取 cookies（使用临时 partition）
    const ses = session.fromPartition(this.currentPartition);
    const electronCookies = await ses.cookies.get({});
    
    log.info(`[Baijiahao] session.cookies.get 获取到 ${electronCookies.length} 个Cookie`);
    
    // 过滤百度相关Cookie
    const baiduCookies = electronCookies.filter(cookie => 
      cookie.domain && (
        cookie.domain.includes('baidu.com') ||
        cookie.domain.includes('baijiahao')
      )
    );
    
    log.info(`[Baijiahao] 过滤后百度相关Cookie: ${baiduCookies.length} 个`);
    
    // 打印关键Cookie
    const keyCookies = baiduCookies.filter(c => 
      c.name.includes('BDUSS') || 
      c.name.includes('STOKEN') ||
      c.name.includes('BAIDUID')
    );
    if (keyCookies.length > 0) {
      log.info(`[Baijiahao] 关键Cookie: ${keyCookies.map(c => c.name).join(', ')}`);
    }
    
    const cookies: Cookie[] = baiduCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.baidu.com',
      path: cookie.path || '/',
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: this.convertSameSite(cookie.sameSite)
    }));

    // 捕获 Storage
    let localStorage: Record<string, string> = {};
    let sessionStorage: Record<string, string> = {};
    
    try {
      localStorage = await webViewManager.executeJavaScript<Record<string, string>>(`
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
      `) || {};
    } catch (e) {
      log.warn('[Baijiahao] 获取localStorage失败');
    }

    try {
      sessionStorage = await webViewManager.executeJavaScript<Record<string, string>>(`
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
      `) || {};
    } catch (e) {
      log.warn('[Baijiahao] 获取sessionStorage失败');
    }

    log.info(`[Baijiahao] Storage - localStorage: ${Object.keys(localStorage).length}, sessionStorage: ${Object.keys(sessionStorage).length}`);

    return {
      cookies,
      storage: { localStorage, sessionStorage }
    };
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
      case 'no_restriction':
        return 'None';
      default:
        return undefined;
    }
  }

  private async saveAccountLocally(account: any): Promise<void> {
    try {
      log.info('[Baijiahao] 保存账号到本地 SQLite...');

      const result = await syncService.saveAccountToLocal({
        platform_id: account.platform_id,
        account_name: account.account_name,
        real_username: account.real_username,
        credentials: account.credentials
      });

      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }

      log.info(`[Baijiahao] 账号保存到本地 SQLite 成功, ID: ${result.accountId}`);
    } catch (error) {
      log.error('[Baijiahao] 保存账号到本地 SQLite 失败:', error);
      throw error;
    }
  }

  private async syncAccountToBackend(account: any): Promise<any> {
    try {
      log.info('[Baijiahao] 同步账号到后端...');
      const result = await syncService.syncAccount(account);
      if (result.success) {
        log.info('[Baijiahao] 账号已同步到后端');
        return result.account;
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
      this.parentWindow = null;
      this.loginResolve = null;
    } catch (error) {
      log.error('[Baijiahao] 清理资源失败:', error);
    }
  }

  async cancelLogin(): Promise<void> {
    if (!this.isLoginInProgress) return;

    log.info('[Baijiahao] 取消登录');
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
    this.isLoginInProgress = false;
  }

  isLoggingIn(): boolean {
    return this.isLoginInProgress;
  }
}

export const baijiahaoLoginManager = BaijiahaoLoginManager.getInstance();
export { BaijiahaoLoginManager };
