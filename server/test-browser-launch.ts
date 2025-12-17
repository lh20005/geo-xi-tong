// 测试浏览器启动
import puppeteer from 'puppeteer';

async function testBrowserLaunch() {
  console.log('开始测试浏览器启动...');
  
  try {
    // 尝试使用系统Chrome
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    console.log(`尝试启动Chrome: ${chromePath}`);
    
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    console.log('✅ 浏览器启动成功！');
    
    const page = await browser.newPage();
    await page.goto('https://www.baidu.com');
    
    console.log('✅ 页面加载成功！');
    
    // 等待3秒后关闭
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await browser.close();
    console.log('✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testBrowserLaunch();
