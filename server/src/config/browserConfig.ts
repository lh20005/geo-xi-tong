/**
 * 浏览器配置
 * 统一管理所有浏览器启动参数，确保一致性
 */

export interface BrowserLaunchOptions {
  headless?: boolean;
  executablePath?: string;
  defaultViewport?: any;
  args?: string[];
  ignoreDefaultArgs?: string[];
  ignoreHTTPSErrors?: boolean;
}

/**
 * 获取标准的浏览器启动配置
 * 参照头条号等平台的成功配置
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
    defaultViewport: null, // 关键：不设置viewport，使用浏览器默认大小（最大化）
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      ...(isServer ? [] : ['--start-maximized']), // 本地才最大化，服务器不需要
      '--disable-blink-features=AutomationControlled', // 隐藏自动化特征
      '--disable-infobars' // 禁用信息栏
    ],
    ignoreDefaultArgs: ['--enable-automation'], // 移除自动化标识
    ignoreHTTPSErrors: true // 忽略HTTPS错误
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

  console.log('⚠️  未找到系统Chrome，将使用Puppeteer内置浏览器');
  return undefined;
}

/**
 * 浏览器配置说明
 * 
 * 为什么使用这些配置：
 * 
 * 1. defaultViewport: null
 *    - 不设置固定的viewport尺寸
 *    - 让浏览器使用默认大小（配合 --start-maximized 实现最大化）
 *    - 避免页面显示不完全的问题
 * 
 * 2. --start-maximized
 *    - 启动时最大化浏览器窗口
 *    - 确保所有内容都能完整显示
 *    - 特别重要：抖音、小红书、B站等平台需要完整显示
 * 
 * 3. --disable-blink-features=AutomationControlled
 *    - 隐藏浏览器的自动化特征
 *    - 避免被平台检测为机器人
 *    - 提高登录和发布的成功率
 * 
 * 4. --disable-infobars
 *    - 禁用"Chrome正在受到自动化测试软件的控制"提示
 *    - 提供更好的用户体验
 * 
 * 5. ignoreDefaultArgs: ['--enable-automation']
 *    - 移除自动化标识
 *    - 配合其他参数隐藏自动化特征
 * 
 * 6. --no-sandbox, --disable-setuid-sandbox, --disable-dev-shm-usage
 *    - 解决Linux环境下的权限和资源问题
 *    - 提高稳定性
 */
