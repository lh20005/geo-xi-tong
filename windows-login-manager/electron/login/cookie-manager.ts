import { BrowserView, Cookie as ElectronCookie } from 'electron';
import log from 'electron-log';

/**
 * Cookie管理器
 * 负责捕获、存储和管理登录Cookie
 * Requirements: 13.3, 2.3
 */

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

class CookieManager {
  private static instance: CookieManager;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): CookieManager {
    if (!CookieManager.instance) {
      CookieManager.instance = new CookieManager();
    }
    return CookieManager.instance;
  }

  /**
   * 捕获所有Cookie
   * Requirements: 13.3, 2.3
   */
  async captureCookies(view: BrowserView): Promise<Cookie[]> {
    try {
      const url = view.webContents.getURL();
      const session = view.webContents.session;

      // 获取所有Cookie
      const electronCookies = await session.cookies.get({});

      // 转换为标准格式
      const cookies: Cookie[] = electronCookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '',
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: this.convertSameSite(cookie.sameSite),
      }));

      log.info(`Captured ${cookies.length} cookies from ${url}`);
      return cookies;
    } catch (error) {
      log.error('Failed to capture cookies:', error);
      throw error;
    }
  }

  /**
   * 捕获特定域名的Cookie
   */
  async captureCookiesByDomain(view: BrowserView, domain: string): Promise<Cookie[]> {
    try {
      const session = view.webContents.session;

      // 获取特定域名的Cookie
      const electronCookies = await session.cookies.get({ domain });

      const cookies: Cookie[] = electronCookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '',
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: this.convertSameSite(cookie.sameSite),
      }));

      log.info(`Captured ${cookies.length} cookies for domain: ${domain}`);
      return cookies;
    } catch (error) {
      log.error('Failed to capture cookies by domain:', error);
      throw error;
    }
  }

  /**
   * 提取Session Storage和Local Storage
   * Requirements: 13.3
   */
  async captureStorage(view: BrowserView): Promise<StorageData> {
    try {
      // 执行JavaScript获取localStorage
      const localStorage = await view.webContents.executeJavaScript(`
        (() => {
          const data = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              data[key] = localStorage.getItem(key);
            }
          }
          return data;
        })()
      `);

      // 执行JavaScript获取sessionStorage
      const sessionStorage = await view.webContents.executeJavaScript(`
        (() => {
          const data = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              data[key] = sessionStorage.getItem(key);
            }
          }
          return data;
        })()
      `);

      log.info(
        `Captured storage - localStorage: ${Object.keys(localStorage).length} items, ` +
          `sessionStorage: ${Object.keys(sessionStorage).length} items`
      );

      return {
        localStorage: localStorage || {},
        sessionStorage: sessionStorage || {},
      };
    } catch (error) {
      log.error('Failed to capture storage:', error);
      return {
        localStorage: {},
        sessionStorage: {},
      };
    }
  }

  /**
   * 设置Cookie到BrowserView
   */
  async setCookies(view: BrowserView, cookies: Cookie[]): Promise<void> {
    try {
      const session = view.webContents.session;

      for (const cookie of cookies) {
        // 构建符合Electron要求的Cookie对象
        const cookieDetails: Electron.CookiesSetDetails = {
          url: `https://${cookie.domain}${cookie.path}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expires,
          sameSite: this.convertSameSiteToElectron(cookie.sameSite) as any,
        };

        await session.cookies.set(cookieDetails);
      }

      log.info(`Set ${cookies.length} cookies`);
    } catch (error) {
      log.error('Failed to set cookies:', error);
      throw error;
    }
  }

  /**
   * 恢复Storage数据
   */
  async restoreStorage(view: BrowserView, storageData: StorageData): Promise<void> {
    try {
      // 恢复localStorage
      if (storageData.localStorage && Object.keys(storageData.localStorage).length > 0) {
        await view.webContents.executeJavaScript(`
          (() => {
            const data = ${JSON.stringify(storageData.localStorage)};
            for (const [key, value] of Object.entries(data)) {
              localStorage.setItem(key, value);
            }
          })()
        `);
      }

      // 恢复sessionStorage
      if (storageData.sessionStorage && Object.keys(storageData.sessionStorage).length > 0) {
        await view.webContents.executeJavaScript(`
          (() => {
            const data = ${JSON.stringify(storageData.sessionStorage)};
            for (const [key, value] of Object.entries(data)) {
              sessionStorage.setItem(key, value);
            }
          })()
        `);
      }

      log.info('Storage data restored');
    } catch (error) {
      log.error('Failed to restore storage:', error);
      throw error;
    }
  }

  /**
   * 清除所有Cookie
   */
  async clearCookies(view: BrowserView): Promise<void> {
    try {
      const session = view.webContents.session;
      const cookies = await session.cookies.get({});

      for (const cookie of cookies) {
        const url = `https://${cookie.domain}${cookie.path}`;
        await session.cookies.remove(url, cookie.name);
      }

      log.info('All cookies cleared');
    } catch (error) {
      log.error('Failed to clear cookies:', error);
      throw error;
    }
  }

  /**
   * 清除特定域名的Cookie
   */
  async clearCookiesByDomain(view: BrowserView, domain: string): Promise<void> {
    try {
      const session = view.webContents.session;
      const cookies = await session.cookies.get({ domain });

      for (const cookie of cookies) {
        const url = `https://${cookie.domain}${cookie.path}`;
        await session.cookies.remove(url, cookie.name);
      }

      log.info(`Cookies cleared for domain: ${domain}`);
    } catch (error) {
      log.error('Failed to clear cookies by domain:', error);
      throw error;
    }
  }

  /**
   * 获取特定Cookie
   */
  async getCookie(view: BrowserView, name: string, domain?: string): Promise<Cookie | null> {
    try {
      const session = view.webContents.session;
      const filter: any = { name };
      
      if (domain) {
        filter.domain = domain;
      }

      const cookies = await session.cookies.get(filter);

      if (cookies.length === 0) {
        return null;
      }

      const cookie = cookies[0];
      return {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '',
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: this.convertSameSite(cookie.sameSite),
      };
    } catch (error) {
      log.error('Failed to get cookie:', error);
      return null;
    }
  }

  /**
   * 检查Cookie是否存在
   */
  async hasCookie(view: BrowserView, name: string, domain?: string): Promise<boolean> {
    const cookie = await this.getCookie(view, name, domain);
    return cookie !== null;
  }

  /**
   * 监听Cookie变化
   */
  onCookieChanged(
    view: BrowserView,
    callback: (event: any, cookie: ElectronCookie, cause: string, removed: boolean) => void
  ): void {
    const session = view.webContents.session;
    session.cookies.on('changed', callback);
  }

  /**
   * 转换SameSite属性
   */
  private convertSameSite(sameSite: string | undefined): 'Strict' | 'Lax' | 'None' | undefined {
    if (!sameSite) return undefined;
    
    switch (sameSite.toLowerCase()) {
      case 'strict':
        return 'Strict';
      case 'lax':
        return 'Lax';
      case 'none':
        return 'None';
      default:
        return undefined;
    }
  }

  /**
   * 转换SameSite属性为Electron格式
   */
  private convertSameSiteToElectron(
    sameSite: 'Strict' | 'Lax' | 'None' | undefined
  ): 'no_restriction' | 'lax' | 'strict' | 'unspecified' {
    if (!sameSite) return 'unspecified';
    
    switch (sameSite) {
      case 'Strict':
        return 'strict';
      case 'Lax':
        return 'lax';
      case 'None':
        return 'no_restriction';
      default:
        return 'unspecified';
    }
  }

  /**
   * 导出Cookie为JSON
   */
  exportCookies(cookies: Cookie[]): string {
    return JSON.stringify(cookies, null, 2);
  }

  /**
   * 从JSON导入Cookie
   */
  importCookies(json: string): Cookie[] {
    try {
      return JSON.parse(json);
    } catch (error) {
      log.error('Failed to import cookies:', error);
      return [];
    }
  }
}

// 导出单例实例
export const cookieManager = CookieManager.getInstance();
export { CookieManager, Cookie, StorageData };
