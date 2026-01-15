/**
 * 哔哩哔哩适配器
 * 
 * 从服务器端迁移: server/src/services/adapters/BilibiliAdapter.ts
 * 改动说明:
 * - 修改导入语句为 ES 模块格式
 * - 此适配器不涉及图片路径处理，无需修改 resolveImagePath
 */

import { Page } from 'playwright';
import { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';

/**
 * 哔哩哔哩适配器
 * 参考 bili.js 登录器实现
 */
export class BilibiliAdapter extends PlatformAdapter {
  platformId = 'bilibili';
  platformName = '哔哩哔哩';

  getLoginUrl(): string {
    return 'https://passport.bilibili.com/login';
  }

  getPublishUrl(): string {
    return 'https://member.bilibili.com/platform/home';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[placeholder="请输入手机号"]',
      passwordInput: 'input[placeholder="请输入密码"]',
      submitButton: 'button:has-text("登录")',
      successIndicator: 'span.right-entry-text'
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
      await this.log('info', '开始登录哔哩哔哩');

      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '尝试使用 Cookie 登录');
        
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const isLoggedIn = await page.locator('span.right-entry-text').isVisible({ timeout: 5000 }).catch(() => false);
        
        if (isLoggedIn) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }

        await this.log('warning', 'Cookie 登录失败，需要手动登录');
      }

      await this.log('warning', '哔哩哔哩需要扫码或手动登录');
      return false;

    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
    try {
      await this.log('info', '开始发布哔哩哔哩文章', { title: article.title });
      await this.log('warning', '哔哩哔哩发布功能待完善');
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
   * 检查登录状态并获取用户信息
   * 最佳实践：检查 URL 重定向 + 多指标验证 + 容错处理
   */
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      await this.log('info', '🔍 检查哔哩哔哩登录状态...');
      
      // 首先检查 URL - 如果被重定向到登录页面，说明未登录
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('passport.bilibili.com')) {
        await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
        return false;
      }
      
      // 方法1：检查用户名元素（登录成功的标志）
      const usernameVisible = await page.locator('span.right-entry-text').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (usernameVisible) {
        try {
          const username = await page.locator('span.right-entry-text').textContent({ timeout: 3000 });
          if (username) {
            await this.log('info', `✅ 哔哩哔哩登录状态正常，用户: ${username.trim()}`);
          } else {
            await this.log('info', '✅ 哔哩哔哩登录状态正常');
          }
        } catch (e) {
          await this.log('info', '✅ 哔哩哔哩登录状态正常');
        }
        return true;
      }
      
      // 方法2：通过 API 检查登录状态
      try {
        const apiCheck = await page.evaluate(async () => {
          try {
            const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
              credentials: 'include'
            });
            const data = await response.json() as { data?: { isLogin?: boolean; uname?: string } };
            return {
              isLogin: data.data?.isLogin || false,
              username: data.data?.uname || ''
            };
          } catch (error) {
            return { isLogin: false, username: '' };
          }
        }) as { isLogin: boolean; username: string };
        
        if (apiCheck.isLogin) {
          await this.log('info', `✅ 哔哩哔哩登录状态正常（API验证），用户: ${apiCheck.username}`);
          return true;
        }
      } catch (e) {
        await this.log('warning', 'API检查失败，继续其他检查');
      }
      
      // 如果没有明确的登录/未登录信号，假设已登录（避免误判）
      await this.log('info', '✅ 未检测到登录页面，假设已登录');
      return true;
    } catch (error: any) {
      await this.log('error', '检查登录状态出错', { error: error.message });
      return true;
    }
  }
}
