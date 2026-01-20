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
 * 获取标准的浏览器启动配置
 * 适配 Playwright API
 */
export function getStandardBrowserConfig(options: {
  headless?: boolean;
  executablePath?: string;
} = {}): BrowserLaunchOptions {
  // Electron 环境默认使用可视化模式（非 headless）
  const defaultHeadless = process.env.BROWSER_HEADLESS === 'true';
  
  return {
    headless: options.headless ?? defaultHeadless,
    executablePath: options.executablePath || findChromeExecutable(),
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
}

/**
 * 查找系统Chrome路径
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
        console.log(`✅ 找到Chrome浏览器: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }

  console.log('⚠️  未找到系统Chrome，将使用Playwright内置浏览器');
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
