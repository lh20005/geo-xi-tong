#!/usr/bin/env node

/**
 * 网易号选择器调试脚本
 * 用于查找和验证网易号页面的正确选择器
 */

const { chromium } = require('playwright');

async function debugSelectors() {
  let browser;
  
  try {
    console.log('🔍 启动浏览器...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 500
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('📄 导航到网易号发布页面...');
    await page.goto('https://mp.163.com/subscribe_v4/index.html#/', { 
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('\n⏳ 等待 10 秒，请手动登录（如需要）...\n');
    await page.waitForTimeout(10000);

    console.log('🔍 开始检测页面元素...\n');
    console.log('=' .repeat(60));

    // 检测发布按钮
    console.log('\n1️⃣ 检测发布按钮:');
    const publishBtnSelectors = [
      'button:has-text("发布")',
      '[class*="publish"]',
      '[class*="btn"]',
      'button',
    ];

    for (const selector of publishBtnSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`   ✅ ${selector} - 找到 ${elements.length} 个元素`);
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const text = await elements[i].textContent().catch(() => '');
            const classes = await elements[i].getAttribute('class').catch(() => '');
            console.log(`      [${i}] 文本: "${text.trim()}" | 类名: ${classes}`);
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }

    // 检测标题输入框
    console.log('\n2️⃣ 检测标题输入框:');
    const titleSelectors = [
      'input[placeholder*="标题"]',
      'input[placeholder*="请输入"]',
      'input[type="text"]',
      '.title-input',
      '[class*="title"]',
    ];

    for (const selector of titleSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`   ✅ ${selector} - 找到 ${elements.length} 个元素`);
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const placeholder = await elements[i].getAttribute('placeholder').catch(() => '');
            const classes = await elements[i].getAttribute('class').catch(() => '');
            console.log(`      [${i}] placeholder: "${placeholder}" | 类名: ${classes}`);
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }

    // 检测正文编辑器
    console.log('\n3️⃣ 检测正文编辑器:');
    const editorSelectors = [
      '.ProseMirror',
      '[contenteditable="true"]',
      '.editor',
      '[class*="editor"]',
      '[class*="content"]',
      'textarea',
    ];

    for (const selector of editorSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`   ✅ ${selector} - 找到 ${elements.length} 个元素`);
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const classes = await elements[i].getAttribute('class').catch(() => '');
            const editable = await elements[i].getAttribute('contenteditable').catch(() => '');
            console.log(`      [${i}] 类名: ${classes} | contenteditable: ${editable}`);
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }

    // 检测上传按钮
    console.log('\n4️⃣ 检测上传按钮:');
    const uploadSelectors = [
      'button:has-text("上传")',
      'button:has-text("封面")',
      '[class*="upload"]',
      'input[type="file"]',
    ];

    for (const selector of uploadSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`   ✅ ${selector} - 找到 ${elements.length} 个元素`);
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const text = await elements[i].textContent().catch(() => '');
            const classes = await elements[i].getAttribute('class').catch(() => '');
            console.log(`      [${i}] 文本: "${text.trim()}" | 类名: ${classes}`);
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }

    // 检测用户区域（登录状态）
    console.log('\n5️⃣ 检测用户区域（登录状态）:');
    const userSelectors = [
      '.topBar__user',
      '.user-info',
      '.user-name',
      '[class*="user"]',
      '[class*="avatar"]',
    ];

    for (const selector of userSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`   ✅ ${selector} - 找到 ${elements.length} 个元素`);
          for (let i = 0; i < Math.min(elements.length, 2); i++) {
            const text = await elements[i].textContent().catch(() => '');
            const classes = await elements[i].getAttribute('class').catch(() => '');
            console.log(`      [${i}] 文本: "${text.trim()}" | 类名: ${classes}`);
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 提示：');
    console.log('   1. 查看上面的输出，找到正确的选择器');
    console.log('   2. 注意元素的文本内容和类名');
    console.log('   3. 选择最稳定、最具体的选择器');
    console.log('\n⏳ 等待 30 秒供你检查页面...\n');
    
    await page.waitForTimeout(30000);

    // 尝试截图
    console.log('📸 保存页面截图...');
    await page.screenshot({ 
      path: 'wangyi-debug-screenshot.png',
      fullPage: true 
    });
    console.log('✅ 截图已保存到: wangyi-debug-screenshot.png');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error);
  } finally {
    if (browser) {
      console.log('\n🔒 关闭浏览器...');
      await browser.close();
    }
  }
}

// 运行调试
debugSelectors();
