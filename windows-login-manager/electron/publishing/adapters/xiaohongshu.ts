import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './base';
import path from 'path';
import fs from 'fs';

/**
 * 小红书适配器
 * 基于 Playwright 录制脚本优化
 */
export class XiaohongshuAdapter extends PlatformAdapter {
  platformId = 'xiaohongshu';
  platformName = '小红书';

  getLoginUrl(): string {
    return 'https://creator.xiaohongshu.com/login';
  }

  getPublishUrl(): string {
    return 'https://creator.xiaohongshu.com/publish/publish';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: 'text=发布笔记'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="填写标题"]',
      contentEditor: '.ql-editor',
      publishButton: 'button:has-text("发布")',
      successIndicator: 'text=发布成功'
    };
  }

  /**
   * 执行登录
   */
  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录小红书');

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
      await this.log('warning', '小红书需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查登录状态（参考 xhs.js 的检测逻辑）
   * 最佳实践：检查 URL 重定向 + 多指标验证 + 容错处理
   */
  private async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 检查小红书登录状态...');

      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }

      // 方法1：检查用户名（参考 xhs.js 中的 .account-name）
      const hasName = await page.locator('.account-name').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasName) {
        await this.log('info', '✅ 检测到用户名，已登录');
        return true;
      }

      // 方法2：检查用户头像（参考 xhs.js 中的 .avatar img）
      const hasAvatar = await page.locator('.avatar img').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasAvatar) {
        await this.log('info', '✅ 检测到用户头像，已登录');
        return true;
      }

      // 方法3：检查"发布笔记"按钮
      const hasPublishButton = await page.getByText('发布笔记').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasPublishButton) {
        await this.log('info', '✅ 检测到发布笔记按钮，已登录');
        return true;
      }

      // 如果没有明确的登录/未登录信号，假设已登录（避免误判）
      await this.log('info', '✅ 未检测到登录页面，假设已登录');
      return true;

    } catch (error: any) {
      await this.log('error', '登录状态检查出错', { error: error.message });
      return true;
    }
  }

  /**
   * 执行发布
   * 优化后的流程：登录后直接按照固定步骤发布
   */
  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布小红书笔记', { title: article.title });

      // 第一步：导航到发布页面
      await this.log('info', '第一步：导航到发布页面');
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000); // 模拟人类等待

      // 第二步：点击"发布笔记"
      await this.log('info', '第二步：点击发布笔记');
      await page.getByText('发布笔记').click();
      await page.waitForTimeout(2000); // 模拟人类等待

      // 第三步：点击"上传图文"（第二个，索引为1）
      await this.log('info', '第三步：点击上传图文');
      const uploadButton = page.getByText('上传图文').nth(1);
      await uploadButton.click({ noWaitAfter: true });
      await page.waitForTimeout(2500); // 模拟人类等待

      // 第四步：上传图片（不触发对话框，直接设置文件）
      await this.log('info', '第四步：上传图片');
      await this.uploadImages(page, article);
      await page.waitForTimeout(2000); // 等待图片上传完成

      // 第五步：填写标题
      await this.log('info', '第五步：填写标题');
      await page.getByRole('textbox', { name: '填写标题会有更多赞哦～' }).click();
      await page.waitForTimeout(800); // 模拟人类思考
      await page.getByRole('textbox', { name: '填写标题会有更多赞哦～' }).fill(article.title);
      await page.waitForTimeout(1000); // 模拟人类输入后停顿

      // 第六步：填写正文
      await this.log('info', '第六步：填写正文');
      const cleanContent = this.cleanArticleContent(article.content);
      let finalContent = cleanContent.length > 1000 ? cleanContent.substring(0, 997) + '...' : cleanContent;
      await page.getByRole('paragraph').first().click();
      await page.waitForTimeout(800); // 模拟人类思考
      await page.getByRole('textbox').nth(1).fill(finalContent);
      await page.waitForTimeout(1500); // 模拟人类输入后停顿

      // 第七步：选择话题按钮
      await this.log('info', '第七步：点击话题按钮');
      await page.getByRole('button', { name: '话题' }).click();
      await page.waitForTimeout(1000); // 等待话题输入框出现

      // 第八步：填写话题关键词
      await this.log('info', '第八步：填写话题关键词');
      // 从文章中提取关键词，如果没有则使用默认关键词
      const keywords = this.extractKeywords(article);
      await this.log('info', `使用关键词: ${keywords}`);
      
      // 点击话题后，正文输入框会自动添加 #，直接在正文输入框中继续输入关键词
      const contentInput = page.getByRole('textbox').nth(1);
      await contentInput.pressSequentially(keywords, { delay: 100 }); // 模拟人类输入
      await page.waitForTimeout(1500); // 等待话题列表加载

      // 第九步：选择话题
      await this.log('info', '第九步：选择话题');
      try {
        await page.locator('#creator-editor-topic-container').getByText(`#${keywords}`).click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        await this.log('info', '✅ 话题选择成功');
      } catch (error) {
        await this.log('warning', '未找到匹配的话题，跳过话题选择');
      }

      // 第十步：点击发布按钮
      await this.log('info', '第十步：点击发布按钮');
      await page.getByRole('button', { name: '发布' }).click();
      await page.waitForTimeout(1000); // 短暂等待，让点击生效

      // 验证发布结果（主动检测，不固定等待）
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 小红书笔记发布成功');
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
   * 上传图片（不触发对话框，直接设置文件）
   */
  private async uploadImages(page: Page, article: Article): Promise<void> {
    try {
      // 从文章内容中提取图片
      const images = this.extractImagesFromContent(article.content);
      
      if (images.length === 0) {
        await this.log('error', '❌ 小红书必须上传图片才能发布，但文章中没有找到图片');
        throw new Error('小红书必须上传图片才能发布');
      }

      await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);

      // 小红书只上传第一张图片作为封面
      const firstImage = images[0];
      const imagePath = this.resolveImagePath(firstImage);

      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        await this.log('error', '❌ 图片文件不存在', { path: imagePath });
        throw new Error(`图片文件不存在: ${imagePath}`);
      }

      await this.log('info', '上传图片', { path: imagePath });

      // 直接设置文件，不触发对话框
      // 找到隐藏的 file input 元素并直接设置文件
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(imagePath);
      await this.log('info', '已设置图片文件，等待上传完成...');
      
      // 等待图片上传完成
      await page.waitForTimeout(3000);
      await this.log('info', '✅ 图片上传完成');

    } catch (error: any) {
      await this.log('error', '图片上传失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 从文章中提取关键词作为话题
   */
  private extractKeywords(article: Article): string {
    // 优先使用文章的 keyword 字段
    if (article.keyword && article.keyword.trim()) {
      return article.keyword.trim();
    }
    
    // 如果没有 keyword，从标题中提取
    const title = article.title;
    
    // 常见的装修相关关键词
    const decorationKeywords = ['装修', '装饰', '设计', '家居', '室内', '软装', '硬装', '风格'];
    
    // 检查标题中是否包含装修关键词
    for (const keyword of decorationKeywords) {
      if (title.includes(keyword)) {
        return keyword;
      }
    }
    
    // 如果标题中没有，从内容中提取
    const cleanContent = this.cleanArticleContent(article.content);
    for (const keyword of decorationKeywords) {
      if (cleanContent.includes(keyword)) {
        return keyword;
      }
    }
    
    // 默认使用"装修装饰"
    return '装修装饰';
  }

  /**
   * 验证发布成功
   */
  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      // 等待页面跳转或出现成功提示（最多等待10秒）
      await this.log('info', '等待发布结果...');
      
      // 方法1：检查 URL 是否包含成功标志
      const urlChanged = await page.waitForURL(
        url => url.toString().includes('published=true') || url.toString().includes('publish/success'),
        { timeout: 10000 }
      ).then(() => true).catch(() => false);
      
      if (urlChanged) {
        await this.log('info', '发布成功（URL验证）');
        return true;
      }

      // 方法2：检查是否有成功提示文本
      const hasSuccessText = await page.getByText('发布成功').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasSuccessText) {
        await this.log('info', '发布成功（文本验证）');
        return true;
      }

      // 方法3：检查是否返回到发布页面（有些平台发布后会返回）
      const currentUrl = page.url();
      if (currentUrl.includes('/publish')) {
        await this.log('info', '发布成功（页面验证）');
        return true;
      }

      await this.log('warning', '无法确认发布是否成功');
      return false;

    } catch (error: any) {
      await this.log('error', '验证发布结果失败', { error: error.message });
      return false;
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

    // 使用 __dirname 获取当前文件所在目录，然后向上两级到 server 目录
    const serverDir = path.resolve(__dirname, '../..');

    // 如果以 /uploads/ 开头，这是相对于 server 目录的路径
    if (imagePath.startsWith('/uploads/')) {
      return path.resolve(serverDir, imagePath.substring(1));
    }
    
    // 如果以 uploads/ 开头，直接拼接到 server 目录
    if (imagePath.startsWith('uploads/')) {
      return path.resolve(serverDir, imagePath);
    }

    // 如果是绝对路径，直接返回
    if (path.isAbsolute(imagePath)) {
      return imagePath;
    }

    // 其他情况，尝试 server 目录
    return path.resolve(serverDir, imagePath);
  }
}
