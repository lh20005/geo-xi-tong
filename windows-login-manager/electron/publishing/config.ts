/**
 * 浏览器配置 (Playwright)
 * 统一管理所有浏览器启动参数，确保一致性
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface BrowserLaunchOptions {
  headless?: boolean;
  executablePath?: string;
  args?: string[];
  timeout?: number;
}

/**
 * 获取捆绑的 Playwright Chromium 路径
 * 打包后的应用会在 resources/playwright-browsers 目录下查找
 * 
 * 目录结构说明：
 * - 打包后：resources/playwright-browsers/chromium-1200/chrome-win64/chrome.exe
 * - 开发模式：playwright-browsers/win/chromium-1200/chrome-win64/chrome.exe
 *            playwright-browsers/mac-arm64/chromium-1200/chrome-mac-arm64/...
 */
function getBundledChromiumPath(): string | undefined {
  const platform = process.platform;
  const arch = process.arch; // 'x64' 或 'arm64'
  const isPackaged = app.isPackaged;
  
  console.log(`[Browser] 查找捆绑的 Chromium...`);
  console.log(`[Browser] 当前平台: ${platform}, 架构: ${arch}, 已打包: ${isPackaged}`);
  
  // 确定 playwright-browsers 目录位置
  let browsersBasePath: string;
  let chromiumBasePath: string | undefined;
  
  if (isPackaged) {
    // 打包后：在 resources 目录下
    // 结构：resources/playwright-browsers/chromium-1200/chrome-win64/chrome.exe
    browsersBasePath = path.join(process.resourcesPath, 'playwright-browsers');
    console.log(`[Browser] 打包模式，基础路径: ${browsersBasePath}`);
    
    if (!fs.existsSync(browsersBasePath)) {
      console.log(`[Browser] ❌ 捆绑浏览器目录不存在: ${browsersBasePath}`);
      return undefined;
    }
    
    // 查找 chromium-* 目录
    const dirs = fs.readdirSync(browsersBasePath);
    const chromiumDir = dirs.find(d => d.startsWith('chromium-') && !d.includes('headless'));
    
    if (!chromiumDir) {
      console.log(`[Browser] ❌ 未找到 chromium 目录，目录内容: ${dirs.join(', ')}`);
      return undefined;
    }
    
    chromiumBasePath = path.join(browsersBasePath, chromiumDir);
  } else {
    // 开发模式：在项目根目录下，按平台分目录
    // 结构：playwright-browsers/win/chromium-1200/chrome-win64/chrome.exe
    //       playwright-browsers/mac-arm64/chromium-1200/chrome-mac-arm64/...
    const projectRoot = path.join(__dirname, '..', '..');
    browsersBasePath = path.join(projectRoot, 'playwright-browsers');
    console.log(`[Browser] 开发模式，基础路径: ${browsersBasePath}`);
    
    if (!fs.existsSync(browsersBasePath)) {
      console.log(`[Browser] ❌ 捆绑浏览器目录不存在: ${browsersBasePath}`);
      return undefined;
    }
    
    // 开发模式下，根据平台选择子目录
    let platformDir: string;
    if (platform === 'win32') {
      platformDir = 'win';
    } else if (platform === 'darwin') {
      platformDir = arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
    } else {
      platformDir = 'linux';
    }
    
    const platformBrowserPath = path.join(browsersBasePath, platformDir);
    console.log(`[Browser] 平台浏览器目录: ${platformBrowserPath}`);
    
    if (!fs.existsSync(platformBrowserPath)) {
      console.log(`[Browser] ❌ 平台浏览器目录不存在: ${platformBrowserPath}`);
      // 尝试直接在 browsersBasePath 下查找（兼容旧结构）
      const dirs = fs.readdirSync(browsersBasePath);
      const chromiumDir = dirs.find(d => d.startsWith('chromium-') && !d.includes('headless'));
      if (chromiumDir) {
        chromiumBasePath = path.join(browsersBasePath, chromiumDir);
        console.log(`[Browser] 使用兼容路径: ${chromiumBasePath}`);
      } else {
        return undefined;
      }
    } else {
      // 在平台目录下查找 chromium-* 目录
      const dirs = fs.readdirSync(platformBrowserPath);
      const chromiumDir = dirs.find(d => d.startsWith('chromium-') && !d.includes('headless'));
      
      if (!chromiumDir) {
        console.log(`[Browser] ❌ 未找到 chromium 目录，目录内容: ${dirs.join(', ')}`);
        return undefined;
      }
      
      chromiumBasePath = path.join(platformBrowserPath, chromiumDir);
    }
  }
  
  if (!chromiumBasePath) {
    console.log('[Browser] ❌ 无法确定 Chromium 基础目录');
    return undefined;
  }
  
  console.log(`[Browser] Chromium 基础目录: ${chromiumBasePath}`);
  
  // 列出 chromium 目录下的所有子目录
  let chromiumSubDirs: string[] = [];
  try {
    chromiumSubDirs = fs.readdirSync(chromiumBasePath).filter(d => {
      try {
        return fs.statSync(path.join(chromiumBasePath!, d)).isDirectory();
      } catch {
        return false;
      }
    });
    console.log(`[Browser] Chromium 子目录: ${chromiumSubDirs.join(', ')}`);
  } catch (e) {
    console.log('[Browser] 无法读取 Chromium 子目录');
  }
  
  // 根据平台和架构确定可执行文件路径
  let executablePaths: string[] = [];
  
  if (platform === 'darwin') {
    // macOS: 尝试多种可能的路径
    const macDirs = arch === 'arm64' 
      ? ['chrome-mac-arm64', 'chrome-mac-x64', 'chrome-mac'] 
      : ['chrome-mac-x64', 'chrome-mac', 'chrome-mac-arm64'];
    
    for (const macDir of macDirs) {
      // 新版 Playwright: Google Chrome for Testing.app
      executablePaths.push(
        path.join(chromiumBasePath, macDir, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
      );
      // 旧版 Playwright: Chromium.app
      executablePaths.push(
        path.join(chromiumBasePath, macDir, 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      );
    }
  } else if (platform === 'win32') {
    // Windows: 尝试多种可能的路径
    const winDirs = ['chrome-win64', 'chrome-win', 'chrome-win32'];
    for (const winDir of winDirs) {
      executablePaths.push(path.join(chromiumBasePath, winDir, 'chrome.exe'));
    }
  } else {
    // Linux
    const linuxDirs = ['chrome-linux64', 'chrome-linux'];
    for (const linuxDir of linuxDirs) {
      executablePaths.push(path.join(chromiumBasePath, linuxDir, 'chrome'));
    }
  }
  
  // 尝试找到存在的可执行文件
  for (const execPath of executablePaths) {
    console.log(`[Browser] 尝试路径: ${execPath}`);
    if (fs.existsSync(execPath)) {
      console.log(`[Browser] ✅ 找到捆绑的 Chromium: ${execPath}`);
      return execPath;
    }
  }
  
  console.log(`[Browser] ❌ 捆绑的 Chromium 可执行文件不存在`);
  console.log(`[Browser] 已尝试路径: ${executablePaths.slice(0, 3).join(', ')}...`);
  return undefined;
}

/**
 * 获取标准的浏览器启动配置
 * 适配 Playwright API
 */
export function getStandardBrowserConfig(options: {
  headless?: boolean;
  executablePath?: string;
} = {}): BrowserLaunchOptions {
  // Electron 环境默认使用可视化模式（非 headless）
  const defaultHeadless = process.env.BROWSER_HEADLESS === 'true';
  
  // 优先级：1. 传入的路径 2. 捆绑的 Chromium 3. 系统 Chrome 4. Playwright 默认（channel: 'chrome'）
  let executablePath = options.executablePath || getBundledChromiumPath() || findChromeExecutable();
  let channel: string | undefined = undefined;
  
  if (executablePath) {
    console.log(`[Browser] 使用浏览器: ${executablePath}`);
  } else {
    // 没有找到任何浏览器，尝试使用 Playwright 的 channel 功能
    // 这会让 Playwright 自动查找系统安装的 Chrome
    console.log('[Browser] ⚠️ 未找到捆绑浏览器或系统 Chrome');
    console.log('[Browser] 尝试使用 Playwright channel: chrome');
    channel = 'chrome';
  }
  
  const config: BrowserLaunchOptions = {
    headless: options.headless ?? defaultHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--start-maximized', // 启动时最大化窗口
      '--disable-blink-features=AutomationControlled', // 隐藏自动化特征
      '--disable-infobars' // 禁用信息栏
    ],
    timeout: 30000
  };
  
  if (executablePath) {
    config.executablePath = executablePath;
  }
  
  // 注意：channel 需要在 chromium.launch() 时传入，这里只是记录
  // Playwright 的 channel 选项可以是 'chrome', 'chrome-beta', 'msedge' 等
  (config as any).channel = channel;
  
  return config;
}

/**
 * 查找系统Chrome路径（作为后备方案）
 */
export function findChromeExecutable(): string | undefined {
  const platform = process.platform;
  
  let chromePaths: string[] = [];
  
  if (platform === 'darwin') {
    // macOS
    chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(app.getPath('home'), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ];
  } else if (platform === 'win32') {
    // Windows
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';
    
    chromePaths = [
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFiles, 'Chromium\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Chromium\\Application\\chrome.exe')
    ];
  } else {
    // Linux
    chromePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ];
  }

  for (const chromePath of chromePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        console.log(`[Browser] 找到系统 Chrome: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }

  console.log('[Browser] ⚠️ 未找到系统 Chrome');
  return undefined;
}

/**
 * 获取默认超时时间（分钟）
 */
export function getDefaultTimeoutMinutes(): number {
  const envTimeout = process.env.TASK_TIMEOUT_MINUTES;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 15; // 默认15分钟
}

/**
 * 获取默认重试次数
 */
export function getDefaultMaxRetries(): number {
  const envRetries = process.env.TASK_MAX_RETRIES;
  if (envRetries) {
    const parsed = parseInt(envRetries, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 3; // 默认3次
}
