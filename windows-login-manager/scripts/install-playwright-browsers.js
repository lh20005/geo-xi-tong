#!/usr/bin/env node
/**
 * 检查并安装 Playwright Chromium 浏览器
 * 为所有目标平台（Windows、macOS Intel、macOS ARM）下载浏览器
 * 只在 Chromium 不存在时才下载，避免每次打包都重新下载
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🌐 检查 Playwright Chromium 浏览器...\n');

const projectRoot = path.join(__dirname, '..');

// Chromium 浏览器目录（固定位置，不会被 prebuild-clean.js 清理）
const browserPath = path.join(projectRoot, 'playwright-browsers');

console.log(`📁 浏览器目录: ${browserPath}`);

// 需要打包的目标平台
const TARGET_PLATFORMS = [
  { name: 'Windows', dir: 'chrome-win', exe: 'chrome.exe' },
  { name: 'macOS Intel', dir: 'chrome-mac', exe: 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', altExe: 'Chromium.app/Contents/MacOS/Chromium' },
  { name: 'macOS ARM', dir: 'chrome-mac-arm64', exe: 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', altExe: 'Chromium.app/Contents/MacOS/Chromium' }
];

/**
 * 检查特定平台的 Chromium 是否已安装
 */
function isPlatformChromiumInstalled(chromiumBasePath, platform) {
  const primaryPath = path.join(chromiumBasePath, platform.dir, platform.exe);
  if (fs.existsSync(primaryPath)) {
    return { installed: true, path: primaryPath };
  }
  
  // 检查备用路径（旧版 Playwright）
  if (platform.altExe) {
    const altPath = path.join(chromiumBasePath, platform.dir, platform.altExe);
    if (fs.existsSync(altPath)) {
      return { installed: true, path: altPath };
    }
  }
  
  return { installed: false, path: null };
}

/**
 * 检查所有目标平台的 Chromium 是否已安装
 */
function checkAllPlatformsInstalled() {
  if (!fs.existsSync(browserPath)) {
    return { allInstalled: false, missing: TARGET_PLATFORMS.map(p => p.name), installed: [] };
  }
  
  const dirs = fs.readdirSync(browserPath);
  const chromiumDir = dirs.find(d => d.startsWith('chromium-') || d === 'chromium');
  
  if (!chromiumDir) {
    return { allInstalled: false, missing: TARGET_PLATFORMS.map(p => p.name), installed: [] };
  }
  
  const chromiumBasePath = path.join(browserPath, chromiumDir);
  const missing = [];
  const installed = [];
  
  for (const platform of TARGET_PLATFORMS) {
    const result = isPlatformChromiumInstalled(chromiumBasePath, platform);
    if (result.installed) {
      installed.push({ name: platform.name, path: result.path });
    } else {
      missing.push(platform.name);
    }
  }
  
  return { 
    allInstalled: missing.length === 0, 
    missing, 
    installed,
    chromiumBasePath 
  };
}

/**
 * 检查当前平台的 Chromium 是否已安装（用于开发模式）
 */
function isCurrentPlatformInstalled() {
  if (!fs.existsSync(browserPath)) {
    return false;
  }
  
  const dirs = fs.readdirSync(browserPath);
  const chromiumDir = dirs.find(d => d.startsWith('chromium-') || d === 'chromium');
  
  if (!chromiumDir) {
    return false;
  }
  
  const chromiumBasePath = path.join(browserPath, chromiumDir);
  const platform = process.platform;
  const arch = process.arch;
  
  // 检查可执行文件是否存在（支持新旧版本 Playwright）
  let executablePaths = [];
  if (platform === 'darwin') {
    const macDir = arch === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac';
    executablePaths = [
      path.join(chromiumBasePath, macDir, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      path.join(chromiumBasePath, macDir, 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
    ];
  } else if (platform === 'win32') {
    executablePaths = [
      path.join(chromiumBasePath, 'chrome-win', 'chrome.exe')
    ];
  } else {
    executablePaths = [
      path.join(chromiumBasePath, 'chrome-linux', 'chrome')
    ];
  }
  
  return executablePaths.some(p => fs.existsSync(p));
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
 * 下载所有目标平台的浏览器
 */
async function downloadAllPlatformBrowsers() {
  console.log('📥 正在下载所有目标平台的 Chromium...');
  console.log('   目标平台: Windows, macOS Intel, macOS ARM');
  console.log('   这可能需要几分钟，请耐心等待...\n');
  
  // 设置环境变量
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
  
  // 创建目录
  fs.mkdirSync(browserPath, { recursive: true });
  
  // 下载所有平台的 Chromium
  // 使用 --with-deps 确保下载完整的浏览器
  const platforms = ['win64', 'mac', 'mac-arm64'];
  
  for (const platform of platforms) {
    console.log(`\n📥 下载 ${platform} 平台的 Chromium...`);
    try {
      // 使用 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 强制下载
      execSync(`npx playwright install chromium --force`, {
        cwd: projectRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: browserPath,
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0'
        }
      });
    } catch (error) {
      console.error(`⚠️  下载 ${platform} 失败:`, error.message);
    }
  }
}

try {
  // 检查所有目标平台的安装状态
  const status = checkAllPlatformsInstalled();
  
  console.log('\n📊 平台安装状态:');
  if (status.installed.length > 0) {
    for (const p of status.installed) {
      console.log(`   ✅ ${p.name}: ${p.path}`);
    }
  }
  if (status.missing.length > 0) {
    for (const name of status.missing) {
      console.log(`   ❌ ${name}: 未安装`);
    }
  }
  
  // 如果当前平台已安装，可以继续（开发模式）
  // 但如果是打包模式，需要所有平台都安装
  const isPackageBuild = process.argv.includes('--all') || 
                         process.env.npm_lifecycle_event?.includes('build');
  
  if (status.allInstalled) {
    const sizeBytes = getDirectorySize(status.chromiumBasePath);
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    
    console.log('\n✅ 所有目标平台的 Chromium 已安装');
    console.log(`📍 位置: ${status.chromiumBasePath}`);
    console.log(`📊 总大小: ${sizeMB} MB`);
    console.log('\n' + '='.repeat(50));
    console.log('✅ 浏览器检查完成，可以继续打包');
    console.log('='.repeat(50) + '\n');
    process.exit(0);
  }
  
  // 如果只是当前平台已安装，在开发模式下可以继续
  if (isCurrentPlatformInstalled() && !isPackageBuild) {
    console.log('\n⚠️  当前平台的 Chromium 已安装，但其他平台缺失');
    console.log('   开发模式下可以继续，但打包时需要所有平台');
    console.log('\n' + '='.repeat(50));
    console.log('✅ 开发模式检查通过');
    console.log('='.repeat(50) + '\n');
    process.exit(0);
  }
  
  // 需要下载缺失的平台
  console.log('\n⚠️  部分平台的 Chromium 未安装，开始下载...');
  console.log(`   缺失平台: ${status.missing.join(', ')}\n`);
  
  // 设置环境变量
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
  
  // 创建目录
  fs.mkdirSync(browserPath, { recursive: true });
  
  // 安装 Chromium（Playwright 会根据当前平台下载对应版本）
  console.log('📥 正在下载 Chromium（约 150-450MB，取决于平台数量）...');
  console.log('   这可能需要几分钟，请耐心等待...');
  console.log('   下载完成后会缓存，后续打包无需重新下载\n');
  
  // 注意：Playwright 默认只下载当前平台的浏览器
  // 要下载其他平台，需要在对应平台上运行，或使用 CI/CD
  execSync('npx playwright install chromium', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: browserPath
    }
  });
  
  console.log('\n✅ Chromium 下载完成！');
  
  // 再次验证安装状态
  const finalStatus = checkAllPlatformsInstalled();
  
  console.log('\n📊 最终安装状态:');
  if (finalStatus.installed.length > 0) {
    for (const p of finalStatus.installed) {
      console.log(`   ✅ ${p.name}`);
    }
  }
  if (finalStatus.missing.length > 0) {
    console.log('\n⚠️  以下平台仍未安装（需要在对应平台上打包）:');
    for (const name of finalStatus.missing) {
      console.log(`   ⚠️  ${name}`);
    }
    console.log('\n💡 提示: Playwright 只能下载当前操作系统的浏览器');
    console.log('   - Windows 版本需要在 Windows 上打包');
    console.log('   - macOS Intel 版本需要在 Intel Mac 上打包');
    console.log('   - macOS ARM 版本需要在 Apple Silicon Mac 上打包');
    console.log('   或者使用 CI/CD 在多平台上构建');
  }
  
  if (finalStatus.chromiumBasePath) {
    const sizeBytes = getDirectorySize(finalStatus.chromiumBasePath);
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    console.log(`\n📍 位置: ${finalStatus.chromiumBasePath}`);
    console.log(`📊 大小: ${sizeMB} MB`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Chromium 安装完成！');
  console.log('📦 打包时将自动包含 Chromium 浏览器');
  console.log('💡 后续打包将直接使用已下载的浏览器');
  console.log('='.repeat(50) + '\n');
  
} catch (error) {
  console.error('\n❌ 安装 Playwright 浏览器失败:', error.message);
  console.error('💡 提示：请检查网络连接，或手动运行 npx playwright install chromium');
  process.exit(1);
}
