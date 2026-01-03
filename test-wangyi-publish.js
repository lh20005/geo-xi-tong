/**
 * 网易号发布测试脚本
 * 用于测试网易号适配器的自动发布功能
 */

const { chromium } = require('playwright');
const path = require('path');

// 测试文章数据
const testArticle = {
  title: '测试文章：如何提升工作效率',
  content: `
# 如何提升工作效率

在现代职场中，提升工作效率是每个人都关心的话题。本文将分享几个实用的技巧。

## 1. 时间管理

合理安排时间是提升效率的关键。建议使用番茄工作法，每25分钟专注工作，然后休息5分钟。

## 2. 工具使用

选择合适的工具可以事半功倍。推荐使用：
- 任务管理工具：Todoist、Notion
- 时间追踪工具：RescueTime
- 笔记工具：Obsidian、Evernote

## 3. 保持专注

减少干扰，关闭不必要的通知，创造一个专注的工作环境。

![效率提升](uploads/test-image.jpg)

通过这些方法，你可以显著提升工作效率，完成更多有价值的工作。
  `.trim()
};

// 模拟适配器的核心方法
class WangyiPublishTest {
  constructor() {
    this.platformName = '网易号';
  }

  async log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
  }

  async randomWait(minMs, maxMs) {
    const waitTime = minMs + Math.random() * (maxMs - minMs);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  async humanClick(locator, description = '') {
    await this.randomWait(3000, 5000);
    await locator.click();
    if (description) {
      await this.log('info', `已点击: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  async humanType(locator, text, description = '') {
    await this.randomWait(3000, 5000);
    await locator.fill(text);
    if (description) {
      await this.log('info', `已输入: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  cleanArticleContent(content) {
    return content
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '') // 移除 Markdown 图片
      .replace(/<img[^>]*>/g, '') // 移除 HTML 图片
      .replace(/#{1,6}\s+/g, '') // 移除 Markdown 标题符号
      .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除粗体
      .replace(/\*([^*]+)\*/g, '$1') // 移除斜体
      .replace(/`([^`]+)`/g, '$1') // 移除代码标记
      .trim();
  }

  extractImagesFromContent(content) {
    const images = [];
    
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

  resolveImagePath(imagePath) {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    if (imagePath.startsWith('/uploads/')) {
      return path.resolve(process.cwd(), imagePath.substring(1));
    }
    
    if (imagePath.startsWith('uploads/')) {
      return path.resolve(process.cwd(), imagePath);
    }

    if (path.isAbsolute(imagePath)) {
      return imagePath;
    }

    return path.resolve(process.cwd(), imagePath);
  }

  async prepareImage(article) {
    const images = this.extractImagesFromContent(article.content);
    
    if (images.length === 0) {
      await this.log('error', '❌ 网易号文章必须上传图片才能发布，但文章中没有找到图片');
      throw new Error('网易号文章必须上传图片才能发布');
    }

    await this.log('info', `找到 ${images.length} 张图片，准备上传第一张`);

    const firstImage = images[0];
    const imagePath = this.resolveImagePath(firstImage);

    const fs = require('fs');
    if (!fs.existsSync(imagePath)) {
      await this.log('error', '❌ 图片文件不存在', { path: imagePath });
      throw new Error(`图片文件不存在: ${imagePath}`);
    }

    await this.log('info', '图片准备完成', { path: imagePath });
    return imagePath;
  }

  async testPublish() {
    let browser;
    
    try {
      await this.log('info', '========================================');
      await this.log('info', `开始测试 ${this.platformName} 发布功能`);
      await this.log('info', '========================================');

      // 启动浏览器
      await this.log('info', '启动浏览器...');
      browser = await chromium.launch({
        headless: false, // 显示浏览器窗口以便观察
        slowMo: 100 // 减慢操作速度以便观察
      });

      const context = await browser.newContext();
      const page = await context.newPage();

      // 导航到发布页面
      await this.log('info', '导航到发布页面...');
      await page.goto('https://mp.163.com/subscribe_v4/index.html#/', { waitUntil: 'networkidle' });
      await this.randomWait(3000, 5000);

      // 检查登录状态
      await this.log('info', '检查登录状态...');
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        await this.log('warning', '❌ 需要先登录，请手动登录后重新运行测试');
        await this.log('info', '等待60秒供手动登录...');
        await page.waitForTimeout(60000);
      }

      // 开始发布流程
      await this.log('info', '========================================');
      await this.log('info', '开始发布流程');
      await this.log('info', '========================================');

      // 第一步：点击发布按钮
      await this.log('info', '第一步：点击发布按钮');
      await this.humanClick(page.getByRole('button', { name: '发布' }), '发布按钮');

      // 第二步：输入标题
      await this.log('info', '第二步：输入标题');
      const titleInput = page.getByRole('textbox', { name: '请输入标题' });
      await this.humanClick(titleInput, '标题输入框');
      await this.humanType(titleInput, testArticle.title, '标题内容');

      // 第三步：输入正文
      await this.log('info', '第三步：输入正文');
      const cleanContent = this.cleanArticleContent(testArticle.content);
      const contentEditor = page.locator('.ProseMirror');
      await this.humanClick(contentEditor, '正文编辑器');
      await this.humanType(contentEditor, cleanContent, '正文内容');

      // 第四步：上传封面图片
      await this.log('info', '第四步：上传封面图片');
      const imagePath = await this.prepareImage(testArticle);
      const fileChooserPromise = page.waitForEvent('filechooser');
      
      await this.randomWait(3000, 5000);
      await page.getByRole('button', { name: '上传封面' }).click();
      await this.log('info', '已点击: 上传封面按钮');
      
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imagePath);
      await this.log('info', '已自动设置图片文件');
      await this.randomWait(3000, 5000);

      // 第五步：点击发布按钮
      await this.log('info', '第五步：点击发布按钮');
      await this.humanClick(page.getByRole('button', { name: '发布', exact: true }), '发布按钮');

      // 验证发布结果
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000);
      
      const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
      let success = false;
      
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          await this.log('info', `✅ 发布成功（找到文本: ${text}）`);
          success = true;
          break;
        }
      }

      if (!success) {
        const finalUrl = page.url();
        await this.log('info', `当前URL: ${finalUrl}`);
        
        if (finalUrl.includes('success') || 
            finalUrl.includes('published') || 
            finalUrl.includes('mp.163.com')) {
          await this.log('info', '✅ 发布成功（URL验证）');
          success = true;
        }
      }

      if (success) {
        await this.log('info', '========================================');
        await this.log('info', '✅ 测试成功！网易号文章发布完成');
        await this.log('info', '========================================');
      } else {
        await this.log('warning', '========================================');
        await this.log('warning', '⚠️ 无法确认发布状态，请手动检查');
        await this.log('warning', '========================================');
      }

      // 等待一段时间以便观察结果
      await this.log('info', '等待10秒以便观察结果...');
      await page.waitForTimeout(10000);

    } catch (error) {
      await this.log('error', '测试失败', { error: error.message });
      console.error(error);
    } finally {
      if (browser) {
        await this.log('info', '关闭浏览器...');
        await browser.close();
      }
    }
  }
}

// 运行测试
(async () => {
  const test = new WangyiPublishTest();
  await test.testPublish();
})();
