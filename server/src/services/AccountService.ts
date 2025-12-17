import { pool } from '../db/database';
import { encryptionService } from './EncryptionService';

export interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  credentials?: any; // 解密后的凭证
  is_default: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
}

export interface CreateAccountInput {
  platform_id: string;
  account_name: string;
  credentials: any;
}

export interface UpdateAccountInput {
  account_name?: string;
  credentials?: any;
}

/**
 * 账号管理服务
 * 处理平台账号的CRUD操作
 */
export class AccountService {
  /**
   * 创建平台账号绑定
   */
  async createAccount(input: CreateAccountInput): Promise<Account> {
    // 验证凭证格式
    this.validateCredentials(input.credentials);
    
    // 加密凭证
    const encryptedCredentials = encryptionService.encryptObject(input.credentials);
    
    const result = await pool.query(
      `INSERT INTO platform_accounts 
       (platform, platform_id, account_name, credentials, status, is_default) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [input.platform_id, input.platform_id, input.account_name, encryptedCredentials, 'active', false]
    );
    
    const account = result.rows[0];
    
    // 返回时不包含加密的凭证
    return this.formatAccount(account, false);
  }
  
  /**
   * 获取所有账号（不返回凭证）
   */
  async getAllAccounts(): Promise<Account[]> {
    const result = await pool.query(
      `SELECT * FROM platform_accounts 
       ORDER BY created_at DESC`
    );
    
    return result.rows.map(row => this.formatAccount(row, false));
  }
  
  /**
   * 根据平台ID获取账号
   */
  async getAccountsByPlatform(platformId: string): Promise<Account[]> {
    const result = await pool.query(
      `SELECT * FROM platform_accounts 
       WHERE platform_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [platformId]
    );
    
    return result.rows.map(row => this.formatAccount(row, false));
  }
  
  /**
   * 根据ID获取账号（包含解密的凭证）
   */
  async getAccountById(accountId: number, includeCredentials: boolean = false): Promise<Account | null> {
    const result = await pool.query(
      'SELECT * FROM platform_accounts WHERE id = $1',
      [accountId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.formatAccount(result.rows[0], includeCredentials);
  }
  
  /**
   * 更新账号
   */
  async updateAccount(accountId: number, input: UpdateAccountInput): Promise<Account> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (input.account_name) {
      updates.push(`account_name = $${paramIndex}`);
      values.push(input.account_name);
      paramIndex++;
    }
    
    if (input.credentials) {
      this.validateCredentials(input.credentials);
      const encryptedCredentials = encryptionService.encryptObject(input.credentials);
      updates.push(`credentials = $${paramIndex}`);
      values.push(encryptedCredentials);
      paramIndex++;
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    values.push(accountId);
    
    const result = await pool.query(
      `UPDATE platform_accounts 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      throw new Error('账号不存在');
    }
    
    return this.formatAccount(result.rows[0], false);
  }
  
  /**
   * 删除账号
   */
  async deleteAccount(accountId: number): Promise<void> {
    const result = await pool.query(
      'DELETE FROM platform_accounts WHERE id = $1',
      [accountId]
    );
    
    if (result.rowCount === 0) {
      throw new Error('账号不存在');
    }
  }
  
  /**
   * 设置默认账号
   */
  async setDefaultAccount(platformId: string, accountId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 取消该平台所有账号的默认状态
      await client.query(
        'UPDATE platform_accounts SET is_default = false WHERE platform_id = $1',
        [platformId]
      );
      
      // 设置指定账号为默认
      const result = await client.query(
        'UPDATE platform_accounts SET is_default = true WHERE id = $1 AND platform_id = $2',
        [accountId, platformId]
      );
      
      if (result.rowCount === 0) {
        throw new Error('账号不存在或平台不匹配');
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * 获取平台的默认账号
   */
  async getDefaultAccount(platformId: string): Promise<Account | null> {
    const result = await pool.query(
      'SELECT * FROM platform_accounts WHERE platform_id = $1 AND is_default = true',
      [platformId]
    );
    
    if (result.rows.length === 0) {
      // 如果没有默认账号，返回第一个账号
      const firstResult = await pool.query(
        'SELECT * FROM platform_accounts WHERE platform_id = $1 ORDER BY created_at ASC LIMIT 1',
        [platformId]
      );
      
      if (firstResult.rows.length === 0) {
        return null;
      }
      
      return this.formatAccount(firstResult.rows[0], true);
    }
    
    return this.formatAccount(result.rows[0], true);
  }
  
  /**
   * 更新账号最后使用时间
   */
  async updateLastUsed(accountId: number): Promise<void> {
    await pool.query(
      'UPDATE platform_accounts SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [accountId]
    );
  }
  
  /**
   * 验证凭证格式
   */
  private validateCredentials(credentials: any): void {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('凭证格式无效');
    }
    
    // 如果是Cookie认证，不需要验证用户名密码
    if (credentials.cookies && Array.isArray(credentials.cookies)) {
      return;
    }
    
    // 基本验证：至少需要用户名和密码
    if (!credentials.username || !credentials.password) {
      throw new Error('凭证必须包含用户名和密码');
    }
    
    if (typeof credentials.username !== 'string' || credentials.username.trim() === '') {
      throw new Error('用户名格式无效');
    }
    
    if (typeof credentials.password !== 'string' || credentials.password.trim() === '') {
      throw new Error('密码格式无效');
    }
  }
  
  /**
   * 使用浏览器登录平台
   */
  async loginWithBrowser(platform: any): Promise<{ success: boolean; message?: string; account?: Account }> {
    let browser: any = null;
    
    try {
      const puppeteer = require('puppeteer');
      
      // 获取平台登录URL
      const loginUrl = this.getPlatformLoginUrl(platform.platform_id);
      
      if (!loginUrl) {
        return {
          success: false,
          message: `暂不支持 ${platform.platform_name} 的浏览器登录`
        };
      }
      
      console.log(`[浏览器登录] 启动浏览器，准备打开 ${platform.platform_name} 登录页面...`);
      
      // 查找系统Chrome路径
      const chromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome', // Linux
        '/usr/bin/chromium', // Linux Chromium
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows 32-bit
      ];
      
      let executablePath: string | undefined;
      const fs = require('fs');
      
      for (const path of chromePaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          console.log(`[浏览器登录] 找到Chrome: ${path}`);
          break;
        }
      }
      
      // 启动浏览器
      const launchOptions: any = {
        headless: false, // 显示浏览器窗口
        defaultViewport: {
          width: 1280,
          height: 800
        },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      };
      
      // 如果找到系统Chrome，使用它
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }
      
      browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      
      // 导航到登录页面
      console.log(`[浏览器登录] 正在打开登录页面: ${loginUrl}`);
      await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      console.log(`[浏览器登录] 已打开 ${platform.platform_name} 登录页面，等待用户登录...`);
      
      // 等待用户登录完成（检测URL变化或特定元素）
      await this.waitForLogin(page, platform.platform_id);
      
      console.log(`[浏览器登录] 检测到登录成功，正在获取Cookie...`);
      
      // 获取Cookie
      const cookies = await page.cookies();
      
      if (cookies.length === 0) {
        await browser.close();
        return {
          success: false,
          message: '未能获取到登录Cookie'
        };
      }
      
      console.log(`[浏览器登录] 成功获取 ${cookies.length} 个Cookie`);
      
      // 尝试获取用户信息
      const userInfo = await this.extractUserInfo(page, platform.platform_id);
      
      await browser.close();
      browser = null;
      
      // 保存账号信息
      const accountName = userInfo.username || `${platform.platform_name}_${Date.now()}`;
      
      // 将Cookie转换为凭证格式
      const credentials = {
        username: userInfo.username || 'browser_login',
        password: 'cookie_auth', // 标记为Cookie认证
        cookies: cookies,
        loginTime: new Date().toISOString(),
        userInfo: userInfo
      };
      
      console.log(`[浏览器登录] 正在保存账号信息: ${accountName}`);
      console.log(`[浏览器登录] Cookie数量: ${cookies.length}`);
      console.log(`[浏览器登录] 凭证数据:`, JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        cookieCount: credentials.cookies.length,
        loginTime: credentials.loginTime
      }));
      
      // 检查是否已存在相同用户名的账号
      const existingAccounts = await this.getAccountsByPlatform(platform.platform_id);
      console.log(`[浏览器登录] 平台 ${platform.platform_id} 现有账号数: ${existingAccounts.length}`);
      
      const existingAccount = existingAccounts.find(acc => 
        acc.account_name === accountName
      );
      
      let account: Account;
      
      try {
        if (existingAccount) {
          // 更新现有账号
          console.log(`[浏览器登录] 更新现有账号 ID: ${existingAccount.id}`);
          account = await this.updateAccount(existingAccount.id, {
            credentials
          });
          console.log(`[浏览器登录] 账号更新成功`);
        } else {
          // 创建新账号
          console.log(`[浏览器登录] 创建新账号，平台: ${platform.platform_id}, 账号名: ${accountName}`);
          account = await this.createAccount({
            platform_id: platform.platform_id,
            account_name: accountName,
            credentials
          });
          console.log(`[浏览器登录] 账号创建成功 ID: ${account.id}`);
        }
        
        console.log(`[浏览器登录] 账号保存成功 ID: ${account.id}, 平台: ${account.platform_id}, 名称: ${account.account_name}`);
        
        return {
          success: true,
          message: '登录成功',
          account
        };
      } catch (saveError: any) {
        console.error(`[浏览器登录] 保存账号失败:`, saveError);
        console.error(`[浏览器登录] 错误详情:`, {
          message: saveError.message,
          stack: saveError.stack
        });
        throw saveError;
      }
      
    } catch (error: any) {
      console.error('[浏览器登录] 失败:', error);
      
      // 确保浏览器被关闭
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('[浏览器登录] 关闭浏览器失败:', e);
        }
      }
      
      return {
        success: false,
        message: error.message || '浏览器登录失败'
      };
    }
  }
  
  /**
   * 获取平台登录URL
   */
  private getPlatformLoginUrl(platformId: string): string | null {
    const loginUrls: { [key: string]: string } = {
      // 主流自媒体平台
      'wangyi': 'https://mp.163.com/login.html',
      'souhu': 'https://mp.sohu.com/login',
      'baijiahao': 'https://baijiahao.baidu.com/builder/author/register/index',
      'toutiao': 'https://mp.toutiao.com/auth/page/login/',
      'qie': 'https://om.qq.com/userAuth/index',
      
      // 社交媒体平台
      'wechat': 'https://mp.weixin.qq.com/',
      'xiaohongshu': 'https://creator.xiaohongshu.com/login',
      'douyin': 'https://creator.douyin.com/',
      'bilibili': 'https://member.bilibili.com/platform/home',
      
      // 技术社区平台
      'zhihu': 'https://www.zhihu.com/signin',
      'jianshu': 'https://www.jianshu.com/sign_in',
      'csdn': 'https://passport.csdn.net/login',
      'juejin': 'https://juejin.cn/login',
      'segmentfault': 'https://segmentfault.com/user/login',
      'oschina': 'https://www.oschina.net/home/login',
      'cnblogs': 'https://account.cnblogs.com/signin',
      'v2ex': 'https://www.v2ex.com/signin'
    };
    
    return loginUrls[platformId] || null;
  }
  
  /**
   * 等待用户登录完成
   */
  private async waitForLogin(page: any, platformId: string): Promise<void> {
    const currentUrl = page.url();
    
    // 根据不同平台设置不同的等待条件
    const waitConditions: { [key: string]: () => Promise<void> } = {
      // 自媒体平台
      'wangyi': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'souhu': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'baijiahao': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('register') && !window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'toutiao': async () => {
        // 头条号登录后URL变化，不再包含 login 或 auth
        await page.waitForFunction(
          `!window.location.href.includes('login') && !window.location.href.includes('auth')`,
          { timeout: 300000 }
        );
        console.log(`[等待登录] 头条号登录成功，当前URL: ${page.url()}`);
      },
      'qie': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('userAuth') && !window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      
      // 社交媒体平台
      'wechat': async () => {
        await page.waitForFunction(
          `window.location.href.includes('home') || window.location.href.includes('cgi-bin')`,
          { timeout: 300000 }
        );
      },
      'xiaohongshu': async () => {
        await page.waitForFunction(
          `window.location.href.includes('creator.xiaohongshu.com') && !window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'douyin': async () => {
        await page.waitForFunction(
          `window.location.href.includes('creator.douyin.com') && !window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'bilibili': async () => {
        await page.waitForFunction(
          `window.location.href.includes('member.bilibili.com') && !window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      
      // 技术社区平台
      'zhihu': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('signin')`,
          { timeout: 300000 }
        );
      },
      'jianshu': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('sign_in')`,
          { timeout: 300000 }
        );
      },
      'csdn': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('login') && !window.location.href.includes('passport')`,
          { timeout: 300000 }
        );
      },
      'juejin': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'segmentfault': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'oschina': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('login')`,
          { timeout: 300000 }
        );
      },
      'cnblogs': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('signin')`,
          { timeout: 300000 }
        );
      },
      'v2ex': async () => {
        await page.waitForFunction(
          `!window.location.href.includes('signin')`,
          { timeout: 300000 }
        );
      }
    };
    
    const waitFn = waitConditions[platformId];
    
    if (waitFn) {
      console.log(`[等待登录] 使用 ${platformId} 特定的等待条件`);
      await waitFn();
    } else {
      // 默认等待：等待URL变化或5分钟超时
      console.log(`[等待登录] 使用默认等待条件，等待URL从 ${currentUrl} 变化`);
      await page.waitForFunction(
        `window.location.href !== "${currentUrl}"`,
        { timeout: 300000 }
      );
    }
    
    console.log(`[等待登录] 检测到URL变化，当前URL: ${page.url()}`);
    
    // 额外等待2秒确保Cookie设置完成
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  /**
   * 提取用户信息
   */
  private async extractUserInfo(page: any, platformId: string): Promise<any> {
    try {
      // 定义选择器映射
      const selectors: { [key: string]: string } = {
        // 自媒体平台
        'wangyi': '.user-info .name',
        'souhu': '.user-name',
        'baijiahao': '.author-name',
        'toutiao': '.user-name',
        'qie': '.user-info-name',
        
        // 社交媒体平台
        'wechat': '.account_info_title',
        'xiaohongshu': '.username',
        'douyin': '.semi-navigation-header-username',
        'bilibili': '.user-name',
        
        // 技术社区平台
        'zhihu': '.AppHeader-profile',
        'jianshu': '.user-name',
        'csdn': '.user-name',
        'juejin': '.username',
        'segmentfault': '.user-name',
        'oschina': '.user-name',
        'cnblogs': '.user-name',
        'v2ex': '.username'
      };
      
      const selector = selectors[platformId];
      
      if (!selector) {
        console.log(`[提取用户信息] ${platformId}: 未配置选择器，跳过提取`);
        return { username: '' };
      }
      
      // 使用$eval来避免TypeScript编译错误
      const username = await page.$eval(selector, (el: any) => el.textContent?.trim() || '').catch(() => '');
      
      console.log(`[提取用户信息] ${platformId}: ${username || '未提取到用户名'}`);
      return { username };
    } catch (error) {
      console.error('[提取用户信息] 失败:', error);
      return { username: '' };
    }
  }
  
  /**
   * 格式化账号数据
   */
  private formatAccount(row: any, includeCredentials: boolean): Account {
    const account: Account = {
      id: row.id,
      platform_id: row.platform_id,
      account_name: row.account_name,
      is_default: row.is_default,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_used_at: row.last_used_at
    };
    
    if (includeCredentials && row.credentials) {
      try {
        account.credentials = encryptionService.decryptObject(row.credentials);
      } catch (error) {
        console.error('解密凭证失败:', error);
        account.credentials = null;
      }
    }
    
    return account;
  }
}

export const accountService = new AccountService();
