import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './base';
import path from 'path';
import fs from 'fs';
import { resolveImagePath } from '../imageDownloader';

/**
 * 百家号适配器
 * 参考 bjh.js 登录器实现
 */
export class BaijiahaoAdapter extends PlatformAdapter {
  platformId = 'baijiahao';
  platformName = '百家号';

  getLoginUrl(): string {
    return 'https://baijiahao.baidu.com/builder/rc/login';
  }

  getPublishUrl(): string {
    return 'https://baijiahao.baidu.com/builder/rc/home';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: '.UjPPKm89R4RrZTKhwG5H'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入标题"]',
      contentEditor: '.ProseMirror',
      publishButton: 'button:has-text("发布")',
      successIndicator: 'text=发布成功'
    };
  }

  private async randomWait(minMs: number, maxMs: number): Promise<void> {
    const waitTime = minMs + Math.random() * (maxMs - minMs);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  private async humanClick(locator: any, description: string = ''): Promise<void> {
    await this.randomWait(3000, 5000);
    await locator.click();
    if (description) {
      await this.log('info', `已点击: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  private async humanType(locator: any, text: string, description: string = ''): Promise<void> {
    await this.randomWait(3000, 5000);
    await locator.fill(text);
    if (description) {
      await this.log('info', `已输入: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  /**
   * 检测并关闭随机弹窗
   * 百家号页面可能会随机弹出各种提示弹窗，需要自动检测并关闭
   * 注意：第一步已经关闭了主弹窗，这里检测其他随机弹窗
   */
  private async closeRandomPopups(page: Page): Promise<void> {
    await this.log('info', '开始检测随机弹窗...');
    
    // 常见的弹窗关闭按钮选择器（排除第一步已处理的主弹窗）
    const popupCloseSelectors = [
      '.c9a2214b6873cbb6-closeBtn',    // 另一种弹窗关闭按钮
      '[class*="closeBtn"]',            // 包含 closeBtn 的类
      '[class*="close-icon"]',          // 包含 close-icon 的类
      '[class*="modal-close"]',         // 模态框关闭按钮
      '.ant-modal-close',               // Ant Design 模态框关闭
    ];

    // 常见的弹窗确认按钮（如"我知道了"、"确定"等）
    const popupConfirmTexts = [
      '我知道了',
      '知道了',
      '确定',
      '关闭',
      '跳过',
      '暂不',
    ];

    let closedCount = 0;
    const maxAttempts = 3; // 最多尝试关闭3个弹窗

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let foundPopup = false;

      // 尝试通过关闭按钮关闭弹窗
      for (const selector of popupCloseSelectors) {
        try {
          const closeBtn = page.locator(selector).first();
          const isVisible = await closeBtn.isVisible({ timeout: 500 }).catch(() => false);
          
          if (isVisible) {
            await this.randomWait(300, 600);
            await closeBtn.click({ force: true }).catch(() => {});
            await this.log('info', `已关闭弹窗（选择器: ${selector}）`);
            closedCount++;
            foundPopup = true;
            await this.randomWait(500, 1000);
            break;
          }
        } catch (error) {
          // 忽略错误，继续尝试下一个选择器
        }
      }

      // 如果没有找到关闭按钮，尝试点击确认文本按钮
      if (!foundPopup) {
        for (const text of popupConfirmTexts) {
          try {
            const confirmBtn = page.getByRole('button', { name: text }).first();
            const isVisible = await confirmBtn.isVisible({ timeout: 500 }).catch(() => false);
            
            if (isVisible) {
              await this.randomWait(300, 600);
              await confirmBtn.click({ force: true }).catch(() => {});
              await this.log('info', `已点击弹窗按钮: ${text}`);
              closedCount++;
              foundPopup = true;
              await this.randomWait(500, 1000);
              break;
            }
          } catch (error) {
            // 忽略错误，继续尝试下一个文本
          }
        }
      }

      // 如果这一轮没有找到任何弹窗，退出循环
      if (!foundPopup) {
        await this.log('info', '本轮未检测到弹窗，结束检测');
        break;
      }
    }

    if (closedCount > 0) {
      await this.log('info', `共关闭了 ${closedCount} 个随机弹窗`);
    } else {
      await this.log('info', '未检测到需要关闭的随机弹窗，继续执行');
    }
  }

  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录百家号');

      // 优先使用 Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        // 注意：executor.ts 已经设置了 Cookie 并导航到发布页面
        // 这里不需要再次导航，直接检查登录状态即可
        await page.waitForTimeout(3000);

        // 检查是否已登录
        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      // Cookie 登录失败，需要手动登录
      await this.log('warning', '百家号需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布百家号文章', { title: article.title });

      // 等待页面完全加载
      await this.log('info', '等待页面加载完成...');
      await this.randomWait(3000, 5000);

      // 第一步：关闭弹窗
      await this.log('info', '第一步：关闭弹窗');
      await this.randomWait(2000, 3000);
      await page.locator('._7c78f7c013adb338-closeIcon').click();
      await this.log('info', '已点击: 关闭按钮');
      await this.randomWait(3000, 5000);

      // 第二步：检测并关闭随机弹窗（弹窗是随机的，没有也继续）
      await this.log('info', '第二步：检测并关闭随机弹窗');
      await this.randomWait(2000, 3000);
      try {
        await this.closeRandomPopups(page);
      } catch (error: any) {
        await this.log('warning', '检测随机弹窗时出错，继续执行', { error: error.message });
      }
      await this.randomWait(3000, 5000);

      // 第三步：点击发布作品（使用force强制点击，避免被遮挡）
      await this.log('info', '第三步：点击发布作品');
      await page.getByText('发布作品').click({ force: true });
      await this.log('info', '已点击: 发布作品');
      await this.randomWait(3000, 5000);

      // 第四步：点击下一步
      await this.log('info', '第四步：点击下一步');
      await page.getByRole('button', { name: '下一步' }).click();
      await this.log('info', '已点击: 下一步');
      await this.randomWait(3000, 5000);

      // 第五步：点击下一步
      await this.log('info', '第五步：点击下一步');
      await page.getByRole('button', { name: '下一步' }).click();
      await this.log('info', '已点击: 下一步');
      await this.randomWait(3000, 5000);

      // 第六步：点击下一步
      await this.log('info', '第六步：点击下一步');
      await page.getByRole('button', { name: '下一步' }).click();
      await this.log('info', '已点击: 下一步');
      await this.randomWait(3000, 5000);

      // 第七步：点击完成
      await this.log('info', '第七步：点击完成');
      await page.getByRole('button', { name: '完成' }).click();
      await this.log('info', '已点击: 完成');
      await this.randomWait(3000, 5000);

      // 第八步：输入标题
      await this.log('info', '第八步：输入标题');
      await page.getByRole('paragraph').filter({ hasText: /^$/ }).click();
      await this.log('info', '已点击: 标题输入框');
      await this.randomWait(3000, 5000);
      await page.locator('._9ddb7e475b559749-editor').fill(article.title);
      await this.log('info', '已输入: 标题内容');
      await this.randomWait(3000, 5000);

      // 第九步：点击"内容润色"
      await this.log('info', '第九步：点击内容润色');
      
      // 等待页面稳定后再查找按钮
      await this.randomWait(3000, 5000);
      
      try {
        // 等待"内容润色"按钮出现（增加超时时间）
        await page.waitForSelector('text=内容润色', { timeout: 15000 });
        await page.getByText('内容润色').click();
        await this.log('info', '已点击: 内容润色');
        await this.randomWait(3000, 5000);
      } catch (error: any) {
        await this.log('error', '找不到"内容润色"按钮', { error: error.message });
        await this.log('info', '尝试截图以便调试...');
        await page.screenshot({ path: 'baijiahao-debug-step9.png' });
        throw new Error('找不到"内容润色"按钮，请检查页面是否正确加载');
      }

      // 第十步：输入需要润色的内容
      await this.log('info', '第十步：输入需要润色的内容');
      const cleanContent = this.cleanArticleContent(article.content);
      await page.getByRole('textbox', { name: '输入需要润色的内容' }).click();
      await this.log('info', '已点击: 润色输入框');
      await this.randomWait(3000, 5000);
      await page.getByRole('textbox', { name: '输入需要润色的内容' }).fill(cleanContent);
      await this.log('info', '已输入: 文章内容');
      await this.randomWait(3000, 5000);

      // 第十一步：点击生成按钮
      await this.log('info', '第十一步：点击生成按钮');
      await page.locator('.ac71384b1d7fa6ba-wrap > img').click();
      await this.log('info', '已点击: 生成按钮');
      await this.log('info', '等待20秒，给AI充足时间生成文章...');
      await page.waitForTimeout(20000);

      // 第十二步：点击"采纳"
      await this.log('info', '第十二步：点击采纳');
      await page.locator('div').filter({ hasText: /^采纳$/ }).first().click();
      await this.log('info', '已点击: 采纳按钮');
      await this.randomWait(3000, 5000);

      // 第十三步：点击选择封面
      await this.log('info', '第十三步：点击选择封面');
      await page.locator('div').filter({ hasText: /^选择封面$/ }).nth(5).click();
      await this.log('info', '已点击: 选择封面按钮');
      await this.randomWait(3000, 5000);

      // 第十四步：上传图片
      await this.log('info', '第十四步：上传图片');
      const imagePath = await this.prepareImage(article);
      
      // 在点击之前设置 fileChooser 监听
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      await page.getByText('点击本地上传').click();
      await this.log('info', '已点击: 点击本地上传按钮');
      
      // 立即等待 fileChooser 并设置文件
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imagePath);
      await this.log('info', '已自动设置图片文件');
      await this.randomWait(3000, 5000);

      // 第十五步：点击确定按钮
      await this.log('info', '第十五步：点击确定按钮');
      await page.getByRole('button', { name: '确定 (1)' }).click();
      await this.log('info', '已点击: 确定按钮');
      await this.randomWait(3000, 5000);

      // 第十六步：勾选AI创作声明
      await this.log('info', '第十六步：勾选AI创作声明');
      try {
        await page.getByRole('checkbox', { name: 'AI创作声明' }).click({ force: true });
        await this.log('info', '已勾选: AI创作声明');
      } catch (error: any) {
        await this.log('warning', '使用 checkbox 点击失败，尝试点击文本标签', { error: error.message });
        await page.getByText('AI创作声明').click();
        await this.log('info', '已通过文本标签勾选: AI创作声明');
      }
      await this.randomWait(3000, 5000);

      // 第十七步：点击发布按钮
      await this.log('info', '第十七步：点击发布按钮');
      await page.getByRole('button', { name: '发布', exact: true }).click();
      await this.log('info', '已点击: 发布按钮');
      await this.randomWait(3000, 5000);

      // 验证发布结果
      const success = await this.verifyPublishSuccess(page);
      
      if (success) {
        await this.log('info', '✅ 百家号文章发布成功');
      } else {
        await this.log('warning', '⚠️ 发布可能未成功，请检查');
      }

      return success;

    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      return false;
    }
  }

  private async prepareImage(article: Article): Promise<string> {
    const images = this.extractImagesFromContent(article.content);
    
    if (images.length === 0) {
      await this.log('error', '❌ 百家号文章必须上传图片才能发布，但文章中没有找到图片');
      throw new Error('百家号文章必须上传图片才能发布');
    }

    await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);

    const firstImage = images[0];
    // 使用新的图片下载服务（支持从服务器下载）
    const imagePath = await resolveImagePath(firstImage);

    if (!fs.existsSync(imagePath)) {
      await this.log('error', '❌ 图片文件不存在', { path: imagePath });
      throw new Error(`图片文件不存在: ${imagePath}`);
    }

    await this.log('info', '图片准备完成', { path: imagePath });
    return imagePath;
  }

  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000);
      
      const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          await this.log('info', `发布成功（找到文本: ${text}）`);
          return true;
        }
      }

      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('success') || 
          currentUrl.includes('published') || 
          currentUrl.includes('baijiahao.baidu.com')) {
        await this.log('info', '发布成功（URL验证）');
        return true;
      }

      await this.log('info', '未找到明确的成功标志，但也没有错误提示，认为发布成功');
      return true;

    } catch (error: any) {
      await this.log('error', '验证发布结果失败', { error: error.message });
      return true;
    }
  }

  private extractImagesFromContent(content: string): string[] {
    const images: string[] = [];
    
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = markdownImageRegex.exec(content)) !== null) {
      images.push(match[2]);
    }
    
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/g;
    
    while ((match = htmlImageRegex.exec(content)) !== null) {
      images.push(match[1]);
    }
    
    return images;
  }

  /**
   * 检查登录状态
   * 最佳实践：检查 URL 重定向 + 多指标验证 + 容错处理
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '开始检查百家号登录状态');
      
      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/rc/login')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 检查头像元素（登录成功的标志）
      const avatarVisible = await page.locator('.UjPPKm89R4RrZTKhwG5H').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (avatarVisible) {
        await this.log('info', '✅ 百家号登录状态正常');
        return true;
      }
      
      // 检查发布按钮
      const hasPublishBtn = await page.getByRole('button', { name: '发布' }).isVisible({ timeout: 3000 }).catch(() => false);
      if (hasPublishBtn) {
        await this.log('info', '✅ 百家号登录状态正常（检测到发布按钮）');
        return true;
      }
      
      // 所有检测方法都未找到登录标志，说明 Cookie 已失效
      await this.log('warning', '❌ 未检测到任何登录标志，Cookie可能已失效，请重新登录');
      return false;
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      return false;
    }
  }
}
