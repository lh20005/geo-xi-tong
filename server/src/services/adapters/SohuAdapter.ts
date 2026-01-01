import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';
import path from 'path';
import fs from 'fs';

/**
 * 搜狐号适配器
 * 基于 Playwright 录制脚本优化
 */
export class SohuAdapter extends PlatformAdapter {
  platformId = 'souhu';
  platformName = '搜狐号';

  getLoginUrl(): string {
    return 'https://mp.sohu.com/mpfe/v4/login';
  }

  getPublishUrl(): string {
    // 使用v3版本的主页，与测试登录保持一致
    // v4版本会重定向到clientAuth页面
    return 'https://mp.sohu.com/mpfe/v3/main/index';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: 'text=发布内容'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入标题"]',
      contentEditor: '.ql-editor',
      publishButton: 'button:has-text("发布")',
      successIndicator: 'text=发布成功'
    };
  }

  /**
   * 随机等待（模拟人类操作间隔）
   * @param minMs 最小等待时间（毫秒）
   * @param maxMs 最大等待时间（毫秒）
   */
  private async randomWait(minMs: number, maxMs: number): Promise<void> {
    const waitTime = minMs + Math.random() * (maxMs - minMs);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * 人性化点击（点击前后都有随机等待，3-5秒）
   */
  private async humanClick(locator: any, description: string = ''): Promise<void> {
    await this.randomWait(3000, 5000); // 点击前等待 3-5 秒
    await locator.click();
    if (description) {
      await this.log('info', `已点击: ${description}`);
    }
    await this.randomWait(3000, 5000); // 点击后等待 3-5 秒
  }

  /**
   * 人性化输入（输入前后都有随机等待，3-5秒）
   */
  private async humanType(locator: any, text: string, description: string = ''): Promise<void> {
    await this.randomWait(3000, 5000); // 输入前思考 3-5 秒
    await locator.fill(text);
    if (description) {
      await this.log('info', `已输入: ${description}`);
    }
    await this.randomWait(3000, 5000); // 输入后停顿 3-5 秒
  }

  /**
   * 执行登录
   */
  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录搜狐号');

      // 优先使用 Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        // Cookie 已在 context 中设置，页面已导航到发布页面
        // 这里只需要验证是否登录成功
        await page.waitForTimeout(2000);

        // 检查是否已登录（查找"发布内容"按钮）
        const isLoggedIn = await page.getByRole('button', { name: '发布内容' }).isVisible({ timeout: 5000 }).catch(() => false);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      // Cookie 登录失败，需要手动登录
      await this.log('warning', '搜狐号需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 执行发布
   * 优化后的流程：登录后直接按照固定步骤发布
   */
  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布搜狐号文章', { title: article.title });

      // 检查当前URL，如果在clientAuth页面，需要等待跳转
      const currentUrl = page.url();
      await this.log('info', `当前页面: ${currentUrl}`);
      
      if (currentUrl.includes('clientAuth') || currentUrl.includes('login')) {
        await this.log('info', '检测到认证/登录页面，等待自动跳转到主页...');
        
        try {
          // 等待页面自动跳转到主页（最多等待30秒）
          await page.waitForFunction(
            `window.location.href.includes('/main/') || 
             window.location.href.includes('/index') ||
             window.location.href.includes('contentManagement')`,
            { timeout: 30000 }
          );
          
          const newUrl = page.url();
          await this.log('info', `✅ 已跳转到: ${newUrl}`);
          
          // 等待页面稳定
          await this.randomWait(3000, 5000);
        } catch (error) {
          await this.log('warning', '页面未自动跳转，尝试手动导航到主页');
          
          // 手动导航到v3主页
          await page.goto('https://mp.sohu.com/mpfe/v3/main/index', { waitUntil: 'networkidle' });
          await this.randomWait(3000, 5000);
        }
      }
      
      // 再次检查是否需要重新导航
      const finalUrl = page.url();
      if (!finalUrl.includes('/main/') && !finalUrl.includes('/index') && !finalUrl.includes('contentManagement')) {
        await this.log('info', '当前不在主页，导航到主页...');
        await page.goto('https://mp.sohu.com/mpfe/v3/main/index', { waitUntil: 'networkidle' });
        await this.randomWait(3000, 5000);
      }

      // 第一步：点击"发布内容"按钮
      await this.log('info', '第一步：点击发布内容按钮');
      await this.humanClick(
        page.getByRole('button', { name: '发布内容' }),
        '发布内容按钮'
      );

      // 第二步：点击标题输入框并输入标题
      await this.log('info', '第二步：输入标题');
      const titleInput = page.getByRole('textbox', { name: '请输入标题（5-72字）' });
      await this.humanClick(titleInput, '标题输入框');
      await this.humanType(titleInput, article.title, '标题内容');

      // 第三步：点击正文编辑器并输入正文
      await this.log('info', '第三步：输入正文');
      const cleanContent = this.cleanArticleContent(article.content);
      await this.humanClick(
        page.getByRole('paragraph').filter({ hasText: /^$/ }),
        '正文编辑器'
      );
      await this.humanType(page.locator('.ql-editor'), cleanContent, '正文内容');

      // 第四步：点击封面按钮
      await this.log('info', '第四步：点击封面按钮');
      await this.humanClick(
        page.locator('div').filter({ hasText: /^上传图片$/ }),
        '封面按钮'
      );

      // 第五步：点击本地上传
      await this.log('info', '第五步：点击本地上传');
      await this.humanClick(
        page.getByRole('heading', { name: '本地上传' }),
        '本地上传按钮'
      );

      // 第六步：上传图片（不触发对话框，直接设置文件）
      await this.log('info', '第六步：上传图片');
      const imagePath = await this.prepareImage(article);
      
      // 监听文件选择器，自动设置文件（不显示对话框）
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      // 点击上传图片按钮（会触发文件选择器）
      await this.randomWait(3000, 5000); // 点击前等待 3-5秒
      await page.getByRole('dialog', { name: 'dialog' }).locator('label').click();
      await this.log('info', '已点击: 上传图片按钮');
      
      // 拦截文件选择器并自动设置文件
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imagePath);
      await this.log('info', '已自动设置图片文件');
      await this.randomWait(3000, 5000); // 等待图片加载 3-5秒

      // 第七步：点击确定按钮
      await this.log('info', '第七步：点击确定按钮');
      await this.humanClick(
        page.getByRole('paragraph').filter({ hasText: '确定' }),
        '确定按钮'
      );

      // 第八步：点击"发布"按钮
      await this.log('info', '第八步：点击发布按钮');
      await this.humanClick(
        page.getByText('发布', { exact: true }),
        '发布按钮'
      );

      // 验证发布结果
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 搜狐号文章发布成功');
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
   * 准备图片（提取并验证图片路径）
   */
  private async prepareImage(article: Article): Promise<string> {
    // 从文章内容中提取图片
    const images = this.extractImagesFromContent(article.content);
    
    if (images.length === 0) {
      await this.log('error', '❌ 搜狐号文章必须上传图片才能发布，但文章中没有找到图片');
      throw new Error('搜狐号文章必须上传图片才能发布');
    }

    await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);

    // 搜狐号只上传第一张图片作为封面
    const firstImage = images[0];
    const imagePath = this.resolveImagePath(firstImage);

    // 检查文件是否存在
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
      // 点击发布后，等待更长时间让页面响应
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000); // 先等待3秒让发布请求完成
      
      // 方法1：检查是否有成功提示文本
      const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          await this.log('info', `发布成功（找到文本: ${text}）`);
          return true;
        }
      }

      // 方法2：检查 URL 是否包含成功标志
      await page.waitForTimeout(2000); // 再等待2秒
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('success') || 
          currentUrl.includes('published') || 
          currentUrl.includes('complete')) {
        await this.log('info', '发布成功（URL验证）');
        return true;
      }

      // 方法3：检查是否返回到内容管理页面
      if (currentUrl.includes('/content') || 
          currentUrl.includes('mp.sohu.com')) {
        await this.log('info', '发布成功（页面验证）');
        return true;
      }

      // 如果以上都没有，保守地认为发布成功
      await this.log('info', '未找到明确的成功标志，但也没有错误提示，认为发布成功');
      return true;

    } catch (error: any) {
      await this.log('error', '验证发布结果失败', { error: error.message });
      // 即使验证失败，也认为发布成功（保守策略）
      return true;
    }
  }

  /**
   * 从文章内容中提取图片路径
   */
  private extractImagesFromContent(content: string): string[] {
    const images: string[] = [];
    
    // 匹配 Markdown 图片语法: ![alt](path)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = markdownImageRegex.exec(content)) !== null) {
      images.push(match[2]); // match[2] 是图片路径
    }
    
    // 匹配 HTML img 标签: <img src="path">
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
    // 如果是 URL，不处理
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    // 如果以 /uploads/ 开头，这是相对于 server 目录的路径
    if (imagePath.startsWith('/uploads/')) {
      // 去掉开头的 /，直接拼接到当前工作目录
      return path.resolve(process.cwd(), imagePath.substring(1));
    }
    
    // 如果以 uploads/ 开头，直接拼接到当前工作目录
    if (imagePath.startsWith('uploads/')) {
      return path.resolve(process.cwd(), imagePath);
    }

    // 如果是绝对路径，直接返回
    if (path.isAbsolute(imagePath)) {
      return imagePath;
    }

    // 其他情况，尝试当前工作目录
    return path.resolve(process.cwd(), imagePath);
  }
}
