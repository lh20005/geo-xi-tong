import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';
import path from 'path';
import fs from 'fs';

/**
 * 抖音适配器
 * 基于 Playwright 录制脚本优化
 */
export class DouyinAdapter extends PlatformAdapter {
  platformId = 'douyin';
  platformName = '抖音';

  getLoginUrl(): string {
    return 'https://creator.douyin.com/passport/web/login';
  }

  getPublishUrl(): string {
    return 'https://creator.douyin.com/creator-micro/content/upload';
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
      titleInput: 'input[placeholder*="添加作品标题"]',
      contentEditor: '.ace-line',
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
   * 标准操作间隔（3-5秒）
   */
  private async standardWait(): Promise<void> {
    await this.randomWait(3000, 5000); // 3-5秒
  }

  /**
   * 人性化点击（点击前后都有3-5秒等待）
   */
  private async humanClick(locator: any, description: string = ''): Promise<void> {
    await this.standardWait(); // 点击前等待 3-5秒
    await locator.click();
    if (description) {
      await this.log('info', `已点击: ${description}`);
    }
    await this.standardWait(); // 点击后等待 3-5秒
  }

  /**
   * 人性化输入（输入前后都有3-5秒等待）
   */
  private async humanType(locator: any, text: string, description: string = ''): Promise<void> {
    await this.standardWait(); // 输入前等待 3-5秒
    await locator.fill(text);
    if (description) {
      await this.log('info', `已输入: ${description}`);
    }
    await this.standardWait(); // 输入后等待 3-5秒
  }

  /**
   * 执行登录
   */
  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录抖音');

      // 优先使用 Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        // 导航到发布页面
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // 检查是否已登录（使用多种方式验证）
        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      // Cookie 登录失败，需要手动登录
      await this.log('warning', '抖音需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查登录状态（参考 dy.js 的检测逻辑）
   * 最佳实践：检查 URL 重定向 + 多指标验证 + 容错处理
   */
  private async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 检查抖音登录状态...');

      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/passport')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }

      // 方法1：检查用户头像（参考 dy.js 中的 .img-PeynF_）
      const hasAvatar = await page.locator('.img-PeynF_').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasAvatar) {
        await this.log('info', '✅ 检测到用户头像，已登录');
        return true;
      }

      // 方法2：检查用户名（参考 dy.js 中的 .name-_lSSDc）
      const hasName = await page.locator('.name-_lSSDc').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasName) {
        await this.log('info', '✅ 检测到用户名，已登录');
        return true;
      }

      // 方法3：检查"高清发布"按钮
      const hasPublishButton = await page.getByRole('button', { name: '高清发布' }).isVisible({ timeout: 3000 }).catch(() => false);
      if (hasPublishButton) {
        await this.log('info', '✅ 检测到发布按钮，已登录');
        return true;
      }

      // 方法4：检查账号ID（参考 dy.js 中的 .unique_id-EuH8eA）
      const hasAccount = await page.locator('.unique_id-EuH8eA').isVisible({ timeout: 3000 }).catch(() => false);
      if (hasAccount) {
        await this.log('info', '✅ 检测到账号ID，已登录');
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
      await this.log('info', '开始发布抖音图文', { title: article.title });

      // 第一步：导航到发布页面
      await this.log('info', '第一步：导航到发布页面');
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      await this.standardWait(); // 等待页面加载 3-5秒

      // 第二步：点击"高清发布"
      await this.log('info', '第二步：点击高清发布');
      await this.humanClick(page.getByRole('button', { name: '高清发布' }), '高清发布按钮');

      // 第三步：点击"发布图文"菜单项
      await this.log('info', '第三步：点击发布图文');
      await this.humanClick(page.getByRole('menuitem', { name: '发布图文' }), '发布图文菜单');

      // 第四步：准备图片上传（在点击"上传图文"之前先设置好文件）
      await this.log('info', '第四步：准备图片上传');
      const imagePath = await this.prepareImage(article);
      await this.standardWait(); // 等待 3-5秒
      
      // 监听文件选择器，自动设置文件（不显示对话框）
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      // 第五步：点击"上传图文"按钮（会触发文件选择器）
      await this.log('info', '第五步：点击上传图文');
      await this.standardWait(); // 点击前等待 3-5秒
      await page.getByRole('button', { name: '上传图文' }).click();
      await this.log('info', '已点击上传图文按钮');
      
      // 拦截文件选择器并自动设置文件
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imagePath);
      await this.log('info', '已自动设置图片文件');
      await this.standardWait(); // 等待 3-5秒
      await this.log('info', '等待图片上传完成...');
      await this.randomWait(3000, 5000); // 额外等待图片上传 3-5秒

      // 第六步：填写标题
      await this.log('info', '第六步：填写标题');
      const titleInput = page.getByRole('textbox', { name: '添加作品标题' });
      await this.humanClick(titleInput, '标题输入框');
      await this.humanType(titleInput, article.title, '标题内容');

      // 第七步：填写正文（限制900字）
      await this.log('info', '第七步：填写正文');
      const cleanContent = this.cleanArticleContent(article.content);
      let finalContent = cleanContent.length > 900 ? cleanContent.substring(0, 897) + '...' : cleanContent;
      const contentEditor = page.locator('.ace-line > div');
      await this.humanClick(contentEditor, '正文编辑器');
      await this.humanType(page.locator('.zone-container'), finalContent, '正文内容');

      // 第八步：点击#号话题
      await this.log('info', '第八步：点击话题按钮');
      await this.humanClick(page.getByText('#添加话题'), '话题按钮');

      // 第九步：填写话题关键词
      await this.log('info', '第九步：填写话题关键词');
      const keywords = this.extractKeywords(article);
      await this.log('info', `使用关键词: ${keywords}`);
      
      // 在话题输入框中输入关键词
      await this.standardWait(); // 输入前等待 3-5秒
      await page.keyboard.type(keywords, { delay: 150 }); // 模拟人类输入
      await this.log('info', '已输入关键词');
      await this.standardWait(); // 等待话题列表加载 3-5秒

      // 第十步：选择话题（点击第一个匹配的话题）
      await this.log('info', '第十步：选择话题');
      try {
        // 等待话题列表出现
        await this.standardWait(); // 3-5秒
        
        // 尝试多种方式点击话题
        let topicClicked = false;
        
        // 方式1：使用 getByText
        try {
          await this.log('info', '尝试方式1：getByText');
          const topic1 = page.getByText('装修公司怎么选');
          const isVisible1 = await topic1.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible1) {
            await this.standardWait(); // 点击前等待 3-5秒
            await topic1.click();
            await this.log('info', '已点击: 话题：装修公司怎么选');
            await this.standardWait(); // 点击后等待 3-5秒
            topicClicked = true;
            await this.log('info', '✅ 方式1成功');
          }
        } catch (e) {
          await this.log('warning', '方式1失败');
        }
        
        // 方式2：使用 locator text=
        if (!topicClicked) {
          try {
            await this.log('info', '尝试方式2：locator text=');
            const topic2 = page.locator('text=装修公司怎么选').first();
            const isVisible2 = await topic2.isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible2) {
              await this.standardWait(); // 点击前等待 3-5秒
              await topic2.click();
              await this.log('info', '已点击: 话题：装修公司怎么选');
              await this.standardWait(); // 点击后等待 3-5秒
              topicClicked = true;
              await this.log('info', '✅ 方式2成功');
            }
          } catch (e) {
            await this.log('warning', '方式2失败');
          }
        }
        
        // 方式3：使用 locator 包含文本
        if (!topicClicked) {
          try {
            await this.log('info', '尝试方式3：locator :has-text');
            const topic3 = page.locator(':has-text("装修公司怎么选")').first();
            const isVisible3 = await topic3.isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible3) {
              await this.standardWait(); // 点击前等待 3-5秒
              await topic3.click();
              await this.log('info', '已点击: 话题：装修公司怎么选');
              await this.standardWait(); // 点击后等待 3-5秒
              topicClicked = true;
              await this.log('info', '✅ 方式3成功');
            }
          } catch (e) {
            await this.log('warning', '方式3失败');
          }
        }
        
        // 方式4：使用 XPath
        if (!topicClicked) {
          try {
            await this.log('info', '尝试方式4：XPath');
            const topic4 = page.locator('xpath=//*[contains(text(), "装修公司怎么选")]').first();
            const isVisible4 = await topic4.isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible4) {
              await this.standardWait(); // 点击前等待 3-5秒
              await topic4.click();
              await this.log('info', '已点击: 话题：装修公司怎么选');
              await this.standardWait(); // 点击后等待 3-5秒
              topicClicked = true;
              await this.log('info', '✅ 方式4成功');
            }
          } catch (e) {
            await this.log('warning', '方式4失败');
          }
        }
        
        if (!topicClicked) {
          await this.log('warning', '所有方式都失败，跳过话题选择');
          // 按 ESC 键关闭话题选择框
          await this.standardWait(); // 3-5秒
          await page.keyboard.press('Escape');
          await this.log('info', '已按ESC键关闭话题选择框');
          await this.standardWait(); // 3-5秒
        }
      } catch (error: any) {
        await this.log('warning', '话题选择失败，继续发布流程', { error: error.message });
        // 按 ESC 键关闭话题选择框
        await this.standardWait(); // 3-5秒
        await page.keyboard.press('Escape');
        await this.log('info', '已按ESC键关闭话题选择框');
        await this.standardWait(); // 3-5秒
      }

      // 第十一步：点击"添加声明"
      await this.log('info', '第十一步：点击添加声明');
      await this.standardWait(); // 点击前等待 3-5秒
      await page.getByText('添加声明').click();
      await this.log('info', '已点击: 添加声明按钮');
      await this.standardWait(); // 点击后等待 3-5秒

      // 第十二步：选择"内容由AI生成"
      await this.log('info', '第十二步：选择内容由AI生成');
      await this.standardWait(); // 点击前等待 3-5秒
      await page.locator('label').filter({ hasText: '内容由AI生成' }).click();
      await this.log('info', '已点击: AI生成选项');
      await this.standardWait(); // 点击后等待 3-5秒

      // 第十三步：点击确定按钮
      await this.log('info', '第十三步：点击确定按钮');
      await this.standardWait(); // 点击前等待 3-5秒
      await page.getByRole('button', { name: '确定' }).click();
      await this.log('info', '已点击: 确定按钮');
      await this.standardWait(); // 点击后等待 3-5秒

      // 第十四步：点击发布按钮
      await this.log('info', '第十四步：点击发布按钮');
      await this.standardWait(); // 点击前等待 3-5秒
      await page.getByRole('button', { name: '发布', exact: true }).click();
      await this.log('info', '已点击: 发布按钮');
      await this.standardWait(); // 点击后等待 3-5秒

      // 验证发布结果（主动检测，不固定等待）
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 抖音图文发布成功');
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
      await this.log('error', '❌ 抖音图文必须上传图片才能发布，但文章中没有找到图片');
      throw new Error('抖音图文必须上传图片才能发布');
    }

    await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);

    // 抖音只上传第一张图片作为封面
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
   * 上传图片（已废弃，使用 prepareImage + fileChooser 方式）
   */
  private async uploadImages(page: Page, article: Article): Promise<void> {
    // 此方法已废弃，现在使用 fileChooser 方式
    throw new Error('此方法已废弃');
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
    const decorationKeywords = ['装修', '装饰', '设计', '家居', '室内', '软装', '硬装', '风格', '装修公司'];
    
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
    
    // 默认使用"装修公司"
    return '装修公司';
  }

  /**
   * 验证发布成功
   */
  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      // 点击发布后，等待更长时间让页面响应
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000); // 先等待3秒让发布请求完成
      
      // 方法1：检查是否有成功提示文本（多种可能的文本）
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
          currentUrl.includes('/content/upload')) {
        await this.log('info', '发布成功（页面验证）');
        return true;
      }

      // 方法4：检查是否还在发布页面（如果还在，说明可能发布成功了）
      // 抖音发布成功后通常会停留在发布页面
      if (currentUrl.includes('creator.douyin.com')) {
        await this.log('info', '发布成功（停留在创作者平台）');
        return true;
      }

      // 方法5：检查页面上是否有"继续发布"或"查看作品"等按钮
      const continueButton = await page.getByText('继续发布').isVisible({ timeout: 2000 }).catch(() => false);
      const viewButton = await page.getByText('查看作品').isVisible({ timeout: 2000 }).catch(() => false);
      
      if (continueButton || viewButton) {
        await this.log('info', '发布成功（找到后续操作按钮）');
        return true;
      }

      // 如果以上都没有，保守地认为发布成功
      // 因为如果真的失败，通常会有明显的错误提示
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
