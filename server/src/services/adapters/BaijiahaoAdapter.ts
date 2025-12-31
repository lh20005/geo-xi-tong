import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 百家号平台适配器
 */
export class BaijiahaoAdapter extends PlatformAdapter {
  platformId = 'baijiahao';
  platformName = '百家号';

  getLoginUrl(): string {
    return 'https://baijiahao.baidu.com/builder/rc/login';
  }

  getPublishUrl(): string {
    return 'https://baijiahao.baidu.com/builder/rc/edit';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="userName"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'input[type="submit"]',
      successIndicator: '.user-name'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input.title-input',
      contentEditor: '.ql-editor',
      categorySelect: 'select[name="category"]',
      publishButton: 'button.submit-btn',
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
        console.log('[百家号] 使用Cookie登录');
        
        // 先导航到主页
        await page.goto('https://baijiahao.baidu.com/', { waitUntil: 'networkidle2' });
        
        // 设置Cookie
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess) {
          // 验证登录状态
          const verified = await this.verifyCookieLogin(page);
          if (verified) {
            console.log('✅ 百家号Cookie登录成功');
            return true;
          }
        }
        
        console.log('[百家号] Cookie登录失败，尝试表单登录');
      }
      
      // 表单登录（后备方案）
      const selectors = this.getLoginSelectors();
      await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      await this.safeType(page, selectors.usernameInput, credentials.username);
      await this.safeType(page, selectors.passwordInput, credentials.password);
      await this.safeClick(page, selectors.submitButton);

      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 15000 });
      }

      console.log('✅ 百家号表单登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ 百家号登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      console.log('[百家号] 开始发布流程');
      const path = require('path');
      const fs = require('fs');
      const selectors = this.getPublishSelectors();
      
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });

      const title = config.title || article.title;
      await this.safeType(page, selectors.titleInput, title, { delay: 50 });
      console.log(`[百家号] ✅ 标题已填写: ${title}`);

      await page.waitForSelector(selectors.contentEditor);
      const contentEditor = await page.$(selectors.contentEditor);
      
      if (contentEditor) {
        console.log('[百家号] 开始填写内容（文件上传方案）');
        
        await contentEditor.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let cleanContent = article.content;
        const contentLines = cleanContent.split('\n');
        const firstLine = contentLines[0].trim();
        
        if (firstLine.includes(article.title) || article.title.includes(firstLine)) {
          cleanContent = contentLines.slice(1).join('\n').trim();
        } else if (firstLine.startsWith('#')) {
          cleanContent = contentLines.slice(1).join('\n').trim();
        }
        
        const textOnly = this.cleanArticleContent(cleanContent);
        console.log(`[百家号] 纯文字长度: ${textOnly.length} 个字符`);
        
        const imagePaths: string[] = [];
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        
        while ((match = imageRegex.exec(cleanContent)) !== null) {
          const imageUrl = match[2];
          let imagePath = imageUrl;
          
          if (imagePath.startsWith('/uploads/')) {
            imagePath = path.join(process.cwd(), 'server', imagePath);
          } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
            imagePath = path.join(process.cwd(), 'server', 'uploads', imagePath);
          }
          
          if (fs.existsSync(imagePath)) {
            imagePaths.push(imagePath);
            console.log(`[百家号] 找到图片: ${path.basename(imagePath)}`);
          }
        }
        
        console.log(`[百家号] 共有 ${imagePaths.length} 张图片需要上传`);
        
        if (textOnly && textOnly.length > 0) {
          console.log('[百家号] 输入文字内容...');
          await page.keyboard.type(textOnly, { delay: 30 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[百家号] ✅ 文字输入完成');
        }
        
        if (imagePaths.length > 0) {
          console.log('[百家号] 开始上传图片...');
          
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            console.log(`[百家号] 上传第 ${i + 1}/${imagePaths.length} 张图片: ${path.basename(imagePath)}`);
            
            try {
              const uploadButton = await page.$('button[aria-label*="图片"], button[title*="图片"], .toolbar button.image, button.image-upload');
              
              if (uploadButton) {
                await uploadButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const fileInput = await page.$('input[type=file]');
                if (fileInput) {
                  await fileInput.uploadFile(imagePath);
                  console.log(`[百家号] ✅ 图片 ${i + 1} 上传完成`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              }
            } catch (error: any) {
              console.log(`[百家号] ⚠️ 图片 ${i + 1} 上传失败: ${error.message}`);
            }
          }
          
          console.log('[百家号] ✅ 所有图片上传完成');
        }
      }

      if (config.category && selectors.categorySelect) {
        await page.select(selectors.categorySelect, config.category);
      }

      await this.waitForPageLoad(page, 2000);
      await this.safeClick(page, selectors.publishButton);

      const success = await this.verifyPublishSuccess(page);
      if (success) {
        console.log('✅ 百家号文章发布成功');
      }
      return success;
    } catch (error: any) {
      console.error('❌ 百家号文章发布失败:', error.message);
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
