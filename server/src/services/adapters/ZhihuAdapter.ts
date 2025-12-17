import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 知乎平台适配器
 */
export class ZhihuAdapter extends PlatformAdapter {
  platformId = 'zhihu';
  platformName = '知乎';

  getLoginUrl(): string {
    return 'https://www.zhihu.com/signin';
  }

  getPublishUrl(): string {
    return 'https://zhuanlan.zhihu.com/write';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="username"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'button[type="submit"]',
      successIndicator: '.Avatar'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder="请输入标题"]',
      contentEditor: '.public-DraftEditor-content',
      publishButton: 'button.PublishPanel-stepTwoButton',
      successIndicator: '.SuccessPanel'
    };
  }

  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // 优先使用Cookie登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[知乎] 使用Cookie登录');
        
        // 先导航到主页
        await page.goto('https://www.zhihu.com/', { waitUntil: 'networkidle2' });
        
        // 设置Cookie
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess) {
          // 验证登录状态
          const verified = await this.verifyCookieLogin(page);
          if (verified) {
            console.log('✅ 知乎Cookie登录成功');
            return true;
          }
        }
        
        console.log('[知乎] Cookie登录失败，尝试表单登录');
      }
      
      // 表单登录（后备方案）
      const selectors = this.getLoginSelectors();

      // 等待登录表单加载
      await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });

      // 填写用户名
      await this.safeType(page, selectors.usernameInput, credentials.username);

      // 填写密码
      await this.safeType(page, selectors.passwordInput, credentials.password);

      // 点击登录按钮
      await this.safeClick(page, selectors.submitButton);

      // 等待登录成功
      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 15000 });
      } else {
        await this.waitForPageLoad(page, 3000);
      }

      console.log('✅ 知乎表单登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ 知乎登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      console.log('[知乎] 开始发布流程');
      const path = require('path');
      const fs = require('fs');
      const selectors = this.getPublishSelectors();

      // 步骤1：等待编辑器加载
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });

      // 步骤2：填写标题
      const title = config.title || article.title;
      await this.safeType(page, selectors.titleInput, title, { delay: 50 });
      console.log(`[知乎] ✅ 标题已填写: ${title}`);

      // 步骤3：使用文件上传方案填写内容（先文字，再图片）
      await page.waitForSelector(selectors.contentEditor);
      const contentEditor = await page.$(selectors.contentEditor);
      
      if (contentEditor) {
        console.log('[知乎] 开始填写内容（文件上传方案）');
        
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
        
        const textOnly = cleanContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim();
        console.log(`[知乎] 纯文字长度: ${textOnly.length} 个字符`);
        
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
            console.log(`[知乎] 找到图片: ${path.basename(imagePath)}`);
          }
        }
        
        console.log(`[知乎] 共有 ${imagePaths.length} 张图片需要上传`);
        
        // 先输入所有文字
        if (textOnly && textOnly.length > 0) {
          console.log('[知乎] 输入文字内容...');
          await page.keyboard.type(textOnly, { delay: 30 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[知乎] ✅ 文字输入完成');
        }
        
        // 再上传所有图片
        if (imagePaths.length > 0) {
          console.log('[知乎] 开始上传图片...');
          
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            console.log(`[知乎] 上传第 ${i + 1}/${imagePaths.length} 张图片: ${path.basename(imagePath)}`);
            
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
                  console.log(`[知乎] ✅ 图片 ${i + 1} 上传完成`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              }
            } catch (error: any) {
              console.log(`[知乎] ⚠️ 图片 ${i + 1} 上传失败: ${error.message}`);
            }
          }
          
          console.log('[知乎] ✅ 所有图片上传完成');
        }
      }

      // 步骤4：等待内容保存
      await this.waitForPageLoad(page, 2000);

      // 步骤5：点击发布按钮
      await this.safeClick(page, selectors.publishButton);

      // 步骤6：验证发布成功
      const success = await this.verifyPublishSuccess(page);

      if (success) {
        console.log('✅ 知乎文章发布成功');
      }

      return success;
    } catch (error: any) {
      console.error('❌ 知乎文章发布失败:', error.message);
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

      // 如果没有成功指示器，等待URL变化
      await page.waitForFunction(
        'window.location.href.includes("/p/")',
        { timeout: 10000 }
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  async handlePlatformSpecifics(
    page: Page,
    config: PublishingConfig
  ): Promise<void> {
    // 知乎特定的处理逻辑
    // 例如：设置文章可见性、允许评论等
    if (config.visibility) {
      // 处理可见性设置
    }

    if (config.allowComments !== undefined) {
      // 处理评论设置
    }
  }
}
