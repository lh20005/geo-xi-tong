import { Page } from 'puppeteer';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 微信公众号适配器
 * 注意：微信公众号需要扫码登录，自动化发布较为复杂
 */
export class WechatAdapter extends PlatformAdapter {
  platformId = 'wechat';
  platformName = '微信公众号';

  getLoginUrl(): string {
    return 'https://mp.weixin.qq.com/';
  }

  getPublishUrl(): string {
    return 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10&token=';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: '', // 微信使用扫码登录
      passwordInput: '',
      submitButton: '',
      successIndicator: '.weui-desktop-account__nickname'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: '#js_appmsg_title',
      contentEditor: '#edui1_iframeholder',
      coverImageUpload: '#js_cover_img_upload',
      publishButton: '#js_send',
      successIndicator: '.weui-desktop-dialog__wrp'
    };
  }

  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // 优先使用Cookie登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        console.log('[微信公众号] 使用Cookie登录');
        
        await page.goto('https://mp.weixin.qq.com/', { waitUntil: 'networkidle2' });
        const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
        
        if (loginSuccess && await this.verifyCookieLogin(page)) {
          console.log('✅ 微信公众号Cookie登录成功');
          return true;
        }
        
        console.log('[微信公众号] Cookie登录失败');
      }
      
      // 微信公众号需要扫码登录
      console.log('⚠️  微信公众号需要扫码登录，请手动扫码');
      
      // 等待登录成功：URL跳转到包含token的后台页面
      try {
        await page.waitForFunction(
          `window.location.href.includes('mp.weixin.qq.com/cgi-bin/') && 
           window.location.href.includes('token=')`,
          { timeout: 60000 }
        );
        
        console.log('✅ 微信公众号登录成功');
        return true;
      } catch (e) {
        console.error('❌ 微信公众号登录超时');
        return false;
      }
    } catch (error: any) {
      console.error('❌ 微信公众号登录失败:', error.message);
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      const path = require('path');
      const selectors = this.getPublishSelectors();
      await page.waitForSelector(selectors.titleInput, { timeout: 10000 });

      const title = config.title || article.title;
      await this.safeType(page, selectors.titleInput, title, { delay: 50 });
      console.log(`[微信公众号] ✅ 标题已填写: ${title}`);

      // 微信公众号使用iframe编辑器，需要特殊处理
      const iframeElement = await page.$(selectors.contentEditor);
      if (iframeElement) {
        const frame = await iframeElement.contentFrame();
        if (frame) {
          // 构建包含base64图片的HTML
          const serverBasePath = path.join(__dirname, '../../../');
          const htmlContent = await this.buildHtmlWithImages(article, serverBasePath);
          
          // 在iframe中设置内容
          await frame.evaluate((html: string) => {
            const body = (window as any).document.body;
            if (body) {
              body.innerHTML = html;
              // 触发事件
              body.dispatchEvent(new Event('input', { bubbles: true }));
              body.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, htmlContent);
          
          console.log('[微信公众号] ✅ 内容已通过iframe DOM设置');
        }
      }

      await this.waitForPageLoad(page, 5000);
      await this.safeClick(page, selectors.publishButton);

      const success = await this.verifyPublishSuccess(page);
      if (success) {
        console.log('✅ 微信公众号文章发布成功');
      }
      return success;
    } catch (error: any) {
      console.error('❌ 微信公众号文章发布失败:', error.message);
      return false;
    }
  }

  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      const selectors = this.getPublishSelectors();
      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 10000 });
        return true;
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}
