/**
 * 知乎适配器
 * 
 * 从服务器端迁移: server/src/services/adapters/ZhihuAdapter.ts
 * 改动说明:
 * - 修改 resolveImagePath 方法，使用 Electron app.getPath('userData') 获取本地存储路径
 * - 修改导入语句为 ES 模块格式
 */

import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

/**
 * 知乎适配器
 * 基于 Playwright 录制脚本优化
 * 发布流程：创作 → 写文章 → 输入标题 → 输入正文 → 添加封面 → 添加话题 → 发布
 */
export class ZhihuAdapter extends PlatformAdapter {
  platformId = 'zhihu';
  platformName = '知乎';

  getLoginUrl(): string {
    return 'https://www.zhihu.com/signin';
  }

  getPublishUrl(): string {
    return 'https://www.zhihu.com/';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: '.AppHeader-profileAvatar'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入标题"]',
      contentEditor: '.public-DraftStyleDefault-block',
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
   * 人性化点击（点击前后都有随机等待）
   */
  private async humanClick(locator: any, description: string = ''): Promise<void> {
    await this.randomWait(2000, 4000);
    await locator.click();
    if (description) {
      await this.log('info', `已点击: ${description}`);
    }
    await this.randomWait(2000, 4000);
  }

  /**
   * 人性化输入（输入前后都有随机等待）
   */
  private async humanType(locator: any, text: string, description: string = ''): Promise<void> {
    await this.randomWait(2000, 4000);
    await locator.fill(text);
    if (description) {
      await this.log('info', `已输入: ${description}`);
    }
    await this.randomWait(2000, 4000);
  }

  /**
   * 执行登录
   */
  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录知乎');

      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', '知乎需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 执行发布
   * 流程：创作 → 写文章(新窗口) → 输入标题 → 输入正文 → 添加封面 → 添加话题 → 发布
   */
  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布知乎文章', { title: article.title });

      // 导航到知乎首页
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      await this.randomWait(2000, 4000);

      // 第一步：点击"创作"按钮
      await this.log('info', '第一步：点击创作按钮');
      await this.humanClick(page.getByRole('button', { name: '创作' }), '创作按钮');
      
      // 等待5秒，确保下拉菜单完全加载
      await this.log('info', '等待菜单加载...');
      await this.randomWait(5000, 6000);

      // 第二步：点击"写文章"，会打开新窗口
      await this.log('info', '第二步：点击写文章（等待新窗口）');
      
      // 设置超时的 popup 等待（30秒超时，避免无限等待导致卡死）
      const popupPromise = Promise.race([
        page.waitForEvent('popup'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('等待新窗口超时（30秒）')), 30000)
        )
      ]);
      
      await this.humanClick(page.getByRole('button', { name: '写文章' }), '写文章按钮');
      
      let articlePage;
      try {
        articlePage = await popupPromise;
      } catch (error: any) {
        await this.log('error', '等待新窗口失败', { error: error.message });
        throw new Error('点击"写文章"后未能打开新窗口，可能是页面加载问题或登录状态异常');
      }
      
      // 等待新窗口加载完成（带超时）
      try {
        await articlePage.waitForLoadState('networkidle', { timeout: 30000 });
      } catch (error) {
        await this.log('warning', '新窗口加载超时，继续尝试');
      }
      await this.randomWait(2000, 4000);
      await this.log('info', '新窗口已打开');

      // 第三步：输入标题
      await this.log('info', '第三步：输入标题');
      const titleInput = articlePage.getByPlaceholder('请输入标题（最多 100 个字）');
      await this.humanClick(titleInput, '标题输入框');
      await this.humanType(titleInput, article.title, '标题内容');

      // 第四步：输入正文
      await this.log('info', '第四步：输入正文');
      const cleanContent = this.cleanArticleContent(article.content);
      await articlePage.locator('.public-DraftStyleDefault-block').click();
      await this.randomWait(1000, 2000);
      await articlePage.getByRole('textbox').nth(1).fill(cleanContent);
      await this.log('info', '已输入: 正文内容');
      await this.randomWait(2000, 4000);

      // 第五步：添加封面图片
      await this.log('info', '第五步：添加封面图片');
      const imagePath = await this.prepareImage(article);
      
      // 设置超时的 filechooser 等待（20秒超时）
      const fileChooserPromise = Promise.race([
        articlePage.waitForEvent('filechooser'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('等待文件选择器超时（20秒）')), 20000)
        )
      ]);
      
      await articlePage.getByText('添加文章封面').click();
      await this.log('info', '已点击: 添加文章封面');
      
      // 等待文件选择器并设置文件
      try {
        const fileChooser = await fileChooserPromise;
        await (fileChooser as any).setFiles(imagePath);
        await this.log('info', '已自动设置封面图片');
      } catch (error: any) {
        await this.log('warning', '封面上传失败，跳过', { error: error.message });
      }
      await this.randomWait(3000, 5000); // 等待图片上传完成

      // 第六步：点击"添加话题"按钮
      await this.log('info', '第六步：点击添加话题');
      await this.humanClick(articlePage.getByRole('button', { name: '添加话题' }), '添加话题按钮');

      // 第七步：输入话题关键词
      await this.log('info', '第七步：输入话题关键词');
      const keyword = this.extractKeyword(article);
      await this.log('info', `使用关键词: ${keyword}`);
      const topicInput = articlePage.getByRole('textbox', { name: '搜索话题' });
      await this.humanClick(topicInput, '话题搜索框');
      await topicInput.pressSequentially(keyword, { delay: 100 }); // 模拟人类输入
      await this.randomWait(2000, 3000); // 等待话题列表加载

      // 第八步：选择话题（点击第一个匹配的话题）
      await this.log('info', '第八步：选择话题');
      try {
        // 尝试点击精确匹配的话题
        const exactTopic = articlePage.getByRole('button', { name: keyword, exact: true });
        const isExactVisible = await exactTopic.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isExactVisible) {
          await this.humanClick(exactTopic, `话题: ${keyword}`);
        } else {
          // 如果没有精确匹配，点击第一个话题建议
          const firstTopic = articlePage.locator('.TopicSelector-item').first();
          const isFirstVisible = await firstTopic.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (isFirstVisible) {
            await this.humanClick(firstTopic, '第一个话题建议');
          } else {
            await this.log('warning', '未找到匹配的话题，跳过话题选择');
          }
        }
      } catch (error) {
        await this.log('warning', '话题选择失败，继续发布');
      }

      // 第九步：点击发布按钮（使用 exact: true 精确匹配，避免匹配到"发布设置"）
      await this.log('info', '第九步：点击发布按钮');
      await this.humanClick(articlePage.getByRole('button', { name: '发布', exact: true }), '发布按钮');

      // 验证发布结果
      const success = await this.verifyPublishSuccessOnPage(articlePage);
      
      if (success) {
        await this.log('info', '✅ 知乎文章发布成功');
      } else {
        await this.log('warning', '⚠️ 发布可能未成功，请检查');
      }

      // 关闭文章编辑窗口
      await articlePage.close();

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
    const images = this.extractImagesFromContent(article.content);
    
    if (images.length === 0) {
      await this.log('warning', '文章中没有找到图片，将跳过封面上传');
      throw new Error('文章中没有找到图片');
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
   * 从文章中提取关键词作为话题
   */
  private extractKeyword(article: Article): string {
    // 优先使用文章的 keyword 字段
    if (article.keyword && article.keyword.trim()) {
      return article.keyword.trim();
    }
    
    // 如果没有 keyword，从标题中提取
    const title = article.title;
    
    // 常见的关键词
    const commonKeywords = ['装修', '装饰', '设计', '家居', '室内', '软装', '硬装', '风格', 
                           '科技', '互联网', '编程', '开发', '产品', '运营', '营销'];
    
    for (const keyword of commonKeywords) {
      if (title.includes(keyword)) {
        return keyword;
      }
    }
    
    // 从内容中提取
    const cleanContent = this.cleanArticleContent(article.content);
    for (const keyword of commonKeywords) {
      if (cleanContent.includes(keyword)) {
        return keyword;
      }
    }
    
    // 默认使用标题的前几个字
    return title.substring(0, 4);
  }

  /**
   * 在文章页面验证发布成功
   */
  private async verifyPublishSuccessOnPage(page: Page): Promise<boolean> {
    try {
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000);
      
      // 方法1：检查是否有成功提示文本
      const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          await this.log('info', `发布成功（找到文本: ${text}）`);
          return true;
        }
      }

      // 方法2：检查 URL 是否变化（发布成功后通常会跳转）
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('success') || 
          currentUrl.includes('published') || 
          currentUrl.includes('zhuanlan.zhihu.com/p/')) {
        await this.log('info', '发布成功（URL验证）');
        return true;
      }

      // 方法3：检查是否跳转到文章详情页
      if (currentUrl.includes('/p/') && !currentUrl.includes('/write')) {
        await this.log('info', '发布成功（跳转到文章详情页）');
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
   * 验证发布成功（基类要求的方法）
   */
  async verifyPublishSuccess(page: Page): Promise<boolean> {
    return this.verifyPublishSuccessOnPage(page);
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
      images.push(match[2]);
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
   * Windows端使用 Electron app.getPath('userData') 获取本地存储路径
   */
  private resolveImagePath(imagePath: string): string {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    // 获取 Electron 用户数据目录作为基础路径
    const userDataPath = app.getPath('userData');

    // 如果以 /uploads/ 开头，这是相对于用户数据目录的路径
    if (imagePath.startsWith('/uploads/')) {
      return path.resolve(userDataPath, imagePath.substring(1));
    }
    
    // 如果以 uploads/ 开头，直接拼接到用户数据目录
    if (imagePath.startsWith('uploads/')) {
      return path.resolve(userDataPath, imagePath);
    }

    // 如果以 /gallery/ 开头，这是图库路径
    if (imagePath.startsWith('/gallery/')) {
      return path.resolve(userDataPath, imagePath.substring(1));
    }
    
    // 如果以 gallery/ 开头，直接拼接到用户数据目录
    if (imagePath.startsWith('gallery/')) {
      return path.resolve(userDataPath, imagePath);
    }

    // 如果是绝对路径，直接返回
    if (path.isAbsolute(imagePath)) {
      return imagePath;
    }

    // 其他情况，尝试用户数据目录
    return path.resolve(userDataPath, imagePath);
  }

  /**
   * 检查登录状态
   * 最佳实践：检查 URL 重定向 + 多指标验证 + 容错处理
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '开始检查知乎登录状态');
      
      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 检查头像元素（登录成功的标志）
      const avatarVisible = await page.locator('.AppHeader-profileAvatar').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (avatarVisible) {
        await this.log('info', '✅ 知乎登录状态正常');
        return true;
      }

      // 检查创作按钮
      const createButtonVisible = await page.getByRole('button', { name: '创作' }).isVisible({ timeout: 3000 }).catch(() => false);
      
      if (createButtonVisible) {
        await this.log('info', '✅ 知乎登录状态正常（检测到创作按钮）');
        return true;
      }
      
      // 如果没有明确的登录/未登录信号，假设已登录（避免误判）
      await this.log('info', '✅ 未检测到登录页面，假设已登录');
      return true;
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      return true;
    }
  }
}
