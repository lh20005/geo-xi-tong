/**
 * WebView Preload 脚本
 * 用于在 webview 中注入登录检测逻辑
 * 替代原有的 login-detector
 */

// 登录检测配置
interface LoginDetectionConfig {
  successUrls?: string[];
  successSelectors?: string[];
  failureSelectors?: string[];
  initialUrl?: string;
}

// 全局状态
let detectionConfig: LoginDetectionConfig | null = null;
let initialUrl: string = '';
let detectionInterval: NodeJS.Timeout | null = null;
let isDetecting = false;

/**
 * 初始化登录检测
 */
function initializeLoginDetection(config: LoginDetectionConfig) {
  console.log('[Preload] Initializing login detection', config);
  
  detectionConfig = config;
  initialUrl = config.initialUrl || window.location.href;
  
  // 开始检测
  startDetection();
  
  // 监听 URL 变化
  observeUrlChanges();
  
  // 监听 DOM 变化
  observeDomChanges();
}

/**
 * 开始检测
 */
function startDetection() {
  if (isDetecting) {
    return;
  }
  
  isDetecting = true;
  console.log('[Preload] Starting detection...');
  
  // 定期检查登录状态
  detectionInterval = setInterval(() => {
    checkLoginStatus();
  }, 500);
}

/**
 * 停止检测
 */
function stopDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  isDetecting = false;
  console.log('[Preload] Detection stopped');
}

/**
 * 检查登录状态
 */
function checkLoginStatus() {
  if (!detectionConfig) {
    return;
  }
  
  const currentUrl = window.location.href;
  
  // 策略1: 检测 URL 变化（最可靠）
  if (currentUrl !== initialUrl) {
    // 排除错误页面
    if (currentUrl.includes('about:blank') || currentUrl.includes('chrome-error://')) {
      return;
    }
    
    console.log('[Preload] URL changed:', initialUrl, '->', currentUrl);
    notifyLoginSuccess('url', currentUrl);
    stopDetection();
    return;
  }
  
  // 策略2: 检查特定的成功 URL 模式
  if (detectionConfig.successUrls) {
    for (const pattern of detectionConfig.successUrls) {
      if (matchesUrlPattern(currentUrl, pattern)) {
        console.log('[Preload] URL pattern matched:', pattern);
        notifyLoginSuccess('url', currentUrl);
        stopDetection();
        return;
      }
    }
  }
  
  // 策略3: 检查失败元素
  if (detectionConfig.failureSelectors) {
    for (const selector of detectionConfig.failureSelectors) {
      if (document.querySelector(selector)) {
        console.log('[Preload] Failure element detected:', selector);
        notifyLoginFailure('failure', 'Login failed (failure element detected)');
        stopDetection();
        return;
      }
    }
  }
  
  // 策略4: 检查成功元素（备用方案）
  if (detectionConfig.successSelectors) {
    for (const selector of detectionConfig.successSelectors) {
      if (document.querySelector(selector)) {
        console.log('[Preload] Success element detected:', selector);
        notifyLoginSuccess('selector', currentUrl);
        stopDetection();
        return;
      }
    }
  }
}

/**
 * 匹配 URL 模式
 */
function matchesUrlPattern(url: string, pattern: string): boolean {
  // 支持通配符匹配
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  if (regex.test(url)) {
    return true;
  }
  
  // 支持简单包含匹配
  if (url.includes(pattern)) {
    return true;
  }
  
  return false;
}

/**
 * 监听 URL 变化
 */
function observeUrlChanges() {
  // 监听 popstate 事件（浏览器前进/后退）
  window.addEventListener('popstate', () => {
    console.log('[Preload] URL changed (popstate)');
    checkLoginStatus();
  });
  
  // 监听 hashchange 事件
  window.addEventListener('hashchange', () => {
    console.log('[Preload] URL changed (hashchange)');
    checkLoginStatus();
  });
  
  // 拦截 pushState 和 replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    console.log('[Preload] URL changed (pushState)');
    checkLoginStatus();
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    console.log('[Preload] URL changed (replaceState)');
    checkLoginStatus();
  };
}

/**
 * 监听 DOM 变化
 */
function observeDomChanges() {
  const observer = new MutationObserver(() => {
    // DOM 变化时检查登录状态
    if (isDetecting) {
      checkLoginStatus();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
}

/**
 * 通知登录成功
 */
function notifyLoginSuccess(method: string, url: string) {
  console.log('[Preload] Login success detected:', method, url);
  
  // 发送消息到主进程
  if (typeof (window as any).ipcRenderer !== 'undefined') {
    (window as any).ipcRenderer.send('login-success', {
      success: true,
      method,
      url,
      message: 'Login successful'
    });
  }
}

/**
 * 通知登录失败
 */
function notifyLoginFailure(method: string, message: string) {
  console.log('[Preload] Login failure detected:', method, message);
  
  // 发送消息到主进程
  if (typeof (window as any).ipcRenderer !== 'undefined') {
    (window as any).ipcRenderer.send('login-failure', {
      success: false,
      method,
      message
    });
  }
}

/**
 * 提取用户信息
 */
function extractUserInfo(selectors: string[]): any {
  console.log('[Preload] Extracting user info with selectors:', selectors);
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      const username = element.textContent.trim();
      if (username) {
        console.log('[Preload] Username extracted:', username);
        return { username };
      }
    }
  }
  
  console.log('[Preload] No username found');
  return null;
}

/**
 * 捕获 Storage 数据
 */
function captureStorage(): any {
  const localStorageData: Record<string, string> = {};
  const sessionStorageData: Record<string, string> = {};
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        localStorageData[key] = localStorage.getItem(key) || '';
      }
    }
  } catch (e) {
    console.error('[Preload] Failed to capture localStorage:', e);
  }
  
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        sessionStorageData[key] = sessionStorage.getItem(key) || '';
      }
    }
  } catch (e) {
    console.error('[Preload] Failed to capture sessionStorage:', e);
  }
  
  console.log('[Preload] Storage captured:', {
    localStorage: Object.keys(localStorageData).length,
    sessionStorage: Object.keys(sessionStorageData).length
  });
  
  return {
    localStorage: localStorageData,
    sessionStorage: sessionStorageData
  };
}

/**
 * 检查元素是否存在
 */
function elementExists(selector: string): boolean {
  return !!document.querySelector(selector);
}

// 页面加载完成后自动开始检测
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Preload] DOM loaded, ready for detection');
  });
} else {
  console.log('[Preload] DOM already loaded');
}

// 导出 API 供主进程调用
(window as any).loginDetection = {
  initialize: initializeLoginDetection,
  stop: stopDetection,
  extractUserInfo,
  captureStorage,
  elementExists,
  getCurrentUrl: () => window.location.href,
  getPageTitle: () => document.title
};

console.log('[Preload] WebView preload script loaded');
