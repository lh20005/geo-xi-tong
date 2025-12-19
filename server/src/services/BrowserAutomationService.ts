import puppeteer, { Browser, Page } from 'puppeteer';
import { getStandardBrowserConfig, findChromeExecutable } from '../config/browserConfig';
import { publishingService } from './PublishingService';

export interface BrowserOptions {
  headless?: boolean;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * 浏览器自动化服务
 */
export class BrowserAutomationService {
  private browser: Browser | null = null;
  private defaultOptions: BrowserOptions = {
    headless: true,
    timeout: 30000,
    viewport: {
      width: 1920,
      height: 1080
    }
  };

  /**
   * 启动浏览器
   */
  async launchBrowser(options?: BrowserOptions): Promise<Browser> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // 查找系统Chrome路径
      const executablePath = findChromeExecutable();

      // 使用统一的浏览器配置
      const launchOptions = getStandardBrowserConfig({
        headless: opts.headless,
        executablePath
      });

      this.browser = await puppeteer.launch(launchOptions);

      console.log('✅ 浏览器启动成功');
      return this.browser;
    } catch (error) {
      console.error('❌ 浏览器启动失败:', error);
      throw new Error('浏览器启动失败');
    }
  }

  /**
   * 创建新页面
   */
  async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();
    
    // 设置超时
    page.setDefaultTimeout(this.defaultOptions.timeout!);
    page.setDefaultNavigationTimeout(this.defaultOptions.timeout!);

    return page;
  }

  /**
   * 导航到URL
   */
  async navigateTo(page: Page, url: string, taskId?: number): Promise<void> {
    try {
      if (taskId) {
        await publishingService.logMessage(taskId, 'info', `导航到: ${url}`);
      }

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.defaultOptions.timeout
      });

      console.log(`✅ 成功导航到: ${url}`);
    } catch (error: any) {
      console.error(`❌ 导航失败: ${url}`, error);
      
      if (taskId) {
        await publishingService.logMessage(
          taskId,
          'error',
          `导航失败: ${url}`,
          { error: error.message }
        );
      }

      throw new Error(`导航失败: ${error.message}`);
    }
  }

  /**
   * 等待元素出现
   */
  async waitForElement(
    page: Page,
    selector: string,
    timeout?: number
  ): Promise<void> {
    try {
      await page.waitForSelector(selector, {
        timeout: timeout || this.defaultOptions.timeout
      });
    } catch (error: any) {
      throw new Error(`等待元素超时: ${selector}`);
    }
  }

  /**
   * 填充输入框
   */
  async fillInput(
    page: Page,
    selector: string,
    value: string,
    taskId?: number
  ): Promise<void> {
    try {
      await this.waitForElement(page, selector);
      await page.type(selector, value, { delay: 50 });

      if (taskId) {
        await publishingService.logMessage(
          taskId,
          'info',
          `填充输入框: ${selector}`
        );
      }
    } catch (error: any) {
      if (taskId) {
        await publishingService.logMessage(
          taskId,
          'error',
          `填充输入框失败: ${selector}`,
          { error: error.message }
        );
      }
      throw error;
    }
  }

  /**
   * 点击元素
   */
  async clickElement(
    page: Page,
    selector: string,
    taskId?: number
  ): Promise<void> {
    try {
      await this.waitForElement(page, selector);
      await page.click(selector);

      if (taskId) {
        await publishingService.logMessage(
          taskId,
          'info',
          `点击元素: ${selector}`
        );
      }
    } catch (error: any) {
      if (taskId) {
        await publishingService.logMessage(
          taskId,
          'error',
          `点击元素失败: ${selector}`,
          { error: error.message }
        );
      }
      throw error;
    }
  }

  /**
   * 截图
   */
  async takeScreenshot(
    page: Page,
    path: string,
    taskId?: number
  ): Promise<void> {
    try {
      await page.screenshot({ path, fullPage: true });

      if (taskId) {
        await publishingService.logMessage(
          taskId,
          'info',
          `截图保存: ${path}`
        );
      }
    } catch (error: any) {
      console.error('截图失败:', error);
    }
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    taskId?: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (taskId && attempt > 1) {
          await publishingService.logMessage(
            taskId,
            'info',
            `重试操作 (${attempt}/${maxRetries})`
          );
        }

        return await operation();
      } catch (error: any) {
        lastError = error;
        console.error(`操作失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

        if (attempt < maxRetries) {
          // 等待一段时间后重试
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (taskId) {
      await publishingService.logMessage(
        taskId,
        'error',
        `操作失败，已重试 ${maxRetries} 次`,
        { error: lastError?.message }
      );
    }

    throw lastError || new Error('操作失败');
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('✅ 浏览器已关闭');
    }
  }

  /**
   * 关闭页面
   */
  async closePage(page: Page): Promise<void> {
    try {
      await page.close();
    } catch (error) {
      console.error('关闭页面失败:', error);
    }
  }

  /**
   * 获取浏览器实例
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * 强制关闭浏览器（用于超时情况）
   */
  async forceCloseBrowser(): Promise<void> {
    if (this.browser) {
      try {
        // 尝试正常关闭
        await this.browser.close();
        this.browser = null;
        console.log('✅ 浏览器已强制关闭');
      } catch (error) {
        console.error('❌ 强制关闭浏览器失败:', error);
        // 即使失败也清空引用
        this.browser = null;
      }
    }
  }

  /**
   * 检查浏览器是否正在运行
   */
  isBrowserRunning(): boolean {
    return this.browser !== null;
  }
}

export const browserAutomationService = new BrowserAutomationService();
