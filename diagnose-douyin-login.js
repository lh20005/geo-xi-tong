/**
 * 抖音登录诊断脚本
 * 用于检查登录后的URL和Cookie
 */

const puppeteer = require('puppeteer');

async function diagnoseDouyinLogin() {
  console.log('====================================');
  console.log('抖音登录诊断工具');
  console.log('====================================\n');
  
  let browser = null;
  
  try {
    // 查找Chrome路径
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    let executablePath;
    const fs = require('fs');
    
    for (const path of chromePaths) {
      if (fs.existsSync(path)) {
        executablePath = path;
        console.log(`✅ 找到Chrome: ${path}\n`);
        break;
      }
    }
    
    // 启动浏览器
    console.log('启动浏览器...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized'
      ]
    });
    
    const page = await browser.newPage();
    
    // 打开抖音创作者中心
    console.log('打开抖音创作者中心...');
    await page.goto('https://creator.douyin.com/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('\n====================================');
    console.log('请在浏览器中完成登录');
    console.log('====================================\n');
    console.log('登录后，此脚本将每5秒检测一次URL和Cookie');
    console.log('按 Ctrl+C 停止检测\n');
    
    // 持续检测
    let checkCount = 0;
    const checkInterval = setInterval(async () => {
      checkCount++;
      
      const url = page.url();
      const cookies = await page.cookies();
      const cookieString = await page.evaluate(() => document.cookie);
      
      console.log(`\n[检测 #${checkCount}] ${new Date().toLocaleTimeString()}`);
      console.log('─'.repeat(60));
      console.log(`当前URL: ${url}`);
      console.log(`\nURL特征检查:`);
      console.log(`  • 包含 /home: ${url.includes('/home')}`);
      console.log(`  • 包含 /content: ${url.includes('/content')}`);
      console.log(`  • 包含 /creator-micro: ${url.includes('/creator-micro')}`);
      
      console.log(`\nCookie数量: ${cookies.length}`);
      console.log(`Cookie字符串长度: ${cookieString.length}`);
      
      console.log(`\n关键Cookie检查:`);
      const hasSessionId = cookieString.includes('sessionid');
      const hasPassportAuth = cookieString.includes('passport_auth_status');
      const hasSidGuard = cookieString.includes('sid_guard');
      
      console.log(`  • sessionid: ${hasSessionId ? '✅ 存在' : '❌ 不存在'}`);
      console.log(`  • passport_auth_status: ${hasPassportAuth ? '✅ 存在' : '❌ 不存在'}`);
      console.log(`  • sid_guard: ${hasSidGuard ? '✅ 存在' : '❌ 不存在'}`);
      
      // 显示所有Cookie名称
      if (cookies.length > 0) {
        console.log(`\n所有Cookie名称:`);
        cookies.forEach(cookie => {
          console.log(`  • ${cookie.name}`);
        });
      }
      
      // 检查是否满足登录条件
      const hasValidPath = url.includes('/home') || 
                          url.includes('/content') || 
                          url.includes('/creator-micro');
      const hasSessionCookie = hasSessionId || hasPassportAuth || hasSidGuard;
      
      console.log(`\n登录条件检查:`);
      console.log(`  • 有效路径: ${hasValidPath ? '✅ 满足' : '❌ 不满足'}`);
      console.log(`  • 登录Cookie: ${hasSessionCookie ? '✅ 满足' : '❌ 不满足'}`);
      console.log(`  • 总体判断: ${hasValidPath && hasSessionCookie ? '✅ 已登录' : '❌ 未登录'}`);
      
      if (hasValidPath && hasSessionCookie) {
        console.log('\n🎉 检测到登录成功！');
        console.log('\n建议的Cookie名称（用于配置）:');
        cookies.forEach(cookie => {
          if (cookie.name.toLowerCase().includes('session') ||
              cookie.name.toLowerCase().includes('auth') ||
              cookie.name.toLowerCase().includes('sid') ||
              cookie.name.toLowerCase().includes('token')) {
            console.log(`  • ${cookie.name}`);
          }
        });
      }
      
    }, 5000);
    
    // 等待用户手动关闭
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
  }
}

diagnoseDouyinLogin();
