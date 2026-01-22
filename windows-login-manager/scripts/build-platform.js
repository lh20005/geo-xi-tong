#!/usr/bin/env node
/**
 * 分平台打包脚本
 * 
 * 用法：
 *   node scripts/build-platform.js win      # 打包 Windows
 *   node scripts/build-platform.js mac-x64  # 打包 macOS Intel
 *   node scripts/build-platform.js mac-arm  # 打包 macOS Apple Silicon
 *   node scripts/build-platform.js all      # 打包所有平台（当前系统支持的）
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const browsersRoot = path.join(projectRoot, 'playwright-browsers');
const targetBrowserDir = path.join(projectRoot, 'playwright-browsers-target');

// 平台配置
const PLATFORMS = {
  'win': {
    name: 'Windows x64',
    browserDir: 'win',
    electronBuilder: '--win',
    currentPlatformOnly: false,
    execPath: ['chrome-win64', 'chrome.exe']
  },
  'mac-x64': {
    name: 'macOS Intel',
    browserDir: 'mac-x64',
    electronBuilder: '--mac dmg:x64 zip:x64',  // 只打包 x64 架构
    currentPlatformOnly: true,  // 只能在 macOS 上打包
    execPath: ['chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing']
  },
  'mac-arm': {
    name: 'macOS Apple Silicon',
    browserDir: 'mac-arm64',
    electronBuilder: '--mac dmg:arm64 zip:arm64',  // 只打包 arm64 架构
    currentPlatformOnly: true,  // 只能在 macOS 上打包
    execPath: ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing']
  }
};

/**
 * 检查浏览器是否存在
 */
function checkBrowserExists(platform) {
  const config = PLATFORMS[platform];
  const platformBrowserPath = path.join(browsersRoot, config.browserDir);
  
  if (!fs.existsSync(platformBrowserPath)) {
    return { exists: false, path: platformBrowserPath };
  }
  
  const dirs = fs.readdirSync(platformBrowserPath);
  const chromiumDir = dirs.find(d => d.startsWith('chromium-') || d === 'chromium');
  
  if (!chromiumDir) {
    return { exists: false, path: platformBrowserPath };
  }
  
  const chromiumPath = path.join(platformBrowserPath, chromiumDir);
  
  // 检查可执行文件是否存在
  const execPath = path.join(chromiumPath, ...config.execPath);
  if (fs.existsSync(execPath)) {
    return { exists: true, path: chromiumPath, execPath };
  }
  
  return { exists: false, path: platformBrowserPath };
}

/**
 * 准备目标平台的浏览器目录
 * 将对应平台的浏览器复制到 playwright-browsers-target 目录
 */
function prepareBrowserForPlatform(platform) {
  const config = PLATFORMS[platform];
  const browserCheck = checkBrowserExists(platform);
  
  if (!browserCheck.exists) {
    console.error(`❌ 未找到 ${config.name} 的浏览器`);
    console.error(`   期望路径: ${browserCheck.path}`);
    console.error(`   请先运行: npm run download:browsers`);
    return false;
  }
  
  console.log(`📦 准备 ${config.name} 的浏览器...`);
  console.log(`   源目录: ${browserCheck.path}`);
  console.log(`   可执行文件: ${browserCheck.execPath}`);
  
  // 清理目标目录
  if (fs.existsSync(targetBrowserDir)) {
    console.log('   清理旧的目标目录...');
    fs.rmSync(targetBrowserDir, { recursive: true, force: true });
  }
  
  // 创建目标目录
  fs.mkdirSync(targetBrowserDir, { recursive: true });
  
  // 复制浏览器文件
  console.log('   复制浏览器文件...');
  const chromiumDirName = path.basename(browserCheck.path);
  const targetChromiumDir = path.join(targetBrowserDir, chromiumDirName);
  
  // 使用 cp -r 复制（保留符号链接和权限）
  execSync(`cp -r "${browserCheck.path}" "${targetChromiumDir}"`, { stdio: 'inherit' });
  
  console.log(`   ✅ 浏览器已准备好: ${targetChromiumDir}`);
  return true;
}

/**
 * 执行打包
 */
function buildPlatform(platform) {
  const config = PLATFORMS[platform];
  
  console.log('\n' + '='.repeat(50));
  console.log(`🔨 开始打包 ${config.name}`);
  console.log('='.repeat(50) + '\n');
  
  // 检查是否可以在当前系统打包
  if (config.currentPlatformOnly && process.platform !== 'darwin') {
    console.error(`❌ ${config.name} 只能在 macOS 上打包`);
    return false;
  }
  
  // 准备浏览器
  if (!prepareBrowserForPlatform(platform)) {
    return false;
  }
  
  try {
    // 执行预构建清理
    console.log('\n📋 执行预构建清理...');
    execSync('node scripts/prebuild-clean.js', { cwd: projectRoot, stdio: 'inherit' });
    
    // 编译 TypeScript
    console.log('\n📋 编译 Electron TypeScript...');
    execSync('npm run build:electron', { cwd: projectRoot, stdio: 'inherit' });
    
    // 构建 Vite
    console.log('\n📋 构建 Vite...');
    execSync('npx vite build', { cwd: projectRoot, stdio: 'inherit' });
    
    // 执行 electron-builder
    console.log(`\n📋 执行 electron-builder ${config.electronBuilder}...`);
    execSync(`npx electron-builder ${config.electronBuilder}`, { 
      cwd: projectRoot, 
      stdio: 'inherit',
      env: {
        ...process.env,
        // 使用目标浏览器目录
        PLAYWRIGHT_BROWSERS_PATH: targetBrowserDir
      }
    });
    
    console.log(`\n✅ ${config.name} 打包完成！`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${config.name} 打包失败:`, error.message);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node scripts/build-platform.js <platform>');
    console.log('');
    console.log('可用平台:');
    console.log('  win       - Windows x64');
    console.log('  mac-x64   - macOS Intel');
    console.log('  mac-arm   - macOS Apple Silicon');
    console.log('  all       - 所有平台（当前系统支持的）');
    process.exit(1);
  }
  
  const platform = args[0];
  
  if (platform === 'all') {
    // 打包所有平台
    const results = [];
    
    for (const [key, config] of Object.entries(PLATFORMS)) {
      // 检查是否可以在当前系统打包
      if (config.currentPlatformOnly && process.platform !== 'darwin') {
        console.log(`⏭️  跳过 ${config.name}（需要在 macOS 上打包）`);
        continue;
      }
      
      const success = buildPlatform(key);
      results.push({ platform: config.name, success });
    }
    
    // 打印结果
    console.log('\n' + '='.repeat(50));
    console.log('📊 打包结果汇总');
    console.log('='.repeat(50));
    
    for (const { platform, success } of results) {
      console.log(`${success ? '✅' : '❌'} ${platform}`);
    }
    
    // 执行 postbuild
    console.log('\n📋 执行 postbuild-latest.js...');
    try {
      execSync('node scripts/postbuild-latest.js', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn('⚠️  postbuild-latest.js 执行失败，请手动执行');
    }
    
  } else if (PLATFORMS[platform]) {
    buildPlatform(platform);
  } else {
    console.error(`❌ 未知平台: ${platform}`);
    console.log('可用平台: win, mac-x64, mac-arm, all');
    process.exit(1);
  }
}

main();
