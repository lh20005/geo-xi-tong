#!/usr/bin/env node
/**
 * 下载所有目标平台的 Playwright Chromium 浏览器
 * 支持跨平台下载（从 Playwright CDN 直接下载）
 * 
 * 目录结构：
 * playwright-browsers/
 *   ├── win/           # Windows x64
 *   │   └── chromium-xxx/
 *   ├── mac-x64/       # macOS Intel
 *   │   └── chromium-xxx/
 *   └── mac-arm64/     # macOS Apple Silicon
 *       └── chromium-xxx/
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { createWriteStream, mkdirSync } = require('fs');
const { pipeline } = require('stream/promises');
const { createGunzip } = require('zlib');

const projectRoot = path.join(__dirname, '..');
const browsersRoot = path.join(projectRoot, 'playwright-browsers');

// Playwright 版本和构建号
const PLAYWRIGHT_BUILD = '1200';  // 对应 Playwright 1.57.0

console.log('🌐 Playwright Chromium 多平台下载工具\n');
console.log(`📦 Playwright Build: ${PLAYWRIGHT_BUILD}`);
console.log(`📁 浏览器目录: ${browsersRoot}\n`);

// 目标平台配置
const PLATFORMS = [
  {
    name: 'Windows x64',
    dir: 'win',
    zipName: 'chromium-win64.zip',
    extractDir: 'chrome-win64',
    execPath: ['chrome-win64', 'chrome.exe']
  },
  {
    name: 'macOS Intel',
    dir: 'mac-x64',
    zipName: 'chromium-mac.zip',
    extractDir: 'chrome-mac-x64',
    execPath: ['chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    altExecPath: ['chrome-mac-x64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']
  },
  {
    name: 'macOS Apple Silicon',
    dir: 'mac-arm64',
    zipName: 'chromium-mac-arm64.zip',
    extractDir: 'chrome-mac-arm64',
    execPath: ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    altExecPath: ['chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']
  }
];

// CDN URLs
const CDN_URLS = [
  `https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/${PLAYWRIGHT_BUILD}`,
  `https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/chromium/${PLAYWRIGHT_BUILD}`
];

/**
 * 检查平台浏览器是否已安装
 */
function isPlatformInstalled(platform) {
  const platformDir = path.join(browsersRoot, platform.dir);
  if (!fs.existsSync(platformDir)) {
    return { installed: false };
  }
  
  const dirs = fs.readdirSync(platformDir);
  const chromiumDir = dirs.find(d => d.startsWith('chromium-') || d === 'chromium');
  
  if (!chromiumDir) {
    return { installed: false };
  }
  
  const chromiumPath = path.join(platformDir, chromiumDir);
  
  // 检查主路径
  const mainExecPath = path.join(chromiumPath, ...platform.execPath);
  if (fs.existsSync(mainExecPath)) {
    return { installed: true, path: mainExecPath, chromiumDir: chromiumPath };
  }
  
  // 检查备用路径
  if (platform.altExecPath) {
    const altExecPath = path.join(chromiumPath, ...platform.altExecPath);
    if (fs.existsSync(altExecPath)) {
      return { installed: true, path: altExecPath, chromiumDir: chromiumPath };
    }
  }
  
  return { installed: false };
}

/**
 * 获取目录大小
 */
function getDirectorySize(dir) {
  let size = 0;
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        size += getDirectorySize(filePath);
      } else {
        size += fs.statSync(filePath).size;
      }
    }
  } catch (e) {
    // 忽略错误
  }
  return size;
}

/**
 * 下载文件
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`   下载: ${url}`);
    
    const file = createWriteStream(destPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    
    const request = https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r   进度: ${mb} MB (${percent}%)    `);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('');
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
    
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * 解压 ZIP 文件
 */
async function extractZip(zipPath, destDir) {
  console.log(`   解压到: ${destDir}`);
  
  // 使用系统 unzip 命令
  try {
    execSync(`unzip -q -o "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`   解压失败: ${error.message}`);
    return false;
  }
}

/**
 * 下载并安装浏览器
 */
async function downloadBrowser(platform) {
  const platformDir = path.join(browsersRoot, platform.dir);
  const chromiumDir = path.join(platformDir, `chromium-${PLAYWRIGHT_BUILD}`);
  const zipPath = path.join(platformDir, platform.zipName);
  
  console.log(`\n📥 下载 ${platform.name} 的 Chromium...`);
  console.log(`   目标目录: ${chromiumDir}`);
  
  // 创建目录
  mkdirSync(platformDir, { recursive: true });
  mkdirSync(chromiumDir, { recursive: true });
  
  // 尝试从 CDN 下载
  let downloaded = false;
  for (const cdnBase of CDN_URLS) {
    const url = `${cdnBase}/${platform.zipName}`;
    try {
      await downloadFile(url, zipPath);
      downloaded = true;
      break;
    } catch (error) {
      console.log(`   ⚠️  从 ${cdnBase} 下载失败: ${error.message}`);
    }
  }
  
  if (!downloaded) {
    console.error(`   ❌ 所有 CDN 下载失败`);
    return false;
  }
  
  // 解压
  const extracted = await extractZip(zipPath, chromiumDir);
  
  // 清理 ZIP 文件
  try {
    fs.unlinkSync(zipPath);
  } catch (e) {}
  
  if (!extracted) {
    return false;
  }
  
  // 验证安装
  const status = isPlatformInstalled(platform);
  if (status.installed) {
    console.log(`   ✅ 安装成功: ${status.path}`);
    return true;
  } else {
    console.error(`   ❌ 安装验证失败`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('📊 检查各平台浏览器安装状态...\n');
  
  const results = [];
  
  for (const platform of PLATFORMS) {
    const status = isPlatformInstalled(platform);
    results.push({ platform, status });
    
    if (status.installed) {
      const sizeMB = (getDirectorySize(status.chromiumDir) / 1024 / 1024).toFixed(2);
      console.log(`✅ ${platform.name}: 已安装 (${sizeMB} MB)`);
    } else {
      console.log(`❌ ${platform.name}: 未安装`);
    }
  }
  
  // 检查是否需要下载
  const needDownload = results.filter(r => !r.status.installed);
  
  if (needDownload.length === 0) {
    console.log('\n✅ 所有平台的浏览器都已安装！');
    return;
  }
  
  console.log(`\n⚠️  ${needDownload.length} 个平台需要下载浏览器`);
  
  // 下载缺失的浏览器
  for (const { platform } of needDownload) {
    await downloadBrowser(platform);
  }
  
  // 最终状态
  console.log('\n' + '='.repeat(50));
  console.log('📊 最终安装状态：');
  console.log('='.repeat(50));
  
  let allInstalled = true;
  for (const platform of PLATFORMS) {
    const status = isPlatformInstalled(platform);
    if (status.installed) {
      const sizeMB = (getDirectorySize(status.chromiumDir) / 1024 / 1024).toFixed(2);
      console.log(`✅ ${platform.name} (${sizeMB} MB)`);
    } else {
      console.log(`❌ ${platform.name}`);
      allInstalled = false;
    }
  }
  
  if (allInstalled) {
    console.log('\n🎉 所有平台的浏览器都已准备就绪！');
    console.log('   现在可以运行 npm run build:all 打包所有平台');
  }
}

main().catch(console.error);
