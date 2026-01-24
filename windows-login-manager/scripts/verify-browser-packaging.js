/**
 * 打包后浏览器验证脚本
 * 验证各平台打包文件中是否正确包含对应的浏览器
 * 
 * 使用方法: node scripts/verify-browser-packaging.js
 */

const fs = require('fs');
const path = require('path');

const RELEASE_DIR = path.join(__dirname, '..', 'release');

// 各平台的浏览器路径配置
const PLATFORM_CONFIGS = {
  'Windows x64': {
    appPath: 'win-unpacked/resources/playwright-browsers/chromium-1200',
    expectedBrowser: 'chrome-win64',
    executableCheck: 'chrome-win64/chrome.exe'
  },
  'macOS Intel': {
    appPath: 'mac/Ai智软精准GEO优化系统.app/Contents/Resources/playwright-browsers/chromium-1200',
    expectedBrowser: 'chrome-mac-x64',
    executableCheck: 'chrome-mac-x64/Google Chrome for Testing.app'
  },
  'macOS ARM': {
    appPath: 'mac-arm64/Ai智软精准GEO优化系统.app/Contents/Resources/playwright-browsers/chromium-1200',
    expectedBrowser: 'chrome-mac-arm64',
    executableCheck: 'chrome-mac-arm64/Google Chrome for Testing.app'
  }
};

// 错误的浏览器（用于检测打包错误）
const WRONG_BROWSERS = {
  'Windows x64': ['chrome-mac-x64', 'chrome-mac-arm64'],
  'macOS Intel': ['chrome-win64', 'chrome-mac-arm64'],
  'macOS ARM': ['chrome-win64', 'chrome-mac-x64']
};

function verifyPlatform(platformName, config) {
  const browserDir = path.join(RELEASE_DIR, config.appPath);
  const result = {
    platform: platformName,
    exists: false,
    hasCorrectBrowser: false,
    hasWrongBrowser: false,
    wrongBrowserFound: null,
    executableExists: false,
    error: null
  };

  // 检查目录是否存在
  if (!fs.existsSync(browserDir)) {
    result.error = `浏览器目录不存在: ${browserDir}`;
    return result;
  }
  result.exists = true;

  // 获取目录内容
  const contents = fs.readdirSync(browserDir);
  
  // 检查是否有正确的浏览器
  result.hasCorrectBrowser = contents.includes(config.expectedBrowser);
  
  // 检查是否有错误的浏览器
  const wrongBrowsers = WRONG_BROWSERS[platformName];
  for (const wrongBrowser of wrongBrowsers) {
    if (contents.includes(wrongBrowser)) {
      result.hasWrongBrowser = true;
      result.wrongBrowserFound = wrongBrowser;
      break;
    }
  }

  // 检查可执行文件是否存在
  const executablePath = path.join(browserDir, config.executableCheck);
  result.executableExists = fs.existsSync(executablePath);

  return result;
}

function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 打包后浏览器验证');
  console.log('='.repeat(60) + '\n');

  let allPassed = true;
  const results = [];

  for (const [platformName, config] of Object.entries(PLATFORM_CONFIGS)) {
    const result = verifyPlatform(platformName, config);
    results.push(result);

    console.log(`📦 ${platformName}:`);
    
    if (result.error) {
      console.log(`   ⚠️  ${result.error}`);
      console.log(`   ⏭️  跳过（可能未打包此平台）\n`);
      continue;
    }

    // 检查正确的浏览器
    if (result.hasCorrectBrowser) {
      console.log(`   ✅ 包含正确的浏览器: ${config.expectedBrowser}`);
    } else {
      console.log(`   ❌ 缺少正确的浏览器: ${config.expectedBrowser}`);
      allPassed = false;
    }

    // 检查是否有错误的浏览器
    if (result.hasWrongBrowser) {
      console.log(`   ❌ 包含错误的浏览器: ${result.wrongBrowserFound}`);
      allPassed = false;
    }

    // 检查可执行文件
    if (result.executableExists) {
      console.log(`   ✅ 浏览器可执行文件存在`);
    } else {
      console.log(`   ❌ 浏览器可执行文件不存在`);
      allPassed = false;
    }

    console.log('');
  }

  // 总结
  console.log('='.repeat(60));
  if (allPassed) {
    console.log('✅ 所有已打包平台的浏览器验证通过！');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.log('❌ 浏览器验证失败！请检查打包配置。');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

main();
