import { BrowserView } from 'electron';
import log from 'electron-log';

/**
 * 用户信息提取器
 * 使用DOM选择器从登录页面提取用户信息
 * Requirements: 13.4
 */

interface UserInfo {
  username: string;
  avatar?: string;
  nickname?: string;
  userId?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

interface PlatformSelectors {
  username: string[];
  avatar?: string[];
  nickname?: string[];
  userId?: string[];
  email?: string[];
  phone?: string[];
}

class UserInfoExtractor {
  private static instance: UserInfoExtractor;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): UserInfoExtractor {
    if (!UserInfoExtractor.instance) {
      UserInfoExtractor.instance = new UserInfoExtractor();
    }
    return UserInfoExtractor.instance;
  }

  /**
   * 提取用户信息
   * Requirements: 13.4
   */
  async extractUserInfo(
    view: BrowserView,
    selectors: PlatformSelectors
  ): Promise<UserInfo | null> {
    try {
      const userInfo: UserInfo = {
        username: '',
      };

      // 提取用户名
      userInfo.username = await this.extractField(view, selectors.username);

      if (!userInfo.username) {
        log.warn('Failed to extract username');
        return null;
      }

      // 提取头像
      if (selectors.avatar) {
        userInfo.avatar = await this.extractField(view, selectors.avatar, 'src');
      }

      // 提取昵称
      if (selectors.nickname) {
        userInfo.nickname = await this.extractField(view, selectors.nickname);
      }

      // 提取用户ID
      if (selectors.userId) {
        userInfo.userId = await this.extractField(view, selectors.userId);
      }

      // 提取邮箱
      if (selectors.email) {
        userInfo.email = await this.extractField(view, selectors.email);
      }

      // 提取手机号
      if (selectors.phone) {
        userInfo.phone = await this.extractField(view, selectors.phone);
      }

      log.info('User info extracted:', { username: userInfo.username });
      return userInfo;
    } catch (error) {
      log.error('Failed to extract user info:', error);
      return null;
    }
  }

  /**
   * 提取单个字段
   */
  private async extractField(
    view: BrowserView,
    selectors: string[],
    attribute: string = 'textContent'
  ): Promise<string> {
    for (const selector of selectors) {
      try {
        const value = await this.extractBySelector(view, selector, attribute);
        
        if (value && value.trim()) {
          log.debug(`Extracted field using selector: ${selector}`);
          return value.trim();
        }
      } catch (error) {
        // 继续尝试下一个选择器
        log.debug(`Selector failed: ${selector}`);
      }
    }

    return '';
  }

  /**
   * 使用选择器提取内容
   */
  private async extractBySelector(
    view: BrowserView,
    selector: string,
    attribute: string = 'textContent'
  ): Promise<string> {
    try {
      const code = `
        (() => {
          const element = document.querySelector('${selector}');
          if (!element) return '';
          
          if ('${attribute}' === 'textContent') {
            return element.textContent || '';
          } else if ('${attribute}' === 'innerHTML') {
            return element.innerHTML || '';
          } else {
            return element.getAttribute('${attribute}') || '';
          }
        })()
      `;

      const result = await view.webContents.executeJavaScript(code);
      return result || '';
    } catch (error) {
      log.debug(`Failed to extract with selector ${selector}:`, error);
      return '';
    }
  }

  /**
   * 提取多个元素
   */
  async extractMultiple(
    view: BrowserView,
    selector: string,
    attribute: string = 'textContent'
  ): Promise<string[]> {
    try {
      const code = `
        (() => {
          const elements = document.querySelectorAll('${selector}');
          const results = [];
          
          elements.forEach(element => {
            if ('${attribute}' === 'textContent') {
              results.push(element.textContent || '');
            } else if ('${attribute}' === 'innerHTML') {
              results.push(element.innerHTML || '');
            } else {
              results.push(element.getAttribute('${attribute}') || '');
            }
          });
          
          return results;
        })()
      `;

      const results = await view.webContents.executeJavaScript(code);
      return results || [];
    } catch (error) {
      log.error('Failed to extract multiple elements:', error);
      return [];
    }
  }

  /**
   * 等待元素出现并提取
   */
  async waitAndExtract(
    view: BrowserView,
    selector: string,
    attribute: string = 'textContent',
    timeout: number = 10000
  ): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const value = await this.extractBySelector(view, selector, attribute);
        
        if (value && value.trim()) {
          return value.trim();
        }
      } catch (error) {
        // 继续等待
      }

      // 等待100ms后重试
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Element not found after ${timeout}ms: ${selector}`);
  }

  /**
   * 检查元素是否存在
   */
  async elementExists(view: BrowserView, selector: string): Promise<boolean> {
    try {
      const code = `!!document.querySelector('${selector}')`;
      const exists = await view.webContents.executeJavaScript(code);
      return exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取元素数量
   */
  async getElementCount(view: BrowserView, selector: string): Promise<number> {
    try {
      const code = `document.querySelectorAll('${selector}').length`;
      const count = await view.webContents.executeJavaScript(code);
      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 提取页面元数据
   */
  async extractPageMetadata(view: BrowserView): Promise<Record<string, string>> {
    try {
      const metadata = await view.webContents.executeJavaScript(`
        (() => {
          const data = {};
          
          // 提取meta标签
          const metaTags = document.querySelectorAll('meta');
          metaTags.forEach(tag => {
            const name = tag.getAttribute('name') || tag.getAttribute('property');
            const content = tag.getAttribute('content');
            if (name && content) {
              data[name] = content;
            }
          });
          
          // 提取title
          data.title = document.title;
          
          // 提取URL
          data.url = window.location.href;
          
          return data;
        })()
      `);

      return metadata || {};
    } catch (error) {
      log.error('Failed to extract page metadata:', error);
      return {};
    }
  }

  /**
   * 执行自定义提取脚本
   */
  async executeCustomExtractor(view: BrowserView, script: string): Promise<any> {
    try {
      const result = await view.webContents.executeJavaScript(script);
      return result;
    } catch (error) {
      log.error('Failed to execute custom extractor:', error);
      throw error;
    }
  }

  /**
   * 提取表单数据
   */
  async extractFormData(view: BrowserView, formSelector: string): Promise<Record<string, string>> {
    try {
      const code = `
        (() => {
          const form = document.querySelector('${formSelector}');
          if (!form) return {};
          
          const data = {};
          const inputs = form.querySelectorAll('input, select, textarea');
          
          inputs.forEach(input => {
            const name = input.name || input.id;
            if (name && input.value) {
              data[name] = input.value;
            }
          });
          
          return data;
        })()
      `;

      const formData = await view.webContents.executeJavaScript(code);
      return formData || {};
    } catch (error) {
      log.error('Failed to extract form data:', error);
      return {};
    }
  }

  /**
   * 提取JSON数据（从script标签或window对象）
   */
  async extractJSONData(view: BrowserView, variableName: string): Promise<any> {
    try {
      const code = `
        (() => {
          try {
            // 尝试从window对象获取
            if (window['${variableName}']) {
              return window['${variableName}'];
            }
            
            // 尝试从script标签获取
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
              const content = script.textContent || '';
              const match = content.match(/var\\s+${variableName}\\s*=\\s*({[^}]+})/);
              if (match) {
                return JSON.parse(match[1]);
              }
            }
            
            return null;
          } catch (e) {
            return null;
          }
        })()
      `;

      const data = await view.webContents.executeJavaScript(code);
      return data;
    } catch (error) {
      log.error('Failed to extract JSON data:', error);
      return null;
    }
  }

  /**
   * 清理提取的文本
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // 合并多个空格
      .replace(/[\r\n\t]/g, '') // 移除换行和制表符
      .trim();
  }

  /**
   * 验证用户信息完整性
   */
  validateUserInfo(userInfo: UserInfo): boolean {
    if (!userInfo.username || userInfo.username.trim() === '') {
      log.warn('User info validation failed: missing username');
      return false;
    }

    return true;
  }
}

// 导出单例实例
export const userInfoExtractor = UserInfoExtractor.getInstance();
export { UserInfoExtractor, UserInfo, PlatformSelectors };
