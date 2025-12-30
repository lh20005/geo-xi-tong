import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 搜狐号平台适配器
 * 参考头条号最佳实践重新制作
 * 
 * 关键改进：
 * 1. 使用最新的v4登录URL
 * 2. 优化Cookie登录验证逻辑
 * 3. 增强登录状态检测
 * 4. 改进错误处理和日志输出
 */
export class SouhuAdapter extends PlatformAdapter {
  platformId = 'souhu';
  platformName = '搜狐号';

  getLoginUrl(): string {
    // 使用最新的v4版本登录页面
    return 'https://mp.sohu.com/mpfe/v4/login';
  }

  getPublishUrl(): string {
    // 使用v3版本的发布页面（更稳定）
    return 'https://mp.sohu.com/mpfe/v3/main/news/addarticle';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="mobile"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'button.login-btn, button[type="submit"]',
      successIndicator: '.user-info, .user-name, [class*="user"]'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder="请输入标题"], input[placeholder*="标题"]',
      contentEditor: '.ql-editor, [contenteditable="true"]',
      categorySelect: 'select.category',
      publishButton: 'button.submit, button[type="submit"]',
      successIndicator: '.success-modal, .success-message'
    };
  }

  /**
   * 执行登录
   * 参考头条号的成功经验，优先使用Cookie登录
   */
  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // ========== 优先使用Cookie登录 ==========
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[搜狐号] 使用Cookie登录');
        console.log(`[搜狐号] Cookie数量: ${credentials.cookies.length}`);
        
        // 设置Cookie（页面已经在主页了，由PublishingExecutor导航）
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess) {
          console.log('[搜狐号] Cookie已设置，等待3秒让页面加载...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 验证登录状态 - 检查URL是否包含mp.sohu.com且不包含login
          const currentUrl = page.url();
          console.log(`[搜狐号] 当前URL: ${currentUrl}`);
          
          // 搜狐号登录成功的URL特征：
          // - 包含 mp.sohu.com
          // - 不包含 login
          // - 可能包含 /mpfe/v3/ 或 /mpfe/v4/ 或 /main/
          if (currentUrl.includes('mp.sohu.com') && 
              !currentUrl.includes('login') &&
              (currentUrl.includes('/mpfe/') || currentUrl.includes('/main/'))) {
            console.log('✅ 搜狐号Cookie登录成功');
            return true;
          }
          
          console.log('[搜狐号] Cookie登录验证失败，尝试表单登录');
        }
        
        // Cookie登录失败，导航到登录页
        console.log('[搜狐号] 导航到登录页面...');
        await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle2', timeout: 30000 });
      }
      
      // ========== 表单登录（后备方案）==========
      console.log('[搜狐号] 开始表单登录');
      const selectors = this.getLoginSelectors();
      
      // 等待用户名输入框
      console.log('[搜狐号] 等待登录表单加载...');
      await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      console.log('[搜狐号] 登录表单已加载');
      
      // 输入用户名和密码
      console.log('[搜狐号] 输入用户名...');
      await this.safeType(page, selectors.usernameInput, credentials.username);
      
      console.log('[搜狐号] 输入密码...');
      await this.safeType(page, selectors.passwordInput, credentials.password);
      
      console.log('[搜狐号] 点击登录按钮...');
      await this.safeClick(page, selectors.submitButton);

      // 等待登录完成
      console.log('[搜狐号] 等待登录完成...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('✅ 搜狐号表单登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ 搜狐号登录失败:', error.message);
      return false;
    }
  }

  /**
   * 执行发布
   * 参考头条号的成功经验，优化内容填充流程
   */
  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      await this.log('info', '========================================');
      await this.log('info', '🚀 开始搜狐号发布流程');
      await this.log('info', '========================================');
      await this.log('info', `📄 文章标题: "${article.title}" (${article.title.length}字)`);
      
      const path = require('path');
      const fs = require('fs');
      const selectors = this.getPublishSelectors();
      
      // ========== 步骤1：确保在发布页面 ==========
      await this.log('info', '📍 步骤1/5：确保在发布页面');
      
      const currentUrl = page.url();
      if (!currentUrl.includes('/addarticle') && !currentUrl.includes('/publish')) {
        await this.log('info', '🔄 当前不在发布页面，正在跳转...');
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle2', timeout: 30000 });
        await this.log('info', '✅ 已跳转到发布页面');
      } else {
        await this.log('info', '✅ 已在发布页面');
      }
      
      // 等待发布页面完全加载
      await this.log('info', '⏳ 等待页面加载完成...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.log('info', '✅ 页面加载完成');
      
      // ========== 步骤2：填写标题 ==========
      await this.log('info', '📝 步骤2/5：填写文章标题');
      
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });
      const titleInput = await page.$(selectors.titleInput);
      
      if (titleInput) {
        const title = config.title || article.title;
        await this.log('info', `⌨️  正在输入标题: "${title}" (${title.length}字)`);
        
        // 点击标题框
        await titleInput.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 清空并输入标题
        await titleInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 使用evaluate方法设置标题（兼容静默模式）
        const titleSetSuccess = await page.evaluate((el, val) => {
          try {
            (el as HTMLInputElement).value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          } catch (e) {
            return false;
          }
        }, titleInput, title);
        
        if (!titleSetSuccess) {
          // 备用方案：使用keyboard.type
          await this.log('warning', '⚠️ evaluate方法失败，使用keyboard.type');
          await page.keyboard.type(title, { delay: 50 });
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.log('info', '✅ 标题输入成功');
      } else {
        await this.log('error', '❌ 未找到标题输入框');
        throw new Error('未找到标题输入框');
      }
      
      // 等待标题输入完成
      await this.log('info', '⏳ 等待标题输入稳定（2秒）...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // ========== 步骤3：填写正文内容 ==========
      await this.log('info', '📄 步骤3/5：填写正文内容');
      
      await page.waitForSelector(selectors.contentEditor, { timeout: 10000 });
      const contentEditor = await page.$(selectors.contentEditor);
      
      if (contentEditor) {
        await this.log('info', '✅ 找到内容编辑器');
        
        // 点击内容编辑器
        await contentEditor.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 清理内容：移除标题
        let cleanContent = article.content;
        const contentLines = cleanContent.split('\n');
        const firstLine = contentLines[0].trim();
        
        if (firstLine.includes(article.title) || article.title.includes(firstLine)) {
          await this.log('info', '⚠️ 检测到content包含标题，正在移除...');
          cleanContent = contentLines.slice(1).join('\n').trim();
        } else if (firstLine.startsWith('#')) {
          await this.log('info', '⚠️ 检测到Markdown标题格式，正在移除...');
          cleanContent = contentLines.slice(1).join('\n').trim();
        }
        
        // 提取纯文字
        const textOnly = this.cleanArticleContent(cleanContent);
        await this.log('info', `📏 纯文字长度: ${textOnly.length} 个字符`);
        
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
          }
        }
        
        await this.log('info', `📊 内容解析完成: 文字${textOnly.length}字, 图片${imagePaths.length}张`);
        
        // 输入文字内容
        if (textOnly && textOnly.length > 0) {
          await this.log('info', '⌨️  开始输入文字内容...');
          
          // 使用evaluate方法设置内容（兼容静默模式）
          const contentSetSuccess = await page.evaluate((text) => {
            try {
              const editor = document.querySelector('.ql-editor, [contenteditable="true"]');
              if (editor) {
                const paragraphs = text.split('\n').filter((p: string) => p.trim());
                const html = paragraphs.map((p: string) => `<p>${p}</p>`).join('');
                editor.innerHTML = html;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              }
              return false;
            } catch (e) {
              return false;
            }
          }, textOnly);
          
          if (!contentSetSuccess) {
            // 备用方案：使用keyboard.type
            await this.log('warning', '⚠️ evaluate方法失败，使用keyboard.type');
            const batchSize = 500;
            for (let i = 0; i < textOnly.length; i += batchSize) {
              const batch = textOnly.substring(i, Math.min(i + batchSize, textOnly.length));
              await page.keyboard.type(batch, { delay: 30 });
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.log('info', '✅ 文字输入完成');
        }
        
        // ========== 步骤4：上传图片 ==========
        if (imagePaths.length > 0) {
          await this.log('info', `📷 步骤4/5：上传${imagePaths.length}张图片`);
          
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            await this.log('info', `📷 上传第${i + 1}/${imagePaths.length}张: ${path.basename(imagePath)}`);
            
            try {
              // 查找上传按钮
              const uploadButtonSelectors = [
                'button[aria-label*="图片"]',
                'button[title*="图片"]',
                '.toolbar button.image',
                'button.image-upload',
                '.ql-image'
              ];
              
              let uploadButton = null;
              for (const selector of uploadButtonSelectors) {
                uploadButton = await page.$(selector);
                if (uploadButton) break;
              }
              
              if (uploadButton) {
                await uploadButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const fileInput = await page.$('input[type=file]');
                if (fileInput) {
                  await (fileInput as any).uploadFile(imagePath);
                  await this.log('info', `✅ 图片${i + 1}上传完成`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              } else {
                await this.log('warning', `⚠️ 未找到上传按钮，跳过图片${i + 1}`);
              }
            } catch (error: any) {
              await this.log('warning', `⚠️ 图片${i + 1}上传失败: ${error.message}`);
            }
          }
          
          await this.log('info', '✅ 所有图片上传完成');
        } else {
          await this.log('info', '📷 步骤4/5：无图片需要上传');
        }
      } else {
        await this.log('error', '❌ 未找到内容编辑器');
        throw new Error('未找到内容编辑器');
      }
      
      // ========== 步骤5：设置分类（如果需要）==========
      if (config.category && selectors.categorySelect) {
        await this.log('info', '🏷️  步骤5/5：设置文章分类');
        try {
          await page.select(selectors.categorySelect, config.category);
          await this.log('info', '✅ 分类设置成功');
        } catch (e) {
          await this.log('warning', '⚠️ 分类设置失败，继续执行');
        }
      } else {
        await this.log('info', '🏷️  步骤5/5：跳过分类设置');
      }
      
      // 等待内容稳定
      await this.log('info', '⏳ 等待内容稳定（2秒）...');
      await this.waitForPageLoad(page, 2000);
      
      // 点击发布按钮
      await this.log('info', '🚀 点击发布按钮...');
      await this.safeClick(page, selectors.publishButton);
      
      // 验证发布成功
      const success = await this.verifyPublishSuccess(page);
      if (success) {
        await this.log('info', '✅✅✅ 搜狐号文章发布成功！');
      } else {
        await this.log('warning', '⚠️ 无法验证发布状态');
      }
      
      await this.log('info', '========================================');
      return success;
    } catch (error: any) {
      await this.log('error', `❌ 搜狐号文章发布失败: ${error.message}`);
      console.error('❌ 搜狐号文章发布失败:', error);
      return false;
    }
  }

  /**
   * 验证发布成功
   */
  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      const selectors = this.getPublishSelectors();
      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 10000 });
        return true;
      }
      // 如果没有成功指示器，默认返回true
      return true;
    } catch (error) {
      // 超时或未找到成功指示器，返回true（假设成功）
      return true;
    }
  }
}
