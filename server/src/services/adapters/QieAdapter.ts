import { Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 企鹅号（腾讯内容开放平台）适配器
 * 基于 Chrome DevTools Recorder 录制的真实流程优化
 */
export class QieAdapter extends PlatformAdapter {
  platformId = 'qie';
  platformName = '企鹅号';

  getLoginUrl(): string {
    return 'https://om.qq.com/userAuth/index';
  }

  getPublishUrl(): string {
    return 'https://om.qq.com/main';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input#u',
      passwordInput: 'input#p',
      submitButton: 'input#login_button',
      successIndicator: '.user-info'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'div.omui-articletitle__title1 span',
      contentEditor: 'section.editor_container-cls1yCMh > div',
      categorySelect: 'select.category',
      tagsInput: 'input.tag-input',
      publishButton: 'li:nth-of-type(2) span',
      successIndicator: '.success-tip'
    };
  }

  /**
   * 模拟人类操作的随机延迟
   */
  private async humanDelay(min: number = 800, max: number = 1500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 模拟人类打字速度
   */
  private async humanType(page: Page, selector: string, text: string): Promise<void> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`找不到元素: ${selector}`);
    }
    
    await element.click();
    await this.humanDelay(300, 600);
    
    // 逐字输入，模拟人类打字速度
    for (const char of text) {
      await page.keyboard.type(char, { delay: Math.random() * 80 + 40 }); // 40-120ms per char
    }
  }

  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      console.log('[企鹅号] 开始登录流程');
      
      // 优先使用Cookie登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[企鹅号] 使用Cookie登录');
        
        await page.goto('https://om.qq.com/', { waitUntil: 'networkidle2' });
        await this.humanDelay(1000, 2000);
        
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess && await this.verifyCookieLogin(page)) {
          console.log('✅ 企鹅号Cookie登录成功');
          return true;
        }
        
        console.log('[企鹅号] Cookie登录失败，尝试表单登录');
      }
      
      const selectors = this.getLoginSelectors();
      await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle2' });
      await this.humanDelay(1500, 2500);
      
      await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      await this.humanType(page, selectors.usernameInput, credentials.username);
      await this.humanDelay(500, 1000);
      
      await this.humanType(page, selectors.passwordInput, credentials.password);
      await this.humanDelay(800, 1500);
      
      await this.safeClick(page, selectors.submitButton);
      await this.humanDelay(2000, 3000);

      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 15000 });
      }

      console.log('✅ 企鹅号登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ 企鹅号登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      console.log('[企鹅号] 开始发布流程');
      const selectors = this.getPublishSelectors();
      
      // 注意：如果使用Cookie登录，页面已经在发布页面了
      // 检查当前URL，如果不在主页，则导航
      const currentUrl = page.url();
      console.log(`[企鹅号] 当前URL: ${currentUrl}`);
      
      if (!currentUrl.includes('om.qq.com/main')) {
        // 步骤1: 进入主页
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle2' });
        await this.humanDelay(2000, 3000);
        console.log('[企鹅号] ✅ 已进入主页');
      } else {
        console.log('[企鹅号] ✅ 已在主页，无需导航');
        await this.humanDelay(1000, 1500);
      }
      
      // 步骤2: 点击"开始创作"按钮
      try {
        const createButton = await page.waitForSelector(
          'div.hello-clsnTcoH > button, button:has-text("开始创作")',
          { timeout: 10000 }
        );
        if (createButton) {
          await createButton.click();
          await this.humanDelay(2000, 3000);
          console.log('[企鹅号] ✅ 已点击"开始创作"');
        }
      } catch (error) {
        console.log('[企鹅号] 可能已在编辑页面，继续...');
      }
      
      // 步骤3: 填写标题
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });
      await this.humanDelay(1000, 1500);
      
      const title = config.title || article.title;
      console.log(`[企鹅号] 开始输入标题: ${title}`);
      await this.humanType(page, selectors.titleInput, title);
      await this.humanDelay(1500, 2500);
      console.log('[企鹅号] ✅ 标题已填写');
      
      // 步骤4: 处理内容和图片
      await page.waitForSelector(selectors.contentEditor, { timeout: 10000 });
      await this.humanDelay(800, 1200);
      
      const contentEditor = await page.$(selectors.contentEditor);
      if (!contentEditor) {
        throw new Error('找不到内容编辑器');
      }
      
      // 点击编辑器获取焦点
      await contentEditor.click();
      await this.humanDelay(1000, 1500);
      console.log('[企鹅号] ✅ 编辑器已获取焦点');
      
      // 清理内容：移除标题行
      let cleanContent = article.content;
      const contentLines = cleanContent.split('\n');
      const firstLine = contentLines[0].trim();
      
      if (firstLine.includes(article.title) || article.title.includes(firstLine) || firstLine.startsWith('#')) {
        cleanContent = contentLines.slice(1).join('\n').trim();
      }
      
      // 提取图片路径
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
          console.log(`[企鹅号] 找到图片: ${path.basename(imagePath)}`);
        }
      }
      
      // 提取纯文本内容
      const textOnly = this.cleanArticleContent(cleanContent);
      console.log(`[企鹅号] 纯文字长度: ${textOnly.length} 个字符`);
      console.log(`[企鹅号] 图片数量: ${imagePaths.length} 张`);
      
      // 步骤5: 输入文字内容
      if (textOnly && textOnly.length > 0) {
        console.log('[企鹅号] 开始输入正文...');
        
        // 分段输入，模拟人类写作
        const paragraphs = textOnly.split('\n\n');
        for (let i = 0; i < paragraphs.length; i++) {
          const para = paragraphs[i].trim();
          if (para) {
            await page.keyboard.type(para, { delay: Math.random() * 30 + 20 });
            
            // 段落之间换行
            if (i < paragraphs.length - 1) {
              await page.keyboard.press('Enter');
              await page.keyboard.press('Enter');
              await this.humanDelay(300, 600);
            }
          }
        }
        
        await this.humanDelay(1500, 2500);
        console.log('[企鹅号] ✅ 正文输入完成');
      }
      
      // 步骤6: 上传图片
      if (imagePaths.length > 0) {
        console.log('[企鹅号] 开始上传图片...');
        
        for (let i = 0; i < imagePaths.length; i++) {
          const imagePath = imagePaths[i];
          console.log(`[企鹅号] 上传第 ${i + 1}/${imagePaths.length} 张图片: ${path.basename(imagePath)}`);
          
          try {
            // 查找图片上传按钮（工具栏中的图片按钮）
            const uploadButton = await page.$(
              'button[aria-label*="图片"], button[title*="图片"], .toolbar button.image, button.image-upload, button[class*="image"]'
            );
            
            if (uploadButton) {
              await uploadButton.click();
              await this.humanDelay(1500, 2500);
              
              // 查找文件输入框
              const fileInput = await page.$('input[type=file]');
              if (fileInput) {
                await fileInput.uploadFile(imagePath);
                console.log(`[企鹅号] ✅ 图片 ${i + 1} 上传成功`);
                
                // 等待图片上传完成
                await this.humanDelay(3000, 4000);
              } else {
                console.log(`[企鹅号] ⚠️ 找不到文件输入框`);
              }
            } else {
              console.log(`[企鹅号] ⚠️ 找不到图片上传按钮`);
            }
          } catch (error: any) {
            console.log(`[企鹅号] ⚠️ 图片 ${i + 1} 上传失败: ${error.message}`);
          }
        }
        
        console.log('[企鹅号] ✅ 所有图片处理完成');
      }
      
      // 步骤7: 上传封面图（如果有图片）
      if (imagePaths.length > 0) {
        console.log('[企鹅号] 开始设置封面图...');
        await this.humanDelay(1000, 2000);
        
        try {
          // 查找封面图上传按钮
          const coverButton = await page.$('#articlePublish-coverinfo svg, #articlePublish-coverinfo button');
          if (coverButton) {
            await coverButton.click();
            await this.humanDelay(1500, 2500);
            
            // 选择"本地上传"
            const localUploadTab = await page.$('li:nth-of-type(2) > div, div:has-text("本地上传")');
            if (localUploadTab) {
              await localUploadTab.click();
              await this.humanDelay(1000, 1500);
              
              // 上传第一张图片作为封面
              const coverFileInput = await page.$('div.omui-dialog-wrapper input[type=file]');
              if (coverFileInput) {
                await coverFileInput.uploadFile(imagePaths[0]);
                await this.humanDelay(2000, 3000);
                
                // 点击确认按钮
                const confirmButton = await page.$('div.omui-dialog-wrapper button.omui-button--primary');
                if (confirmButton) {
                  await confirmButton.click();
                  await this.humanDelay(1500, 2500);
                  console.log('[企鹅号] ✅ 封面图上传成功');
                }
              }
            }
          }
        } catch (error: any) {
          console.log(`[企鹅号] ⚠️ 封面图上传失败: ${error.message}`);
        }
      }
      
      // 步骤8: 添加内容自主声明
      console.log('[企鹅号] 添加内容自主声明...');
      await this.humanDelay(1000, 1500);
      
      try {
        const declarationButton = await page.$('#articlePublish-selfDeclaration button');
        if (declarationButton) {
          await declarationButton.click();
          await this.humanDelay(1500, 2500);
          
          // 点击确认
          const confirmButton = await page.$('div:nth-of-type(11) button.omui-button--primary');
          if (confirmButton) {
            await confirmButton.click();
            await this.humanDelay(1000, 1500);
            console.log('[企鹅号] ✅ 内容声明已添加');
          }
        }
      } catch (error: any) {
        console.log(`[企鹅号] ⚠️ 内容声明添加失败: ${error.message}`);
      }
      
      // 步骤9: 发布文章
      console.log('[企鹅号] 准备发布文章...');
      await this.humanDelay(2000, 3000);
      
      const publishButton = await page.$(selectors.publishButton);
      if (!publishButton) {
        throw new Error('找不到发布按钮');
      }
      
      await publishButton.click();
      await this.humanDelay(3000, 4000);
      console.log('[企鹅号] ✅ 已点击发布按钮');
      
      // 步骤10: 验证发布成功
      const success = await this.verifyPublishSuccess(page);
      if (success) {
        console.log('✅ 企鹅号文章发布成功');
      }
      
      return success;
    } catch (error: any) {
      console.error('❌ 企鹅号文章发布失败:', error.message);
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
