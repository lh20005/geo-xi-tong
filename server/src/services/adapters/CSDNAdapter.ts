import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * CSDN平台适配器
 */
export class CSDNAdapter extends PlatformAdapter {
  platformId = 'csdn';
  platformName = 'CSDN';

  getLoginUrl(): string {
    return 'https://passport.csdn.net/login';
  }

  getPublishUrl(): string {
    return 'https://mp.csdn.net/mp_blog/creation/editor';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="username"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'button.btn-login',
      successIndicator: '.user-profile'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input#articleTitle',
      contentEditor: '.editor__inner',
      tagsInput: 'input.tag-input',
      categorySelect: 'select.category',
      publishButton: 'button.btn-publish',
      successIndicator: '.success-modal'
    };
  }

  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // 优先使用Cookie登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[CSDN] 使用Cookie登录');
        
        await page.goto('https://www.csdn.net/', { waitUntil: 'networkidle2' });
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess && await this.verifyCookieLogin(page)) {
          console.log('✅ CSDN Cookie登录成功');
          return true;
        }
        
        console.log('[CSDN] Cookie登录失败，尝试表单登录');
      }
      
      const selectors = this.getLoginSelectors();
      await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      await this.safeType(page, selectors.usernameInput, credentials.username);
      await this.safeType(page, selectors.passwordInput, credentials.password);
      await this.safeClick(page, selectors.submitButton);

      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 15000 });
      }

      console.log('✅ CSDN表单登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ CSDN登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      console.log('[CSDN] 开始发布流程');
      const path = require('path');
      const fs = require('fs');
      const selectors = this.getPublishSelectors();
      
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });

      // 步骤1：填写标题
      const title = config.title || article.title;
      await this.safeType(page, selectors.titleInput, title, { delay: 50 });
      console.log(`[CSDN] ✅ 标题已填写: ${title}`);

      // 步骤2：使用文件上传方案填写内容（先文字，再图片）
      await page.waitForSelector(selectors.contentEditor);
      const contentEditor = await page.$(selectors.contentEditor);
      
      if (contentEditor) {
        console.log('[CSDN] 开始填写内容（文件上传方案）');
        
        // 点击编辑器获取焦点
        await contentEditor.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 提取纯文字（移除图片标记）
        let cleanContent = article.content;
        const contentLines = cleanContent.split('\n');
        const firstLine = contentLines[0].trim();
        
        // 移除标题（如果存在）
        if (firstLine.includes(article.title) || article.title.includes(firstLine)) {
          cleanContent = contentLines.slice(1).join('\n').trim();
        } else if (firstLine.startsWith('#')) {
          cleanContent = contentLines.slice(1).join('\n').trim();
        }
        
        const textOnly = this.cleanArticleContent(cleanContent);
        console.log(`[CSDN] 纯文字长度: ${textOnly.length} 个字符`);
        
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
            console.log(`[CSDN] 找到图片: ${path.basename(imagePath)}`);
          }
        }
        
        console.log(`[CSDN] 共有 ${imagePaths.length} 张图片需要上传`);
        
        // 先输入所有文字
        if (textOnly && textOnly.length > 0) {
          console.log('[CSDN] 输入文字内容...');
          await page.keyboard.type(textOnly, { delay: 30 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[CSDN] ✅ 文字输入完成');
        }
        
        // 再上传所有图片
        if (imagePaths.length > 0) {
          console.log('[CSDN] 开始上传图片...');
          
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            console.log(`[CSDN] 上传第 ${i + 1}/${imagePaths.length} 张图片: ${path.basename(imagePath)}`);
            
            try {
              // 查找上传按钮（通用方法）
              const uploadButton = await page.$('button[aria-label*="图片"], button[title*="图片"], .toolbar button.image, button.image-upload');
              
              if (uploadButton) {
                await uploadButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 查找文件输入框
                const fileInput = await page.$('input[type=file]');
                if (fileInput) {
                  await fileInput.uploadFile(imagePath);
                  console.log(`[CSDN] ✅ 图片 ${i + 1} 上传完成`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              }
            } catch (error: any) {
              console.log(`[CSDN] ⚠️ 图片 ${i + 1} 上传失败: ${error.message}`);
            }
          }
          
          console.log('[CSDN] ✅ 所有图片上传完成');
        }
      }

      // 步骤3：填写标签
      if (config.tags && selectors.tagsInput) {
        for (const tag of config.tags) {
          await this.safeType(page, selectors.tagsInput, tag);
          await page.keyboard.press('Enter');
        }
      }

      // 步骤4：选择分类
      if (config.category && selectors.categorySelect) {
        await page.select(selectors.categorySelect, config.category);
      }

      // 步骤5：发布
      await this.waitForPageLoad(page, 2000);
      await this.safeClick(page, selectors.publishButton);

      const success = await this.verifyPublishSuccess(page);
      if (success) {
        console.log('✅ CSDN文章发布成功');
      }
      return success;
    } catch (error: any) {
      console.error('❌ CSDN文章发布失败:', error.message);
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
