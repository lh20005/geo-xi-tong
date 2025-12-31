/**
 * 浏览器配置 (Playwright)
 * 统一管理所有浏览器启动参数，确保一致性
 */

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
  // 检测是否在服务器环境（无显示器的 Linux）
  const isServer = !process.env.DISPLAY && process.platform === 'linux';
  
  return {
    headless: options.headless ?? isServer, // 服务器环境自动使用 headless
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
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
    '/usr/bin/google-chrome', // Linux
    '/usr/bin/chromium', // Linux Chromium
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows 32-bit
  ];

  const fs = require('fs');
  
  for (const path of chromePaths) {
    try {
      if (fs.existsSync(path)) {
        console.log(`✅ 找到Chrome浏览器: ${path}`);
        return path;
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }

  console.log('⚠️  未找到系统Chrome，将使用Playwright内置浏览器');
  return undefined;
}
