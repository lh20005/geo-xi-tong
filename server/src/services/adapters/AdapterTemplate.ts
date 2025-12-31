import { Page } from 'playwright';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 平台适配器模板 (Playwright)
 * 
 * 使用方法：
 * 1. 复制此文件并重命名（如 ToutiaoAdapter.ts）
 * 2. 修改类名和平台信息
 * 3. 实现登录和发布逻辑
 * 4. 在 AdapterRegistry.ts 中注册
 * 
 * 示例：
 * export class ToutiaoAdapter extends PlatformAdapter {
 *   platformId = 'toutiao';
 *   platformName = '头条号';
 *   ...
 * }
 */
export class TemplateAdapter extends PlatformAdapter {
  platformId = 'template';
  platformName = '模板平台';

  /**
   * 获取登录页面URL
   */
  getLoginUrl(): string {
    return 'https://example.com/login';
  }

  /**
   * 获取发布页面URL
   */
  getPublishUrl(): string {
    return 'https://example.com/publish';
  }

  /**
   * 获取登录表单选择器
   * 使用浏览器开发者工具获取选择器
   */
  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="username"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'button[type="submit"]',
      successIndicator: '.user-avatar' // 登录成功后出现的元素
    };
  }

  /**
   * 获取发布表单选择器
   */
  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[name="title"]',
      contentEditor: '.editor',
      categorySelect: 'select[name="category"]', // 可选
      tagsInput: 'input[name="tags"]', // 可选
      coverImageUpload: 'input[type="file"]', // 可选
      publishButton: 'button.publish',
      successIndicator: '.success-message' // 发布成功后出现的元素
    };
  }

  /**
   * 执行登录流程
   * 优先使用 Cookie 登录，失败则使用表单登录
   */
  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      await this.log('info', '开始登录流程');

      // 1. 优先使用 Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '使用 Cookie 登录');
        
        // Cookie 已在 BrowserContext 中设置
        // 这里只需要验证登录状态
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        
        const currentUrl = page.url();
        if (!currentUrl.includes('login')) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }
        
        await this.log('warning', 'Cookie 登录失败，尝试表单登录');
      }

      // 2. 表单登录（后备方案）
      await this.log('info', '开始表单登录');
      await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle' });
      
      const selectors = this.getLoginSelectors();
      
      // 填写用户名
      await page.waitForSelector(selectors.usernameInput);
      await page.fill(selectors.usernameInput, credentials.username);
      
      // 填写密码
      await page.fill(selectors.passwordInput, credentials.password);
      
      // 点击登录按钮
      await page.click(selectors.submitButton);
      
      // 等待登录完成
      await page.waitForTimeout(3000);
      
      await this.log('info', '表单登录成功');
      return true;
    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 执行发布流程
   */
  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      await this.log('info', '开始发布流程');
      await this.log('info', `文章标题: ${article.title}`);

      // 1. 导航到发布页面
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      
      const selectors = this.getPublishSelectors();

      // 2. 填写标题
      await this.log('info', '填写标题');
      await page.waitForSelector(selectors.titleInput);
      await page.fill(selectors.titleInput, config.title || article.title);

      // 3. 填写内容
      await this.log('info', '填写内容');
      await page.waitForSelector(selectors.contentEditor);
      
      // 清理内容（移除 HTML 和图片标记）
      const cleanContent = this.cleanArticleContent(article.content);
      await page.fill(selectors.contentEditor, cleanContent);

      // 4. 填写分类（如果需要）
      if (config.category && selectors.categorySelect) {
        await this.log('info', '选择分类');
        await page.selectOption(selectors.categorySelect, config.category);
      }

      // 5. 填写标签（如果需要）
      if (config.tags && selectors.tagsInput) {
        await this.log('info', '填写标签');
        await page.fill(selectors.tagsInput, config.tags.join(','));
      }

      // 6. 点击发布按钮
      await this.log('info', '点击发布按钮');
      await page.click(selectors.publishButton);

      // 7. 等待发布完成
      await page.waitForTimeout(5000);

      await this.log('info', '发布成功');
      return true;
    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      return false;
    }
  }

  /**
   * 验证发布成功
   */
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
