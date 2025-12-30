import { pool } from '../db/database';
import { encryptionService } from './EncryptionService';
import { getStandardBrowserConfig, findChromeExecutable } from '../config/browserConfig';

export interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string; // 平台真实用户名
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
  real_username?: string;
  credentials: any;
}

export interface UpdateAccountInput {
  account_name?: string;
  real_username?: string;
  status?: string;
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
  async createAccount(input: CreateAccountInput, userId: number): Promise<Account> {
    // 验证凭证格式
    this.validateCredentials(input.credentials);
    
    // 加密凭证
    const encryptedCredentials = encryptionService.encryptObject(input.credentials);
    
    const result = await pool.query(
      `INSERT INTO platform_accounts 
       (platform, platform_id, account_name, credentials, user_id, status, is_default) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [input.platform_id, input.platform_id, input.account_name, encryptedCredentials, userId, 'active', false]
    );
    
    const account = result.rows[0];
    
    // 返回时不包含加密的凭证
    return this.formatAccount(account, false);
  }
  
  /**
   * 创建平台账号绑定（包含真实用户名）
   */
  async createAccountWithRealUsername(input: CreateAccountInput, realUsername: string, userId: number): Promise<Account> {
    // 验证凭证格式
    this.validateCredentials(input.credentials);
    
    // 加密凭证
    const encryptedCredentials = encryptionService.encryptObject(input.credentials);
    
    const result = await pool.query(
      `INSERT INTO platform_accounts 
       (platform, platform_id, account_name, credentials, real_username, user_id, status, is_default) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [input.platform_id, input.platform_id, input.account_name, encryptedCredentials, realUsername, userId, 'active', false]
    );
    
    const account = result.rows[0];
    
    // 返回时不包含加密的凭证
    return this.formatAccount(account, false);
  }
  
  /**
   * 创建或更新账号（去重逻辑）
   * 如果同一平台的同一用户名已存在，则更新；否则创建新账号
   */
  async createOrUpdateAccount(input: CreateAccountInput, realUsername: string, userId: number): Promise<{ account: Account; isNew: boolean }> {
    console.log('[AccountService] createOrUpdateAccount 开始');
    console.log('[AccountService] platform_id:', input.platform_id);
    console.log('[AccountService] account_name:', input.account_name);
    console.log('[AccountService] realUsername:', realUsername);
    console.log('[AccountService] userId:', userId);
    
    // 验证凭证格式
    try {
      console.log('[AccountService] 开始验证凭证格式');
      this.validateCredentials(input.credentials);
      console.log('[AccountService] 凭证格式验证通过');
    } catch (error: any) {
      console.error('[AccountService] 凭证验证失败:', error.message);
      throw error;
    }
    
    // 检查是否已存在相同的账号（同一用户下）
    // 使用 real_username 作为唯一标识（如果提供），否则使用 account_name
    const uniqueIdentifier = realUsername || input.account_name;
    
    console.log('[AccountService] 检查是否存在重复账号, uniqueIdentifier:', uniqueIdentifier);
    
    const existingResult = await pool.query(
      `SELECT * FROM platform_accounts 
       WHERE platform_id = $1 
       AND user_id = $2
       AND (real_username = $3 OR (real_username IS NULL AND account_name = $3))
       LIMIT 1`,
      [input.platform_id, userId, uniqueIdentifier]
    );
    
    if (existingResult.rows.length > 0) {
      // 账号已存在，更新凭证和时间
      const existingAccount = existingResult.rows[0];
      console.log(`[账号去重] 发现已存在账号 ID: ${existingAccount.id}, 平台: ${input.platform_id}, 用户名: ${uniqueIdentifier}`);
      
      console.log('[AccountService] 开始加密凭证（更新）');
      const encryptedCredentials = encryptionService.encryptObject(input.credentials);
      console.log('[AccountService] 凭证加密完成，长度:', encryptedCredentials.length);
      
      const updateResult = await pool.query(
        `UPDATE platform_accounts 
         SET credentials = $1, 
             real_username = $2,
             account_name = $3,
             updated_at = CURRENT_TIMESTAMP,
             last_used_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [encryptedCredentials, realUsername, input.account_name, existingAccount.id, userId]
      );
      
      console.log(`[账号去重] 已更新账号 ID: ${existingAccount.id}`);
      
      return {
        account: this.formatAccount(updateResult.rows[0], false),
        isNew: false
      };
    } else {
      // 账号不存在，创建新账号
      console.log(`[账号去重] 创建新账号，平台: ${input.platform_id}, 用户名: ${uniqueIdentifier}`);
      
      console.log('[AccountService] 开始加密凭证（新建）');
      const encryptedCredentials = encryptionService.encryptObject(input.credentials);
      console.log('[AccountService] 凭证加密完成，长度:', encryptedCredentials.length);
      
      const insertResult = await pool.query(
        `INSERT INTO platform_accounts 
         (platform, platform_id, account_name, credentials, real_username, user_id, status, is_default) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [input.platform_id, input.platform_id, input.account_name, encryptedCredentials, realUsername, userId, 'active', false]
      );
      
      console.log(`[账号去重] 已创建新账号 ID: ${insertResult.rows[0].id}`);
      
      return {
        account: this.formatAccount(insertResult.rows[0], false),
        isNew: true
      };
    }
  }
  
  /**
   * 获取所有账号（不返回凭证）- 仅返回当前用户的账号
   */
  async getAllAccounts(userId: number): Promise<Account[]> {
    const result = await pool.query(
      `SELECT * FROM platform_accounts 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows.map(row => this.formatAccount(row, false));
  }
  
  /**
   * 根据平台ID获取账号 - 仅返回当前用户的账号
   */
  async getAccountsByPlatform(platformId: string, userId: number): Promise<Account[]> {
    const result = await pool.query(
      `SELECT * FROM platform_accounts 
       WHERE platform_id = $1 AND user_id = $2
       ORDER BY is_default DESC, created_at DESC`,
      [platformId, userId]
    );
    
    return result.rows.map(row => this.formatAccount(row, false));
  }
  
  /**
   * 根据ID获取账号（包含解密的凭证）- 验证所有权
   */
  async getAccountById(accountId: number, userId: number, includeCredentials: boolean = false): Promise<Account | null> {
    const result = await pool.query(
      'SELECT * FROM platform_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.formatAccount(result.rows[0], includeCredentials);
  }
  
  /**
   * 更新账号
   */
  async updateAccount(accountId: number, input: UpdateAccountInput, userId: number): Promise<Account> {
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
    values.push(userId);
    
    const result = await pool.query(
      `UPDATE platform_accounts 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      throw new Error('账号不存在或无权访问');
    }
    
    return this.formatAccount(result.rows[0], false);
  }
  
  /**
   * 更新账号（包含真实用户名）
   */
  async updateAccountWithRealUsername(accountId: number, input: UpdateAccountInput, realUsername: string, userId: number): Promise<Account> {
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
    
    // 更新真实用户名
    if (realUsername) {
      updates.push(`real_username = $${paramIndex}`);
      values.push(realUsername);
      paramIndex++;
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    values.push(accountId);
    values.push(userId);
    
    const result = await pool.query(
      `UPDATE platform_accounts 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      throw new Error('账号不存在或无权访问');
    }
    
    return this.formatAccount(result.rows[0], false);
  }
  
  /**
   * 删除账号 - 验证所有权
   */
  async deleteAccount(accountId: number, userId: number): Promise<void> {
    const result = await pool.query(
      'DELETE FROM platform_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    
    if (result.rowCount === 0) {
      throw new Error('账号不存在或无权访问');
    }
  }
  
  /**
   * 设置默认账号 - 仅在当前用户的账号中设置
   */
  async setDefaultAccount(platformId: string, accountId: number, userId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 取消该平台该用户所有账号的默认状态
      await client.query(
        'UPDATE platform_accounts SET is_default = false WHERE platform_id = $1 AND user_id = $2',
        [platformId, userId]
      );
      
      // 设置指定账号为默认（验证所有权）
      const result = await client.query(
        'UPDATE platform_accounts SET is_default = true WHERE id = $1 AND platform_id = $2 AND user_id = $3',
        [accountId, platformId, userId]
      );
      
      if (result.rowCount === 0) {
        throw new Error('账号不存在、平台不匹配或无权访问');
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
  async loginWithBrowser(platform: any, userId: number): Promise<{ success: boolean; message?: string; account?: Account }> {
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
      
      console.log(`\n========================================`);
      console.log(`[浏览器登录] 开始登录流程`);
      console.log(`[浏览器登录] 平台: ${platform.platform_name} (${platform.platform_id})`);
      console.log(`[浏览器登录] 登录URL: ${loginUrl}`);
      console.log(`========================================\n`);
      
      // 查找系统Chrome路径
      const executablePath = findChromeExecutable();
      
      // 使用统一的浏览器配置（参照头条号配置，使用最大化窗口）
      const launchOptions = getStandardBrowserConfig({
        headless: false, // 显示浏览器窗口
        executablePath
      });
      
      console.log(`[浏览器登录] 正在启动浏览器...`);
      browser = await puppeteer.launch(launchOptions);
      console.log(`[浏览器登录] 浏览器启动成功`);
      
      const page = await browser.newPage();
      console.log(`[浏览器登录] 创建新页面成功`);
      
      // 导航到登录页面
      console.log(`[浏览器登录] 正在导航到登录页面...`);
      await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`[浏览器登录] 页面加载完成，当前URL: ${page.url()}`);
      
      console.log(`[浏览器登录] 等待用户完成登录...`);
      
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
      
      // 平台特殊处理：某些平台需要导航到特定页面才能提取用户名
      const platformsNeedingNavigation: { [key: string]: { url: string; waitTime: number } } = {
        'douyin': {
          url: 'https://creator.douyin.com/creator-micro/home',
          waitTime: 5000
        },
        'souhu': {
          url: 'https://mp.sohu.com/mpfe/v3/main/index',
          waitTime: 4000
        },
        'xiaohongshu': {
          url: 'https://creator.xiaohongshu.com/creator/home',
          waitTime: 3000
        },
        'jianshu': {
          url: 'https://www.jianshu.com/',
          waitTime: 3000
        }
        // 注意：微信公众号和哔哩哔哩不需要导航，登录成功后已经在正确页面
      };
      
      const navConfig = platformsNeedingNavigation[platform.platform_id];
      if (navConfig) {
        console.log(`[浏览器登录] ${platform.platform_name}：检查是否需要导航到主页...`);
        
        const currentUrl = page.url();
        const targetUrl = navConfig.url;
        
        // 检查当前URL是否已经是目标页面（或其子页面）
        const isAlreadyOnTargetPage = currentUrl.includes(new URL(targetUrl).pathname);
        
        if (isAlreadyOnTargetPage) {
          console.log(`[浏览器登录] ${platform.platform_name}：已在目标页面，无需导航`);
          console.log(`[浏览器登录] ${platform.platform_name}：当前URL: ${currentUrl}`);
          // 等待页面渲染完成
          await new Promise(resolve => setTimeout(resolve, navConfig.waitTime));
        } else {
          console.log(`[浏览器登录] ${platform.platform_name}：导航到主页以提取用户名...`);
          try {
            await page.goto(navConfig.url, { 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            // 等待页面渲染完成
            await new Promise(resolve => setTimeout(resolve, navConfig.waitTime));
            console.log(`[浏览器登录] ${platform.platform_name}：已导航到主页，当前URL: ${page.url()}`);
          } catch (navError: any) {
            console.log(`[浏览器登录] ${platform.platform_name}：导航到主页失败: ${navError.message}`);
            // 继续尝试提取，可能当前页面已经有用户名
          }
        }
      } else {
        // 对于没有特殊导航配置的平台，等待1秒确保页面加载完成
        console.log(`[浏览器登录] ${platform.platform_name}：等待页面完全加载...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 尝试获取用户信息
      const userInfo = await this.extractUserInfo(page, platform.platform_id);
      
      await browser.close();
      browser = null;
      
      // 保存账号信息
      const accountName = userInfo.username || `${platform.platform_name}_${Date.now()}`;
      const realUsername = userInfo.username || ''; // 提取真实用户名
      
      // 将Cookie转换为凭证格式
      const credentials = {
        username: userInfo.username || 'browser_login',
        password: 'cookie_auth', // 标记为Cookie认证
        cookies: cookies,
        loginTime: new Date().toISOString(),
        userInfo: userInfo
      };
      
      console.log(`\n========================================`);
      console.log(`[浏览器登录] 准备保存账号信息`);
      console.log(`[浏览器登录] 平台ID: ${platform.platform_id}`);
      console.log(`[浏览器登录] 平台名称: ${platform.platform_name}`);
      console.log(`[浏览器登录] 账号名称: ${accountName}`);
      console.log(`[浏览器登录] 真实用户名: ${realUsername || '未提取到'}`);
      console.log(`[浏览器登录] Cookie数量: ${cookies.length}`);
      console.log(`[浏览器登录] 用户ID: ${userId}`);
      console.log(`[浏览器登录] 凭证数据:`, JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        cookieCount: credentials.cookies.length,
        loginTime: credentials.loginTime,
        userInfo: credentials.userInfo
      }, null, 2));
      console.log(`========================================\n`);
      
      // 检查是否已存在相同用户名的账号（仅当前用户）
      const existingAccounts = await this.getAccountsByPlatform(platform.platform_id, userId);
      console.log(`[浏览器登录] 平台 ${platform.platform_id} 现有账号数: ${existingAccounts.length}`);
      
      const existingAccount = existingAccounts.find(acc => 
        acc.account_name === accountName
      );
      
      let account: Account;
      
      try {
        if (existingAccount) {
          // 更新现有账号（包括真实用户名）
          console.log(`[浏览器登录] 更新现有账号 ID: ${existingAccount.id}`);
          account = await this.updateAccountWithRealUsername(existingAccount.id, {
            credentials
          }, realUsername, userId);
          console.log(`[浏览器登录] 账号更新成功`);
        } else {
          // 创建新账号（包括真实用户名）
          console.log(`[浏览器登录] 创建新账号，平台: ${platform.platform_id}, 账号名: ${accountName}`);
          account = await this.createAccountWithRealUsername({
            platform_id: platform.platform_id,
            account_name: accountName,
            credentials
          }, realUsername, userId);
          console.log(`[浏览器登录] 账号创建成功 ID: ${account.id}`);
        }
        
        console.log(`[浏览器登录] 账号保存成功 ID: ${account.id}, 平台: ${account.platform_id}, 名称: ${account.account_name}, 真实用户名: ${account.real_username || '未设置'}`);
        
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
      'souhu': 'https://mp.sohu.com/mpfe/v4/login',
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
   * 根据不同平台使用不同的检测策略
   */
  private async waitForLogin(page: any, platformId: string): Promise<void> {
    const initialUrl = page.url();
    console.log(`[等待登录] ${platformId} 平台 - 初始URL: ${initialUrl}`);
    
    // 定义各平台的登录成功检测策略
    const loginDetectionStrategies: { [key: string]: () => Promise<void> } = {
      // 抖音：检测特定元素
      'douyin': async () => {
        console.log(`[等待登录] 抖音平台：等待登录成功元素出现...`);
        try {
          await page.waitForSelector('#douyin-creator-master-side-upload-wrap', { timeout: 300000 });
          console.log(`[等待登录] 抖音平台：检测到登录成功元素`);
        } catch (e) {
          console.log(`[等待登录] 抖音平台：元素检测超时，尝试URL变化检测...`);
          await page.waitForFunction(`window.location.href !== "${initialUrl}"`, { timeout: 60000 });
        }
      },
      
      // 头条号：URL变化检测（已验证成功）
      'toutiao': async () => {
        console.log(`[等待登录] 头条号：等待URL变化...`);
        await page.waitForFunction(`window.location.href !== "${initialUrl}"`, { timeout: 300000 });
      },
      
      // 搜狐号：检测登录成功后的元素或URL变化
      'souhu': async () => {
        console.log(`[等待登录] 搜狐号：等待登录成功...`);
        console.log(`[等待登录] 搜狐号：初始URL: ${initialUrl}`);
        
        try {
          // 关键修复：必须同时满足两个条件
          // 1. URL不再是登录页面（不包含login）
          // 2. URL包含创作者中心路径（支持多种可能的路径）
          console.log(`[等待登录] 搜狐号：等待URL跳转到创作者中心（不包含login）...`);
          
          await page.waitForFunction(
            `!window.location.href.includes('login') && 
             window.location.href.includes('mp.sohu.com/mpfe/') &&
             (window.location.href.includes('/main/') || 
              window.location.href.includes('/index') ||
              window.location.href.includes('/home') ||
              window.location.href.includes('/contentManagement/') ||
              window.location.href.includes('/page'))`,
            { timeout: 300000 }
          );
          
          const currentUrl = page.url();
          console.log(`[等待登录] 搜狐号：✅ URL已跳转到创作者中心: ${currentUrl}`);
          
          // 额外验证：等待3秒确保页面稳定
          console.log(`[等待登录] 搜狐号：等待3秒确保页面稳定...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 验证是否真的在创作者中心（检查是否有用户信息元素）
          try {
            console.log(`[等待登录] 搜狐号：验证是否有用户信息元素...`);
            await page.waitForSelector('.user-info, .user-name, .header-user-name', { timeout: 10000 });
            console.log(`[等待登录] 搜狐号：✅ 确认检测到用户信息元素，登录成功！`);
          } catch (e) {
            console.log(`[等待登录] 搜狐号：⚠️ 未检测到用户信息元素，但URL已变化，继续执行`);
          }
          
        } catch (e) {
          console.log(`[等待登录] 搜狐号：❌ URL检测超时，登录可能失败`);
          throw new Error('搜狐号登录超时：URL未跳转到创作者中心');
        }
      },
      
      // 小红书：检测创作者中心元素
      'xiaohongshu': async () => {
        console.log(`[等待登录] 小红书：等待登录成功...`);
        try {
          // 尝试检测创作者中心特定元素
          await page.waitForSelector('.username, .user-name, [class*="username"]', { timeout: 300000 });
          console.log(`[等待登录] 小红书：检测到用户信息元素`);
        } catch (e) {
          // 备用：URL变化
          await page.waitForFunction(`window.location.href !== "${initialUrl}"`, { timeout: 60000 });
        }
      },
      
      // 微信公众号：检测账号信息
      'wechat': async () => {
        console.log(`[等待登录] 微信公众号：等待登录成功...`);
        console.log(`[等待登录] 微信公众号：初始URL: ${initialUrl}`);
        
        try {
          // 第一步：等待URL跳转到后台页面（包含cgi-bin和token参数）
          console.log(`[等待登录] 微信公众号：等待URL跳转...`);
          await page.waitForFunction(
            `window.location.href.includes('mp.weixin.qq.com/cgi-bin/') && 
             window.location.href.includes('token=')`,
            { timeout: 300000 }
          );
          
          const currentUrl = page.url();
          console.log(`[等待登录] 微信公众号：✅ URL已跳转到后台: ${currentUrl}`);
          
          // 第二步：等待侧边栏账号信息元素出现（最多3秒）
          // 一旦检测到元素就立即继续，不需要等待完整的3秒
          console.log(`[等待登录] 微信公众号：等待账号信息元素加载（最多3秒）...`);
          
          try {
            await page.waitForSelector('.weui-desktop-account__info, .mp_account_box, #js_mp_sidemenu', { timeout: 3000 });
            console.log(`[等待登录] 微信公众号：✅ 检测到账号信息元素，登录成功！`);
          } catch (e) {
            // 3秒后元素还没出现，但URL已经正确，也认为登录成功
            console.log(`[等待登录] 微信公众号：⚠️ 3秒内未检测到账号信息元素，但URL已包含token，继续执行`);
          }
          
        } catch (e) {
          console.log(`[等待登录] 微信公众号：❌ 登录检测超时`);
          throw new Error('微信公众号登录超时：URL未跳转');
        }
      },
      
      // B站：检测用户信息
      'bilibili': async () => {
        console.log(`[等待登录] B站：等待登录成功...`);
        console.log(`[等待登录] B站：初始URL: ${initialUrl}`);
        
        try {
          // 第一步：等待URL跳转到创作者中心
          console.log(`[等待登录] B站：等待URL跳转到创作者中心...`);
          await page.waitForFunction(
            `window.location.href.includes('member.bilibili.com/platform')`,
            { timeout: 300000 }
          );
          
          const currentUrl = page.url();
          console.log(`[等待登录] B站：✅ URL已跳转到创作者中心: ${currentUrl}`);
          
          // 第二步：等待头部登录图标元素加载（最多3秒）
          // 这是登录成功最可靠的标志
          console.log(`[等待登录] B站：等待头部登录图标加载（最多3秒）...`);
          try {
            await page.waitForSelector('#app > div.cc-header > div > div.right-block > span:nth-child(1) > span > a > img, .cc-header .right-block img, .bili-avatar', { timeout: 3000 });
            console.log(`[等待登录] B站：✅ 检测到头部登录图标，登录成功！`);
          } catch (e) {
            console.log(`[等待登录] B站：⚠️ 3秒内未检测到登录图标，但URL已正确，继续执行`);
          }
          
        } catch (e) {
          console.log(`[等待登录] B站：❌ 登录检测超时`);
          throw new Error('B站登录超时：URL未跳转到创作者中心');
        }
      },
      
      // 知乎：检测用户头像或名称
      'zhihu': async () => {
        console.log(`[等待登录] 知乎：等待登录成功...`);
        console.log(`[等待登录] 知乎：初始URL: ${initialUrl}`);
        
        try {
          // 关键修复：知乎登录成功后会跳转到首页
          // 检测条件：URL不包含signin且是知乎域名
          console.log(`[等待登录] 知乎：等待URL跳转（不包含signin）...`);
          
          await page.waitForFunction(
            `!window.location.href.includes('signin') && 
             !window.location.href.includes('login') &&
             window.location.href.includes('zhihu.com')`,
            { timeout: 300000 }
          );
          
          const currentUrl = page.url();
          console.log(`[等待登录] 知乎：✅ URL已跳转: ${currentUrl}`);
          
          // 等待3秒确保页面稳定
          console.log(`[等待登录] 知乎：等待3秒确保页面稳定...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 尝试验证用户信息元素（可选）
          try {
            console.log(`[等待登录] 知乎：验证是否有用户信息元素...`);
            await page.waitForSelector('.AppHeader-profile, .Profile-name, .Avatar, [class*="Avatar"]', { timeout: 10000 });
            console.log(`[等待登录] 知乎：✅ 确认检测到用户信息元素，登录成功！`);
          } catch (e) {
            console.log(`[等待登录] 知乎：⚠️ 未检测到用户信息元素，但URL已变化，继续执行`);
          }
          
        } catch (e) {
          console.log(`[等待登录] 知乎：❌ URL检测超时，登录可能失败`);
          throw new Error('知乎登录超时：URL未跳转');
        }
      },
      
      // 企鹅号：跳过注册确认页面，等待到达创作者中心
      'qie': async () => {
        console.log(`[等待登录] 企鹅号：等待登录成功...`);
        console.log(`[等待登录] 企鹅号：初始URL: ${initialUrl}`);
        
        try {
          // 关键修复：企鹅号登录后会先跳转到注册确认页面
          // https://om.qq.com/userReg/register
          // 然后才跳转到创作者中心
          // https://om.qq.com/main 或其他页面
          // 检测条件：URL不包含userAuth、userReg、register、login，且包含om.qq.com
          console.log(`[等待登录] 企鹅号：等待URL跳转到创作者中心（跳过注册确认页）...`);
          
          await page.waitForFunction(
            `!window.location.href.includes('userAuth') && 
             !window.location.href.includes('userReg') &&
             !window.location.href.includes('register') &&
             !window.location.href.includes('login') &&
             window.location.href.includes('om.qq.com') &&
             (window.location.href.includes('/main') ||
              window.location.href.includes('/article') ||
              window.location.href.includes('/content'))`,
            { timeout: 300000 }
          );
          
          const currentUrl = page.url();
          console.log(`[等待登录] 企鹅号：✅ URL已跳转到创作者中心: ${currentUrl}`);
          
          // 等待3秒确保页面稳定
          console.log(`[等待登录] 企鹅号：等待3秒确保页面稳定...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 尝试验证用户信息元素（可选）
          try {
            console.log(`[等待登录] 企鹅号：验证是否有用户信息元素...`);
            await page.waitForSelector('.user-info-name, .user-name, [class*="user"]', { timeout: 10000 });
            console.log(`[等待登录] 企鹅号：✅ 确认检测到用户信息元素，登录成功！`);
          } catch (e) {
            console.log(`[等待登录] 企鹅号：⚠️ 未检测到用户信息元素，但URL已变化，继续执行`);
          }
          
        } catch (e) {
          console.log(`[等待登录] 企鹅号：❌ URL检测超时，登录可能失败`);
          throw new Error('企鹅号登录超时：URL未跳转到创作者中心');
        }
      },
      
      // 简书：简单检测URL变化即可
      'jianshu': async () => {
        console.log(`[等待登录] 简书：等待登录成功...`);
        console.log(`[等待登录] 简书：初始URL: ${initialUrl}`);
        
        // 简单检测：URL从登录页跳转到首页
        console.log(`[等待登录] 简书：等待URL跳转到首页...`);
        await page.waitForFunction(
          `window.location.href === 'https://www.jianshu.com/' || 
           (window.location.href.includes('jianshu.com') && 
            !window.location.href.includes('sign_in') && 
            !window.location.href.includes('sign_up'))`,
          { timeout: 300000 }
        );
        
        const currentUrl = page.url();
        console.log(`[等待登录] 简书：✅ URL已跳转到: ${currentUrl}`);
        console.log(`[等待登录] 简书：登录成功！`);
      }
    };
    
    // 使用平台特定策略，或默认URL变化检测
    const strategy = loginDetectionStrategies[platformId];
    
    if (strategy) {
      await strategy();
    } else {
      // 默认策略：URL变化检测
      console.log(`[等待登录] ${platformId}：使用默认URL变化检测...`);
      await page.waitForFunction(
        `window.location.href !== "${initialUrl}"`,
        { timeout: 300000 }
      );
    }
    
    const finalUrl = page.url();
    console.log(`[等待登录] ${platformId} 登录成功，当前URL: ${finalUrl}`);
    
    // 额外等待2秒确保Cookie设置完成和页面渲染
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  /**
   * 提取用户信息
   */
  private async extractUserInfo(page: any, platformId: string): Promise<any> {
    try {
      console.log(`\n========================================`);
      console.log(`[提取用户信息] 开始提取 ${platformId} 平台的用户名`);
      console.log(`[提取用户信息] 当前页面URL: ${page.url()}`);
      
      // 定义选择器映射（支持多个选择器尝试）
      const selectors: { [key: string]: string[] } = {
        // 自媒体平台 - 已优化和测试
        'wangyi': [
          // 网易号创作者中心
          '.user-info .name',
          '.user-name',
          '.username',
          '.account-name',
          '[class*="user-name"]',
          '[class*="username"]'
        ],
        'souhu': [
          // 搜狐号创作者中心 - 优先级从高到低
          '.user-info .name',           // 优先级1：用户信息区域的名称
          '.header-user-name',          // 优先级2：头部用户名
          '.user-name',                 // 优先级3：通用用户名
          '.username',                  // 优先级4：用户名
          '.account-name',              // 优先级5：账号名
          '.author-name',               // 优先级6：作者名
          '[class*="user-name"]',       // 优先级7：包含user-name的class
          '[class*="username"]',        // 优先级8：包含username的class
          '[class*="account"]'          // 优先级9：包含account的class
        ],
        'baijiahao': [
          // 百家号创作者中心
          '.author-name',
          '.user-name',
          '.username',
          '.account-name',
          '[class*="author-name"]',
          '[class*="user-name"]'
        ],
        'toutiao': [
          // 头条号创作者中心（已测试成功）
          '.auth-avator-name',
          '.semi-navigation-header-username',
          '.user-name',
          '.username', 
          '.account-name',
          '[class*="username"]',
          '[class*="user-name"]'
        ],
        'qie': [
          // 企鹅号（腾讯内容开放平台）
          '.user-info-name',
          '.user-name',
          '.username',
          '.account-name',
          '[class*="user-name"]',
          '[class*="username"]'
        ],
        
        // 社交媒体平台 - 已优化
        'wechat': [
          // 微信公众号 - 使用精确的侧边栏账号信息选择器
          '.weui-desktop-account__info',      // 优先级1：侧边栏账号信息容器（最可靠）
          '.weui-desktop-account__nickname',  // 优先级2：账号昵称
          '.mp_account_box .weui-desktop-account__info', // 优先级3：账号信息框内的信息
          '#js_account_name',                 // 优先级4：账号名称ID
          '.account_info_title',              // 优先级5：账号信息标题
          '.account-name',                    // 优先级6：账号名称
          '.user-name',                       // 优先级7：用户名
          '.username',                        // 优先级8：用户名
          '[class*="account"]',               // 优先级9：包含account的class
          '[class*="user-name"]'              // 优先级10：包含user-name的class
        ],
        'xiaohongshu': [
          // 小红书创作者中心
          '.username',
          '.user-name',
          '.nickname',
          '.author-name',
          '[class*="username"]',
          '[class*="nickname"]'
        ],
        'douyin': [
          // 抖音创作者中心（已测试成功）
          '.name-_lSSDc',
          '.header-_F2uzl .name-_lSSDc',
          '.left-zEzdJX .name-_lSSDc',
          '[class*="name-"][class*="_"]',
          '.semi-navigation-header-username',
          '.username',
          '.user-name',
          '[class*="username"]',
          '[class*="user-name"]'
        ],
        'bilibili': [
          // B站创作者中心 - 使用头部登录区域的元素
          '.cc-header .right-block img',  // 优先级1：头部登录图标（最可靠）
          '.bili-avatar',                 // 优先级2：B站头像
          '.user-name',                   // 优先级3：用户名
          '.username',                    // 优先级4：用户名
          '.uname',                       // 优先级5：UP主名称
          '.up-name',                     // 优先级6：UP主名称
          '[class*="user-name"]',         // 优先级7：包含user-name的class
          '[class*="username"]'           // 优先级8：包含username的class
        ],
        
        // 技术社区平台 - 已优化
        'zhihu': [
          // 知乎
          '.AppHeader-profile',
          '.Profile-name',
          '.username',
          '.user-name',
          '[class*="Profile"]',
          '[class*="username"]'
        ],
        'jianshu': [
          // 简书 - 使用导航栏登录区域的元素
          'nav .user img',                     // 优先级1：导航栏用户头像图标（最可靠）
          'body > nav > div > div.user > div > a > img', // 优先级2：完整路径
          'nav .user div',                     // 优先级3：用户区域
          '.avatar',                           // 优先级4：头像
          '.user-name',                        // 优先级5：用户名
          '.username',                         // 优先级6：用户名
          '.nickname',                         // 优先级7：昵称
          '.author-name',                      // 优先级8：作者名
          '[class*="user-name"]',              // 优先级9：包含user-name的class
          '[class*="nickname"]'                // 优先级10：包含nickname的class
        ],
        'csdn': [
          // CSDN
          '.user-name',
          '.username',
          '.nick-name',
          '.user-profile-name',
          '[class*="user-name"]',
          '[class*="username"]'
        ],
        'juejin': [
          // 掘金
          '.username',
          '.user-name',
          '.author-name',
          '[class*="username"]',
          '[class*="user-name"]'
        ],
        'segmentfault': [
          // SegmentFault
          '.user-name',
          '.username',
          '.author-name',
          '[class*="user-name"]',
          '[class*="username"]'
        ],
        'oschina': [
          // 开源中国
          '.user-name',
          '.username',
          '.author-name',
          '[class*="user-name"]',
          '[class*="username"]'
        ],
        'cnblogs': [
          // 博客园
          '.user-name',
          '.username',
          '.author-name',
          '[class*="user-name"]',
          '[class*="username"]'
        ],
        'v2ex': [
          // V2EX
          '.username',
          '.user-name',
          '[class*="username"]',
          '[class*="user-name"]'
        ]
      };
      
      const selectorList = selectors[platformId];
      
      if (!selectorList || selectorList.length === 0) {
        console.log(`[提取用户信息] ${platformId}: 未配置选择器，跳过提取`);
        console.log(`========================================\n`);
        return { username: '' };
      }
      
      console.log(`[提取用户信息] ${platformId}: 尝试 ${selectorList.length} 个选择器`);
      
      // 尝试所有选择器
      let username = '';
      for (let i = 0; i < selectorList.length; i++) {
        const selector = selectorList[i];
        console.log(`[提取用户信息] 尝试选择器 ${i + 1}/${selectorList.length}: ${selector}`);
        
        try {
          // 先检查元素是否存在
          const element = await page.$(selector);
          if (element) {
            console.log(`[提取用户信息] ✅ 找到元素: ${selector}`);
            username = await page.$eval(selector, (el: any) => el.textContent?.trim() || '');
            
            if (username) {
              console.log(`[提取用户信息] ✅ 成功提取用户名: "${username}"`);
              break;
            } else {
              console.log(`[提取用户信息] ⚠️  元素存在但内容为空`);
            }
          } else {
            console.log(`[提取用户信息] ❌ 未找到元素: ${selector}`);
          }
        } catch (error: any) {
          console.log(`[提取用户信息] ❌ 选择器出错: ${selector}, 错误: ${error.message}`);
        }
      }
      
      if (!username) {
        console.log(`[提取用户信息] ⚠️  所有选择器都未能提取到用户名`);
        console.log(`[提取用户信息] 💡 建议：检查页面HTML结构，更新选择器配置`);
        
        // 尝试打印页面标题作为参考
        try {
          const pageTitle = await page.title();
          console.log(`[提取用户信息] 页面标题: ${pageTitle}`);
        } catch (e) {
          // ignore
        }
        
        // 保存页面HTML用于调试
        try {
          const fs = require('fs');
          const path = require('path');
          const html = await page.content();
          const debugDir = path.join(process.cwd(), 'debug');
          
          // 确保debug目录存在
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          
          const filename = `${platformId}_${Date.now()}.html`;
          const filepath = path.join(debugDir, filename);
          fs.writeFileSync(filepath, html);
          console.log(`[提取用户信息] 📄 已保存页面HTML: ${filepath}`);
          console.log(`[提取用户信息] 💡 请打开此文件，搜索用户名，找到对应的HTML元素`);
        } catch (saveError) {
          console.error(`[提取用户信息] 保存HTML失败:`, saveError);
        }
      }
      
      console.log(`========================================\n`);
      return { username };
    } catch (error) {
      console.error('[提取用户信息] 失败:', error);
      console.log(`========================================\n`);
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
    
    // 优先从数据库字段读取真实用户名
    if (row.real_username) {
      account.real_username = row.real_username;
    }
    
    // 如果数据库没有，尝试从凭证中提取（向后兼容）
    if (!account.real_username && row.credentials) {
      try {
        const decryptedCredentials = encryptionService.decryptObject(row.credentials);
        
        // 提取真实用户名（优先使用 userInfo.username，其次使用 username）
        if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
          account.real_username = decryptedCredentials.userInfo.username;
        } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
          account.real_username = decryptedCredentials.username;
        }
        
        // 如果需要包含完整凭证
        if (includeCredentials) {
          account.credentials = decryptedCredentials;
        }
      } catch (error) {
        console.error('解密凭证失败:', error);
        if (includeCredentials) {
          account.credentials = null;
        }
      }
    } else if (includeCredentials && row.credentials) {
      // 如果只需要凭证但不需要提取用户名
      try {
        const decryptedCredentials = encryptionService.decryptObject(row.credentials);
        account.credentials = decryptedCredentials;
      } catch (error) {
        console.error('解密凭证失败:', error);
        account.credentials = null;
      }
    }
    
    return account;
  }

  /**
   * 测试账号登录
   * 使用保存的Cookie打开浏览器并导航到平台，由用户自己查看登录状态
   */
  async testAccountLogin(accountId: number, userId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const puppeteer = require('puppeteer');
      
      // 获取账号信息（包含凭证）
      const account = await this.getAccountById(accountId, userId, true);
      
      if (!account) {
        return {
          success: false,
          message: '账号不存在或无权访问'
        };
      }
      
      if (!account.credentials || !account.credentials.cookies) {
        return {
          success: false,
          message: '账号未保存Cookie信息'
        };
      }
      
      // 获取平台信息
      const platformResult = await pool.query(
        'SELECT * FROM platforms_config WHERE platform_id = $1',
        [account.platform_id]
      );
      
      if (platformResult.rows.length === 0) {
        return {
          success: false,
          message: '平台配置不存在'
        };
      }
      
      const platform = platformResult.rows[0];
      
      // 获取平台主页URL
      const homeUrl = this.getPlatformHomeUrl(account.platform_id);
      
      if (!homeUrl) {
        return {
          success: false,
          message: `暂不支持 ${platform.platform_name} 的登录测试`
        };
      }
      
      console.log(`\n========================================`);
      console.log(`[登录测试] 打开浏览器供用户查看`);
      console.log(`[登录测试] 平台: ${platform.platform_name} (${account.platform_id})`);
      console.log(`[登录测试] 账号: ${account.account_name}`);
      console.log(`[登录测试] 真实用户名: ${account.real_username || '未知'}`);
      console.log(`[登录测试] 主页URL: ${homeUrl}`);
      console.log(`========================================\n`);
      
      // 查找系统Chrome路径
      const executablePath = findChromeExecutable();
      
      // 使用统一的浏览器配置
      const launchOptions = getStandardBrowserConfig({
        headless: false, // 显示浏览器窗口
        executablePath
      });
      
      console.log(`[登录测试] 正在启动浏览器...`);
      const browser = await puppeteer.launch(launchOptions);
      console.log(`[登录测试] 浏览器启动成功`);
      
      const page = await browser.newPage();
      console.log(`[登录测试] 创建新页面成功`);
      
      // 设置Cookie
      console.log(`[登录测试] 正在设置Cookie (${account.credentials.cookies.length}个)...`);
      await page.setCookie(...account.credentials.cookies);
      console.log(`[登录测试] Cookie设置成功`);
      
      // 导航到平台主页
      console.log(`[登录测试] 正在导航到平台主页...`);
      await page.goto(homeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`[登录测试] 页面加载完成，当前URL: ${page.url()}`);
      
      console.log(`\n========================================`);
      console.log(`[登录测试] 浏览器已打开，请用户自行查看登录状态`);
      console.log(`[登录测试] 用户可以自行关闭浏览器窗口`);
      console.log(`========================================\n`);
      
      // 更新最后使用时间
      await this.updateLastUsed(accountId);
      
      // 不关闭浏览器，让用户自己查看和关闭
      // 浏览器实例会在用户手动关闭窗口后自动清理
      
      return {
        success: true,
        message: '浏览器已打开，请查看登录状态。查看完毕后请手动关闭浏览器窗口。'
      };
      
    } catch (error: any) {
      console.error('[登录测试] 失败:', error);
      
      return {
        success: false,
        message: error.message || '打开浏览器失败'
      };
    }
  }
  
  /**
   * 获取平台主页URL
   */
  private getPlatformHomeUrl(platformId: string): string | null {
    const homeUrls: { [key: string]: string } = {
      // 主流自媒体平台
      'wangyi': 'https://mp.163.com/',
      'souhu': 'https://mp.sohu.com/mpfe/v3/main/index',
      'baijiahao': 'https://baijiahao.baidu.com/builder/rc/home',
      'toutiao': 'https://mp.toutiao.com/profile_v4/index',
      'qie': 'https://om.qq.com/main',  // 修复：改为主页而非登录页
      
      // 社交媒体平台
      'wechat': 'https://mp.weixin.qq.com/',
      'xiaohongshu': 'https://creator.xiaohongshu.com/creator/home',
      'douyin': 'https://creator.douyin.com/creator-micro/home',
      'bilibili': 'https://member.bilibili.com/platform/home',
      
      // 技术社区平台
      'zhihu': 'https://www.zhihu.com/',
      'jianshu': 'https://www.jianshu.com/',
      'csdn': 'https://www.csdn.net/',
      'juejin': 'https://juejin.cn/',
      'segmentfault': 'https://segmentfault.com/',
      'oschina': 'https://www.oschina.net/',
      'cnblogs': 'https://www.cnblogs.com/',
      'v2ex': 'https://www.v2ex.com/'
    };
    
    return homeUrls[platformId] || null;
  }
}

export const accountService = new AccountService();
