/**
 * 浏览器配置 (Playwright)
 * 统一管理所有浏览器启动参数，确保一致性
 * 
 * 从服务器端迁移: server/src/config/browserConfig.ts
 * 改动说明: 
 * - 移除服务器环境检测逻辑（Windows端始终有显示器）
 * - 调整Chrome路径查找逻辑适配Windows/macOS
 */

import * as fs from 'fs';

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
  return {
    headless: options.headless ?? false, // Windows端默认非headless，方便调试
    executablePath: options.executablePath, // 可选：指定Chrome路径
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
  const chromePaths = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Windows 用户目录
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];

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
