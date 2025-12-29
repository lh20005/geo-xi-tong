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
      
      // 抖音平台特殊处理：登录后需要导航到首页才能提取用户名
      if (platform.platform_id === 'douyin') {
        console.log(`[浏览器登录] 抖音平台：导航到创作者中心首页以提取用户名...`);
        try {
          await page.goto('https://creator.douyin.com/creator-micro/home', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          // 额外等待页面渲染完成（增加到5秒）
          await new Promise(resolve => setTimeout(resolve, 5000));
          console.log(`[浏览器登录] 抖音平台：已导航到首页，当前URL: ${page.url()}`);
          
          // 等待用户名元素出现
          try {
            await page.waitForSelector('.name-_lSSDc', { timeout: 10000 });
            console.log(`[浏览器登录] 抖音平台：用户名元素已加载`);
          } catch (e) {
            console.log(`[浏览器登录] 抖音平台：等待用户名元素超时，尝试继续提取`);
          }
        } catch (navError: any) {
          console.log(`[浏览器登录] 抖音平台：导航到首页失败: ${navError.message}`);
          // 继续尝试提取，可能当前页面已经有用户名
        }
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
      console.log(`[浏览器登录] 账号名称: ${accountName}`);
      console.log(`[浏览器登录] 真实用户名: ${realUsername || '未提取到'}`);
      console.log(`[浏览器登录] Cookie数量: ${cookies.length}`);
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
   * 统一使用简单的URL变化检测（参考头条号成功经验）
   */
  private async waitForLogin(page: any, platformId: string): Promise<void> {
    const initialUrl = page.url();
    console.log(`[等待登录] ${platformId} 平台 - 初始URL: ${initialUrl}`);
    
    // 抖音平台特殊处理：检测登录成功元素而不是URL变化
    if (platformId === 'douyin') {
      console.log(`[等待登录] 抖音平台：等待登录成功元素出现...`);
      try {
        // 等待高清发布按钮出现（登录成功的标志）
        await page.waitForSelector('#douyin-creator-master-side-upload-wrap', { timeout: 300000 });
        console.log(`[等待登录] 抖音平台：检测到登录成功元素`);
      } catch (e) {
        // 备用方案：等待URL变化
        console.log(`[等待登录] 抖音平台：元素检测超时，尝试URL变化检测...`);
        await page.waitForFunction(
          `window.location.href !== "${initialUrl}"`,
          { timeout: 60000 }
        );
      }
    } else {
      // 其他平台：等待URL变化
      await page.waitForFunction(
        `window.location.href !== "${initialUrl}"`,
        { timeout: 300000 }
      );
    }
    
    const finalUrl = page.url();
    console.log(`[等待登录] ${platformId} 登录成功，当前URL: ${finalUrl}`);
    
    // 额外等待2秒确保Cookie设置完成
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
        // 自媒体平台
        'wangyi': ['.user-info .name', '.user-name', '.username'],
        'souhu': ['.user-name', '.username', '.account-name'],
        'baijiahao': ['.author-name', '.user-name', '.username'],
        'toutiao': [
          '.auth-avator-name',
          '.user-name',
          '.username', 
          '.account-name',
          '[class*="username"]',
          '[class*="user-name"]',
          '.semi-navigation-header-username'
        ],
        'qie': ['.user-info-name', '.user-name', '.username'],
        
        // 社交媒体平台
        'wechat': ['.account_info_title', '.user-name', '.username'],
        'xiaohongshu': ['.username', '.user-name', '.nickname'],
        'douyin': [
          // 优先级1: 抖音创作者中心特定选择器（从HTML快照中提取，最可靠）
          '.name-_lSSDc',
          '.header-_F2uzl .name-_lSSDc',
          '.left-zEzdJX .name-_lSSDc',
          // 优先级2: 通配符选择器（匹配动态class名）
          '[class*="name-"][class*="_"]',
          // 优先级3: 通用选择器（备用）
          '.semi-navigation-header-username',
          '.username',
          '.user-name',
          '[class*="username"]',
          '[class*="user-name"]'
        ],
        'bilibili': ['.user-name', '.username', '.uname'],
        
        // 技术社区平台
        'zhihu': ['.AppHeader-profile', '.username', '.user-name'],
        'jianshu': ['.user-name', '.username', '.nickname'],
        'csdn': ['.user-name', '.username', '.nick-name'],
        'juejin': ['.username', '.user-name'],
        'segmentfault': ['.user-name', '.username'],
        'oschina': ['.user-name', '.username'],
        'cnblogs': ['.user-name', '.username'],
        'v2ex': ['.username', '.user-name']
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
}

export const accountService = new AccountService();
