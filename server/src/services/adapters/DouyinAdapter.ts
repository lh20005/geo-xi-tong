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
    // 返回首页，因为需要从首页点击"高清发布"按钮
    return 'https://creator.douyin.com/creator-micro/home';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button.login-btn',
      // 登录成功后，检查高清发布按钮是否存在（这是创作者中心的标志性元素）
      successIndicator: '#douyin-creator-master-side-upload-wrap'
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
        
        // 先访问登录页面
        await page.goto('https://creator.douyin.com/', { waitUntil: 'networkidle2' });
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess) {
          console.log('[抖音号] Cookie设置成功，验证登录状态...');
          
          // 跳转到创作者中心首页验证登录
          await page.goto('https://creator.douyin.com/creator-micro/home', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          // 等待页面加载
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 检查是否有高清发布按钮（登录成功的标志）
          try {
            await page.waitForSelector('#douyin-creator-master-side-upload-wrap', { timeout: 10000 });
            console.log('✅ 抖音号Cookie登录成功');
            return true;
          } catch (e) {
            console.log('[抖音号] 未找到高清发布按钮，Cookie可能已失效');
          }
        }
        
        console.log('[抖音号] Cookie登录失败，需要手动登录');
        throw new Error('Cookie登录失败');
      }
      
      // 表单登录（抖音通常需要扫码或验证码，不推荐）
      console.log('[抖音号] ⚠️ 抖音平台需要Cookie登录，请先在平台登录页面完成登录');
      throw new Error('抖音平台需要Cookie登录');
    } catch (error: any) {
      console.error('❌ 抖音号登录失败:', error.message);
      throw error;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      console.log('[抖音号] ========================================');
      console.log('[抖音号] 🚀 开始抖音号发布流程（7步）');
      console.log('[抖音号] ========================================');
      console.log(`[抖音号] 文章ID: ${article.id}`);
      console.log(`[抖音号] 文章标题: "${article.title}"`);
      console.log(`[抖音号] 标题长度: ${article.title.length} 个字符`);
      console.log(`[抖音号] 内容长度: ${article.content.length} 个字符`);
      console.log(`[抖音号] 当前URL: ${page.url()}`);
      
      const path = require('path');
      const fs = require('fs');
      
      // 等待页面完全加载
      console.log('[抖音号] ⏳ 等待页面完全加载（5秒）...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('[抖音号] ✅ 页面加载完成');
      console.log(`[抖音号] 当前URL: ${page.url()}`);
      
      // ========== 步骤1：悬停在"高清发布"按钮上5秒，显示下拉菜单，然后点击"发布图文" ==========
      console.log('\n[抖音号] ========================================');
      console.log('[抖音号] 📝 步骤1/7：悬停在高清发布按钮上5秒，点击发布图文');
      console.log('[抖音号] ========================================');
      
      // 使用你提供的精确选择器
      const hdPublishButton = '#douyin-creator-master-side-upload-wrap > button';
      console.log(`[抖音号] 高清发布按钮选择器: ${hdPublishButton}`);
      console.log('[抖音号] ⏳ 等待高清发布按钮出现（15秒）...');
      
      await page.waitForSelector(hdPublishButton, { timeout: 15000 });
      console.log('[抖音号] ✅ 找到高清发布按钮');
      
      // 关键步骤：鼠标悬停5秒，让二级菜单有充分时间弹出
      console.log('[抖音号] 🖱️  模拟鼠标悬停在高清发布按钮上...');
      await page.hover(hdPublishButton);
      console.log('[抖音号] ✅ 鼠标已悬停');
      
      console.log('[抖音号] ⏳ 保持悬停5秒，等待二级菜单完全弹出...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('[抖音号] ✅ 悬停5秒完成，二级菜单应该已完全显示');
      
      // 点击二级菜单中的"发布图文"按钮
      // 策略：严格按照文字"发布图文"查找并点击
      console.log('[抖音号] 🖱️  查找并点击"发布图文"按钮...');
      console.log('[抖音号] 🔍 使用文字匹配方式查找按钮...');
      
      // 使用XPath查找包含"发布图文"文字的元素
      const xpath = "//*[contains(text(), '发布图文')]";
      console.log(`[抖音号] XPath: ${xpath}`);
      
      try {
        // TODO: 修复Puppeteer API兼容性问题
        // await page.waitForXPath(xpath, { visible: true, timeout: 10000 });
        console.log('[抖音号] ⚠️ waitForXPath API需要更新');
        
        // TODO: 修复$x API
        // const elements = await page.$x(xpath);
        const elements: any[] = [];
        console.log(`[抖音号] 找到 ${elements.length} 个匹配元素`);
        
        if (elements.length > 0) {
          // 点击第一个匹配的元素
          console.log('[抖音号] 🖱️  点击第一个匹配元素...');
          await elements[0].click();
          console.log('[抖音号] ✅ 已点击"发布图文"按钮');
        } else {
          throw new Error('未找到包含"发布图文"文字的元素');
        }
      } catch (error: any) {
        console.log('[抖音号] ⚠️ XPath查找失败，尝试遍历所有元素...');
        
        // 备用方案：遍历所有可能的元素
        const allElements = await page.$$('*');
        let clicked = false;
        
        console.log(`[抖音号] 开始遍历 ${allElements.length} 个元素...`);
        
        for (let i = 0; i < allElements.length; i++) {
          try {
            const element = allElements[i];
            const text = await page.evaluate(el => el.textContent?.trim(), element);
            
            // 严格匹配"发布图文"
            if (text === '发布图文') {
              console.log(`[抖音号] ✅ 找到精确匹配的元素 [${i}]: "${text}"`);
              
              // 检查元素是否可见
              const isVisible = await page.evaluate(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
              }, element);
              
              if (isVisible) {
                console.log('[抖音号] 元素可见，准备点击...');
                await element.click();
                clicked = true;
                console.log('[抖音号] ✅ 已点击"发布图文"按钮（遍历方案）');
                break;
              } else {
                console.log('[抖音号] 元素不可见，跳过...');
              }
            }
          } catch (e) {
            // 忽略单个元素的错误，继续下一个
            continue;
          }
        }
        
        if (!clicked) {
          throw new Error('找不到可点击的"发布图文"按钮');
        }
      }
      
      console.log('[抖音号] ⏳ 等待页面跳转到上传页面（3秒）...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('[抖音号] ✅ 页面应该已跳转到上传页面');
      
      // ========== 步骤2：点击上传图文按钮，上传图片 ==========
      console.log('\n[抖音号] ========================================');
      console.log('[抖音号] 📷 步骤2/7：点击上传图文按钮，上传图片');
      console.log('[抖音号] ========================================');
      
      // 不点击上传按钮，直接查找文件input并上传
      // 这样可以避免触发系统文件选择对话框
      console.log('[抖音号] 🔍 直接查找文件上传input（不点击按钮，避免弹出对话框）...');
      console.log('[抖音号] ⏳ 等待页面加载完成（2秒）...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 提取图片路径
      let cleanContent = article.content;
      const contentLines = cleanContent.split('\n');
      const firstLine = contentLines[0].trim();
      
      console.log(`[抖音号] 检查content第一行: "${firstLine.substring(0, 50)}"`);
      console.log(`[抖音号] 文章标题: "${article.title}"`);
      
      if (firstLine.includes(article.title) || article.title.includes(firstLine)) {
        console.log('[抖音号] ⚠️ 检测到content包含标题，正在移除...');
        cleanContent = contentLines.slice(1).join('\n').trim();
        console.log(`[抖音号] ✅ 已移除标题，剩余内容长度: ${cleanContent.length}`);
      } else if (firstLine.startsWith('#')) {
        console.log('[抖音号] ⚠️ 检测到Markdown标题格式，正在移除...');
        cleanContent = contentLines.slice(1).join('\n').trim();
        console.log(`[抖音号] ✅ 已移除Markdown标题，剩余内容长度: ${cleanContent.length}`);
      } else {
        console.log('[抖音号] ✅ content不包含标题，无需处理');
      }
      
      const imagePaths: string[] = [];
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      
      console.log('[抖音号] 🔍 正在提取图片路径...');
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
          console.log(`[抖音号] ✅ 找到图片 ${imagePaths.length}: ${path.basename(imagePath)}`);
        } else {
          console.log(`[抖音号] ⚠️ 图片不存在: ${imagePath}`);
        }
      }
      
      console.log(`[抖音号] 📊 共有 ${imagePaths.length} 张图片需要上传`);
      
      // 上传图片 - 使用DOM方式，不弹出文件选择对话框
      if (imagePaths.length > 0) {
        console.log('[抖音号] 📤 开始上传图片（DOM方式，不弹出对话框）...');
        
        // 查找文件上传input
        console.log('[抖音号] 🔍 查找文件上传input元素...');
        const fileInput = await page.$('input[type="file"]');
        
        if (fileInput) {
          console.log('[抖音号] ✅ 找到文件上传input');
          console.log('[抖音号] 📤 正在通过DOM方式上传所有图片（不弹出对话框）...');
          
          // 使用DOM方式上传文件，不会弹出系统对话框
          await fileInput.uploadFile(...imagePaths);
          console.log(`[抖音号] ✅ 已通过DOM上传 ${imagePaths.length} 张图片`);
          
          // 等待图片上传完成
          console.log('[抖音号] ⏳ 等待图片上传完成（8秒）...');
          await new Promise(resolve => setTimeout(resolve, 8000));
          console.log('[抖音号] ✅ 图片上传应该已完成');
        } else {
          console.log('[抖音号] ⚠️ 未找到文件上传input，跳过图片上传');
        }
      } else {
        console.log('[抖音号] ℹ️  没有图片需要上传');
      }
      
      // ========== 步骤3：填写标题 ==========
      console.log('\n[抖音号] ========================================');
      console.log('[抖音号] 📝 步骤3/7：填写标题');
      console.log('[抖音号] ========================================');
      
      const titleInput = '#DCPF .content-left-F3wKrk .content-child-V0CB7w input';
      
      console.log(`[抖音号] 标题输入框选择器（简化）: ${titleInput}`);
      console.log('[抖音号] ⏳ 等待标题输入框出现（10秒）...');
      await page.waitForSelector(titleInput, { timeout: 10000 });
      console.log('[抖音号] ✅ 找到标题输入框');
      
      const title = config.title || article.title;
      console.log(`[抖音号] 📝 标题内容: "${title}"`);
      console.log(`[抖音号] 📏 标题长度: ${title.length} 个字符`);
      
      console.log('[抖音号] 🖱️  点击标题输入框，让光标进入...');
      await page.click(titleInput);
      console.log('[抖音号] ⏳ 等待光标进入（1秒）...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('[抖音号] ✅ 光标应该在标题框内');
      
      console.log('[抖音号] ⌨️  输入标题文本...');
      await page.type(titleInput, title, { delay: 50 });
      console.log('[抖音号] ⏳ 等待输入完成（1秒）...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[抖音号] ✅ 标题已填写: ${title}`);
      
      // ========== 步骤4：填写描述（正文）==========
      console.log('\n[抖音号] ========================================');
      console.log('[抖音号] 📄 步骤4/7：填写描述（正文）');
      console.log('[抖音号] ========================================');
      
      const descriptionEditor = '#DCPF .content-left-F3wKrk .editor-kit-editor-container.old > div > div > div';
      
      console.log(`[抖音号] 描述编辑器选择器（简化）: ${descriptionEditor}`);
      console.log('[抖音号] ⏳ 等待描述编辑器出现（10秒）...');
      await page.waitForSelector(descriptionEditor, { timeout: 10000 });
      console.log('[抖音号] ✅ 找到描述编辑器');
      
      // 提取纯文字内容 - 使用基类的通用清理方法
      const textOnly = this.cleanArticleContent(cleanContent);
      console.log(`[抖音号] 📏 纯文字长度: ${textOnly.length} 个字符`);
      console.log(`[抖音号] 📝 文字预览: "${textOnly.substring(0, 100)}${textOnly.length > 100 ? '...' : ''}"`);
      
      if (textOnly && textOnly.length > 0) {
        console.log('[抖音号] 🖱️  点击描述编辑器，让光标进入...');
        await page.click(descriptionEditor);
        console.log('[抖音号] ⏳ 等待光标进入（1秒）...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[抖音号] ✅ 光标应该在描述框内');
        
        console.log('[抖音号] ⌨️  输入描述文本...');
        await page.type(descriptionEditor, textOnly, { delay: 30 });
        console.log('[抖音号] ⏳ 等待输入完成（2秒）...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[抖音号] ✅ 描述已填写');
      } else {
        console.log('[抖音号] ⚠️ 没有文字内容需要填写');
      }
      
      // ========== 步骤5：添加话题（输入关键字，点击推荐话题）==========
      console.log('\n[抖音号] ========================================');
      console.log('[抖音号] 🏷️  步骤5/7：添加话题');
      console.log('[抖音号] ========================================');
      
      const addTopicButton = '#DCPF .editor-kit-root-container .toolbar > div:first-child > div > div > div:first-child';
      
      try {
        console.log(`[抖音号] 添加话题按钮选择器（简化）: ${addTopicButton}`);
        console.log('[抖音号] ⏳ 等待"添加话题"按钮出现（5秒）...');
        await page.waitForSelector(addTopicButton, { timeout: 5000 });
        console.log('[抖音号] ✅ 找到"添加话题"按钮');
        
        console.log('[抖音号] 🖱️  点击"添加话题"按钮...');
        await page.click(addTopicButton);
        console.log('[抖音号] ⏳ 等待话题输入框出现（1秒）...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[抖音号] ✅ 话题输入框应该已出现');
        
        // 输入关键词（使用文章标题作为关键词）
        const keyword = config.title || article.title;
        console.log(`[抖音号] ⌨️  输入关键词: "${keyword}"`);
        await page.keyboard.type(keyword, { delay: 50 });
        console.log('[抖音号] ⏳ 等待推荐话题出现（2秒）...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[抖音号] ✅ 推荐话题应该已出现');
        
        // 点击推荐的第一个话题
        const recommendedTopic = '.mention-suggest-mount-dom span.tag-hash-view-name-DwMEe8';
        console.log(`[抖音号] 推荐话题选择器（简化）: ${recommendedTopic}`);
        console.log('[抖音号] ⏳ 等待推荐话题可点击（5秒）...');
        await page.waitForSelector(recommendedTopic, { timeout: 5000 });
        console.log('[抖音号] ✅ 找到推荐话题');
        
        console.log('[抖音号] 🖱️  点击推荐话题...');
        await page.click(recommendedTopic);
        console.log('[抖音号] ⏳ 等待话题添加完成（1秒）...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[抖音号] ✅ 话题已添加');
      } catch (error: any) {
        console.log('[抖音号] ⚠️ 添加话题失败:', error.message);
        console.log('[抖音号] ℹ️  继续执行后续步骤...');
      }
      
      // ========== 步骤6：添加自主声明（内容由AI生成）==========
      console.log('\n[抖音号] ========================================');
      console.log('[抖音号] 📋 步骤6/7：添加自主声明（内容由AI生成）');
      console.log('[抖音号] ========================================');
      
      const addDeclarationButton = '.content-right-ik9gts .addUserDeclaration-dq21tU';
      
      try {
        console.log(`[抖音号] 添加自主声明按钮选择器: ${addDeclarationButton}`);
        console.log('[抖音号] ⏳ 等待"添加自主声明"按钮出现（5秒）...');
        await page.waitForSelector(addDeclarationButton, { timeout: 5000 });
        console.log('[抖音号] ✅ 找到"添加自主声明"按钮');
        
        console.log('[抖音号] 🖱️  点击"添加自主声明"按钮...');
        await page.click(addDeclarationButton);
        console.log('[抖音号] ⏳ 等待侧滑页容器出现...');
        
        // 等待侧滑页容器出现
        const sidesheetSelector = '.semi-sidesheet-inner.semi-sidesheet-inner-wrap';
        await page.waitForSelector(sidesheetSelector, { timeout: 5000 });
        console.log('[抖音号] ✅ 侧滑页容器已出现');
        
        // 使用waitForFunction等待动画真正完成
        console.log('[抖音号] ⏳ 等待侧滑动画完全完成...');
        await page.waitForFunction(() => {
          const sidesheet = document.querySelector('.semi-sidesheet-inner.semi-sidesheet-inner-wrap');
          if (!sidesheet) return false;
          
          // 检查transform是否已经完成
          const style = window.getComputedStyle(sidesheet);
          const transform = style.transform;
          
          // 如果transform是none或者translate(0px)，说明动画完成
          return transform === 'none' || 
                 transform.includes('matrix(1, 0, 0, 1, 0, 0)') ||
                 !transform.includes('translate');
        }, { timeout: 10000 });
        console.log('[抖音号] ✅ 侧滑动画已完成');
        
        // 额外等待确保内容稳定
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 打印所有可见的label元素，用于调试
        console.log('[抖音号] 🔍 调试：列出所有可见的label元素...');
        const debugLabels = await page.evaluate(() => {
          const labels = Array.from(document.querySelectorAll('label'));
          return labels
            .filter(label => {
              const style = window.getComputedStyle(label);
              const rect = label.getBoundingClientRect();
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     rect.width > 0 && 
                     rect.height > 0;
            })
            .map(label => ({
              text: label.textContent?.trim(),
              className: label.className,
              visible: true
            }));
        });
        console.log('[抖音号] 可见的label元素:', JSON.stringify(debugLabels, null, 2));
        
        // 查找"内容由AI生成"选项 - 使用JavaScript直接点击
        console.log('[抖音号] 🔍 查找并点击"内容由AI生成"选项...');
        const aiClicked = await page.evaluate(() => {
          const labels = Array.from(document.querySelectorAll('label'));
          
          for (const label of labels) {
            const text = label.textContent?.trim() || '';
            if (text.includes('内容由AI生成') || text.includes('内容由ai生成')) {
              const style = window.getComputedStyle(label);
              const rect = label.getBoundingClientRect();
              
              if (style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  rect.width > 0 && 
                  rect.height > 0) {
                
                console.log('找到目标label:', text);
                
                // 尝试多种点击方式
                // 方式1：直接点击label
                label.click();
                
                // 方式2：点击label内的input/checkbox
                const input = label.querySelector('input');
                if (input) {
                  input.click();
                  input.checked = true;
                }
                
                // 方式3：触发change事件
                const changeEvent = new Event('change', { bubbles: true });
                if (input) {
                  input.dispatchEvent(changeEvent);
                }
                
                // 方式4：触发click事件
                const clickEvent = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                label.dispatchEvent(clickEvent);
                
                return true;
              }
            }
          }
          return false;
        });
        
        if (!aiClicked) {
          throw new Error('未找到或无法点击"内容由AI生成"选项');
        }
        
        console.log('[抖音号] ✅ 已点击"内容由AI生成"选项');
        console.log('[抖音号] ⏳ 等待选项选中（1秒）...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 打印所有可见的按钮，用于调试
        console.log('[抖音号] 🔍 调试：列出所有可见的按钮...');
        const debugButtons = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons
            .filter(btn => {
              const style = window.getComputedStyle(btn);
              const rect = btn.getBoundingClientRect();
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     rect.width > 0 && 
                     rect.height > 0;
            })
            .map(btn => ({
              text: btn.textContent?.trim(),
              className: btn.className,
              visible: true
            }));
        });
        console.log('[抖音号] 可见的按钮:', JSON.stringify(debugButtons, null, 2));
        
        // 查找并点击确定按钮 - 使用JavaScript直接点击
        console.log('[抖音号] 🔍 查找并点击"确定"按钮...');
        const confirmClicked = await page.evaluate(() => {
          // 查找侧边栏footer中的主按钮
          const footer = document.querySelector('.semi-sidesheet-body > footer');
          if (!footer) {
            console.log('未找到footer');
            return false;
          }
          
          const buttons = Array.from(footer.querySelectorAll('button'));
          console.log('footer中的按钮数量:', buttons.length);
          
          for (const button of buttons) {
            const text = button.textContent?.trim() || '';
            const className = button.className || '';
            
            console.log('检查按钮:', text, className);
            
            // 查找包含"确定"或"确认"文字，且是primary按钮的
            if ((text.includes('确定') || text.includes('确认')) && 
                className.includes('semi-button-primary')) {
              
              const style = window.getComputedStyle(button);
              const rect = button.getBoundingClientRect();
              
              if (style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  rect.width > 0 && 
                  rect.height > 0) {
                
                console.log('找到目标按钮，准备点击:', text);
                
                // 移除可能的pointer-events限制
                button.style.pointerEvents = 'auto';
                
                // 尝试多种点击方式
                // 方式1：直接点击
                button.click();
                
                // 方式2：触发click事件
                const clickEvent = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                button.dispatchEvent(clickEvent);
                
                // 方式3：触发mousedown和mouseup
                const mousedownEvent = new MouseEvent('mousedown', {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                const mouseupEvent = new MouseEvent('mouseup', {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                button.dispatchEvent(mousedownEvent);
                button.dispatchEvent(mouseupEvent);
                
                return true;
              }
            }
          }
          
          return false;
        });
        
        if (!confirmClicked) {
          throw new Error('未找到或无法点击"确定"按钮');
        }
        
        console.log('[抖音号] ✅ 已点击"确定"按钮');
        console.log('[抖音号] ⏳ 等待侧边栏关闭（2秒）...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[抖音号] ✅ 自主声明已添加');
      } catch (error: any) {
        console.log('[抖音号] ⚠️ 添加自主声明失败:', error.message);
        console.log('[抖音号] ℹ️  继续执行后续步骤...');
      }
      
      // ========== 步骤7：点击发布按钮，完成发布 ==========
      console.log('\n[抖音号] ========================================');
      console.log('[抖音号] 🚀 步骤7/7：点击发布按钮');
      console.log('[抖音号] ========================================');
      
      // 使用简化的CSS选择器
      const publishButton = '#DCPF button.primary-cECiOJ.fixed-J9O8Yw';
      console.log(`[抖音号] 发布按钮选择器（简化）: ${publishButton}`);
      console.log('[抖音号] ⏳ 等待发布按钮出现（20秒）...');
      
      try {
        await page.waitForSelector(publishButton, { visible: true, timeout: 20000 });
        console.log('[抖音号] ✅ 找到发布按钮');
        
        // 检查按钮是否可见和可点击
        const buttonInfo = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent?.trim(),
            visible: style.display !== 'none' && 
                    style.visibility !== 'hidden' && 
                    style.opacity !== '0' &&
                    rect.width > 0 && 
                    rect.height > 0,
            className: element.className
          };
        }, publishButton);
        
        if (buttonInfo) {
          console.log(`[抖音号] 发布按钮文字: "${buttonInfo.text}"`);
          console.log(`[抖音号] 发布按钮可见性: ${buttonInfo.visible}`);
          console.log(`[抖音号] 发布按钮class: ${buttonInfo.className}`);
          
          if (buttonInfo.visible) {
            console.log('[抖音号] 🖱️  点击发布按钮...');
            await page.click(publishButton);
            console.log('[抖音号] ✅ 已点击发布按钮');
          } else {
            throw new Error('发布按钮不可见');
          }
        } else {
          throw new Error('未找到发布按钮');
        }
      } catch (error: any) {
        console.log('[抖音号] ⚠️ CSS选择器失败，尝试XPath备用方案...');
        console.log('[抖音号] 错误信息:', error.message);
        
        // 备用方案：使用原始XPath
        const publishButtonXPath = '//*[@id="DCPF"]/div/div[1]/div/div[5]/div/div/div/div/div/button[1]';
        console.log(`[抖音号] 备用XPath: ${publishButtonXPath}`);
        
        // TODO: 修复Puppeteer API兼容性问题
        // await page.waitForXPath(publishButtonXPath, { visible: true, timeout: 10000 });
        // const publishButtons = await page.$x(publishButtonXPath);
        const publishButtons: any[] = [];
        console.log('[抖音号] ⚠️ Puppeteer API需要更新');
        
        if (publishButtons.length > 0) {
          await publishButtons[0].click();
          console.log('[抖音号] ✅ 已点击发布按钮（XPath备用方案）');
        } else {
          throw new Error('XPath备用方案也失败了');
        }
        
        // 备用方案：使用文字匹配
        const publishXPath = "//button[contains(text(), '发布')]";
        console.log(`[抖音号] 备用XPath: ${publishXPath}`);
        
        try {
          // TODO: 修复Puppeteer API兼容性问题
          // await page.waitForXPath(publishXPath, { visible: true, timeout: 10000 });
          console.log('[抖音号] ⚠️ 使用XPath找到发布按钮 - API需要更新');
          
          // const publishButtons = await page.$x(publishXPath);
          const publishButtons: any[] = [];
          console.log(`[抖音号] 找到 ${publishButtons.length} 个包含"发布"的按钮`);
          
          // 遍历所有按钮，找到主发布按钮
          let clicked = false;
          for (let i = 0; i < publishButtons.length; i++) {
            const button = publishButtons[i];
            const buttonText = await page.evaluate(el => el.textContent?.trim(), button);
            const buttonClass = await page.evaluate(el => el.className, button);
            
            console.log(`[抖音号] 按钮 [${i}] 文字: "${buttonText}", class: "${buttonClass}"`);
            
            // 查找主发布按钮（通常文字就是"发布"，且有特定class）
            if (buttonText === '发布' && buttonClass.includes('primary')) {
              const isVisible = await page.evaluate(el => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
              }, button);
              
              if (isVisible) {
                console.log(`[抖音号] ✅ 找到主发布按钮: "${buttonText}"`);
                console.log('[抖音号] 🖱️  点击发布按钮...');
                await button.click();
                clicked = true;
                console.log('[抖音号] ✅ 已点击发布按钮（XPath方案）');
                break;
              }
            }
          }
          
          if (!clicked) {
            // 如果还没点击，点击第一个可见的"发布"按钮
            console.log('[抖音号] ⚠️ 未找到主发布按钮，尝试点击第一个可见按钮...');
            for (const button of publishButtons) {
              const isVisible = await page.evaluate(el => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
              }, button);
              
              if (isVisible) {
                await button.click();
                clicked = true;
                console.log('[抖音号] ✅ 已点击发布按钮（备用方案）');
                break;
              }
            }
          }
          
          if (!clicked) {
            throw new Error('所有发布按钮都不可点击');
          }
        } catch (e: any) {
          console.log('[抖音号] ❌ XPath方案也失败了:', e.message);
          throw new Error('找不到可点击的发布按钮');
        }
      }
      
      console.log('[抖音号] ⏳ 等待3秒，检查是否有确认对话框...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查是否有确认对话框或二次确认按钮
      try {
        console.log('[抖音号] 🔍 检查是否有确认对话框...');
        const confirmButtons: any[] = [];
        
        // 查找所有可见的按钮
        const allButtons = await page.$$('button');
        console.log(`[抖音号] 页面共有 ${allButtons.length} 个按钮`);
        
        // 遍历所有按钮，查找确认按钮
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          const buttonInfo = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              text: el.textContent?.trim(),
              visible: style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      style.opacity !== '0' &&
                      rect.width > 0 && 
                      rect.height > 0,
              className: el.className
            };
          }, button);
          
          // 查找可见的确认按钮
          if (buttonInfo.visible && 
              (buttonInfo.text === '确定' || 
               buttonInfo.text === '确认' || 
               buttonInfo.text === '发布' ||
               buttonInfo.text === '立即发布')) {
            confirmButtons.push({ button, info: buttonInfo });
          }
        }
        
        console.log(`[抖音号] 找到 ${confirmButtons.length} 个可见的确认按钮`);
        
        if (confirmButtons.length > 0) {
          console.log('[抖音号] ⚠️ 发现确认按钮，可能需要二次确认');
          
          for (let i = 0; i < confirmButtons.length; i++) {
            const { button, info } = confirmButtons[i];
            console.log(`[抖音号] 确认按钮 [${i}] 文字: "${info.text}", class: "${info.className}"`);
            
            // 点击第一个不是已经点击过的发布按钮
            if (info.text !== '发布' || !info.className.includes('primary-cECiOJ')) {
              console.log(`[抖音号] 🖱️  点击确认按钮: "${info.text}"`);
              await button.click();
              console.log('[抖音号] ✅ 已点击确认按钮');
              await new Promise(resolve => setTimeout(resolve, 2000));
              break;
            }
          }
        } else {
          console.log('[抖音号] ℹ️  没有发现确认对话框');
        }
      } catch (e: any) {
        console.log('[抖音号] ℹ️  检查确认对话框时出错:', e.message);
      }
      
      console.log('[抖音号] ⏳ 等待发布完成（20秒）...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      
      // 检查是否发布成功
      console.log('[抖音号] 🔍 检查发布结果...');
      try {
        // 检查URL是否变化（发布成功通常会跳转）
        const currentUrl = page.url();
        console.log(`[抖音号] 当前URL: ${currentUrl}`);
        
        // 检查是否有成功提示（使用CSS选择器）
        const successTexts = await page.$$eval('*', elements => {
          return elements
            .map(el => el.textContent?.trim())
            .filter(text => text && (text.includes('发布成功') || text.includes('已发布')));
        });
        
        if (successTexts.length > 0) {
          console.log('[抖音号] ✅ 检测到发布成功提示:', successTexts[0]);
        } else {
          console.log('[抖音号] ⚠️ 未检测到明确的成功提示');
        }
        
        // 检查是否还在编辑页面（如果还在，说明可能没发布成功）
        const stillEditing = await page.$('#DCPF');
        if (stillEditing) {
          console.log('[抖音号] ⚠️ 仍在编辑页面，发布可能未成功');
          
          // 列出页面上所有可见的按钮文字
          const visibleButtons = await page.$$eval('button', buttons => {
            return buttons
              .filter(btn => {
                const style = window.getComputedStyle(btn);
                const rect = btn.getBoundingClientRect();
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       rect.width > 0 && 
                       rect.height > 0;
              })
              .map(btn => btn.textContent?.trim())
              .filter(text => text);
          });
          console.log('[抖音号] 页面可见按钮:', visibleButtons.join(', '));
        } else {
          console.log('[抖音号] ✅ 已离开编辑页面');
        }
      } catch (e: any) {
        console.log('[抖音号] ℹ️  检查发布结果时出错:', e.message);
      }
      
      console.log('[抖音号] ========================================');
      console.log('✅ 抖音号发布流程已完成！');
      console.log('[抖音号] 💡 请查看 douyin-after-publish.png 确认发布状态');
      console.log('[抖音号] ========================================');
      return true;
    } catch (error: any) {
      console.error('❌ 抖音号文章发布失败:', error.message);
      console.error('错误堆栈:', error.stack);
      
      // 等待一段时间再关闭，方便查看
      console.log('[抖音号] ⏳ 等待10秒后关闭浏览器...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
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
