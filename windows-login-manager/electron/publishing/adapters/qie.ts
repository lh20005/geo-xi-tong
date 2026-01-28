import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './base';
import path from 'path';
import fs from 'fs';
import { resolveImagePath } from '../imageDownloader';

/**
 * 企鹅号适配器
 * 参考 qeh.js 登录器实现
 */
export class QieAdapter extends PlatformAdapter {
  platformId = 'qie';
  platformName = '企鹅号';

  getLoginUrl(): string {
    return 'https://om.qq.com/userAuth/index';
  }

  getPublishUrl(): string {
    return 'https://om.qq.com/main/creation/article';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: 'span.usernameText-cls2j9OE'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: '.omui-inputautogrowing__inner',
      contentEditor: '.ProseMirror',
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

  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始验证企鹅号登录状态');

      // 关键修复：Cookie 已经在 PublishingExecutor 中设置并导航到发布页面
      // 这里只需要验证登录状态，不要再次导航（会导致掉线）
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '验证 Cookie 登录状态...');
        
        // 等待页面完全加载
        await page.waitForTimeout(3000);

        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', '✅ Cookie 登录验证成功');
          return true;
        }

        await this.log('warning', '❌ Cookie 已失效，需要重新登录');
        return false;
      }

      await this.log('warning', '企鹅号需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录验证失败', { error: error.message });
      return false;
    }
  }

  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布企鹅号文章', { title: article.title });

      // 第一步：输入标题
      await this.log('info', '第一步：输入标题');
      const titleInput = page.locator('.omui-inputautogrowing__inner').first();
      await this.humanClick(titleInput, '标题输入框');
      await this.humanType(titleInput, article.title, '标题内容');

      // 第二步：输入正文
      await this.log('info', '第二步：输入正文');
      await this.humanClick(page.getByRole('paragraph').filter({ hasText: /^$/ }), '正文编辑器');
      const cleanContent = this.cleanArticleContent(article.content);
      await this.humanType(page.locator('.ProseMirror'), cleanContent, '正文内容');

      // 第三步：点击"更换"按钮
      await this.log('info', '第三步：点击更换按钮');
      await this.humanClick(page.getByText('更换'), '更换按钮');

      // 第四步：点击"本地上传"
      await this.log('info', '第四步：点击本地上传');
      await this.humanClick(page.getByText('本地上传'), '本地上传按钮');

      // 第五步：上传图片
      await this.log('info', '第五步：上传图片');
      const imagePath = await this.prepareImage(article);
      
      // 必须在点击之前设置 waitForEvent('filechooser')
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      await this.randomWait(3000, 5000);
      await page.locator('.omui-upload-image-trigger').click();
      await this.log('info', '已点击: 图片上传触发器');
      
      // 点击后立即等待 fileChooserPromise
      const fileChooser = await fileChooserPromise;
      // 使用 fileChooser.setFiles() 设置文件
      await fileChooser.setFiles(imagePath);
      await this.log('info', '已自动设置图片文件');
      await this.randomWait(3000, 5000);

      // 第六步：点击确认按钮
      await this.log('info', '第六步：点击确认按钮');
      await this.humanClick(page.getByRole('button', { name: '确认' }), '确认按钮');

      // 第七步：输入标签
      await this.log('info', '第七步：输入标签');
      await this.humanClick(
        page.getByText('最多9个标签，每个标签最多8个字，用空格或Enter键隔开'),
        '标签输入区域'
      );
      const tags = this.prepareTags(article, config);
      await this.humanType(
        page.locator('#articlePublish-tag').getByRole('textbox'),
        tags,
        '标签内容'
      );

      // 第八步：点击"添加内容自主声明"按钮
      await this.log('info', '第八步：点击添加内容自主声明');
      await this.humanClick(
        page.getByRole('button', { name: '添加内容自主声明' }),
        '添加内容自主声明按钮'
      );

      // 第九步：选择第5个单选框（AI生成内容声明）
      await this.log('info', '第九步：选择AI生成内容声明');
      await this.humanClick(
        page.locator('div:nth-child(5) > .omui-radio > .omui-radio__inner'),
        'AI生成内容声明选项'
      );

      // 第十步：点击确认按钮
      await this.log('info', '第十步：点击确认按钮');
      await this.humanClick(page.getByRole('button', { name: '确认' }), '确认按钮');

      // 第十一步：点击发布按钮
      await this.log('info', '第十一步：点击发布按钮');
      await this.humanClick(page.getByRole('button', { name: '发布', exact: true }), '发布按钮');

      // 验证发布结果
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 企鹅号文章发布成功');
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
      await this.log('error', '❌ 企鹅号文章必须上传图片才能发布，但文章中没有找到图片');
      throw new Error('企鹅号文章必须上传图片才能发布');
    }

    await this.log('info', `找到 ${images.length} 张图片，准备上传第一张作为封面`);

    // 企鹅号只上传第一张图片作为封面
    const firstImage = images[0];
    // 使用新的图片下载服务（支持从服务器下载）
    const imagePath = await resolveImagePath(firstImage);

    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      await this.log('error', '❌ 图片文件不存在', { path: imagePath });
      throw new Error(`图片文件不存在: ${imagePath}`);
    }

    await this.log('info', '图片准备完成', { path: imagePath });
    return imagePath;
  }

  /**
   * 准备标签（从文章关键词或配置中提取）
   */
  private prepareTags(article: Article, config: PublishingConfig): string {
    // 优先使用配置中的标签
    if (config.tags && config.tags.length > 0) {
      return config.tags.slice(0, 9).join(' '); // 最多9个标签
    }
    
    // 使用文章关键词
    if (article.keyword) {
      // 关键词可能是逗号分隔的，转换为空格分隔
      const keywords = article.keyword.split(/[,，、\s]+/).filter((k: string) => k.trim());
      return keywords.slice(0, 9).join(' '); // 最多9个标签
    }
    
    // 默认使用标题作为标签
    return article.title.slice(0, 8); // 每个标签最多8个字
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

  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(5000); // 等待5秒让发布请求完成
      
      // 方法1：检查是否有成功提示文本
      const successTexts = ['发布成功', '发布完成', '已发布', '提交成功', '审核中'];
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          await this.log('info', `发布成功（找到文本: ${text}）`);
          return true;
        }
      }

      // 方法2：检查 URL 是否包含成功标志
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('success') || 
          currentUrl.includes('published') || 
          currentUrl.includes('complete') ||
          currentUrl.includes('manage')) {
        await this.log('info', '发布成功（URL验证）');
        return true;
      }

      // 方法3：检查是否返回到内容管理页面
      if (currentUrl.includes('/content') || 
          currentUrl.includes('/article')) {
        await this.log('info', '发布成功（页面验证）');
        return true;
      }

      // 方法4：检查是否还在企鹅号平台
      if (currentUrl.includes('om.qq.com')) {
        await this.log('info', '发布成功（停留在企鹅号平台）');
        return true;
      }

      // 如果以上都没有，保守地认为发布成功
      await this.log('info', '未找到明确的成功标志，但也没有错误提示，认为发布成功');
      return true;

    } catch (error: any) {
      await this.log('error', '验证发布结果失败', { error: error.message });
      return true; // 保守策略
    }
  }

  /**
   * 检查登录状态
   * 最佳实践：
   * 1. 检查 URL 是否被重定向到登录页面
   * 2. 检查多个成功指标，任一存在即为已登录
   * 3. 只有明确检测到登录页面才返回 false
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '开始检查企鹅号登录状态');
      
      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      // 检查是否在登录页面（明确的未登录信号）
      if (currentUrl.includes('/userAuth') || currentUrl.includes('/login')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 检查多个成功指标（任一存在即为已登录）
      const successIndicators = [
        { selector: 'span.usernameText-cls2j9OE', name: '用户名' },
        { selector: '.omui-inputautogrowing__inner', name: '标题输入框' },
        { selector: '.ProseMirror', name: '内容编辑器' },
        { selector: '.omui-upload-image-trigger', name: '图片上传区域' }
      ];
      
      for (const indicator of successIndicators) {
        try {
          const isVisible = await page.locator(indicator.selector).first().isVisible({ timeout: 2000 });
          if (isVisible) {
            await this.log('info', `✅ 企鹅号登录状态正常（检测到${indicator.name}）`);
            return true;
          }
        } catch {
          // 继续检查下一个指标
        }
      }
      
      // 检查是否有明确的未登录信号（登录按钮、登录表单等）
      const loginIndicators = [
        'button:has-text("登录")',
        'input[placeholder*="手机号"]',
        '.login-form'
      ];
      
      for (const selector of loginIndicators) {
        try {
          const isVisible = await page.locator(selector).first().isVisible({ timeout: 1000 });
          if (isVisible) {
            await this.log('warning', '❌ 检测到登录表单，Cookie已失效');
            return false;
          }
        } catch {
          // 继续检查
        }
      }
      
      // 所有检测方法都未找到登录标志，说明 Cookie 已失效
      await this.log('warning', '❌ 未检测到任何登录标志，Cookie可能已失效，请重新登录');
      return false;
      
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      return false;
    }
  }
}
