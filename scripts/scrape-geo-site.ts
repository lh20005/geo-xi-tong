import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function scrapeGeoSite() {
  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 访问登录页面
    console.log('访问登录页面...');
    await page.goto('https://geo.leismedia.com/user/index/login?url=%2Fuser', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 截图查看当前页面
    await page.screenshot({ path: 'temp/login-page.png', fullPage: true });
    console.log('登录页面截图已保存到 temp/login-page.png');

    // 获取页面 HTML 查看表单结构
    const html = await page.content();
    fs.writeFileSync('temp/login-page.html', html);
    console.log('登录页面 HTML 已保存到 temp/login-page.html');

    // 尝试填写登录表单
    console.log('尝试登录...');
    
    // 查找并填写用户名
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="account"]',
      'input[name="phone"]',
      'input[name="mobile"]',
      'input[type="text"]',
      '#username',
      '#account'
    ];

    let usernameInput = null;
    for (const selector of usernameSelectors) {
      const el = await page.$(selector);
      if (el) {
        usernameInput = el;
        console.log(`找到用户名输入框: ${selector}`);
        await el.fill('18645078383');
        break;
      }
    }

    // 查找并填写密码
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      '#password'
    ];

    let passwordInput = null;
    for (const selector of passwordSelectors) {
      const el = await page.$(selector);
      if (el) {
        passwordInput = el;
        console.log(`找到密码输入框: ${selector}`);
        await el.fill('18645078383');
        break;
      }
    }

    await page.waitForTimeout(1000);

    // 查找并点击登录按钮
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("登录")',
      'button:has-text("登 录")',
      '.login-btn',
      '.submit-btn'
    ];

    for (const selector of submitSelectors) {
      const el = await page.$(selector);
      if (el) {
        console.log(`找到登录按钮: ${selector}`);
        await el.click();
        break;
      }
    }

    // 等待登录完成
    console.log('等待登录完成...');
    await page.waitForTimeout(5000);

    // 截图登录后的页面
    await page.screenshot({ path: 'temp/after-login.png', fullPage: true });
    console.log('登录后截图已保存到 temp/after-login.png');

    // 获取当前 URL
    const currentUrl = page.url();
    console.log(`当前页面 URL: ${currentUrl}`);

    // 保存登录后的页面内容
    const afterLoginHtml = await page.content();
    fs.writeFileSync('temp/after-login.html', afterLoginHtml);
    console.log('登录后页面 HTML 已保存到 temp/after-login.html');

    // 保持浏览器打开一段时间以便查看
    console.log('浏览器将保持打开 30 秒...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('发生错误:', error);
    await page.screenshot({ path: 'temp/error-page.png', fullPage: true });
  } finally {
    await browser.close();
    console.log('浏览器已关闭');
  }
}

// 确保 temp 目录存在
if (!fs.existsSync('temp')) {
  fs.mkdirSync('temp', { recursive: true });
}

scrapeGeoSite();
