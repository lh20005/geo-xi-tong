import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './base';

/**
 * CSDN适配器
 * 参考 csdn.js 登录器实现
 */
export class CSDNAdapter extends PlatformAdapter {
  platformId = 'csdn';
  platformName = 'CSDN';

  getLoginUrl(): string {
    return 'https://passport.csdn.net/login';
  }

  getPublishUrl(): string {
    return 'https://mp.csdn.net/mp_blog/creation/editor';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: '.hasAvatar'
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
      await this.log('info', '开始登录CSDN');

      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        // 注意：executor.ts 已经设置了 Cookie 并导航到发布页面
        // 这里不需要再次导航，直接检查登录状态即可
        await page.waitForTimeout(3000);

        // 使用多重验证的 checkLoginStatus 方法，避免误判
        const isLoggedIn = await this.checkLoginStatus(page);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', 'CSDN需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布CSDN文章', { title: article.title });
      await this.log('warning', 'CSDN发布功能待完善');
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
   * 最佳实践：
   * 1. 首先检查 URL 重定向（最可靠的未登录信号）
   * 2. 多元素检查作为备选
   * 3. 如果没有明确的未登录信号，默认假设已登录（避免误判）
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 检查CSDN登录状态...');
      
      // 等待页面稳定
      await page.waitForTimeout(2000);
      
      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('passport.csdn.net')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 方法1：检查头像元素（登录成功的标志）
      const avatarVisible = await page.locator('.hasAvatar').isVisible({ timeout: 5000 }).catch(() => false);
      if (avatarVisible) {
        await this.log('info', '✅ CSDN登录状态正常（检测到头像）');
        return true;
      }
      
      // 方法2：检查用户名元素
      const usernameVisible = await page.locator('.toolbar-btn-username').isVisible({ timeout: 3000 }).catch(() => false);
      if (usernameVisible) {
        await this.log('info', '✅ CSDN登录状态正常（检测到用户名）');
        return true;
      }
      
      // 方法3：检查编辑器页面特有元素（说明在编辑页面且已登录）
      const editorVisible = await page.locator('.editor-container, .article-bar').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (editorVisible) {
        await this.log('info', '✅ CSDN登录状态正常（检测到编辑器）');
        return true;
      }
      
      // 方法4：检查是否有"登录"按钮（未登录的明确信号）
      const hasLoginButton = await page.getByRole('link', { name: '登录' }).isVisible({ timeout: 2000 }).catch(() => false);
      if (hasLoginButton) {
        await this.log('warning', '❌ 检测到登录按钮，Cookie已失效');
        return false;
      }
      
      // 如果没有明确的登录/未登录信号，假设已登录（避免误判）
      await this.log('info', '✅ 未检测到明确的未登录信号，假设已登录');
      return true;
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      // 出错时不要轻易判定为未登录，避免误判
      return true;
    }
  }
}
