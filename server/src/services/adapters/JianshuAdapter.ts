import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';

/**
 * 简书适配器
 * 参考 js.js 登录器实现
 */
export class JianshuAdapter extends PlatformAdapter {
  platformId = 'jianshu';
  platformName = '简书';

  getLoginUrl(): string {
    return 'https://www.jianshu.com/sign_in';
  }

  getPublishUrl(): string {
    return 'https://www.jianshu.com/writer';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: '.avatar>img'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[placeholder*="请输入标题"]',
      contentEditor: '.ProseMirror',
      publishButton: 'button:has-text("发布")',
      successIndicator: 'text=发布成功'
    };
  }

  async performLogin(page: Page, credentials: any): Promise<boolean> {
    try {
      await this.log('info', '开始登录简书');

      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const isLoggedIn = await page.locator('.avatar>img').isVisible({ timeout: 5000 }).catch(() => false);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', '简书需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布简书文章', { title: article.title });
      await this.log('warning', '简书发布功能待完善');
      return false;
    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      return false;
    }
  }

  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      await this.log('info', '等待发布结果...');
      await page.waitForTimeout(3000);
      
      const successTexts = ['发布成功', '发布完成', '已发布'];
      for (const text of successTexts) {
        const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasText) {
          return true;
        }
      }
      return false;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * 检查登录状态
   * 最佳实践：检查 URL 重定向 + 多指标验证 + 严格检测
   * 
   * 简书特点：
   * 1. 未登录访问 /writer 会重定向到 /sign_in
   * 2. 登录后页面有 .avatar>img 头像元素
   * 3. 登录后导航栏有 .user 用户区域
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 开始检查简书登录状态...');
      
      // 等待页面加载完成
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      
      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      await this.log('info', `当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('/sign_in') || currentUrl.includes('/sign_up') || currentUrl.includes('/login')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 方法1：检查头像元素（登录成功的主要标志）
      const avatarVisible = await page.locator('.avatar>img').isVisible({ timeout: 5000 }).catch(() => false);
      if (avatarVisible) {
        await this.log('info', '✅ 检测到头像元素，登录状态正常');
        return true;
      }
      
      // 方法2：检查导航栏用户区域
      const userAreaVisible = await page.locator('.user').isVisible({ timeout: 3000 }).catch(() => false);
      if (userAreaVisible) {
        await this.log('info', '✅ 检测到用户区域，登录状态正常');
        return true;
      }
      
      // 方法3：检查导航栏中的用户图片
      const navUserImg = await page.locator('nav .user img, nav img.avatar').isVisible({ timeout: 3000 }).catch(() => false);
      if (navUserImg) {
        await this.log('info', '✅ 检测到导航栏用户图片，登录状态正常');
        return true;
      }
      
      // 方法4：检查是否有"写文章"按钮（只有登录后才能看到）
      const writeButton = await page.locator('a[href="/writer"], button:has-text("写文章")').isVisible({ timeout: 3000 }).catch(() => false);
      if (writeButton) {
        await this.log('info', '✅ 检测到写文章按钮，登录状态正常');
        return true;
      }
      
      // 方法5：检查页面是否有登录/注册按钮（未登录的标志）
      const loginButton = await page.locator('a:has-text("登录"), button:has-text("登录"), a:has-text("注册")').isVisible({ timeout: 3000 }).catch(() => false);
      if (loginButton) {
        await this.log('warning', '❌ 检测到登录/注册按钮，Cookie已失效');
        return false;
      }
      
      // 如果所有检测都没有明确结果，默认返回 false（严格模式）
      await this.log('warning', '❌ 未检测到任何登录标志，Cookie可能已失效');
      return false;
      
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      // 出错时返回 false，触发重新登录
      return false;
    }
  }
}
