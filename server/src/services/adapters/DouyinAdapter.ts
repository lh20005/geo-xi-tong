import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 抖音号适配器
 * 注意：抖音主要是短视频平台，图文内容功能有限
 */
export class DouyinAdapter extends PlatformAdapter {
  platformId = 'douyin';
  platformName = '抖音号';

  getLoginUrl(): string {
    return 'https://creator.douyin.com/';
  }

  getPublishUrl(): string {
    return 'https://creator.douyin.com/creator-micro/content/publish';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button.login-btn',
      successIndicator: '.user-info'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder="填写标题"]',
      contentEditor: 'textarea[placeholder="填写内容"]',
      coverImageUpload: 'input[type="file"]',
      publishButton: 'button.publish-btn',
      successIndicator: '.success-tip'
    };
  }

  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // 优先使用Cookie登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[抖音号] 使用Cookie登录');
        
        await page.goto('https://creator.douyin.com/', { waitUntil: 'networkidle2' });
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess && await this.verifyCookieLogin(page)) {
          console.log('✅ 抖音号Cookie登录成功');
          return true;
        }
        
        console.log('[抖音号] Cookie登录失败，尝试表单登录');
      }
      
      const selectors = this.getLoginSelectors();
      await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      await this.safeType(page, selectors.usernameInput, credentials.username);
      await this.safeType(page, selectors.passwordInput, credentials.password);
      await this.safeClick(page, selectors.submitButton);

      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 15000 });
      }

      console.log('✅ 抖音号表单登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ 抖音号登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      console.log('[抖音号] 开始发布流程');
      const path = require('path');
      const fs = require('fs');
      const selectors = this.getPublishSelectors();
      
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });

      const title = config.title || article.title;
      await this.safeType(page, selectors.titleInput, title, { delay: 50 });
      console.log(`[抖音号] ✅ 标题已填写: ${title}`);

      await page.waitForSelector(selectors.contentEditor);
      
      // 抖音号使用textarea，处理方式略有不同
      let cleanContent = article.content;
      const contentLines = cleanContent.split('\n');
      const firstLine = contentLines[0].trim();
      
      if (firstLine.includes(article.title) || article.title.includes(firstLine)) {
        cleanContent = contentLines.slice(1).join('\n').trim();
      } else if (firstLine.startsWith('#')) {
        cleanContent = contentLines.slice(1).join('\n').trim();
      }
      
      const textOnly = cleanContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim();
      console.log(`[抖音号] 纯文字长度: ${textOnly.length} 个字符`);
      
      // 提取图片路径
      const imagePaths: string[] = [];
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      
      while ((match = imageRegex.exec(cleanContent)) !== null) {
        const imageUrl = match[2];
        let imagePath = imageUrl;
        
        if (imagePath.startsWith('/uploads/')) {
          imagePath = path.join(process.cwd(), imagePath);
        } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
          imagePath = path.join(process.cwd(), 'uploads', imagePath);
        }
        
        if (fs.existsSync(imagePath)) {
          imagePaths.push(imagePath);
          console.log(`[抖音号] 找到图片: ${path.basename(imagePath)}`);
        }
      }
      
      console.log(`[抖音号] 共有 ${imagePaths.length} 张图片需要上传`);
      
      // 输入文字内容
      if (textOnly && textOnly.length > 0) {
        console.log('[抖音号] 输入文字内容...');
        await this.safeType(page, selectors.contentEditor, textOnly, { delay: 30 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[抖音号] ✅ 文字输入完成');
      }
      
      // 上传图片（如果支持）
      if (imagePaths.length > 0 && selectors.coverImageUpload) {
        console.log('[抖音号] 开始上传图片...');
        
        for (let i = 0; i < imagePaths.length; i++) {
          const imagePath = imagePaths[i];
          console.log(`[抖音号] 上传第 ${i + 1}/${imagePaths.length} 张图片: ${path.basename(imagePath)}`);
          
          try {
            const fileInput = await page.$(selectors.coverImageUpload);
            if (fileInput) {
              await fileInput.uploadFile(imagePath);
              console.log(`[抖音号] ✅ 图片 ${i + 1} 上传完成`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error: any) {
            console.log(`[抖音号] ⚠️ 图片 ${i + 1} 上传失败: ${error.message}`);
          }
        }
        
        console.log('[抖音号] ✅ 所有图片上传完成');
      }

      await this.waitForPageLoad(page, 2000);
      await this.safeClick(page, selectors.publishButton);

      const success = await this.verifyPublishSuccess(page);
      if (success) {
        console.log('✅ 抖音号文章发布成功');
      }
      return success;
    } catch (error: any) {
      console.error('❌ 抖音号文章发布失败:', error.message);
      return false;
    }
  }

  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      const selectors = this.getPublishSelectors();
      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 10000 });
        return true;
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}
