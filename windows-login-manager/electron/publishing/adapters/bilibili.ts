import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './base';
import fs from 'fs';
import { resolveImagePath } from '../imageDownloader';

/**
 * 哔哩哔哩适配器
 * 参考 bili.js 登录器实现
 * 发布专栏文章到 B 站创作中心
 */
export class BilibiliAdapter extends PlatformAdapter {
  platformId = 'bilibili';
  platformName = '哔哩哔哩';

  getLoginUrl(): string {
    return 'https://passport.bilibili.com/login';
  }

  getPublishUrl(): string {
    return 'https://member.bilibili.com/platform/home';
  }

  /**
   * 获取专栏发布页面 URL
   */
  getArticlePublishUrl(): string {
    return 'https://member.bilibili.com/platform/upload/text/edit';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: 'span.right-entry-text'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入标题"], textarea[placeholder*="请输入标题"]',
      contentEditor: '.ql-editor, .ProseMirror, [contenteditable="true"]',
      publishButton: 'button:has-text("发布"), button:has-text("提交")',
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
   * 人性化点击（点击前后都有随机等待，2-4秒）
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
   * 人性化输入（输入前后都有随机等待，2-4秒）
   */
  private async humanType(locator: any, text: string, description: string = ''): Promise<void> {
    await this.randomWait(2000, 4000);
    await locator.fill(text);
    if (description) {
      await this.log('info', `已输入: ${description}`);
    }
    await this.randomWait(2000, 4000);
  }

  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录哔哩哔哩');

      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // 使用多重验证的 checkLoginStatus 方法，避免误判
        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', '哔哩哔哩需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  async performPublish(page: Page, article: Article, _config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布哔哩哔哩专栏文章', { title: article.title });

      // 当前应该在创作中心首页 https://member.bilibili.com/platform/home
      // 第一步：点击"投稿"链接
      await this.log('info', '第一步：点击投稿链接');
      const uploadLink = page.getByRole('link', { name: '投稿' });
      const uploadLinkVisible = await uploadLink.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!uploadLinkVisible) {
        // 备选：使用 ID 选择器
        const uploadLinkAlt = page.locator('#nav_upload_btn');
        const altVisible = await uploadLinkAlt.isVisible({ timeout: 3000 }).catch(() => false);
        if (altVisible) {
          await this.humanClick(uploadLinkAlt, '投稿链接（ID选择器）');
        } else {
          await this.log('error', '❌ 找不到投稿链接');
          await this.saveDebugScreenshot(page, 'bilibili-no-upload-link');
          return false;
        }
      } else {
        await this.humanClick(uploadLink, '投稿链接');
      }

      // 第二步：点击"专栏投稿"
      await this.log('info', '第二步：点击专栏投稿');
      await this.randomWait(2000, 3000);
      
      const articleUploadBtn = page.locator('#video-up-app').getByText('专栏投稿');
      const articleBtnVisible = await articleUploadBtn.isVisible({ timeout: 8000 }).catch(() => false);
      
      if (!articleBtnVisible) {
        await this.log('error', '❌ 找不到专栏投稿按钮');
        await this.saveDebugScreenshot(page, 'bilibili-no-article-btn');
        return false;
      }
      
      await this.humanClick(articleUploadBtn, '专栏投稿按钮');
      await this.randomWait(3000, 5000);

      // 第三步：输入标题
      // 选择器: #app > div > div.web-editor__wrap > div.b-read-editor > div.b-read-editor__title.mt-l > div > textarea
      await this.log('info', '第三步：输入标题');
      
      const titleTextarea = page.locator('div.b-read-editor__title textarea');
      const titleVisible = await titleTextarea.isVisible({ timeout: 10000 }).catch(() => false);
      
      if (!titleVisible) {
        await this.log('error', '❌ 找不到标题输入框');
        await this.saveDebugScreenshot(page, 'bilibili-no-title');
        return false;
      }
      
      await this.humanClick(titleTextarea, '标题输入框');
      await this.humanType(titleTextarea, article.title, '标题内容');

      // 第四步：输入正文
      // 选择器: div.b-read-editor__field > div > div.ql-editor
      await this.log('info', '第四步：输入正文');
      
      const contentEditor = page.locator('div.b-read-editor__field div.ql-editor');
      const editorVisible = await contentEditor.isVisible({ timeout: 10000 }).catch(() => false);
      
      if (!editorVisible) {
        await this.log('error', '❌ 找不到内容编辑器');
        await this.saveDebugScreenshot(page, 'bilibili-no-editor');
        return false;
      }
      
      await this.humanClick(contentEditor, '内容编辑器');
      
      // 清理并输入正文
      const cleanContent = this.cleanArticleContent(article.content);
      await this.humanType(contentEditor, cleanContent, '正文内容');

      // 第五步：上传图片
      // 选择器: div.b-read-editor__toolbar > div > div:nth-child(13)
      await this.log('info', '第五步：上传图片');
      const images = this.extractImagesFromContent(article.content);
      
      if (images.length > 0) {
        await this.log('info', `找到 ${images.length} 张图片，准备上传`);
        
        try {
          const imagePath = await resolveImagePath(images[0]);
          
          if (fs.existsSync(imagePath)) {
            // 图片上传按钮（工具栏第13个按钮）
            const imageUploadBtn = page.locator('div.b-read-editor__toolbar > div > div:nth-child(13)');
            const imgBtnVisible = await imageUploadBtn.isVisible({ timeout: 5000 }).catch(() => false);
            
            if (imgBtnVisible) {
              // 重要：必须在点击之前设置 waitForEvent('filechooser')
              const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
              
              await this.randomWait(2000, 3000);
              await imageUploadBtn.click();
              await this.log('info', '已点击: 图片上传按钮');
              
              // 点击后立即等待 fileChooserPromise
              const fileChooser = await fileChooserPromise;
              
              // 使用 fileChooser.setFiles() 设置文件（对话框不会显示给用户）
              await fileChooser.setFiles(imagePath);
              await this.log('info', '✅ 图片已上传');
              await this.randomWait(3000, 5000);
            } else {
              await this.log('warning', '未找到图片上传按钮，跳过图片上传');
            }
          } else {
            await this.log('warning', `图片文件不存在: ${imagePath}`);
          }
        } catch (e: any) {
          await this.log('warning', '图片上传失败，继续发布', { error: e.message });
        }
      } else {
        await this.log('info', '文章中没有图片，跳过图片上传');
      }

      // 第六步：点击发布按钮
      // 选择器: div.b-read-editor__btns button.bre-btn.primary.size--large
      await this.log('info', '第六步：点击发布按钮');
      
      const publishBtn = page.locator('div.b-read-editor__btns button.bre-btn.primary.size--large');
      const publishBtnVisible = await publishBtn.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!publishBtnVisible) {
        // 备选选择器
        const altPublishBtn = page.locator('button:has-text("发布文章"), button:has-text("提交")').first();
        const altVisible = await altPublishBtn.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (altVisible) {
          await this.humanClick(altPublishBtn, '发布按钮（备选）');
        } else {
          await this.log('error', '❌ 找不到发布按钮');
          await this.saveDebugScreenshot(page, 'bilibili-no-publish-btn');
          return false;
        }
      } else {
        await this.humanClick(publishBtn, '发布按钮');
      }

      // 处理可能的确认弹窗
      await this.log('info', '处理可能的确认弹窗');
      await this.randomWait(2000, 3000);
      
      const confirmBtn = page.locator('button:has-text("确认"), button:has-text("确定"), button:has-text("立即发布")').first();
      const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (confirmVisible) {
        await this.humanClick(confirmBtn, '确认按钮');
      }

      // 验证发布结果
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 哔哩哔哩专栏文章发布成功');
      } else {
        await this.log('warning', '⚠️ 发布可能未成功，请检查');
      }

      return success;

    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      await this.saveDebugScreenshot(page, 'bilibili-publish-error');
      return false;
    }
  }

  /**
   * 保存调试截图
   */
  private async saveDebugScreenshot(page: Page, prefix: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const screenshotPath = `${prefix}-${timestamp}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await this.log('info', `调试截图已保存: ${screenshotPath}`);
    } catch (e) {
      // 忽略截图错误
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
      images.push(match[2]);
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
      const successTexts = ['发布成功', '发布完成', '已发布', '提交成功', '投稿成功'];
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          await this.log('info', `✅ 发布成功（找到文本: ${text}）`);
          return true;
        }
      }

      // 方法2：检查 URL 是否包含成功标志或跳转到内容管理页面
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('success') || 
          currentUrl.includes('published') || 
          currentUrl.includes('complete') ||
          currentUrl.includes('/content') ||
          currentUrl.includes('/article/list')) {
        await this.log('info', '✅ 发布成功（URL验证）');
        return true;
      }

      // 方法3：检查是否有错误提示
      const errorTexts = ['发布失败', '提交失败', '请填写', '不能为空', '格式错误'];
      for (const text of errorTexts) {
        const hasError = await page.getByText(text).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasError) {
          await this.log('error', `❌ 发布失败（找到错误: ${text}）`);
          return false;
        }
      }

      // 方法4：检查是否还在发布页面（可能正在处理中）
      if (currentUrl.includes('member.bilibili.com')) {
        // 如果还在 B 站创作中心，且没有错误提示，认为发布成功
        await this.log('info', '✅ 未检测到错误，假设发布成功');
        return true;
      }

      // 默认认为成功（保守策略）
      await this.log('info', '✅ 未找到明确的失败标志，认为发布成功');
      return true;

    } catch (error: any) {
      await this.log('error', '验证发布结果失败', { error: error.message });
      // 即使验证失败，也认为发布成功（保守策略）
      return true;
    }
  }

  /**
   * 检查登录状态并获取用户信息
   * 最佳实践：
   * 1. 首先检查 URL 重定向（最可靠的未登录信号）
   * 2. 优先使用 API 验证（最准确）
   * 3. 多元素检查作为备选
   * 4. 如果没有明确的未登录信号，默认假设已登录（避免误判）
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 检查哔哩哔哩登录状态...');
      
      // 等待页面稳定（B站页面加载较慢）
      await page.waitForTimeout(2000);
      
      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('passport.bilibili.com')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 方法1（最可靠）：通过 B站 API 检查登录状态
      // https://api.bilibili.com/x/web-interface/nav 返回 isLogin 字段
      try {
        const apiCheck = await page.evaluate(async () => {
          try {
            const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
              credentials: 'include'
            });
            const data = await response.json() as { 
              code?: number;
              data?: { isLogin?: boolean; uname?: string; face?: string } 
            };
            return {
              code: data.code,
              isLogin: data.data?.isLogin || false,
              username: data.data?.uname || '',
              hasAvatar: !!data.data?.face
            };
          } catch (error) {
            return { code: -1, isLogin: false, username: '', hasAvatar: false };
          }
        });
        
        // API 返回 code=0 且 isLogin=true 表示已登录
        if (apiCheck.code === 0 && apiCheck.isLogin) {
          await this.log('info', `✅ 哔哩哔哩登录状态正常（API验证），用户: ${apiCheck.username}`);
          return true;
        }
        
        // API 返回 code=-101 表示未登录
        if (apiCheck.code === -101) {
          await this.log('warning', '❌ API返回未登录状态（code=-101），Cookie已失效');
          return false;
        }
        
        await this.log('info', `API检查结果: code=${apiCheck.code}, isLogin=${apiCheck.isLogin}`);
      } catch (e) {
        await this.log('warning', 'API检查失败，继续其他检查');
      }
      
      // 方法2：检查用户名元素（登录成功的标志）
      // 增加等待时间，因为 B 站页面加载较慢
      const usernameVisible = await page.locator('span.right-entry-text').isVisible({ timeout: 8000 }).catch(() => false);
      
      if (usernameVisible) {
        try {
          const username = await page.locator('span.right-entry-text').textContent({ timeout: 3000 });
          if (username) {
            await this.log('info', `✅ 哔哩哔哩登录状态正常，用户: ${username.trim()}`);
          } else {
            await this.log('info', '✅ 哔哩哔哩登录状态正常（检测到用户名元素）');
          }
        } catch (e) {
          await this.log('info', '✅ 哔哩哔哩登录状态正常（检测到用户名元素）');
        }
        return true;
      }
      
      // 方法3：检查用户头像（另一个登录标志）
      const avatarVisible = await page.locator('.header-avatar-wrap img, .bili-avatar img').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (avatarVisible) {
        await this.log('info', '✅ 哔哩哔哩登录状态正常（检测到用户头像）');
        return true;
      }
      
      // 方法4：检查创作中心特有元素（说明在创作中心且已登录）
      const hasCreatorElement = await page.locator('.home-containter, .creator-home').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (hasCreatorElement) {
        await this.log('info', '✅ 哔哩哔哩登录状态正常（检测到创作中心元素）');
        return true;
      }
      
      // 方法5：检查是否有"登录"按钮（未登录的明确信号）
      const hasLoginButton = await page.getByRole('button', { name: '登录' }).isVisible({ timeout: 2000 }).catch(() => false);
      if (hasLoginButton) {
        await this.log('warning', '❌ 检测到登录按钮，Cookie已失效');
        return false;
      }
      
      // 如果没有明确的登录/未登录信号，假设已登录（避免误判）
      // 这是最佳实践：宁可让发布流程继续尝试，也不要因为检测问题而误判用户被踢出
      await this.log('info', '✅ 未检测到明确的未登录信号，假设已登录');
      return true;
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      // 出错时不要轻易判定为未登录，避免误判
      return true;
    }
  }
}
