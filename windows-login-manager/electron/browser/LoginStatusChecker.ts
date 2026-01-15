/**
 * 登录状态检测器
 * 
 * 从服务器端迁移: server/src/services/LoginStatusChecker.ts
 * 改动说明:
 * - 保持原有业务逻辑不变
 * - 调整导入路径
 */

import { Page } from 'playwright';
import { PlatformAdapter } from '../adapters/PlatformAdapter';

/**
 * 用户信息接口
 */
export interface UserInfo {
  platform: string;
  avatar: string;
  account: string;
  name: string;
  cookies: any[];
  follower_count?: string;
}

/**
 * 登录状态检测器
 * 
 * 核心思路：
 * 1. 定时检查特定的DOM元素（如用户头像、用户名）
 * 2. 如果元素存在 = 已登录
 * 3. 如果元素不存在 = 未登录或已掉线
 */
export class LoginStatusChecker {
  /**
   * 检查登录状态（单次检查）
   * @param page Playwright页面对象
   * @param adapter 平台适配器
   * @returns 是否已登录
   */
  static async checkLoginStatus(page: Page, adapter: PlatformAdapter): Promise<boolean> {
    try {
      const selectors = adapter.getLoginSelectors();
      const successIndicator = selectors.successIndicator;

      if (!successIndicator) {
        console.error('登录成功标志选择器未定义');
        return false;
      }

      // 检查登录成功标志元素是否存在
      const isLoggedIn = await page.locator(successIndicator).isVisible({ timeout: 3000 }).catch(() => false);

      return isLoggedIn;
    } catch (error) {
      console.error('检查登录状态失败:', error);
      return false;
    }
  }

  /**
   * 持续检查登录状态（定时轮询）
   * 
   * @param page Playwright页面对象
   * @param adapter 平台适配器
   * @param intervalMs 检查间隔（毫秒），默认2000ms
   * @param maxAttempts 最大尝试次数，默认30次（1分钟）
   * @returns Promise<boolean> 是否检测到登录成功
   */
  static async waitForLogin(
    page: Page,
    adapter: PlatformAdapter,
    intervalMs: number = 2000,
    maxAttempts: number = 30
  ): Promise<boolean> {
    console.log(`[${adapter.platformName}] 开始检测登录状态，每${intervalMs}ms检查一次，最多尝试${maxAttempts}次`);

    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[${adapter.platformName}] 第${attempts}次检查登录状态...`);

      const isLoggedIn = await this.checkLoginStatus(page, adapter);

      if (isLoggedIn) {
        console.log(`[${adapter.platformName}] ✅ 检测到登录成功`);
        return true;
      } else {
        console.log(`[${adapter.platformName}] ⏳ 还未登录成功，等待${intervalMs}ms后重试...`);
      }

      // 等待指定时间后再次检查
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    console.log(`[${adapter.platformName}] ❌ 超过最大尝试次数，登录检测失败`);
    return false;
  }

  /**
   * 验证Cookie是否有效（在发布前检查）
   * 这是关键方法：在每次发布前都检查一次登录状态
   * 
   * @param page Playwright页面对象
   * @param adapter 平台适配器
   * @returns Promise<boolean> Cookie是否有效
   */
  static async verifyCookieValid(page: Page, adapter: PlatformAdapter): Promise<boolean> {
    try {
      console.log(`[${adapter.platformName}] 🔍 验证Cookie是否有效...`);

      // 导航到发布页面
      await page.goto(adapter.getPublishUrl(), { waitUntil: 'networkidle', timeout: 30000 });

      // 等待页面加载
      await page.waitForTimeout(2000);

      // 检查登录状态
      const isLoggedIn = await this.checkLoginStatus(page, adapter);

      if (isLoggedIn) {
        console.log(`[${adapter.platformName}] ✅ Cookie有效，已登录`);
        return true;
      } else {
        console.log(`[${adapter.platformName}] ❌ Cookie无效或已过期，需要重新登录`);
        return false;
      }
    } catch (error: any) {
      console.error(`[${adapter.platformName}] Cookie验证失败:`, error.message);
      return false;
    }
  }

  /**
   * 提取用户信息
   * 在检测到登录成功后，提取用户信息
   * 
   * @param page Playwright页面对象
   * @param adapter 平台适配器
   * @returns Promise<UserInfo | null> 用户信息
   */
  static async extractUserInfo(page: Page, adapter: PlatformAdapter): Promise<UserInfo | null> {
    try {
      console.log(`[${adapter.platformName}] 📝 提取用户信息...`);

      const selectors = adapter.getLoginSelectors();
      const successIndicator = selectors.successIndicator;

      if (!successIndicator) {
        console.log(`[${adapter.platformName}] ❌ 登录成功标志选择器未定义`);
        return null;
      }

      // 检查登录状态
      const isLoggedIn = await page.locator(successIndicator).isVisible({ timeout: 3000 }).catch(() => false);

      if (!isLoggedIn) {
        console.log(`[${adapter.platformName}] ❌ 未登录，无法提取用户信息`);
        return null;
      }

      // 提取用户信息（根据不同平台的选择器）
      const userInfo: UserInfo = {
        platform: adapter.platformId,
        avatar: '',
        account: '',
        name: '',
        cookies: await page.context().cookies()
      };

      // 尝试提取头像
      try {
        const avatarElement = await page.locator(successIndicator).first();
        if (await avatarElement.isVisible({ timeout: 1000 })) {
          const src = await avatarElement.getAttribute('src');
          if (src) {
            userInfo.avatar = src;
          }
        }
      } catch (e) {
        console.log(`[${adapter.platformName}] 无法提取头像`);
      }

      // 尝试提取用户名
      try {
        const nameElement = await page.locator(successIndicator).first();
        if (await nameElement.isVisible({ timeout: 1000 })) {
          const name = await nameElement.textContent();
          if (name) {
            userInfo.name = name.trim();
          }
        }
      } catch (e) {
        console.log(`[${adapter.platformName}] 无法提取用户名`);
      }

      console.log(`[${adapter.platformName}] ✅ 用户信息提取成功:`, userInfo);
      return userInfo;
    } catch (error: any) {
      console.error(`[${adapter.platformName}] 提取用户信息失败:`, error.message);
      return null;
    }
  }

  /**
   * 检测平台是否掉线（在发布过程中）
   * 如果检测到掉线，返回false
   * 
   * @param page Playwright页面对象
   * @param adapter 平台适配器
   * @returns Promise<boolean> 是否在线
   */
  static async isOnline(page: Page, adapter: PlatformAdapter): Promise<boolean> {
    try {
      const isLoggedIn = await this.checkLoginStatus(page, adapter);

      if (!isLoggedIn) {
        console.log(`[${adapter.platformName}] ⚠️ 检测到平台已掉线`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[${adapter.platformName}] 在线状态检测失败:`, error);
      return false;
    }
  }

  /**
   * 监控登录状态（持续监控）
   * 在发布过程中，每隔一段时间检查一次登录状态
   * 
   * @param page Playwright页面对象
   * @param adapter 平台适配器
   * @param onStatusChange 状态变化回调
   * @param intervalMs 检查间隔（毫秒），默认10000ms（10秒）
   * @returns 停止监控的函数
   */
  static startMonitoring(
    page: Page,
    adapter: PlatformAdapter,
    onStatusChange: (isOnline: boolean) => void,
    intervalMs: number = 10000
  ): () => void {
    console.log(`[${adapter.platformName}] 🔍 开始监控登录状态，每${intervalMs}ms检查一次`);

    let lastStatus = true; // 假设初始状态是在线的

    const intervalId = setInterval(async () => {
      const currentStatus = await this.isOnline(page, adapter);

      // 状态发生变化时触发回调
      if (currentStatus !== lastStatus) {
        console.log(`[${adapter.platformName}] 📢 登录状态变化: ${lastStatus ? '在线' : '离线'} -> ${currentStatus ? '在线' : '离线'}`);
        lastStatus = currentStatus;
        onStatusChange(currentStatus);
      }
    }, intervalMs);

    // 返回停止监控的函数
    return () => {
      console.log(`[${adapter.platformName}] 🛑 停止监控登录状态`);
      clearInterval(intervalId);
    };
  }
}
