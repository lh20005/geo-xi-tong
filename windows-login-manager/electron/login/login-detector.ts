import { BrowserView } from 'electron';
import log from 'electron-log';
import { userInfoExtractor } from './user-info-extractor';

/**
 * 登录状态检测器
 * 监听URL变化和特定元素出现来检测登录成功
 * Requirements: 2.3, 13.4
 */

interface LoginDetectionConfig {
  successUrls?: string[]; // 登录成功后的URL模式
  successSelectors?: string[]; // 登录成功后出现的元素选择器
  failureSelectors?: string[]; // 登录失败时出现的元素选择器
  timeout?: number; // 超时时间（毫秒）
}

interface LoginDetectionResult {
  success: boolean;
  method: 'url' | 'selector' | 'timeout' | 'failure';
  message: string;
  url?: string;
}

class LoginDetector {
  private static instance: LoginDetector;
  private detectionInterval: NodeJS.Timeout | null = null;
  private isCancelled = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): LoginDetector {
    if (!LoginDetector.instance) {
      LoginDetector.instance = new LoginDetector();
    }
    return LoginDetector.instance;
  }

  /**
   * 取消当前的登录检测
   */
  cancelDetection(): void {
    log.info('Cancelling login detection...');
    this.isCancelled = true;
    this.stopDetection();
  }

  /**
   * 重置取消标志
   */
  private resetCancellation(): void {
    this.isCancelled = false;
  }

  /**
   * 等待登录成功
   * Requirements: 2.3, 13.4
   */
  async waitForLoginSuccess(
    view: BrowserView,
    config: LoginDetectionConfig
  ): Promise<LoginDetectionResult> {
    const timeout = config.timeout || 300000; // 默认5分钟
    const startTime = Date.now();

    // 重置取消标志
    this.resetCancellation();

    log.info('Starting login detection...');

    return new Promise((resolve) => {
      let resolved = false;

      // 设置超时
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.stopDetection();
          log.warn('Login detection timeout');
          resolve({
            success: false,
            method: 'timeout',
            message: 'Login timeout',
          });
        }
      }, timeout);

      // 检查取消状态
      const checkCancellation = () => {
        if (this.isCancelled && !resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          this.stopDetection();
          log.info('Login detection cancelled by user');
          resolve({
            success: false,
            method: 'timeout',
            message: 'Login cancelled',
          });
          return true;
        }
        return false;
      };

      // 监听URL变化
      const urlChangeHandler = () => {
        if (resolved || checkCancellation()) return;

        const currentUrl = view.webContents.getURL();
        
        if (config.successUrls && this.matchesUrlPattern(currentUrl, config.successUrls)) {
          resolved = true;
          clearTimeout(timeoutTimer);
          this.stopDetection();
          log.info('Login success detected by URL change');
          resolve({
            success: true,
            method: 'url',
            message: 'Login successful (URL matched)',
            url: currentUrl,
          });
        }
      };

      // 监听导航
      view.webContents.on('did-navigate', urlChangeHandler);
      view.webContents.on('did-navigate-in-page', urlChangeHandler);

      // 定期检查元素
      this.detectionInterval = setInterval(async () => {
        if (resolved || checkCancellation()) return;

        try {
          // 检查失败元素
          if (config.failureSelectors) {
            for (const selector of config.failureSelectors) {
              const exists = await userInfoExtractor.elementExists(view, selector);
              if (exists) {
                resolved = true;
                clearTimeout(timeoutTimer);
                this.stopDetection();
                log.warn('Login failure detected');
                resolve({
                  success: false,
                  method: 'failure',
                  message: 'Login failed (failure element detected)',
                });
                return;
              }
            }
          }

          // 检查成功元素
          if (config.successSelectors) {
            for (const selector of config.successSelectors) {
              const exists = await userInfoExtractor.elementExists(view, selector);
              if (exists) {
                resolved = true;
                clearTimeout(timeoutTimer);
                this.stopDetection();
                log.info('Login success detected by element');
                resolve({
                  success: true,
                  method: 'selector',
                  message: 'Login successful (element detected)',
                  url: view.webContents.getURL(),
                });
                return;
              }
            }
          }
        } catch (error) {
          // 如果 BrowserView 被销毁，会抛出错误
          if (checkCancellation()) {
            return;
          }
          log.debug('Detection check error:', error);
        }
      }, 500); // 每500ms检查一次
    });
  }

  /**
   * 检测当前登录状态
   */
  async checkLoginStatus(
    view: BrowserView,
    config: LoginDetectionConfig
  ): Promise<boolean> {
    try {
      const currentUrl = view.webContents.getURL();

      // 检查URL
      if (config.successUrls && this.matchesUrlPattern(currentUrl, config.successUrls)) {
        log.debug('Login status: logged in (URL matched)');
        return true;
      }

      // 检查成功元素
      if (config.successSelectors) {
        for (const selector of config.successSelectors) {
          const exists = await userInfoExtractor.elementExists(view, selector);
          if (exists) {
            log.debug('Login status: logged in (element found)');
            return true;
          }
        }
      }

      log.debug('Login status: not logged in');
      return false;
    } catch (error) {
      log.error('Failed to check login status:', error);
      return false;
    }
  }

  /**
   * 匹配URL模式
   */
  private matchesUrlPattern(url: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      // 支持通配符匹配
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(url)) {
        return true;
      }

      // 支持简单包含匹配
      if (url.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 等待特定URL
   */
  async waitForUrl(
    view: BrowserView,
    urlPattern: string,
    timeout: number = 30000
  ): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkUrl = () => {
        const currentUrl = view.webContents.getURL();
        
        if (this.matchesUrlPattern(currentUrl, [urlPattern])) {
          log.debug(`URL matched: ${urlPattern}`);
          resolve(true);
          return true;
        }

        if (Date.now() - startTime > timeout) {
          log.warn(`URL wait timeout: ${urlPattern}`);
          resolve(false);
          return true;
        }

        return false;
      };

      // 立即检查
      if (checkUrl()) return;

      // 监听导航
      const handler = () => {
        checkUrl();
      };

      view.webContents.on('did-navigate', handler);
      view.webContents.on('did-navigate-in-page', handler);

      // 定期检查
      const interval = setInterval(() => {
        if (checkUrl()) {
          clearInterval(interval);
          view.webContents.removeListener('did-navigate', handler);
          view.webContents.removeListener('did-navigate-in-page', handler);
        }
      }, 500);
    });
  }

  /**
   * 等待页面稳定（无导航）
   */
  async waitForPageStable(view: BrowserView, stableTime: number = 2000): Promise<void> {
    return new Promise((resolve) => {
      let lastNavigationTime = Date.now();
      let checkInterval: NodeJS.Timeout;

      const navigationHandler = () => {
        lastNavigationTime = Date.now();
      };

      view.webContents.on('did-navigate', navigationHandler);
      view.webContents.on('did-navigate-in-page', navigationHandler);

      checkInterval = setInterval(() => {
        if (Date.now() - lastNavigationTime > stableTime) {
          clearInterval(checkInterval);
          view.webContents.removeListener('did-navigate', navigationHandler);
          view.webContents.removeListener('did-navigate-in-page', navigationHandler);
          log.debug('Page stable');
          resolve();
        }
      }, 500);
    });
  }

  /**
   * 检测验证码
   */
  async detectCaptcha(view: BrowserView): Promise<boolean> {
    try {
      // 常见验证码选择器
      const captchaSelectors = [
        'iframe[src*="captcha"]',
        'div[class*="captcha"]',
        'div[id*="captcha"]',
        'img[src*="captcha"]',
        'canvas[id*="captcha"]',
        '.geetest_radar_tip',
        '#nc_1_wrapper',
      ];

      for (const selector of captchaSelectors) {
        const exists = await userInfoExtractor.elementExists(view, selector);
        if (exists) {
          log.info('Captcha detected');
          return true;
        }
      }

      return false;
    } catch (error) {
      log.error('Failed to detect captcha:', error);
      return false;
    }
  }

  /**
   * 等待验证码完成
   */
  async waitForCaptchaCompletion(
    view: BrowserView,
    timeout: number = 120000
  ): Promise<boolean> {
    const startTime = Date.now();

    log.info('Waiting for captcha completion...');

    while (Date.now() - startTime < timeout) {
      const hasCaptcha = await this.detectCaptcha(view);
      
      if (!hasCaptcha) {
        log.info('Captcha completed');
        return true;
      }

      // 等待1秒后重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    log.warn('Captcha completion timeout');
    return false;
  }

  /**
   * 检测二维码登录
   */
  async detectQRCode(view: BrowserView): Promise<boolean> {
    try {
      const qrSelectors = [
        'img[alt*="二维码"]',
        'img[alt*="QR"]',
        'canvas[id*="qrcode"]',
        'div[class*="qrcode"]',
        '#qrcode',
      ];

      for (const selector of qrSelectors) {
        const exists = await userInfoExtractor.elementExists(view, selector);
        if (exists) {
          log.info('QR code detected');
          return true;
        }
      }

      return false;
    } catch (error) {
      log.error('Failed to detect QR code:', error);
      return false;
    }
  }

  /**
   * 停止检测
   */
  private stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * 获取当前页面状态
   */
  async getPageState(view: BrowserView): Promise<{
    url: string;
    title: string;
    hasCaptcha: boolean;
    hasQRCode: boolean;
  }> {
    return {
      url: view.webContents.getURL(),
      title: view.webContents.getTitle(),
      hasCaptcha: await this.detectCaptcha(view),
      hasQRCode: await this.detectQRCode(view),
    };
  }
}

// 导出单例实例
export const loginDetector = LoginDetector.getInstance();
export { LoginDetector, LoginDetectionConfig, LoginDetectionResult };
