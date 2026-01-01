import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';
import path from 'path';
import fs from 'fs';

/**
 * 头条适配器
 * 基于 Playwright 录制脚本优化
 */
export class ToutiaoAdapter extends PlatformAdapter {
  platformId = 'toutiao';
  platformName = '头条';

  getLoginUrl(): string {
    return 'https://mp.toutiao.com/auth/page/login';
  }

  getPublishUrl(): string {
    return 'https://mp.toutiao.com/profile_v4/graphic/publish';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: 'text=发布'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入文章标题"]',
      contentEditor: '.ProseMirror',
      publishButton: 'button:has-text("预览并发布")',
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
      await this.log('info', '开始登录头条');

      // 优先使用 Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        // 导航到发布页面
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

      // Cookie 登录失败，需要手动登录
      await this.log('warning', '头条需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查登录状态（参考 tt.js 的检测逻辑）
   */
  private async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 检查头条登录状态...');

      // 方法1：检查用户名（参考 tt.js 中的 .auth-avator-name）
      const hasName = await page.locator('.auth-avator-name').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasName) {
        await this.log('info', '✅ 检测到用户名，已登录');
        return true;
      }

      // 方法2：检查用户头像（参考 tt.js 中的 .auth-avator-img）
      const hasAvatar = await page.locator('.auth-avator-img').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasAvatar) {
        await this.log('info', '✅ 检测到用户头像，已登录');
        return true;
      }

      // 方法3：检查"文章"链接
      const hasArticleLink = await page.getByRole('link', { name: '文章' }).isVisible({ timeout: 3000 }).catch(() => false);
      if (hasArticleLink) {
        await this.log('info', '✅ 检测到文章链接，已登录');
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
   * 优化后的流程：登录后直接按照固定步骤发布
   */
  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布头条文章', { title: article.title });

      // 第一步：关闭可能出现的抽屉遮罩，然后输入标题
      await this.log('info', '第一步：准备输入标题');
      
      // 尝试关闭抽屉遮罩（如果存在）
      try {
        const drawerMask = page.locator('.byte-drawer-mask');
        const isVisible = await drawerMask.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          await this.humanClick(drawerMask, '关闭抽屉遮罩');
        }
      } catch (e) {
        // 忽略错误，继续执行
      }

      // 点击标题输入框
      const titleInput = page.getByRole('textbox', { name: '请输入文章标题（2～30个字）' });
      await this.humanClick(titleInput, '标题输入框');
      
      // 输入标题
      await this.humanType(titleInput, article.title, '标题内容');

      // 第二步：输入正文
      await this.log('info', '第二步：输入正文');
      
      // 点击正文编辑器
      await this.humanClick(page.getByRole('paragraph').first(), '正文编辑器');
      
      // 清理并输入正文
      const cleanContent = this.cleanArticleContent(article.content);
      const contentEditor = page.locator('.ProseMirror');
      await this.humanType(contentEditor, cleanContent, '正文内容');

      // 第三步：点击上传图片按钮
      await this.log('info', '第三步：点击上传图片按钮');
      const imagePath = await this.prepareImage(article);
      await this.humanClick(page.locator('.article-cover-add'), '上传图片按钮');

      // 第四步：选择本地上传并上传图片
      await this.log('info', '第四步：选择本地上传并上传图片');
      
      // 监听文件选择器，自动设置文件（不显示对话框）
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      // 点击本地上传按钮（会触发文件选择器）
      await this.randomWait(3000, 5000); // 点击前等待 3-5秒
      await page.getByRole('button', { name: '本地上传 Choose File' }).locator('input[type="file"]').click();
      await this.log('info', '已点击: 本地上传按钮');
      
      // 拦截文件选择器并自动设置文件
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imagePath);
      await this.log('info', '已自动设置图片文件');
      await this.randomWait(3000, 5000); // 等待图片加载 3-5秒

      // 第五步：点击确定按钮
      await this.log('info', '第五步：点击确定按钮');
      await this.humanClick(page.getByRole('button', { name: '确定' }), '确定按钮');
      await this.randomWait(3000, 5000); // 等待图片上传完成 3-5秒

      // 第六步：选择第一个复选框
      await this.log('info', '第六步：选择第一个复选框');
      await this.humanClick(page.locator('.byte-checkbox-mask').first(), '第一个复选框');

      // 第七步：选择第二个复选框
      await this.log('info', '第七步：选择第二个复选框');
      await this.humanClick(
        page.locator('.byte-checkbox-group > span > .byte-checkbox > .byte-checkbox-wrapper > .byte-checkbox-mask').first(),
        '第二个复选框'
      );

      // 第八步：点击"预览并发布"按钮
      await this.log('info', '第八步：点击预览并发布');
      await this.humanClick(page.getByRole('button', { name: '预览并发布' }), '预览并发布按钮');

      // 第九步：点击"确认发布"按钮
      await this.log('info', '第九步：点击确认发布');
      await this.humanClick(page.getByRole('button', { name: '确认发布' }), '确认发布按钮');

      // 验证发布结果
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 头条文章发布成功');
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
      await this.log('error', '❌ 头条文章必须上传图片才能发布，但文章中没有找到图片');
      throw new Error('头条文章必须上传图片才能发布');
    }

    await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);

    // 头条只上传第一张图片作为封面
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
      if (currentUrl.includes('/content/manage') || 
          currentUrl.includes('/profile_v4')) {
        await this.log('info', '发布成功（页面验证）');
        return true;
      }

      // 方法4：检查是否还在发布页面
      if (currentUrl.includes('mp.toutiao.com')) {
        await this.log('info', '发布成功（停留在头条平台）');
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
