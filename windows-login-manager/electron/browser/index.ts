/**
 * 浏览器自动化模块导出
 * 
 * 从服务器端迁移的浏览器自动化相关功能
 */

export { BrowserAutomationService, browserAutomationService } from './BrowserAutomationService';
export type { BrowserOptions, LogCallback } from './BrowserAutomationService';

export { getStandardBrowserConfig, findChromeExecutable } from './browserConfig';
export type { BrowserLaunchOptions } from './browserConfig';

export { LoginStatusChecker } from './LoginStatusChecker';
export type { UserInfo } from './LoginStatusChecker';

export { normalizeCookies, isValidCookie, filterAndNormalizeCookies } from './cookieNormalizer';
export type { Cookie } from './cookieNormalizer';
