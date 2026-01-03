#!/usr/bin/env node

/**
 * 网易号逐步调试脚本
 * 每一步都截图，帮助找到问题
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function debugStepByStep() {
  let browser;
  
  try {
    console.log('🚀 启动浏览器...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 500
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // 创建截图目录
    const screenshotDir = 'wangyi-debug-screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }

    console.log('📄 导航到网易号发布页面...');
    await page.goto('https://mp.163.com/subscribe_v4/index.html#/', { 
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.screenshot({ path: `${screenshotDir}/step-0-initial.png` });
    console.log('✅ 截图: step-0-initial.png');

    console.log('\n⏳ 等待 10 秒，请手动登录（如需要）...\n');
    await page.waitForTimeout(10000);

    await page.screenshot({ path: `${screenshotDir}/step-0-after-login.png` });
    console.log('✅ 截图: step-0-after-login.png');

    // 第一步：点击按钮
    console.log('\n第一步：点击按钮');
    await page.waitForTimeout(3000);
    
    // 查找所有按钮
    const buttons = await page.locator('button').all();
    console.log(`找到 ${buttons.length} 个按钮`);
    
    if (buttons.length > 0) {
      await buttons[0].click();
      console.log('✅ 已点击第一个按钮');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${screenshotDir}/step-1-clicked-button.png` });
    }

    // 第二步：点击"文章"
    console.log('\n第二步：点击"文章"');
    await page.getByText('文章').click();
    console.log('✅ 已点击: 文章');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshotDir}/step-2-clicked-article.png` });

    // 第三步：输入标题
    console.log('\n第三步：输入标题');
    await page.getByRole('textbox', { name: '请输入标题 (5~30个字)' }).click();
    console.log('✅ 已点击: 标题输入框');
    await page.waitForTimeout(2000);
    await page.getByRole('textbox', { name: '请输入标题 (5~30个字)' }).fill('测试标题：网易号自动发布');
    console.log('✅ 已输入: 标题');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshotDir}/step-3-filled-title.png` });

    // 第四步：输入正文
    console.log('\n第四步：输入正文');
    await page.locator('.public-DraftStyleDefault-block').click();
    console.log('✅ 已点击: 正文编辑器');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: '请输入正文' }).getByRole('textbox').fill('这是测试正文内容。网易号自动发布功能测试。');
    console.log('✅ 已输入: 正文');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshotDir}/step-4-filled-content.png` });

    // 第五步：查找图片按钮
    console.log('\n第五步：查找图片按钮');
    console.log('尝试方法1: getByRole("button", { name: "图片" })');
    
    try {
      const imageBtn1 = page.getByRole('button', { name: '图片' });
      const isVisible1 = await imageBtn1.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`方法1结果: ${isVisible1 ? '找到' : '未找到'}`);
      
      if (isVisible1) {
        await imageBtn1.click();
        console.log('✅ 已点击: 图片按钮（方法1）');
      }
    } catch (e) {
      console.log('方法1失败:', e.message);
    }

    await page.screenshot({ path: `${screenshotDir}/step-5-before-image-button.png` });

    console.log('\n尝试方法2: getByText("图片")');
    try {
      const imageBtn2 = page.getByText('图片', { exact: true });
      const isVisible2 = await imageBtn2.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`方法2结果: ${isVisible2 ? '找到' : '未找到'}`);
      
      if (isVisible2) {
        await imageBtn2.click();
        console.log('✅ 已点击: 图片按钮（方法2）');
      }
    } catch (e) {
      console.log('方法2失败:', e.message);
    }

    console.log('\n尝试方法3: locator("button:has-text(\\"图片\\")")');
    try {
      const imageBtn3 = page.locator('button:has-text("图片")');
      const count = await imageBtn3.count();
      console.log(`方法3结果: 找到 ${count} 个匹配元素`);
      
      if (count > 0) {
        await imageBtn3.first().click();
        console.log('✅ 已点击: 图片按钮（方法3）');
      }
    } catch (e) {
      console.log('方法3失败:', e.message);
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshotDir}/step-5-after-image-button.png` });

    // 列出所有可见的按钮文本
    console.log('\n📋 列出页面上所有按钮:');
    const allButtons = await page.locator('button').all();
    for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
      const text = await allButtons[i].textContent().catch(() => '');
      const isVisible = await allButtons[i].isVisible().catch(() => false);
      if (isVisible && text.trim()) {
        console.log(`  [${i}] "${text.trim()}"`);
      }
    }

    console.log('\n✅ 调试完成！');
    console.log(`📁 截图保存在: ${screenshotDir}/`);
    console.log('\n⏳ 等待 30 秒供你检查...\n');
    await page.waitForTimeout(30000);

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
debugStepByStep();
