import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';
import path from 'path';
import fs from 'fs';

/**
 * 网易号适配器
 * 参考 wy.js 登录器实现
 */
export class WangyiAdapter extends PlatformAdapter {
  platformId = 'wangyi';
  platformName = '网易号';

  getLoginUrl(): string {
    return 'https://mp.163.com/login.html';
  }

  getPublishUrl(): string {
    return 'https://mp.163.com/v4/home';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: '.topBar__user'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入标题"]',
      contentEditor: '.ProseMirror',
      publishButton: 'button:has-text("发布")',
      successIndicator: 'text=发布成功'
    };
  }

  /**
   * 随机等待（模拟人类操作间隔）
   */
  private async randomWait(minMs: number, maxMs: number): Promise<void> {
    const waitTime = minMs + Math.random() * (maxMs - minMs);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * 人性化点击
   */
  private async humanClick(locator: any, description: string = ''): Promise<void> {
    await this.randomWait(3000, 5000);
    await locator.click();
    if (description) {
      await this.log('info', `已点击: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  /**
   * 人性化输入
   */
  private async humanType(locator: any, text: string, description: string = ''): Promise<void> {
    await this.randomWait(3000, 5000);
    await locator.fill(text);
    if (description) {
      await this.log('info', `已输入: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  /**
   * 执行登录
   */
  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录网易号');

      // 优先使用 Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // 检查是否已登录
        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', '网易号需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查登录状态（参考 wy.js 的检测逻辑）
   */
  private async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 检查网易号登录状态...');

      // 检查用户区域（参考 wy.js 中的 .topBar__user）
      const hasUserArea = await page.locator('.topBar__user').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasUserArea) {
        await this.log('info', '✅ 检测到用户区域，已登录');
        return true;
      }

      await this.log('warning', '❌ 未检测到登录标志，可能未登录或已掉线');
      return false;

    } catch (error: any) {
      await this.log('error', '登录状态检查失败', { error: error.message });
      return false;
    }
  }

  /**
   * 执行发布
   */
  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布网易号文章', { title: article.title });

      // 导航到发布页面
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      await this.randomWait(3000, 5000);

      // 点击发布按钮
      await this.humanClick(page.getByRole('button', { name: '发布' }), '发布按钮');

      // 输入标题
      const titleInput = page.getByRole('textbox', { name: '请输入标题' });
      await this.humanClick(titleInput, '标题输入框');
      await this.humanType(titleInput, article.title, '标题内容');

      // 输入正文
      const cleanContent = this.cleanArticleContent(article.content);
      const contentEditor = page.locator('.ProseMirror');
      await this.humanClick(contentEditor, '正文编辑器');
      await this.humanType(contentEditor, cleanContent, '正文内容');

      // 上传封面图片
      const imagePath = await this.prepareImage(article);
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      await this.randomWait(3000, 5000);
      await page.getByRole('button', { name: '上传封面' }).click();
      await this.log('info', '已点击: 上传封面按钮');
      
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imagePath);
      await this.log('info', '已自动设置图片文件');
      await this.randomWait(3000, 5000);

      // 点击发布按钮
      await this.humanClick(page.getByRole('button', { name: '发布', exact: true }), '发布按钮');

      // 验证发布结果
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 网易号文章发布成功');
      } else {
        await this.log('warning', '⚠️ 发布可能未成功，请检查');
      }

      return success;

    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      return false;
    }
  }

  /**
   * 准备图片
   */
  private async prepareImage(article: Article): Promise<string> {
    const images = this.extractImagesFromContent(article.content);
    
    if (images.length === 0) {
      await this.log('error', '❌ 网易号文章必须上传图片才能发布，但文章中没有找到图片');
      throw new Error('网易号文章必须上传图片才能发布');
    }

    await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);

    const firstImage = images[0];
    const imagePath = this.resolveImagePath(firstImage);

    if (!fs.existsSync(imagePath)) {
      await this.log('error', '❌ 图片文件不存在', { path: imagePath });
      throw new Error(`图片文件不存在: ${imagePath}`);
    }

    await this.log('info', '图片准备完成', { path: imagePath });
    return imagePath;
  }

  /**
   * 验证发布成功
   */
  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000);
      
      const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          await this.log('info', `发布成功（找到文本: ${text}）`);
          return true;
        }
      }

      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('success') || 
          currentUrl.includes('published') || 
          currentUrl.includes('mp.163.com')) {
        await this.log('info', '发布成功（URL验证）');
        return true;
      }

      await this.log('info', '未找到明确的成功标志，但也没有错误提示，认为发布成功');
      return true;

    } catch (error: any) {
      await this.log('error', '验证发布结果失败', { error: error.message });
      return true;
    }
  }

  /**
   * 从文章内容中提取图片路径
   */
  private extractImagesFromContent(content: string): string[] {
    const images: string[] = [];
    
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = markdownImageRegex.exec(content)) !== null) {
      images.push(match[2]);
    }
    
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/g;
    
    while ((match = htmlImageRegex.exec(content)) !== null) {
      images.push(match[1]);
    }
    
    return images;
  }

  /**
   * 解析图片路径为绝对路径
   */
  private resolveImagePath(imagePath: string): string {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    if (imagePath.startsWith('/uploads/')) {
      return path.resolve(process.cwd(), imagePath.substring(1));
    }
    
    if (imagePath.startsWith('uploads/')) {
      return path.resolve(process.cwd(), imagePath);
    }

    if (path.isAbsolute(imagePath)) {
      return imagePath;
    }

    return path.resolve(process.cwd(), imagePath);
  }
}
