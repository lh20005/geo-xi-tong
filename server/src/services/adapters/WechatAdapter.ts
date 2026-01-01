import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';

/**
 * 微信公众号适配器
 * 参考 wxgzh.js 登录器实现
 */
export class WechatAdapter extends PlatformAdapter {
  platformId = 'wechat';
  platformName = '微信公众号';

  getLoginUrl(): string {
    return 'https://mp.weixin.qq.com/';
  }

  getPublishUrl(): string {
    return 'https://mp.weixin.qq.com/';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: '',
      passwordInput: '',
      submitButton: '',
      successIndicator: '.weui-desktop_name'
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
      await this.log('info', '开始登录微信公众号');

      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const isLoggedIn = await page.locator('.weui-desktop_name').isVisible({ timeout: 5000 }).catch(() => false);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', '微信公众号需要扫码登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布微信公众号文章', { title: article.title });
      await this.log('warning', '微信公众号发布功能待完善');
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
}
