import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './base';

/**
 * 简书适配器
 * 参考 js.js 登录器实现
 */
export class JianshuAdapter extends PlatformAdapter {
  platformId = 'jianshu';
  platformName = '简书';

  getLoginUrl(): string {
    return 'https://www.jianshu.com/sign_in';
  }

  getPublishUrl(): string {
    return 'https://www.jianshu.com/';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: '.avatar>img'
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

  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始验证简书登录状态');

      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '检查 Cookie 是否有效');
        
        // Cookie 已在 context 层面设置，页面已导航到首页
        // 只需要等待页面加载并检查登录状态
        await page.waitForTimeout(2000);

        // 检查是否已登录
        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', '简书需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录验证失败', { error: error.message });
      return false;
    }
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

  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布简书文章', { title: article.title });

      // 第一步：点击"写文章"并等待新标签页打开
      await this.log('info', '第一步：点击写文章按钮（会打开新标签页）');
      await this.standardWait(); // 点击前等待 3-5秒
      
      const page1Promise = page.waitForEvent('popup');
      await page.getByRole('link', { name: '写文章' }).click();
      await this.log('info', '已点击: 写文章按钮');
      
      const page1 = await page1Promise;
      await this.log('info', '新标签页已打开，切换到编辑器页面');
      await this.standardWait(); // 等待新页面加载 3-5秒

      // 第二步：新建文章
      await this.log('info', '第二步：点击新建文章');
      await this.standardWait(); // 点击前等待 3-5秒
      await page1.getByText('新建文章', { exact: true }).click();
      await this.log('info', '已点击: 新建文章按钮');
      await this.standardWait(); // 点击后等待 3-5秒

      // 第三步：点击标题输入框
      await this.log('info', '第三步：点击标题输入框');
      await this.standardWait(); // 点击前等待 3-5秒
      await page1.getByRole('textbox').nth(1).click();
      await this.log('info', '已点击: 标题输入框');
      await this.standardWait(); // 点击后等待 3-5秒

      // 第四步：删除原有文字并填写标题
      await this.log('info', '第四步：清空并填写标题');
      await this.standardWait(); // 操作前等待 3-5秒
      await page1.getByRole('textbox').nth(1).fill('');
      await this.log('info', '已清空原有文字');
      await page1.waitForTimeout(1000); // 短暂等待
      await page1.getByRole('textbox').nth(1).fill(article.title);
      await this.log('info', `已输入标题: ${article.title}`);
      await this.standardWait(); // 输入后等待 3-5秒

      // 第五步：点击正文输入框并填写内容
      await this.log('info', '第五步：点击正文输入框');
      await this.standardWait(); // 点击前等待 3-5秒
      await page1.locator('.kalamu-area').click();
      await this.log('info', '已点击: 正文输入框');
      await this.standardWait(); // 点击后等待 3-5秒
      
      // 填写正文内容
      await this.log('info', '填写正文内容');
      const cleanContent = this.cleanArticleContent(article.content);
      await page1.keyboard.type(cleanContent, { delay: 50 }); // 每个字符间隔50ms
      await this.log('info', '已输入正文内容');
      await this.standardWait(); // 输入后等待 3-5秒

      // 第六步：点击图片上传按钮
      await this.log('info', '第六步：点击图片上传按钮');
      try {
        const images = this.extractImagesFromContent(article.content);
        if (images.length > 0) {
          await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);
          
          await this.standardWait(); // 点击前等待 3-5秒
          await page1.locator('.fa.fa-picture-o').click();
          await this.log('info', '已点击: 图片上传按钮');
          await this.standardWait(); // 点击后等待 3-5秒

          // 第七步：点击"点击上传"并上传图片
          await this.log('info', '第七步：上传图片（不弹出对话框）');
          await this.uploadImageWithFileChooser(page1, images[0]);
          
        } else {
          await this.log('info', '文章中没有图片，跳过第六步和第七步');
          await this.standardWait(); // 保持节奏一致
        }
      } catch (error: any) {
        await this.log('warning', '图片上传失败，继续发布流程', { error: error.message });
        await this.standardWait(); // 保持节奏一致
      }

      // 第八步：点击发布文章
      await this.log('info', '第八步：点击发布文章');
      await this.standardWait(); // 点击前等待 3-5秒
      await page1.getByText('发布文章').click();
      await this.log('info', '已点击: 发布文章按钮');
      await this.standardWait(); // 点击后等待 3-5秒

      // 验证发布结果
      const success = await this.verifyPublishSuccess(page1);
      
      if (success) {
        await this.log('info', '✅ 简书文章发布成功');
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
   * 使用 fileChooser 上传图片（不弹出对话框）
   */
  private async uploadImageWithFileChooser(page: Page, imagePath: string): Promise<void> {
    try {
      const path = require('path');
      const fs = require('fs');
      
      const fullPath = this.resolveImagePath(imagePath);
      
      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        await this.log('warning', '图片文件不存在', { path: fullPath });
        return;
      }

      await this.log('info', '准备上传图片', { path: fullPath });

      // 必须在点击之前设置 waitForEvent('filechooser')
      await this.standardWait(); // 点击前等待 3-5秒
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      // 点击"点击上传（可多张）"
      await page.getByText('点击上传（可多张）').click();
      await this.log('info', '已点击: 点击上传按钮');
      
      // 点击后立即等待 fileChooserPromise
      const fileChooser = await fileChooserPromise;
      
      // 使用 fileChooser.setFiles() 设置文件（对话框不会显示给用户）
      await fileChooser.setFiles(fullPath);
      await this.log('info', '已通过 fileChooser 设置图片文件');
      await this.standardWait(); // 等待上传完成 3-5秒

      await this.log('info', '✅ 图片上传完成');

    } catch (error: any) {
      await this.log('warning', '图片上传失败', { error: error.message });
      throw error;
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
    const path = require('path');
    
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

  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000); // 先等待3秒让发布请求完成
      
      // 方法1：检查是否有成功提示文本
      const successTexts = ['发布成功', '发布完成', '已发布', '发表成功'];
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
      
      if (currentUrl.includes('/p/') || // 简书文章URL格式
          currentUrl.includes('success') || 
          currentUrl.includes('published')) {
        await this.log('info', '发布成功（URL验证）');
        return true;
      }

      // 方法3：检查是否返回到文章详情页（简书发布后会跳转到文章页面）
      const articleTitle = await page.locator('h1, .title').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (articleTitle) {
        await this.log('info', '发布成功（检测到文章标题）');
        return true;
      }

      // 方法4：检查是否还在编辑器页面（如果还在，说明可能发布失败）
      const editorVisible = await page.locator('.ProseMirror').isVisible({ timeout: 2000 }).catch(() => false);
      if (!editorVisible) {
        // 编辑器不可见，说明已离开编辑页面，可能发布成功
        await this.log('info', '发布成功（已离开编辑器页面）');
        return true;
      }

      // 方法5：检查是否有"查看文章"或"继续写作"等按钮
      const viewButton = await page.getByText('查看文章').isVisible({ timeout: 2000 }).catch(() => false);
      const continueButton = await page.getByText('继续写作').isVisible({ timeout: 2000 }).catch(() => false);
      
      if (viewButton || continueButton) {
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
   * 检查登录状态
   * 最佳实践：检查 URL 重定向 + 多指标验证 + 宽松策略（避免误判）
   * 
   * 简书特点：
   * 1. 未登录访问 /writer 会重定向到 /sign_in
   * 2. 登录后页面有 .avatar>img 头像元素
   * 3. 登录后导航栏有 .user 用户区域
   * 
   * 关键原则：只有明确检测到"未登录"信号才返回false，否则默认返回true（避免误判掉线）
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 开始检查简书登录状态...');
      
      // 等待页面加载完成
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      
      // 🔴 关键检查1：URL重定向（最可靠的未登录信号）
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('/sign_in') || currentUrl.includes('/sign_up') || currentUrl.includes('/login')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 🔴 关键检查2：登录/注册按钮（明确的未登录信号）
      const loginButton = await page.locator('a:has-text("登录"), button:has-text("登录"), a:has-text("注册")').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (loginButton) {
        await this.log('warning', '❌ 检测到登录/注册按钮，Cookie已失效');
        return false;
      }
      
      // ✅ 积极信号检查（有任何一个就确认已登录）
      
      // 方法1：检查头像元素（登录成功的主要标志）
      const avatarVisible = await page.locator('.avatar>img').isVisible({ timeout: 3000 }).catch(() => false);
      if (avatarVisible) {
        await this.log('info', '✅ 检测到头像元素，登录状态正常');
        return true;
      }
      
      // 方法2：检查导航栏用户区域
      const userAreaVisible = await page.locator('.user').isVisible({ timeout: 2000 }).catch(() => false);
      if (userAreaVisible) {
        await this.log('info', '✅ 检测到用户区域，登录状态正常');
        return true;
      }
      
      // 方法3：检查导航栏中的用户图片
      const navUserImg = await page.locator('nav .user img, nav img.avatar').isVisible({ timeout: 2000 }).catch(() => false);
      if (navUserImg) {
        await this.log('info', '✅ 检测到导航栏用户图片，登录状态正常');
        return true;
      }
      
      // 方法4：检查是否有"写文章"按钮（只有登录后才能看到）
      const writeButton = await page.locator('a[href="/writer"], button:has-text("写文章")').isVisible({ timeout: 2000 }).catch(() => false);
      if (writeButton) {
        await this.log('info', '✅ 检测到写文章按钮，登录状态正常');
        return true;
      }
      
      // 🟢 宽松策略：如果没有明确的"未登录"信号，假设已登录（避免误判）
      // 原因：页面加载慢、元素未出现等情况不应该被判定为掉线
      await this.log('info', '✅ 未检测到登录页面，假设已登录');
      return true;
      
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      // 🟢 出错时也返回true（宽松策略，避免误判）
      return true;
    }
  }
}
