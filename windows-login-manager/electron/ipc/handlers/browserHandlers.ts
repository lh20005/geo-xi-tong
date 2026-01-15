/**
 * 浏览器 IPC 处理器
 * 处理浏览器自动化操作
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain, app } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserAutomationService } from '../../browser/BrowserAutomationService';
import { LoginStatusChecker } from '../../browser/LoginStatusChecker';
import { accountService } from '../../services';
import { storageManager } from '../../storage/manager';
import { Page } from 'playwright';

// 单例实例
let browserService: BrowserAutomationService | null = null;
let loginChecker: LoginStatusChecker | null = null;
let currentPage: Page | null = null;

/**
 * 获取或创建 BrowserAutomationService 实例
 */
function getBrowserService(): BrowserAutomationService {
  if (!browserService) {
    browserService = new BrowserAutomationService();
  }
  return browserService;
}

/**
 * 获取或创建 LoginStatusChecker 实例
 */
function getLoginChecker(): LoginStatusChecker {
  if (!loginChecker) {
    loginChecker = new LoginStatusChecker();
  }
  return loginChecker;
}

/**
 * 注册浏览器相关 IPC 处理器
 */
export function registerBrowserHandlers(): void {
  log.info('Registering browser IPC handlers...');

  // 启动浏览器
  ipcMain.handle('browser:launch', async (_event, options?: {
    headless?: boolean;
    userDataDir?: string;
  }) => {
    try {
      log.info('IPC: browser:launch');
      
      const service = getBrowserService();
      
      await service.launchBrowser({
        headless: options?.headless ?? false
      });
      
      // 创建一个默认页面
      currentPage = await service.createPage();

      return { success: true, message: '浏览器已启动' };
    } catch (error: any) {
      log.error('IPC: browser:launch failed:', error);
      return { success: false, error: error.message || '启动浏览器失败' };
    }
  });

  // 关闭浏览器
  ipcMain.handle('browser:close', async () => {
    try {
      log.info('IPC: browser:close');
      
      const service = getBrowserService();
      await service.closeBrowser();
      currentPage = null;

      return { success: true, message: '浏览器已关闭' };
    } catch (error: any) {
      log.error('IPC: browser:close failed:', error);
      return { success: false, error: error.message || '关闭浏览器失败' };
    }
  });

  // 截图
  ipcMain.handle('browser:screenshot', async (_event, options?: {
    fullPage?: boolean;
    path?: string;
  }) => {
    try {
      log.info('IPC: browser:screenshot');
      
      if (!currentPage) {
        return { success: false, error: '浏览器页面未打开' };
      }

      // 默认保存到用户数据目录
      const userDataPath = app.getPath('userData');
      const screenshotPath = options?.path || path.join(
        userDataPath, 
        'screenshots', 
        `screenshot-${Date.now()}.png`
      );

      // 确保目录存在
      const dir = path.dirname(screenshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await currentPage.screenshot({
        path: screenshotPath,
        fullPage: options?.fullPage ?? false
      });

      return { success: true, data: { path: screenshotPath } };
    } catch (error: any) {
      log.error('IPC: browser:screenshot failed:', error);
      return { success: false, error: error.message || '截图失败' };
    }
  });

  // 导航到 URL
  ipcMain.handle('browser:navigateTo', async (_event, url: string, options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
  }) => {
    try {
      log.info(`IPC: browser:navigateTo - ${url}`);
      
      if (!currentPage) {
        return { success: false, error: '浏览器页面未打开' };
      }
      
      const service = getBrowserService();
      await service.navigateTo(currentPage, url);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: browser:navigateTo failed:', error);
      return { success: false, error: error.message || '导航失败' };
    }
  });

  // 获取当前 URL
  ipcMain.handle('browser:getCurrentUrl', async () => {
    try {
      log.info('IPC: browser:getCurrentUrl');
      
      if (!currentPage) {
        return { success: false, error: '浏览器页面未打开' };
      }

      const url = currentPage.url();
      return { success: true, data: { url } };
    } catch (error: any) {
      log.error('IPC: browser:getCurrentUrl failed:', error);
      return { success: false, error: error.message || '获取 URL 失败' };
    }
  });

  // 获取页面内容
  ipcMain.handle('browser:getPageContent', async () => {
    try {
      log.info('IPC: browser:getPageContent');
      
      if (!currentPage) {
        return { success: false, error: '浏览器页面未打开' };
      }

      const content = await currentPage.content();
      return { success: true, data: { content } };
    } catch (error: any) {
      log.error('IPC: browser:getPageContent failed:', error);
      return { success: false, error: error.message || '获取页面内容失败' };
    }
  });

  // 执行 JavaScript
  ipcMain.handle('browser:evaluate', async (_event, script: string) => {
    try {
      log.info('IPC: browser:evaluate');
      
      if (!currentPage) {
        return { success: false, error: '浏览器页面未打开' };
      }

      const result = await currentPage.evaluate(script);
      return { success: true, data: { result } };
    } catch (error: any) {
      log.error('IPC: browser:evaluate failed:', error);
      return { success: false, error: error.message || '执行脚本失败' };
    }
  });

  // 设置 Cookies
  ipcMain.handle('browser:setCookies', async (_event, cookies: any[], url?: string) => {
    try {
      log.info(`IPC: browser:setCookies - ${cookies.length} cookies`);
      
      const service = getBrowserService();
      const context = service.getContext();
      
      if (!context) {
        return { success: false, error: '浏览器上下文未创建' };
      }
      
      // 添加 cookies 到上下文
      await context.addCookies(cookies.map(cookie => ({
        ...cookie,
        url: url || cookie.url
      })));

      return { success: true };
    } catch (error: any) {
      log.error('IPC: browser:setCookies failed:', error);
      return { success: false, error: error.message || '设置 Cookies 失败' };
    }
  });

  // 获取 Cookies
  ipcMain.handle('browser:getCookies', async (_event, url?: string) => {
    try {
      log.info('IPC: browser:getCookies');
      
      const service = getBrowserService();
      const context = service.getContext();
      
      if (!context) {
        return { success: false, error: '浏览器上下文未创建' };
      }
      
      const cookies = await context.cookies(url ? [url] : undefined);

      return { success: true, data: { cookies } };
    } catch (error: any) {
      log.error('IPC: browser:getCookies failed:', error);
      return { success: false, error: error.message || '获取 Cookies 失败' };
    }
  });

  // 检查登录状态
  ipcMain.handle('browser:checkLoginStatus', async (_event, accountId: string) => {
    try {
      log.info(`IPC: browser:checkLoginStatus - ${accountId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const account = accountService.findById(accountId);
      if (!account) {
        return { success: false, error: '账号不存在' };
      }

      // LoginStatusChecker.checkLoginStatus 需要 page 和 adapter
      // 这里简化处理：如果账号有 cookies 且状态为 active，认为已登录
      const isLoggedIn = account.status === 'active' && account.cookies !== null;

      // 更新账号登录状态
      const newStatus = isLoggedIn ? 'active' : 'inactive';
      if (account.status !== newStatus) {
        accountService.update(accountId, {
          status: newStatus
        });
      }

      return { success: true, data: { isLoggedIn } };
    } catch (error: any) {
      log.error('IPC: browser:checkLoginStatus failed:', error);
      return { success: false, error: error.message || '检查登录状态失败' };
    }
  });

  // 批量检查登录状态
  ipcMain.handle('browser:checkAllLoginStatus', async () => {
    try {
      log.info('IPC: browser:checkAllLoginStatus');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const accounts = accountService.findAll(user.id);
      const results: { accountId: string; isLoggedIn: boolean }[] = [];

      for (const account of accounts) {
        try {
          // 简化处理：如果账号有 cookies 且状态为 active，认为已登录
          const isLoggedIn = account.status === 'active' && account.cookies !== null;
          results.push({ accountId: account.id, isLoggedIn });

          // 更新账号登录状态
          const newStatus = isLoggedIn ? 'active' : 'inactive';
          if (account.status !== newStatus) {
            accountService.update(account.id, {
              status: newStatus
            });
          }
        } catch (err) {
          log.warn(`Failed to check login status for account ${account.id}:`, err);
          results.push({ accountId: account.id, isLoggedIn: false });
        }
      }

      return { success: true, data: { results } };
    } catch (error: any) {
      log.error('IPC: browser:checkAllLoginStatus failed:', error);
      return { success: false, error: error.message || '批量检查登录状态失败' };
    }
  });

  // 获取浏览器状态
  ipcMain.handle('browser:getStatus', async () => {
    try {
      log.info('IPC: browser:getStatus');
      
      const service = getBrowserService();
      const isLaunched = service.isBrowserRunning();

      return { 
        success: true, 
        data: { 
          isLaunched,
          hasPage: !!currentPage,
          currentUrl: currentPage?.url() || null
        } 
      };
    } catch (error: any) {
      log.error('IPC: browser:getStatus failed:', error);
      return { success: false, error: error.message || '获取浏览器状态失败' };
    }
  });

  log.info('Browser IPC handlers registered');
}

/**
 * 清理浏览器相关资源
 */
export async function cleanupBrowserHandlers(): Promise<void> {
  if (browserService) {
    try {
      await browserService.closeBrowser();
    } catch (err) {
      log.error('Failed to close browser service:', err);
    }
    browserService = null;
  }
  currentPage = null;
  loginChecker = null;
}
