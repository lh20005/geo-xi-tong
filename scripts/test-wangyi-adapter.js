#!/usr/bin/env node

/**
 * 网易号适配器快速测试脚本
 * 用于验证网易号自动发布功能
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 测试配置
const TEST_CONFIG = {
  headless: false, // 显示浏览器以便观察
  slowMo: 100, // 减慢操作速度
  timeout: 60000, // 超时时间
  loginWaitTime: 60000, // 等待手动登录的时间
};

// 测试文章
const TEST_ARTICLE = {
  title: '提升工作效率的5个实用技巧',
  content: `
在快节奏的现代职场中，提升工作效率是每个人都关心的话题。本文将分享5个简单实用的技巧，帮助你更高效地完成工作。

## 1. 使用番茄工作法

番茄工作法是一种时间管理方法，将工作时间分为25分钟的专注时段，每个时段后休息5分钟。这种方法可以帮助你保持专注，避免疲劳。

## 2. 制定每日任务清单

每天早上花5分钟列出当天要完成的任务，按优先级排序。完成一项就划掉一项，这会给你带来成就感，激励你继续前进。

## 3. 减少干扰

关闭不必要的通知，将手机设置为静音模式。创造一个安静的工作环境，让自己能够全神贯注地工作。

## 4. 学会说"不"

不要接受所有的任务和请求。学会拒绝那些不重要或不紧急的事情，把时间和精力集中在最重要的工作上。

## 5. 定期休息

长时间工作会降低效率。每工作1-2小时就起来活动一下，喝杯水，看看远处，让大脑和身体都得到休息。

![工作效率](uploads/test-image.jpg)

通过实践这些技巧，你会发现工作效率显著提升，工作质量也会更好。记住，效率不是做更多的事，而是做正确的事。
  `.trim()
};

class WangyiAdapterTest {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[level] || 'ℹ️';
    
    console.log(`[${timestamp}] ${emoji} ${message}`);
    if (Object.keys(data).length > 0) {
      console.log('   ', JSON.stringify(data, null, 2));
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async randomWait(minMs, maxMs) {
    const waitTime = minMs + Math.random() * (maxMs - minMs);
    await this.wait(waitTime);
  }

  async humanClick(locator, description = '') {
    await this.randomWait(3000, 5000);
    await locator.click();
    if (description) {
      this.log('info', `已点击: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  async humanType(locator, text, description = '') {
    await this.randomWait(3000, 5000);
    await locator.fill(text);
    if (description) {
      this.log('info', `已输入: ${description}`);
    }
    await this.randomWait(3000, 5000);
  }

  cleanContent(content) {
    return content
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')
      .replace(/<img[^>]*>/g, '')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
  }

  extractImages(content) {
    const images = [];
    const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = markdownRegex.exec(content)) !== null) {
      images.push(match[2]);
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

  async prepareTestImage() {
    // 创建测试图片目录
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      this.log('info', '创建 uploads 目录');
    }

    // 检查是否有测试图片
    const testImagePath = path.join(uploadsDir, 'test-image.jpg');
    
    if (!fs.existsSync(testImagePath)) {
      this.log('warning', '测试图片不存在，请手动添加图片到: ' + testImagePath);
      this.log('info', '你可以使用任何 JPG 或 PNG 图片，建议尺寸 1200x630');
      throw new Error('测试图片不存在');
    }

    this.log('success', '找到测试图片: ' + testImagePath);
    return testImagePath;
  }

  async checkLoginStatus() {
    const currentUrl = this.page.url();
    
    if (currentUrl.includes('/login')) {
      this.log('warning', '检测到登录页面，需要手动登录');
      return false;
    }

    const hasUserArea = await this.page.locator('.topBar__user')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    
    if (hasUserArea) {
      this.log('success', '已登录（检测到用户区域）');
      return true;
    }

    const hasPublishBtn = await this.page.getByRole('button', { name: '发布' })
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    
    if (hasPublishBtn) {
      this.log('success', '已登录（检测到发布按钮）');
      return true;
    }

    this.log('info', '未检测到登录页面，假设已登录');
    return true;
  }

  async performPublish() {
    this.log('info', '========================================');
    this.log('info', '开始发布流程');
    this.log('info', '========================================');

    // 第一步：点击发布按钮
    this.log('info', '第一步：点击发布按钮');
    await this.humanClick(
      this.page.getByRole('button', { name: '发布' }),
      '发布按钮'
    );

    // 第二步：输入标题
    this.log('info', '第二步：输入标题');
    const titleInput = this.page.getByRole('textbox', { name: '请输入标题' });
    await this.humanClick(titleInput, '标题输入框');
    await this.humanType(titleInput, TEST_ARTICLE.title, '标题内容');

    // 第三步：输入正文
    this.log('info', '第三步：输入正文');
    const cleanContent = this.cleanContent(TEST_ARTICLE.content);
    const contentEditor = this.page.locator('.ProseMirror');
    await this.humanClick(contentEditor, '正文编辑器');
    await this.humanType(contentEditor, cleanContent, '正文内容');

    // 第四步：上传封面图片
    this.log('info', '第四步：上传封面图片');
    const imagePath = await this.prepareTestImage();
    
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.randomWait(3000, 5000);
    await this.page.getByRole('button', { name: '上传封面' }).click();
    this.log('info', '已点击: 上传封面按钮');
    
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imagePath);
    this.log('info', '已设置图片文件');
    await this.randomWait(3000, 5000);

    // 第五步：点击发布按钮
    this.log('info', '第五步：点击最终发布按钮');
    await this.humanClick(
      this.page.getByRole('button', { name: '发布', exact: true }),
      '发布按钮'
    );

    // 验证发布结果
    await this.verifyPublish();
  }

  async verifyPublish() {
    this.log('info', '等待发布结果...');
    await this.wait(3000);
    
    const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
    
    for (const text of successTexts) {
      const hasText = await this.page.getByText(text)
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      
      if (hasText) {
        this.log('success', `发布成功！（找到文本: ${text}）`);
        return true;
      }
    }

    const currentUrl = this.page.url();
    this.log('info', `当前 URL: ${currentUrl}`);
    
    if (currentUrl.includes('success') || 
        currentUrl.includes('published') || 
        currentUrl.includes('mp.163.com')) {
      this.log('success', '发布成功！（URL 验证）');
      return true;
    }

    this.log('warning', '无法确认发布状态，请手动检查');
    return false;
  }

  async run() {
    try {
      console.log('\n');
      this.log('info', '========================================');
      this.log('info', '网易号适配器测试');
      this.log('info', '========================================');
      console.log('\n');

      // 启动浏览器
      this.log('info', '启动浏览器...');
      this.browser = await chromium.launch({
        headless: TEST_CONFIG.headless,
        slowMo: TEST_CONFIG.slowMo
      });

      const context = await this.browser.newContext();
      this.page = await context.newPage();

      // 导航到发布页面
      this.log('info', '导航到网易号发布页面...');
      await this.page.goto('https://mp.163.com/subscribe_v4/index.html#/', { 
        waitUntil: 'networkidle',
        timeout: TEST_CONFIG.timeout
      });
      await this.wait(3000);

      // 检查登录状态
      this.log('info', '检查登录状态...');
      const isLoggedIn = await this.checkLoginStatus();
      
      if (!isLoggedIn) {
        this.log('warning', '需要手动登录');
        this.log('info', `等待 ${TEST_CONFIG.loginWaitTime / 1000} 秒供手动登录...`);
        await this.wait(TEST_CONFIG.loginWaitTime);
        
        // 再次检查登录状态
        const isLoggedInNow = await this.checkLoginStatus();
        if (!isLoggedInNow) {
          throw new Error('登录超时，请重新运行测试');
        }
      }

      // 执行发布
      await this.performPublish();

      // 等待观察结果
      this.log('info', '等待 10 秒以便观察结果...');
      await this.wait(10000);

      console.log('\n');
      this.log('success', '========================================');
      this.log('success', '测试完成！');
      this.log('success', '========================================');
      console.log('\n');

    } catch (error) {
      console.log('\n');
      this.log('error', '测试失败');
      this.log('error', error.message);
      console.error(error);
      console.log('\n');
    } finally {
      if (this.browser) {
        this.log('info', '关闭浏览器...');
        await this.browser.close();
      }
    }
  }
}

// 运行测试
(async () => {
  const test = new WangyiAdapterTest();
  await test.run();
})();
