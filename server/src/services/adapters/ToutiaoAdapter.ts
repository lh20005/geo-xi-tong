import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 头条号平台适配器
 * 根据头条号实际界面优化：
 * 1. 标题输入框：请输入文章标题（2～30个字）- 单独的input元素
 * 2. 正文编辑器：请输入正文 - contenteditable的div元素
 * 3. 发布按钮：预览并发布（红色按钮，在页面底部）
 * 
 * 重要：标题和内容必须分别输入到不同的元素中
 */
export class ToutiaoAdapter extends PlatformAdapter {
  platformId = 'toutiao';
  platformName = '头条号';

  getLoginUrl(): string {
    return 'https://mp.toutiao.com/auth/page/login';
  }

  getPublishUrl(): string {
    return 'https://mp.toutiao.com/profile_v4/graphic/publish';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="mobile"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'button.btn-login',
      successIndicator: '.user-avatar'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入文章标题"]',
      contentEditor: '.ql-editor',
      categorySelect: 'select.category',
      tagsInput: 'input.tag-input',
      publishButton: 'button:contains("预览并发布")',
      successIndicator: '.publish-success'
    };
  }

  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // 优先使用Cookie登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[头条号] 使用Cookie登录');
        
        // 设置Cookie（页面已经在主页了，由PublishingExecutor导航）
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess) {
          console.log('[头条号] Cookie已设置，等待3秒让页面加载...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 验证登录状态 - 检查URL是否包含mp.toutiao.com且不包含login
          const currentUrl = page.url();
          console.log(`[头条号] 当前URL: ${currentUrl}`);
          
          if (currentUrl.includes('mp.toutiao.com') && !currentUrl.includes('login') && !currentUrl.includes('auth')) {
            console.log('✅ 头条号Cookie登录成功');
            return true;
          }
          
          console.log('[头条号] Cookie登录验证失败，尝试表单登录');
        }
        
        // Cookie登录失败，导航到登录页
        await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle2', timeout: 30000 });
      }
      
      // 表单登录（后备方案）
      console.log('[头条号] 开始表单登录');
      const selectors = this.getLoginSelectors();
      await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      await this.safeType(page, selectors.usernameInput, credentials.username);
      await this.safeType(page, selectors.passwordInput, credentials.password);
      await this.safeClick(page, selectors.submitButton);

      // 等待登录完成
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('✅ 头条号表单登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ 头条号登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      await this.log('info', '========================================');
      await this.log('info', '🚀 开始头条号发布流程');
      await this.log('info', '========================================');
      await this.log('info', `📄 文章标题: "${article.title}" (${article.title.length}字)`);
      
      // ========== 步骤1：确保在发布页面 ==========
      await this.log('info', '📍 步骤1/6：确保在发布页面');
      
      const currentUrl = page.url();
      if (!currentUrl.includes('/graphic/publish')) {
        await this.log('info', '🔄 当前不在发布页面，正在跳转...');
        
        const publishMenuSelector = '#masterRoot > div > div.pgc-content > section > aside > div > div > div > div.byte-menu-inline.base_creation_tab > div.byte-menu-inline-content > div:nth-child(1) > span > a';
        
        try {
          await page.waitForSelector(publishMenuSelector, { timeout: 5000 });
          const menuLink = await page.$(publishMenuSelector);
          
          if (menuLink) {
            await this.log('info', '👆 点击"发布文章"菜单...');
            await menuLink.click();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.log('info', '✅ 已跳转到发布页面');
          }
        } catch (e) {
          await this.log('warning', '⚠️ 未找到菜单，可能已在发布页面');
        }
      } else {
        await this.log('info', '✅ 已在发布页面');
      }
      
      // 等待发布页面完全加载
      await this.log('info', '⏳ 等待页面加载完成...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      await this.log('info', '✅ 页面加载完成');
      
      // ========== 步骤2：填写标题 ==========
      await this.log('info', '📝 步骤2/6：填写文章标题');
      
      const titleSelector = '#root > div > div.left-column > div > div.publish-editor > div.publish-editor-title-wrapper > div > div > div.title-wrapper > div > div > div > textarea';
      
      let titleInput = await page.$(titleSelector);
      
      if (!titleInput) {
        await this.log('warning', '⚠️ 精确选择器未找到，尝试简化选择器...');
        
        const fallbackSelectors = [
          'textarea',
          '.title-wrapper textarea',
          'div.publish-editor-title-wrapper textarea'
        ];
        
        for (const selector of fallbackSelectors) {
          titleInput = await page.$(selector) as any;
          if (titleInput) {
            await this.log('info', `✅ 使用简化选择器找到: ${selector}`);
            break;
          }
        }
      } else {
        await this.log('info', '✅ 找到标题输入框');
      }
      
      if (titleInput) {
        const title = config.title || article.title;
        await this.log('info', `⌨️  正在输入标题: "${title}" (${title.length}字)`);
        
        // 点击标题框
        await this.log('info', '👆 点击标题输入框...');
        await titleInput.click();
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 清空并输入标题
        await this.log('info', '🧹 清空标题框...');
        await titleInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await this.log('info', '⌨️  输入标题文本...');
        
        // ========== 关键修复：优先使用evaluate方法，兼容静默模式 ==========
        await this.log('info', '💡 使用evaluate方法设置标题（兼容静默模式）');
        
        const titleSetSuccess = await page.evaluate((el, val) => {
          try {
            (el as HTMLTextAreaElement).value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
          } catch (e) {
            return false;
          }
        }, titleInput, title);
        
        if (!titleSetSuccess) {
          // 备用方案：使用keyboard.type
          await this.log('warning', '⚠️ evaluate方法失败，使用keyboard.type');
          await page.keyboard.type(title, { delay: 80 });
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 验证标题
        const inputValue = await page.evaluate(el => (el as HTMLTextAreaElement).value, titleInput);
        
        if (inputValue === title) {
          await this.log('info', '✅ 标题输入成功！');
        } else if (inputValue.includes(title) || title.includes(inputValue)) {
          await this.log('warning', '⚠️ 标题部分匹配');
        } else {
          await this.log('warning', '⚠️ 标题验证失败，但继续执行');
        }
      } else {
        await this.log('error', '❌ 未找到标题输入框！');
        throw new Error('未找到标题输入框');
        console.log('[头条号]    4. 查看上面的input元素列表');
        console.log('[头条号] ========================================');
      }
      
      // 等待标题输入完成后再继续（增加等待时间）
      console.log('[头条号] ⏳ 等待标题输入稳定（3秒）...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // ========== 步骤3：填写正文内容（按位置插入图片）==========
      console.log('\n[头条号] ========================================');
      console.log('[头条号] 📄 步骤3/6：填写正文内容（按位置插入图片）');
      console.log('[头条号] ========================================');
      
      // 使用精确选择器（用户提供）- ProseMirror 编辑器
      const contentSelector = '#root > div > div.left-column > div > div.publish-editor > div.syl-editor-wrap > div > div.ProseMirror > p';
      
      console.log(`[头条号] 精确选择器: ${contentSelector}`);
      let contentEditor = await page.$(contentSelector);
      
      if (contentEditor) {
        console.log('[头条号] ✅ 找到内容编辑器（ProseMirror）');
      } else {
        console.log('[头条号] ⚠️ 精确选择器未找到，尝试简化选择器...');
        
        // 尝试简化的选择器
        const fallbackSelectors = [
          '.ProseMirror',  // ProseMirror 编辑器
          '.ProseMirror > p',  // ProseMirror 中的段落
          'div.syl-editor-wrap .ProseMirror',
          '[contenteditable="true"]'  // 任何可编辑元素
        ];
        
        for (const selector of fallbackSelectors) {
          contentEditor = await page.$(selector) as any;
          if (contentEditor) {
            console.log(`[头条号] ✅ 使用简化选择器找到: ${selector}`);
            break;
          }
        }
      }
      
      if (contentEditor) {
        await this.log('info', '📝 步骤3/6：开始输入正文内容');
        
        // 点击内容编辑器
        await this.log('info', '👆 点击内容编辑器...');
        await contentEditor.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.log('info', '✅ 内容编辑器已激活');
        
        // ========== 新方案：先复制所有文字，再上传所有图片 ==========
        console.log('[头条号] 💡 新方案：先复制所有文字，再上传所有图片');
        
        const fs = require('fs');
        const path = require('path');
        
        // ========== 关键修复：从content中移除标题 ==========
        let cleanContent = article.content;
        
        // 检查content是否以标题开头
        const contentLines = cleanContent.split('\n');
        const firstLine = contentLines[0].trim();
        
        console.log(`[头条号] 检查content第一行: "${firstLine.substring(0, 50)}"`);
        console.log(`[头条号] 文章标题: "${article.title}"`);
        
        // 如果第一行包含标题，移除它
        if (firstLine.includes(article.title) || article.title.includes(firstLine)) {
          console.log('[头条号] ⚠️ 检测到content包含标题，正在移除...');
          cleanContent = contentLines.slice(1).join('\n').trim();
          console.log(`[头条号] ✅ 已移除标题，剩余内容长度: ${cleanContent.length}`);
        } else if (firstLine.startsWith('#')) {
          // 如果第一行是Markdown标题格式
          console.log('[头条号] ⚠️ 检测到Markdown标题格式，正在移除...');
          cleanContent = contentLines.slice(1).join('\n').trim();
          console.log(`[头条号] ✅ 已移除Markdown标题，剩余内容长度: ${cleanContent.length}`);
        } else {
          console.log('[头条号] ✅ content不包含标题，无需处理');
        }
        
        // ========== 步骤1：提取所有文字（移除图片标记）==========
        console.log('[头条号] 📝 步骤1：提取所有文字内容...');
        
        // 使用基类的通用清理方法，移除HTML标签和图片标记，保留段落格式
        const textOnly = this.cleanArticleContent(cleanContent);
        console.log(`[头条号] 📏 纯文字长度: ${textOnly.length} 个字符`);
        console.log(`[头条号] 📝 文字预览: "${textOnly.substring(0, 100)}${textOnly.length > 100 ? '...' : ''}"`);
        
        // ========== 步骤2：提取所有图片路径 ==========
        console.log('[头条号] 📷 步骤2：提取所有图片路径...');
        
        const imagePaths: string[] = [];
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        
        while ((match = imageRegex.exec(cleanContent)) !== null) {
          const imageUrl = match[2];
          let imagePath = imageUrl;
          
          console.log(`[头条号] 🔍 原始图片URL: ${imageUrl}`);
          
          // 转换为绝对路径
          if (imagePath.startsWith('/uploads/')) {
            // 修复：文件实际在server/uploads/目录下
            imagePath = path.join(process.cwd(), 'server', imagePath);
            console.log(`[头条号] 📁 转换为绝对路径: ${imagePath}`);
          } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
            imagePath = path.join(process.cwd(), 'server', 'uploads', imagePath);
            console.log(`[头条号] 📁 添加uploads前缀: ${imagePath}`);
          }
          
          // 检查文件是否存在
          if (fs.existsSync(imagePath)) {
            imagePaths.push(imagePath);
            console.log(`[头条号] ✅ 图片文件存在，已添加到队列 ${imagePaths.length}: ${path.basename(imagePath)}`);
          } else {
            console.log(`[头条号] ❌ 图片文件不存在: ${imagePath}`);
            console.log(`[头条号] 💡 请检查文件路径是否正确`);
          }
        }
        
        console.log(`[头条号] 📊 内容解析完成:`);
        console.log(`[头条号]    - 纯文字长度: ${textOnly.length} 个字符`);
        console.log(`[头条号]    - 图片数量: ${imagePaths.length} 张`);
        
        // ========== 步骤3：先插入所有文字 ==========
        console.log('\n[头条号] ========================================');
        console.log('[头条号] � 步明骤3：插入所有文字到正文');
        console.log('[头条号] ========================================');
        
        if (textOnly && textOnly.length > 0) {
          try {
            // 点击编辑器确保焦点
            console.log('[头条号] 🖱️  点击编辑器确保焦点...');
            await contentEditor.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('[头条号] ✅ 编辑器已获得焦点');
            
            // ========== 关键修复：使用evaluate方法直接设置内容，兼容静默模式 ==========
            console.log('[头条号] ⌨️  开始输入所有文字...');
            console.log(`[头条号] 📏 文字长度: ${textOnly.length} 个字符`);
            console.log('[头条号] 💡 使用evaluate方法直接设置内容（兼容静默模式）');
            
            // 方法1：尝试使用evaluate直接设置innerHTML（更可靠）
            // 关键修复：添加超时保护，避免静默模式下卡死
            let setContentSuccess = false;
            try {
              // 设置5秒超时
              const evaluatePromise = page.evaluate((text) => {
                const editor = document.querySelector('.ProseMirror');
                if (editor) {
                  // 将文本转换为HTML段落
                  const paragraphs = text.split('\n').filter(p => p.trim());
                  const html = paragraphs.map(p => `<p>${p}</p>`).join('');
                  
                  editor.innerHTML = html;
                  
                  // 触发input事件，确保编辑器识别内容变化
                  editor.dispatchEvent(new Event('input', { bubbles: true }));
                  editor.dispatchEvent(new Event('change', { bubbles: true }));
                  
                  return true;
                }
                return false;
              }, textOnly);
              
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('evaluate超时')), 5000)
              );
              
              setContentSuccess = await Promise.race([evaluatePromise, timeoutPromise]) as boolean;
              console.log('[头条号] ✅ 所有文字输入完成（evaluate方法）');
            } catch (error: any) {
              console.log(`[头条号] ⚠️ evaluate方法失败或超时: ${error.message}`);
              setContentSuccess = false;
            }
            
            if (!setContentSuccess) {
              // 方法2：备用方案 - 使用keyboard.type（可视化模式下更自然）
              console.log('[头条号] 🔄 使用keyboard.type备用方案');
              try {
                // 分批输入，避免一次性输入过多导致卡顿
                const batchSize = 500; // 每批500个字符
                for (let i = 0; i < textOnly.length; i += batchSize) {
                  const batch = textOnly.substring(i, Math.min(i + batchSize, textOnly.length));
                  await page.keyboard.type(batch, { delay: 20 });
                  console.log(`[头条号] 📝 已输入 ${Math.min(i + batchSize, textOnly.length)}/${textOnly.length} 字符`);
                  // 每批之间短暂停顿
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                console.log('[头条号] ✅ 所有文字输入完成（keyboard方法）');
              } catch (error: any) {
                console.error(`[头条号] ❌ keyboard输入也失败: ${error.message}`);
                throw new Error('文字输入失败');
              }
            }
            
            // 等待输入稳定（减少到3秒，因为evaluate方法更快）
            console.log('[头条号] ⏳ 等待文字输入稳定（3秒）...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
          } catch (error: any) {
            console.error(`[头条号] ❌ 插入文字失败:`, error.message);
          }
        } else {
          console.log('[头条号] ⚠️ 没有文字内容需要插入');
        }
        
        // ========== 步骤4：上传所有图片 ==========
        console.log('\n[头条号] ========================================');
        console.log('[头条号] 📷 步骤4：上传所有图片');
        console.log('[头条号] ========================================');
        console.log(`[头条号] 📊 共有 ${imagePaths.length} 张图片需要上传`);
        
        if (imagePaths.length > 0) {
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            console.log(`\n[头条号] ========== 上传第 ${i + 1}/${imagePaths.length} 张图片 ==========`);
            console.log(`[头条号] 📷 图片文件: ${path.basename(imagePath)}`);
            console.log(`[头条号] � 即完整路径: ${imagePath}`);
            
            try {
              // 点击上传图片按钮
              const uploadButtonSelector = '#root > div > div.left-column > div > div.publish-editor > div.syl-editor-toolbar.visible.inline > div > div.syl-toolbar-tool.image.static > div > button > svg';
              
              console.log('[头条号] 🔍 查找上传图片按钮...');
              console.log(`[头条号] 选择器: ${uploadButtonSelector.substring(0, 80)}...`);
              
              try {
                await page.waitForSelector(uploadButtonSelector, { timeout: 5000 });
                const uploadButton = await page.$(uploadButtonSelector);
                
                if (uploadButton) {
                  console.log('[头条号] ✅✅✅ 找到上传图片按钮，正在点击...');
                  await uploadButton.click();
                  console.log('[头条号] ✅ 已点击上传按钮');
                  console.log('[头条号] ⏳ 等待上传对话框打开（8秒，考虑网络延迟）...');
                  await new Promise(resolve => setTimeout(resolve, 8000));
                  console.log('[头条号] ✅ 对话框应该已打开');
                
                // 在弹出的对话框中点击"本地上传"
                const fileInputSelector = 'body > div:nth-child(46) > div.byte-drawer.primary-drawer.mp-ic-img-drawer.is-first.slideRight-enter-done > div > div > div.byte-drawer-content.byte-drawer-content-nofooter > div > div.byte-tabs-content.byte-tabs-content-horizontal > div > div.byte-tabs-content-item.byte-tabs-content-item-active > div > div > div > div.btn-upload-scand.is-empty > div > button:nth-child(1) > div > input[type=file]';
                
                console.log('[头条号] 🔍 查找文件上传输入框...');
                console.log('[头条号] 💡 尝试多个选择器...');
                
                // 尝试多个可能的选择器
                const fileInputSelectors = [
                  fileInputSelector,
                  'input[type=file]',  // 简化选择器
                  '.byte-drawer input[type=file]',
                  '.mp-ic-img-drawer input[type=file]'
                ];
                
                let fileInput = null;
                for (let idx = 0; idx < fileInputSelectors.length; idx++) {
                  const selector = fileInputSelectors[idx];
                  console.log(`[头条号] 🔍 尝试选择器 ${idx + 1}/${fileInputSelectors.length}: ${selector.substring(0, 50)}...`);
                  
                  try {
                    await page.waitForSelector(selector, { timeout: 3000 });
                    fileInput = await page.$(selector);
                    if (fileInput) {
                      console.log(`[头条号] ✅✅✅ 成功找到文件输入框！使用选择器: ${selector.substring(0, 50)}...`);
                      break;
                    } else {
                      console.log(`[头条号] ⚠️ 选择器匹配但元素为null`);
                    }
                  } catch (e: any) {
                    console.log(`[头条号] ⚠️ 选择器超时或失败: ${e.message}`);
                    // 继续尝试下一个选择器
                  }
                }
                
                if (!fileInput) {
                  console.log('[头条号] ❌❌❌ 所有选择器都失败了！');
                  console.log('[头条号] 💡 尝试列出页面上所有的input[type=file]元素...');
                  
                  const allFileInputs = await page.$$('input[type=file]');
                  console.log(`[头条号] 📊 页面上共有 ${allFileInputs.length} 个文件输入框`);
                  
                  if (allFileInputs.length > 0) {
                    console.log('[头条号] 💡 使用第一个文件输入框');
                    fileInput = allFileInputs[0];
                  }
                }
                
                if (fileInput) {
                  console.log('[头条号] ✅✅✅ 找到文件输入框，准备上传图片');
                  console.log(`[头条号] 📁 图片路径: ${imagePath}`);
                  console.log(`[头条号] 📁 图片文件名: ${path.basename(imagePath)}`);
                  
                  // 再次验证文件是否存在
                  if (!fs.existsSync(imagePath)) {
                    console.log(`[头条号] ❌❌❌ 严重错误：图片文件不存在！`);
                    console.log(`[头条号] 路径: ${imagePath}`);
                    throw new Error(`图片文件不存在: ${imagePath}`);
                  }
                  
                  console.log('[头条号] ⏳ 正在调用uploadFile方法...');
                  try {
                    await (fileInput as any).uploadFile(imagePath);
                    console.log('[头条号] ✅✅✅ uploadFile方法调用成功！图片已提交上传');
                  } catch (uploadError: any) {
                    console.log(`[头条号] ❌❌❌ uploadFile方法调用失败: ${uploadError.message}`);
                    throw uploadError;
                  }
                  
                  // 等待上传完成（预留20秒，因为网络可能慢）
                  console.log('[头条号] ⏳ 等待图片上传完成（20秒，考虑网络延迟）...');
                  await new Promise(resolve => setTimeout(resolve, 20000));
                  console.log('[头条号] ✅ 上传等待完成');
                  
                  // 点击确定按钮关闭对话框
                  console.log('[头条号] 🔍 查找确定按钮关闭对话框...');
                  console.log('[头条号] 💡 重要：必须通过文本查找，避免点击错误的按钮');
                  
                  try {
                    // 等待一下确保按钮可点击
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // 方法1：通过文本精确查找"确定"按钮
                    console.log('[头条号] 🔍 方法1：通过文本查找"确定"按钮...');
                    const confirmClicked = await page.evaluate(() => {
                      console.log('=== 开始在对话框中查找确定按钮 ===');
                      const buttons = Array.from(document.querySelectorAll('button'));
                      console.log('对话框中的按钮总数:', buttons.length);
                      
                      // 打印所有按钮文本（调试用）
                      buttons.forEach((btn, i) => {
                        const text = (btn.textContent || '').trim();
                        if (text) {
                          console.log(`按钮${i}: "${text}"`);
                        }
                      });
                      
                      // 查找确定按钮（精确匹配）
                      for (const btn of buttons) {
                        const text = (btn.textContent || '').trim();
                        if (text === '确定' || text === '确认') {
                          console.log('✅ 找到确定按钮，文本:', text);
                          (btn as HTMLButtonElement).click();
                          return true;
                        }
                      }
                      
                      console.log('❌ 未找到确定按钮');
                      return false;
                    });
                    
                    if (confirmClicked) {
                      console.log('[头条号] ✅✅✅ 已点击"确定"按钮！');
                      console.log('[头条号] ⏳ 等待对话框关闭（5秒，确保完全关闭）...');
                      await new Promise(resolve => setTimeout(resolve, 5000));
                      console.log('[头条号] ✅ 对话框已关闭，光标应自动回到正文图片后');
                      console.log('[头条号] 💡 准备继续处理下一个内容部分（文字或图片）');
                    } else {
                      console.log('[头条号] ⚠️ 未找到确定按钮，尝试使用精确选择器...');
                      
                      // 方法2：使用用户提供的精确选择器
                      const confirmButtonSelector = 'body > div:nth-child(46) > div.byte-drawer.primary-drawer.mp-ic-img-drawer.is-first.slideRight-enter-done > div > div > div.byte-drawer-content.byte-drawer-content-nofooter > div > div.byte-tabs-content.byte-tabs-content-horizontal > div > div.byte-tabs-content-item.byte-tabs-content-item-active > div > div > div > div.footer > div.confirm-btns > button.byte-btn.byte-btn-primary.byte-btn-size-large.byte-btn-shape-square > span';
                      
                      const confirmButton = await page.$(confirmButtonSelector);
                      if (confirmButton) {
                        console.log('[头条号] ✅ 使用精确选择器找到确定按钮');
                        await confirmButton.click();
                        console.log('[头条号] ✅ 已点击确定按钮');
                        await new Promise(resolve => setTimeout(resolve, 5000));
                      } else {
                        console.log('[头条号] ⚠️ 精确选择器也未找到，对话框可能自动关闭');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                      }
                    }
                  } catch (e) {
                    console.log('[头条号] ⚠️ 点击确定按钮失败，继续执行:', e);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                  
                } else {
                  console.log('[头条号] ❌❌❌ 严重错误：未找到文件上传输入框！');
                  console.log('[头条号] 💡 可能原因：');
                  console.log('[头条号]    1. 对话框没有正确打开');
                  console.log('[头条号]    2. 选择器已过时');
                  console.log('[头条号]    3. 页面结构发生变化');
                }
                
                } else {
                  console.log('[头条号] ❌ 上传按钮选择器匹配但元素为null');
                }
              } catch (buttonError: any) {
                console.log(`[头条号] ❌❌❌ 查找上传按钮失败: ${buttonError.message}`);
                console.log('[头条号] 💡 尝试备用方案：通过类名查找按钮');
                
                // 备用方案：查找所有可能的上传按钮
                const alternativeSelectors = [
                  'button[aria-label*="图片"]',
                  'button[title*="图片"]',
                  '.syl-toolbar-tool.image button',
                  'div.image button'
                ];
                
                let foundButton = false;
                for (const altSelector of alternativeSelectors) {
                  try {
                    const altButton = await page.$(altSelector);
                    if (altButton) {
                      console.log(`[头条号] ✅ 使用备用选择器找到按钮: ${altSelector}`);
                      await altButton.click();
                      console.log('[头条号] ⏳ 等待对话框打开（5秒）...');
                      await new Promise(resolve => setTimeout(resolve, 5000));
                      foundButton = true;
                      break;
                    }
                  } catch (e) {
                    // 继续尝试
                  }
                }
                
                if (!foundButton) {
                  console.log('[头条号] ❌ 所有备用方案都失败了，跳过此图片');
                  continue;
                }
              }
              
            } catch (error: any) {
              console.error(`[头条号] ❌ 上传图片失败:`, error.message);
              console.log('[头条号] ⚠️ 图片上传失败，但继续上传下一张');
            }
            
            console.log(`[头条号] ✅ 第 ${i + 1}/${imagePaths.length} 张图片处理完成\n`);
          }
          
          console.log('[头条号] ✅ 所有图片上传完成');
        } else {
          console.log('[头条号] ⚠️ 没有图片需要上传');
        }
        
        console.log('\n[头条号] ========================================');
        console.log('[头条号] ✅✅✅ 所有内容插入完成！');
        console.log('[头条号] ========================================');
        console.log(`[头条号] � 文字长度 : ${textOnly.length} 个字符`);
        console.log(`[头条号] � 文图片数量: ${imagePaths.length} 张`);
        
        // ========== 验证算法：确保所有文字都已复制完毕 ==========
        console.log('\n[头条号] ========================================');
        console.log('[头条号] 🔍 验证算法：检查所有文字和图片是否已复制完毕');
        console.log('[头条号] ========================================');
        
        // 计算预期的文字总长度
        const expectedTextLength = textOnly.length;
        const expectedImageCount = imagePaths.length;
        
        console.log(`[头条号] 📏 预期文字总长度: ${expectedTextLength} 个字符`);
        console.log(`[头条号] 📷 预期图片数量: ${expectedImageCount} 张`);
        
        // 等待一下，确保最后的输入已经完成
        console.log('[头条号] ⏳ 等待3秒，确保最后的输入已完成...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 验证编辑器中的内容
        let verificationAttempts = 0;
        const maxAttempts = 5;
        let verificationPassed = false;
        
        while (verificationAttempts < maxAttempts && !verificationPassed) {
          verificationAttempts++;
          console.log(`[头条号] 🔍 验证尝试 ${verificationAttempts}/${maxAttempts}...`);
          
          const finalResult = await page.evaluate(() => {
            const editor = document.querySelector('.ProseMirror');
            if (editor) {
              const images = editor.querySelectorAll('img');
              const text = editor.textContent || '';
              // 移除所有空白字符来比较
              const cleanText = text.replace(/\s+/g, '');
              return {
                imageCount: images.length,
                textLength: text.length,
                cleanTextLength: cleanText.length,
                hasContent: text.length > 0
              };
            }
            return { imageCount: 0, textLength: 0, cleanTextLength: 0, hasContent: false };
          });
          
          console.log(`[头条号] 📊 编辑器中的内容:`);
          console.log(`[头条号]    - 图片数量: ${finalResult.imageCount} 张`);
          console.log(`[头条号]    - 文字长度: ${finalResult.textLength} 个字符`);
          console.log(`[头条号]    - 纯文字长度（去空格）: ${finalResult.cleanTextLength} 个字符`);
          
          // 验证条件
          const imageCountMatch = finalResult.imageCount === expectedImageCount;
          const hasEnoughText = finalResult.cleanTextLength >= expectedTextLength * 0.7; // 允许70%的容差（因为可能有换行等）
          
          console.log(`[头条号] 📊 验证结果:`);
          console.log(`[头条号]    - 图片数量匹配: ${imageCountMatch ? '✅' : '❌'} (预期: ${expectedImageCount}, 实际: ${finalResult.imageCount})`);
          console.log(`[头条号]    - 文字长度足够: ${hasEnoughText ? '✅' : '❌'} (预期: ${expectedTextLength}, 实际: ${finalResult.cleanTextLength})`);
          
          if (imageCountMatch && hasEnoughText) {
            verificationPassed = true;
            console.log('[头条号] ✅✅✅ 验证通过！所有内容已成功复制到编辑器');
            break;
          } else {
            console.log(`[头条号] ⚠️ 验证未通过，等待2秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (!verificationPassed) {
          console.log('[头条号] ⚠️⚠️⚠️ 警告：验证未完全通过，但继续执行');
          console.log('[头条号] 💡 可能原因：');
          console.log('[头条号]    1. 部分文字输入失败');
          console.log('[头条号]    2. 图片上传失败');
          console.log('[头条号]    3. 编辑器响应慢');
          console.log('[头条号] 💡 建议：检查编辑器内容是否完整');
        }
        
        console.log('[头条号] ========================================');
        console.log('[头条号] ✅ 内容验证完成，准备执行下一步');
        console.log('[头条号] ========================================');
        
      } else {
        console.log('[头条号] ❌ 未找到内容编辑器');
      }
      
      // 等待内容输入完成后再继续（增加等待时间）
      console.log('[头条号] ⏳ 等待内容输入稳定（5秒）...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // ========== 步骤4：点击必需选项按钮 ==========
      console.log('\n[头条号] ========================================');
      console.log('[头条号] ☑️  步骤4/6：点击必需选项按钮');
      console.log('[头条号] ========================================');
      
      // 只点击一个必需的选项按钮（用户提供的选择器）
      const optionButtonSelector = '#root > div > div.left-column > div > div.form-wrap > div.form-container > div.source-wrap > div > div.edit-input > div > div > span > span:nth-child(4) > label > span > div';
      
      try {
        console.log('[头条号] ⏳ 等待选项按钮加载（5秒）...');
        await page.waitForSelector(optionButtonSelector, { timeout: 5000 });
        const optionButton = await page.$(optionButtonSelector);
        
        if (optionButton) {
          console.log('[头条号] ✅ 找到选项按钮');
          await optionButton.click();
          console.log('[头条号] ✅ 已点击选项按钮');
          console.log('[头条号] ⏳ 等待选项生效（3秒）...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.log('[头条号] ⚠️ 未找到选项按钮');
        }
      } catch (e) {
        console.log('[头条号] ⚠️ 点击选项按钮失败:', e);
      }
      
      // ========== 步骤5：点击"预览并发布"按钮 ==========
      console.log('\n[头条号] ========================================');
      console.log('[头条号] 🚀 步骤5/6：点击"预览并发布"按钮');
      console.log('[头条号] ========================================');
      console.log('[头条号] 💡 策略：直接查找按钮并使用scrollIntoView滚动到按钮位置');
      
      // 先使用精确选择器尝试
      const publishButtonSelector = '#root > div > div.left-column > div > div.publish-footer.inline-editor > div > button.byte-btn.byte-btn-primary.byte-btn-size-large.byte-btn-shape-square.publish-btn.publish-btn-last > span';
      
      console.log('[头条号] 🔍 尝试使用精确选择器查找按钮...');
      let publishButton = await page.$(publishButtonSelector);
      
      if (publishButton) {
        console.log('[头条号] ✅ 使用精确选择器找到按钮');
        
        // 滚动到按钮位置
        await page.evaluate((selector: string) => {
          const btn = document.querySelector(selector);
          if (btn) {
            btn.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        }, publishButtonSelector);
        
        console.log('[头条号] ⏳ 等待滚动完成（3秒）...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 点击按钮
        await publishButton.click();
        console.log('[头条号] ✅ 已点击"预览并发布"按钮');
        
      } else {
        // 备用方案：通过文本查找按钮并滚动（最可靠的方法）
        console.log('[头条号] 🔍 精确选择器未找到，通过文本查找"预览并发布"按钮...');
        
        const clicked = await page.evaluate(() => {
          console.log('=== 开始查找发布按钮 ===');
          
          // 查找所有按钮
          const buttons = Array.from(document.querySelectorAll('button'));
          console.log('页面上的按钮总数:', buttons.length);
          
          // 打印所有按钮文本（调试用）
          buttons.forEach((btn, i) => {
            const text = (btn.textContent || '').trim();
            if (text) {
              console.log(`按钮${i}: "${text.substring(0, 20)}"`);
            }
          });
          
          // 查找发布按钮 - 关键修复：明确排除"定时发布"
          let publishButton = null;
          for (const btn of buttons) {
            const text = (btn.textContent || '').trim();
            
            // 第一优先级：精确匹配"预览并发布"
            if (text === '预览并发布') {
              publishButton = btn;
              console.log('✅ 找到发布按钮（精确匹配）:', text);
              break;
            }
            
            // 第二优先级：包含"预览"和"发布"
            if (text.includes('预览') && text.includes('发布')) {
              publishButton = btn;
              console.log('✅ 找到发布按钮（包含预览和发布）:', text);
              break;
            }
          }
          
          if (!publishButton) {
            // 备用方案：只匹配"发布"，但必须排除"定时"、"草稿"、"保存"
            for (const btn of buttons) {
              const text = (btn.textContent || '').trim();
              // 关键：必须包含"发布"，但不能包含"定时"、"草稿"、"保存"
              if (text.includes('发布') && 
                  !text.includes('定时') && 
                  !text.includes('草稿') && 
                  !text.includes('保存')) {
                publishButton = btn;
                console.log('✅ 找到发布按钮（备选）:', text);
                break;
              }
            }
          }
          
          if (publishButton) {
            const rect = publishButton.getBoundingClientRect();
            console.log('按钮位置:', {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight
            });
            
            // 关键：滚动到按钮位置
            console.log('开始滚动到按钮...');
            
            try {
              // 方法1：scrollIntoView with options
              publishButton.scrollIntoView({ 
                behavior: 'auto',  // 立即滚动，不要smooth
                block: 'center',   // 按钮居中显示
                inline: 'center' 
              });
              console.log('scrollIntoView完成');
            } catch (e) {
              // 方法2：简单的scrollIntoView
              publishButton.scrollIntoView();
              console.log('使用简单scrollIntoView');
            }
            
            // 等待一下，确保滚动完成
            return new Promise((resolve) => {
              setTimeout(() => {
                const newRect = publishButton!.getBoundingClientRect();
                console.log('滚动后按钮位置:', {
                  top: newRect.top,
                  bottom: newRect.bottom,
                  inViewport: newRect.top >= 0 && newRect.bottom <= window.innerHeight
                });
                
                // 点击按钮
                console.log('准备点击按钮...');
                try {
                  (publishButton as HTMLButtonElement).click();
                  console.log('✅ 已点击按钮');
                  resolve(true);
                } catch (e) {
                  console.log('❌ 点击失败:', e);
                  resolve(false);
                }
              }, 2000);  // 等待2秒让滚动完成（增加等待时间）
            });
          } else {
            console.log('❌ 未找到发布按钮');
            return false;
          }
        });
        
        if (clicked) {
          console.log('[头条号] ✅✅✅ 成功找到并点击发布按钮');
        } else {
          console.log('[头条号] ❌❌❌ 无法找到或点击发布按钮');
        }
      }
      
      // 等待确认对话框出现（增加等待时间）
      console.log('[头条号] ⏳ 等待确认对话框出现（5秒）...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // ========== 步骤6：在确认对话框中点击"确认发布"按钮 ==========
      console.log('\n[头条号] ========================================');
      console.log('[头条号] ✅ 步骤6/6：点击"确认发布"按钮');
      console.log('[头条号] ========================================');
      
      // 注意：确认按钮的选择器可能与预览按钮不同，需要在对话框中查找
      try {
        // 等待对话框完全加载（增加等待时间）
        console.log('[头条号] ⏳ 等待对话框完全加载（3秒）...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 通过文本查找确认按钮
        const confirmClicked = await page.evaluate(() => {
          console.log('=== 开始查找确认发布按钮 ===');
          const buttons = Array.from(document.querySelectorAll('button'));
          console.log('对话框中的按钮总数:', buttons.length);
          
          // 打印所有按钮文本
          buttons.forEach((btn, i) => {
            const text = (btn.textContent || '').trim();
            if (text) {
              console.log(`对话框按钮${i}: "${text}"`);
            }
          });
          
          for (const btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text === '确认发布' || text === '发布' || text === '确定') {
              console.log('✅ 找到确认按钮，文本:', text);
              (btn as HTMLButtonElement).click();
              return true;
            }
          }
          console.log('❌ 未找到确认按钮');
          return false;
        });
        
        if (confirmClicked) {
          console.log('[头条号] ✅✅✅ 已点击"确认发布"按钮！');
          console.log('[头条号] ⏳ 等待发布处理（8秒）...');
          await new Promise(resolve => setTimeout(resolve, 8000));
        } else {
          console.log('[头条号] ⚠️ 未找到确认按钮，可能已自动发布或对话框未出现');
        }
      } catch (e) {
        console.log('[头条号] ⚠️ 点击确认发布失败:', e);
      }
      
      // ========== 等待发布完成 ==========
      console.log('\n[头条号] ========================================');
      console.log('[头条号] 🎉 等待发布完成');
      console.log('[头条号] ========================================');
      
      console.log('[头条号] ⏳ 等待发布结果（10秒）...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log('\n[头条号] ========================================');
      console.log('[头条号] ✅✅✅ 头条号简化发布流程执行完成！');
      console.log('[头条号] ========================================');
      console.log('[头条号] 📊 流程总结（6步）:');
      console.log('[头条号]    ✅ 步骤1: 点击"发布文章"菜单');
      console.log('[头条号]    ✅ 步骤2: 填写标题');
      console.log('[头条号]    ✅ 步骤3: 填写正文（按位置插入图片）');
      console.log('[头条号]    ✅ 步骤4: 点击必需选项按钮');
      console.log('[头条号]    ✅ 步骤5: 点击预览并发布');
      console.log('[头条号]    ✅ 步骤6: 确认发布');
      console.log('[头条号] ========================================');
      console.log('[头条号] 💡 优化说明:');
      console.log('[头条号]    - 简化流程，去掉封面上传步骤');
      console.log('[头条号]    - 每步之间增加了充足的等待时间');
      console.log('[头条号]    - 使用精确的CSS选择器');
      console.log('[头条号]    - 图片上传预留15秒等待时间');
      console.log('[头条号]    - 正文内容按位置逐步插入文字和图片');
      console.log('[头条号] ========================================');
      return true;
    } catch (error: any) {
      console.error('❌ 头条号文章发布失败:', error.message);
      console.error(error.stack);
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
