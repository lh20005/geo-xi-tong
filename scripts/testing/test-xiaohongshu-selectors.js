#!/usr/bin/env node

/**
 * 小红书用户名选择器测试脚本
 * 用于诊断为什么无法提取用户名
 */

const puppeteer = require('puppeteer');

async function testXiaohongshuSelectors() {
  console.log('========================================');
  console.log('小红书用户名选择器测试');
  console.log('========================================\n');

  let browser = null;
  
  try {
    // 启动浏览器
    console.log('1. 启动浏览器...');
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox'
      ]
    });

    const page = await browser.newPage();
    
    // 设置User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('2. 导航到小红书创作者中心登录页...');
    await page.goto('https://creator.xiaohongshu.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('\n⏸️  请在浏览器中手动登录小红书...');
    console.log('登录成功后，按回车键继续...\n');
    
    // 等待用户按回车
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    console.log('\n3. 检查当前URL...');
    const currentUrl = page.url();
    console.log(`当前URL: ${currentUrl}`);
    
    // 导航到创作者中心主页
    console.log('\n4. 导航到创作者中心新版主页...');
    await page.goto('https://creator.xiaohongshu.com/new/home', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('等待3秒让页面完全加载...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`\n当前URL: ${page.url()}`);
    console.log(`页面标题: ${await page.title()}`);
    
    // 测试精准选择器
    console.log('\n5. 测试精准用户名选择器...\n');
    
    const preciseSelector = '#header-area > div > div > div:nth-child(2) > div > span';
    
    console.log(`测试选择器: ${preciseSelector}`);
    
    try {
      const element = await page.$(preciseSelector);
      
      if (element) {
        const text = await page.evaluate(el => el.textContent?.trim(), element);
        const className = await page.evaluate(el => el.className, element);
        const tagName = await page.evaluate(el => el.tagName, element);
        
        console.log(`  ✅ 找到元素`);
        console.log(`  标签: ${tagName}`);
        console.log(`  类名: ${className}`);
        console.log(`  文本: "${text}"`);
        
        if (text && text.length > 0) {
          console.log(`\n  🎯 成功提取用户名: "${text}"`);
          foundUsername = true;
        } else {
          console.log(`\n  ⚠️  元素存在但内容为空`);
        }
      } else {
        console.log(`  ❌ 未找到元素`);
      }
    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);
    }
    
    // 保存页面HTML用于分析
    console.log('\n6. 保存页面HTML...');
    const fs = require('fs');
    const path = require('path');
    
    const debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const html = await page.content();
    const filename = `xiaohongshu_${Date.now()}.html`;
    const filepath = path.join(debugDir, filename);
    fs.writeFileSync(filepath, html);
    console.log(`已保存页面HTML: ${filepath}`);
    
    // 尝试获取所有可能包含用户名的元素
    console.log('\n7. 搜索所有可能的用户名元素...\n');
    
    const possibleElements = await page.evaluate(() => {
      const results = [];
      
      // 搜索所有包含特定关键词的class
      const keywords = ['user', 'name', 'nick', 'author', 'profile', 'account'];
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(el => {
        const className = el.className;
        if (typeof className === 'string') {
          const hasKeyword = keywords.some(keyword => 
            className.toLowerCase().includes(keyword)
          );
          
          if (hasKeyword) {
            const text = el.textContent?.trim();
            if (text && text.length > 0 && text.length < 50) {
              results.push({
                tag: el.tagName,
                class: className,
                text: text.substring(0, 50)
              });
            }
          }
        }
      });
      
      return results.slice(0, 20); // 只返回前20个
    });
    
    console.log('找到的可能元素:');
    possibleElements.forEach((el, i) => {
      console.log(`\n${i + 1}. <${el.tag}> class="${el.class}"`);
      console.log(`   文本: "${el.text}"`);
    });
    
    console.log('\n========================================');
    if (foundUsername) {
      console.log('✅ 测试完成：找到了可能的用户名');
    } else {
      console.log('⚠️  测试完成：未找到明确的用户名');
      console.log('请检查保存的HTML文件，手动查找用户名元素');
    }
    console.log('========================================\n');
    
    console.log('按回车键关闭浏览器...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 运行测试
testXiaohongshuSelectors().catch(console.error);
