import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 简书平台适配器
 * 参考搜狐号和头条号最佳实践重新制作
 * 
 * 关键改进：
 * 1. 优化Cookie登录验证逻辑
 * 2. 增强登录状态检测（URL + 元素双重验证）
 * 3. 改进用户信息提取
 * 4. 增强错误处理和日志输出
 */
export class JianshuAdapter extends PlatformAdapter {
  platformId = 'jianshu';
  platformName = '简书';

  getLoginUrl(): string {
    return 'https://www.jianshu.com/sign_in';
  }

  getPublishUrl(): string {
    return 'https://www.jianshu.com/writer#/';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="session[email_or_mobile_number]"]',
      passwordInput: 'input[name="session[password]"]',
      submitButton: 'button[type="submit"]',
      successIndicator: 'nav .user img, .avatar, nav .user'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input#article-title',
      contentEditor: '#editor',
      publishButton: 'button.publish-btn',
      successIndicator: '.success-tip'
    };
  }

  /**
   * 执行登录
   * 参考搜狐号和头条号的成功经验，优先使用Cookie登录
   */
  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // ========== 优先使用Cookie登录 ==========
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[简书] 使用Cookie登录');
        console.log(`[简书] Cookie数量: ${credentials.cookies.length}`);
        
        // 设置Cookie（页面已经在主页了，由PublishingExecutor导航）
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess) {
          console.log('[简书] Cookie已设置，等待3秒让页面加载...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 验证登录状态 - 检查URL和登录元素
          const currentUrl = page.url();
          console.log(`[简书] 当前URL: ${currentUrl}`);
          
          // 简书登录成功的URL特征：
          // - 包含 jianshu.com
          // - 不包含 sign_in 或 sign_up
          if (currentUrl.includes('jianshu.com') && 
              !currentUrl.includes('sign_in') && 
              !currentUrl.includes('sign_up')) {
            
            // 双重验证：检查导航栏是否有登录图标
            try {
              await page.waitForSelector('nav .user img, nav .user, .avatar', { timeout: 5000 });
              console.log('✅ 简书Cookie登录成功（URL + 元素双重验证通过）');
              return true;
            } catch (e) {
              console.log('[简书] 未检测到登录元素，但URL正确，继续验证...');
              // URL正确但元素未找到，可能是页面加载慢，再等待一下
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // 再次尝试
              try {
                await page.waitForSelector('nav .user img, nav .user, .avatar', { timeout: 3000 });
                console.log('✅ 简书Cookie登录成功（延迟验证通过）');
                return true;
              } catch (e2) {
                console.log('[简书] Cookie登录验证失败，尝试表单登录');
              }
            }
          }
          
          console.log('[简书] Cookie登录验证失败，尝试表单登录');
        }
        
        // Cookie登录失败，导航到登录页
        console.log('[简书] 导航到登录页面...');
        await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle2', timeout: 30000 });
      }
      
      // ========== 表单登录（后备方案）==========
      console.log('[简书] 开始表单登录');
      const selectors = this.getLoginSelectors();
      
      // 等待登录表单加载
      console.log('[简书] 等待登录表单加载...');
      await page.waitForSelector(selectors.usernameInput, { timeout: 15000 });
      console.log('[简书] 登录表单已加载');
      
      // 填写用户名
      console.log('[简书] 填写用户名...');
      await this.safeType(page, selectors.usernameInput, credentials.username);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 填写密码
      console.log('[简书] 填写密码...');
      await this.safeType(page, selectors.passwordInput, credentials.password);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 点击登录按钮
      console.log('[简书] 点击登录按钮...');
      await this.safeClick(page, selectors.submitButton);
      
      // 等待登录成功（URL跳转 + 登录元素出现）
      console.log('[简书] 等待登录成功...');
      
      // 方式1：等待URL跳转（离开登录页）
      try {
        await page.waitForFunction(
          `window.location.href !== "${this.getLoginUrl()}" && 
           !window.location.href.includes('sign_in') && 
           !window.location.href.includes('sign_up')`,
          { timeout: 30000 }
        );
        console.log('[简书] ✅ URL已跳转，登录成功');
      } catch (e) {
        console.log('[简书] ⚠️ URL未跳转，但继续验证登录状态');
      }
      
      // 方式2：等待登录元素出现
      if (selectors.successIndicator) {
        try {
          await page.waitForSelector(selectors.successIndicator, { timeout: 10000 });
          console.log('[简书] ✅ 检测到登录元素');
        } catch (e) {
          console.log('[简书] ⚠️ 未检测到登录元素，但可能已登录');
        }
      }
      
      // 最终验证：检查当前URL
      const finalUrl = page.url();
      console.log(`[简书] 最终URL: ${finalUrl}`);
      
      if (finalUrl.includes('jianshu.com') && 
          !finalUrl.includes('sign_in') && 
          !finalUrl.includes('sign_up')) {
        console.log('✅ 简书表单登录成功');
        return true;
      }
      
      throw new Error('登录后URL未正确跳转');
      
    } catch (error: any) {
      console.error('❌ 简书登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      console.log('[简书] 开始发布流程');
      const path = require('path');
      const fs = require('fs');
      const selectors = this.getPublishSelectors();
      
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });

      const title = config.title || article.title;
      await this.safeType(page, selectors.titleInput, title, { delay: 50 });
      console.log(`[简书] ✅ 标题已填写: ${title}`);

      await page.waitForSelector(selectors.contentEditor);
      const contentEditor = await page.$(selectors.contentEditor);
      
      if (contentEditor) {
        console.log('[简书] 开始填写内容（文件上传方案）');
        
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
        console.log(`[简书] 纯文字长度: ${textOnly.length} 个字符`);
        
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
            console.log(`[简书] 找到图片: ${path.basename(imagePath)}`);
          }
        }
        
        console.log(`[简书] 共有 ${imagePaths.length} 张图片需要上传`);
        
        // 先输入所有文字
        if (textOnly && textOnly.length > 0) {
          console.log('[简书] 输入文字内容...');
          await page.keyboard.type(textOnly, { delay: 30 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[简书] ✅ 文字输入完成');
        }
        
        // 再上传所有图片
        if (imagePaths.length > 0) {
          console.log('[简书] 开始上传图片...');
          
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            console.log(`[简书] 上传第 ${i + 1}/${imagePaths.length} 张图片: ${path.basename(imagePath)}`);
            
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
                  console.log(`[简书] ✅ 图片 ${i + 1} 上传完成`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              }
            } catch (error: any) {
              console.log(`[简书] ⚠️ 图片 ${i + 1} 上传失败: ${error.message}`);
            }
          }
          
          console.log('[简书] ✅ 所有图片上传完成');
        }
      }

      await this.waitForPageLoad(page, 2000);
      await this.safeClick(page, selectors.publishButton);

      const success = await this.verifyPublishSuccess(page);
      if (success) {
        console.log('✅ 简书文章发布成功');
      }
      return success;
    } catch (error: any) {
      console.error('❌ 简书文章发布失败:', error.message);
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
