/**
 * 平台适配器抽象类 (Playwright)
 * 
 * 从服务器端迁移: server/src/services/adapters/PlatformAdapter.ts
 * 改动说明:
 * - 移除 publishingService 依赖
 * - 使用日志回调替代服务器端日志服务
 * - 调整图片读取路径为本地路径
 */

import { Page, BrowserContext } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface LoginSelectors {
  usernameInput: string;
  passwordInput: string;
  submitButton: string;
  successIndicator?: string;
}

export interface PublishSelectors {
  titleInput: string;
  contentEditor: string;
  categorySelect?: string;
  tagsInput?: string;
  coverImageUpload?: string;
  publishButton: string;
  successIndicator?: string;
}

export interface Article {
  id: string;  // Windows端使用UUID字符串
  title: string;
  content: string;
  keyword?: string;  // 文章关键词
  images?: string[];
}

export interface PublishingConfig {
  title?: string;
  category?: string;
  tags?: string[];
  cover_image?: string;
  [key: string]: any;
}

/**
 * 日志回调函数类型
 */
export type LogCallback = (level: 'info' | 'warning' | 'error', message: string, details?: any) => void;

/**
 * 平台适配器抽象类 (Playwright)
 * 每个平台需要实现此类来定义特定的发布逻辑
 */
export abstract class PlatformAdapter {
  abstract platformId: string;
  abstract platformName: string;
  
  // 当前任务ID（用于日志记录）
  protected currentTaskId?: string;
  
  // 日志回调
  protected logCallback?: LogCallback;

  /**
   * 获取登录页面URL
   */
  abstract getLoginUrl(): string;

  /**
   * 获取发布页面URL
   */
  abstract getPublishUrl(): string;

  /**
   * 获取登录表单选择器
   */
  abstract getLoginSelectors(): LoginSelectors;

  /**
   * 获取发布表单选择器
   */
  abstract getPublishSelectors(): PublishSelectors;

  /**
   * 设置当前任务ID（用于日志记录）
   */
  setTaskId(taskId: string): void {
    this.currentTaskId = taskId;
  }

  /**
   * 设置日志回调
   */
  setLogCallback(callback: LogCallback): void {
    this.logCallback = callback;
  }

  /**
   * 记录日志
   */
  protected async log(level: 'info' | 'warning' | 'error', message: string, details?: any): Promise<void> {
    // 调用日志回调
    if (this.logCallback) {
      this.logCallback(level, message, details);
    }
    
    // 同时输出到控制台
    const prefix = `[${this.platformName}]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warning') {
      console.warn(prefix, message, details || '');
    } else {
      console.log(prefix, message, details || '');
    }
  }

  /**
   * 执行登录流程
   * 支持两种登录方式：
   * 1. Cookie登录：如果credentials包含cookies数组，直接设置Cookie（在context层面）
   * 2. 表单登录：使用用户名密码登录
   */
  abstract performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[]; [key: string]: any }
  ): Promise<boolean>;

  /**
   * 执行发布流程
   */
  abstract performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean>;

  /**
   * 验证发布成功
   */
  abstract verifyPublishSuccess(page: Page): Promise<boolean>;

  /**
   * 处理平台特定逻辑
   */
  async handlePlatformSpecifics(
    page: Page,
    config: PublishingConfig
  ): Promise<void> {
    // 默认实现为空，子类可以覆盖
  }

  /**
   * 处理验证码（如果需要）
   */
  async handleCaptcha(page: Page): Promise<boolean> {
    // 默认实现返回true，子类可以覆盖
    return true;
  }

  /**
   * 等待页面加载完成
   */
  protected async waitForPageLoad(page: Page, timeout: number = 5000): Promise<void> {
    await page.waitForTimeout(timeout);
  }

  /**
   * 清理文章内容，移除HTML标签和Markdown图片语法，保留段落格式
   * 这是一个通用方法，所有平台适配器都可以使用
   */
  protected cleanArticleContent(content: string): string {
    if (!content) return '';
    
    let cleanedContent = content;
    
    // 1. 移除Markdown图片语法 ![alt](url)
    cleanedContent = cleanedContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');
    
    // 2. 处理HTML标签，保留段落结构
    // 将 <p>、</p>、<br>、<br/> 转换为换行符
    cleanedContent = cleanedContent.replace(/<\/p>/gi, '\n');
    cleanedContent = cleanedContent.replace(/<p[^>]*>/gi, '');
    cleanedContent = cleanedContent.replace(/<br\s*\/?>/gi, '\n');
    
    // 3. 移除其他所有HTML标签（保留文本内容）
    cleanedContent = cleanedContent.replace(/<[^>]+>/g, '');
    
    // 4. 移除HTML实体字符
    cleanedContent = cleanedContent.replace(/&nbsp;/g, ' ');
    cleanedContent = cleanedContent.replace(/&lt;/g, '<');
    cleanedContent = cleanedContent.replace(/&gt;/g, '>');
    cleanedContent = cleanedContent.replace(/&amp;/g, '&');
    cleanedContent = cleanedContent.replace(/&quot;/g, '"');
    
    // 5. 移除图片URL（http开头的链接）
    cleanedContent = cleanedContent.replace(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi, '');
    
    // 6. 清理多余的空行（超过2个连续换行符的合并为2个）
    cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');
    
    // 7. 移除首尾空白
    cleanedContent = cleanedContent.trim();
    
    return cleanedContent;
  }

  /**
   * 安全地填充输入框 (Playwright)
   */
  protected async safeType(
    page: Page,
    selector: string,
    text: string,
    options?: { delay?: number }
  ): Promise<void> {
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector, { clickCount: 3 }); // 选中现有文本
    await page.keyboard.press('Backspace'); // 删除
    await page.type(selector, text, options);
  }

  /**
   * 安全地点击元素 (Playwright)
   */
  protected async safeClick(page: Page, selector: string): Promise<void> {
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector);
  }

  /**
   * 使用Cookie登录
   * Cookie 已在 BrowserContext 层面设置，这里只需要验证
   */
  protected async loginWithCookies(
    page: Page,
    cookies: any[]
  ): Promise<boolean> {
    try {
      console.log(`[Cookie登录] Cookie 已在 context 中设置`);
      
      // 刷新页面以应用Cookie
      await page.reload({ waitUntil: 'networkidle' });
      
      console.log(`[Cookie登录] 页面刷新完成`);
      
      return true;
    } catch (error: any) {
      console.error('[Cookie登录] 失败:', error);
      return false;
    }
  }

  /**
   * 验证Cookie登录是否成功
   * 子类可以覆盖此方法来实现特定的验证逻辑
   */
  protected async verifyCookieLogin(page: Page): Promise<boolean> {
    try {
      const selectors = this.getLoginSelectors();
      if (selectors.successIndicator) {
        // 等待登录成功的标识元素出现
        await page.waitForSelector(selectors.successIndicator, { timeout: 5000 });
        return true;
      }
      // 如果没有定义成功标识，默认认为成功
      return true;
    } catch (error) {
      console.error('[Cookie登录验证] 失败:', error);
      return false;
    }
  }

  /**
   * 构建包含base64图片的HTML内容
   * 这是从头条号成功经验中提取的通用方法
   * 
   * @param article 文章对象
   * @param localBasePath 本地图片基础路径
   */
  protected async buildHtmlWithImages(
    article: Article,
    localBasePath: string
  ): Promise<string> {
    // 提取Markdown中的图片
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const images: string[] = [];
    let match;
    
    while ((match = imageRegex.exec(article.content)) !== null) {
      images.push(match[1]);
    }

    console.log(`[${this.platformName}] 📷 找到 ${images.length} 张图片`);

    // 构建HTML内容
    let htmlContent = '';
    const lines = article.content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('![')) {
        // 图片行
        const imgMatch = /!\[.*?\]\((.*?)\)/.exec(trimmedLine);
        if (imgMatch) {
          const imagePath = imgMatch[1];
          
          // 处理图片路径
          let fullPath: string;
          if (path.isAbsolute(imagePath)) {
            fullPath = imagePath;
          } else if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            // 网络图片，跳过base64转换
            htmlContent += `<p><img src="${imagePath}" /></p>`;
            continue;
          } else {
            fullPath = path.join(localBasePath, imagePath);
          }
          
          try {
            const imageBuffer = await fs.readFile(fullPath);
            const base64 = imageBuffer.toString('base64');
            
            // 检测图片格式
            let mimeType = 'image/png';
            const ext = path.extname(fullPath).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') {
              mimeType = 'image/jpeg';
            } else if (ext === '.gif') {
              mimeType = 'image/gif';
            } else if (ext === '.webp') {
              mimeType = 'image/webp';
            }
            
            htmlContent += `<p><img src="data:${mimeType};base64,${base64}" /></p>`;
            console.log(`[${this.platformName}] ✅ 图片已转换为base64: ${imagePath}`);
          } catch (error: any) {
            console.error(`[${this.platformName}] ❌ 读取图片失败: ${imagePath}`, error.message);
          }
        }
      } else if (trimmedLine) {
        // 文本行
        htmlContent += `<p>${trimmedLine}</p>`;
      }
    }

    return htmlContent;
  }

  /**
   * 使用DOM直接设置编辑器内容（包含图片）
   * 这是从头条号成功经验中提取的通用方法
   */
  protected async setEditorContentWithDOM(
    page: Page,
    editorSelector: string,
    htmlContent: string
  ): Promise<boolean> {
    try {
      console.log(`[${this.platformName}] 🔧 使用DOM直接设置编辑器内容`);
      
      // 点击编辑器使其获得焦点
      await page.click(editorSelector);
      await this.waitForPageLoad(page, 500);
      
      // 直接设置innerHTML
      // 注意：evaluate 中的代码在浏览器环境执行，document 是可用的
      await page.evaluate(({ selector, html }: { selector: string; html: string }) => {
        const editor = (globalThis as any).document.querySelector(selector);
        if (editor) {
          editor.innerHTML = html;
          
          // 触发事件让编辑器知道内容已更改
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          editor.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { selector: editorSelector, html: htmlContent });
      
      console.log(`[${this.platformName}] ✅ 内容已通过DOM设置`);
      
      // 等待内容加载
      await this.waitForPageLoad(page, 5000);
      
      return true;
    } catch (error: any) {
      console.error(`[${this.platformName}] ❌ DOM设置失败:`, error.message);
      return false;
    }
  }
}
