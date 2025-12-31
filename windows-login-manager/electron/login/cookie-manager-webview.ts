import { BrowserWindow, session } from 'electron';
import log from 'electron-log';

/**
 * Cookie管理器 (WebView 版本)
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

class CookieManagerWebView {
  private static instance: CookieManagerWebView;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): CookieManagerWebView {
    if (!CookieManagerWebView.instance) {
      CookieManagerWebView.instance = new CookieManagerWebView();
    }
    return CookieManagerWebView.instance;
  }

  /**
   * 捕获所有Cookie（从 webview）
   * Requirements: 13.3, 2.3
   */
  async captureCookies(parentWindow: BrowserWindow, partition: string): Promise<Cookie[]> {
    try {
      // 获取 webview 的 session
      const webviewSession = session.fromPartition(partition);

      // 获取所有Cookie
      const electronCookies = await webviewSession.cookies.get({});

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

      log.info(`Captured ${cookies.length} cookies from webview`);
      return cookies;
    } catch (error) {
      log.error('Failed to capture cookies:', error);
      throw error;
    }
  }

  /**
   * 捕获特定域名的Cookie
   */
  async captureCookiesByDomain(partition: string, domain: string): Promise<Cookie[]> {
    try {
      const webviewSession = session.fromPartition(partition);

      // 获取特定域名的Cookie
      const electronCookies = await webviewSession.cookies.get({ domain });

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
   * 提取Session Storage和Local Storage（通过 webview executeJavaScript）
   * Requirements: 13.3
   */
  async captureStorage(parentWindow: BrowserWindow, webViewId: string): Promise<StorageData> {
    try {
      // 通过 webview 执行 JavaScript 获取 storage
      const storageData = await parentWindow.webContents.executeJavaScript(`
        (async function() {
          const webview = document.getElementById('${webViewId}');
          if (!webview) {
            return { localStorage: {}, sessionStorage: {} };
          }

          try {
            const result = await webview.executeJavaScript(\`
              (function() {
                const localData = {};
                const sessionData = {};
                
                try {
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                      localData[key] = localStorage.getItem(key);
                    }
                  }
                } catch (e) {}
                
                try {
                  for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                      sessionData[key] = sessionStorage.getItem(key);
                    }
                  }
                } catch (e) {}
                
                return { localStorage: localData, sessionStorage: sessionData };
              })()
            \`);
            
            return result;
          } catch (e) {
            console.error('Failed to capture storage:', e);
            return { localStorage: {}, sessionStorage: {} };
          }
        })();
      `);

      log.info(
        `Captured storage - localStorage: ${Object.keys(storageData.localStorage || {}).length} items, ` +
          `sessionStorage: ${Object.keys(storageData.sessionStorage || {}).length} items`
      );

      return storageData || { localStorage: {}, sessionStorage: {} };
    } catch (error) {
      log.error('Failed to capture storage:', error);
      return {
        localStorage: {},
        sessionStorage: {},
      };
    }
  }

  /**
   * 设置Cookie到WebView
   */
  async setCookies(partition: string, cookies: Cookie[]): Promise<void> {
    try {
      const webviewSession = session.fromPartition(partition);

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

        await webviewSession.cookies.set(cookieDetails);
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
  async restoreStorage(parentWindow: BrowserWindow, webViewId: string, storageData: StorageData): Promise<void> {
    try {
      await parentWindow.webContents.executeJavaScript(`
        (async function() {
          const webview = document.getElementById('${webViewId}');
          if (!webview) {
            return;
          }

          const localData = ${JSON.stringify(storageData.localStorage || {})};
          const sessionData = ${JSON.stringify(storageData.sessionStorage || {})};

          try {
            await webview.executeJavaScript(\`
              (function() {
                const localData = ${JSON.stringify(storageData.localStorage || {})};
                const sessionData = ${JSON.stringify(storageData.sessionStorage || {})};
                
                try {
                  for (const [key, value] of Object.entries(localData)) {
                    localStorage.setItem(key, value);
                  }
                } catch (e) {}
                
                try {
                  for (const [key, value] of Object.entries(sessionData)) {
                    sessionStorage.setItem(key, value);
                  }
                } catch (e) {}
              })()
            \`);
          } catch (e) {
            console.error('Failed to restore storage:', e);
          }
        })();
      `);

      log.info('Storage data restored');
    } catch (error) {
      log.error('Failed to restore storage:', error);
      throw error;
    }
  }

  /**
   * 清除所有Cookie
   */
  async clearCookies(partition: string): Promise<void> {
    try {
      const webviewSession = session.fromPartition(partition);
      const cookies = await webviewSession.cookies.get({});

      for (const cookie of cookies) {
        const url = `https://${cookie.domain}${cookie.path}`;
        await webviewSession.cookies.remove(url, cookie.name);
      }

      log.info('All cookies cleared');
    } catch (error) {
      log.error('Failed to clear cookies:', error);
      throw error;
    }
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
export const cookieManagerWebView = CookieManagerWebView.getInstance();
export { CookieManagerWebView, Cookie, StorageData };
