/**
 * 平台账号服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的平台账号
 * - 处理账号凭证（加密存储）
 * - 管理账号状态
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import { encryptObject, tryDecryptObject } from '../utils/encryption';
import log from 'electron-log';

/**
 * 平台账号接口
 */
export interface PlatformAccount {
  id: string;  // integer (as string)
  user_id: number;
  platform: string;
  platform_id?: string;
  account_name?: string;
  real_username?: string;
  credentials?: string;  // 加密存储
  cookies?: string;      // 加密存储
  status: string;
  is_default: boolean;
  error_message?: string;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * 解密后的账号接口
 */
export interface DecryptedPlatformAccount extends Omit<PlatformAccount, 'credentials' | 'cookies'> {
  credentials: any | null;
  cookies: any[] | null;
}

/**
 * 创建平台账号输入
 */
export interface CreatePlatformAccountInput {
  platform: string;
  platform_id?: string;
  account_name?: string;
  real_username?: string;
  credentials?: any; // 支持对象，自动加密
  cookies?: any;     // 支持对象，自动加密
  is_default?: boolean;
}

/**
 * 更新平台账号输入
 */
export interface UpdatePlatformAccountInput {
  account_name?: string;
  real_username?: string;
  credentials?: any; // 支持对象，自动加密
  cookies?: any;     // 支持对象，自动加密
  status?: string;
  is_default?: boolean;
  error_message?: string;
  last_used_at?: Date;
}

/**
 * 平台账号服务类
 */
export class PlatformAccountServicePostgres extends BaseServicePostgres<PlatformAccount> {
  constructor() {
    super('platform_accounts', 'PlatformAccountService');
  }

  /**
   * 创建平台账号
   */
  async createAccount(input: CreatePlatformAccountInput): Promise<PlatformAccount> {
    const encryptedCredentials = input.credentials ? encryptObject(input.credentials) : undefined;
    const encryptedCookies = input.cookies ? encryptObject(input.cookies) : undefined;

    return await this.create({
      ...input,
      credentials: encryptedCredentials,
      cookies: encryptedCookies,
      status: 'inactive',
      is_default: input.is_default || false
    });
  }

  /**
   * 更新平台账号
   */
  async updateAccount(id: string, input: UpdatePlatformAccountInput): Promise<PlatformAccount> {
    const updates: any = { ...input };
    
    if (input.credentials !== undefined) {
      updates.credentials = input.credentials ? encryptObject(input.credentials) : undefined;
    }
    
    if (input.cookies !== undefined) {
      updates.cookies = input.cookies ? encryptObject(input.cookies) : undefined;
    }

    return await this.update(id, updates);
  }

  /**
   * 删除平台账号
   */
  async deleteAccount(id: string): Promise<void> {
    await this.delete(id);
  }

  /**
   * 获取账号（解密敏感数据）
   */
  async getDecrypted(id: string): Promise<DecryptedPlatformAccount | null> {
    try {
      const account = await this.findById(id);
      if (!account) return null;

      return this.decryptAccount(account);
    } catch (error) {
      log.error('PlatformAccountService: getDecrypted failed:', error);
      throw error;
    }
  }

  /**
   * 解密账号数据
   */
  private decryptAccount(account: PlatformAccount): DecryptedPlatformAccount {
    return {
      ...account,
      credentials: account.credentials ? tryDecryptObject(account.credentials) : null,
      cookies: account.cookies ? tryDecryptObject(account.cookies) : null
    };
  }

  /**
   * 根据平台获取账号列表
   */
  async getByPlatform(platform: string): Promise<PlatformAccount[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM platform_accounts WHERE user_id = $1 AND platform = $2 ORDER BY created_at DESC',
        [this.userId, platform]
      );

      return result.rows as PlatformAccount[];
    } catch (error) {
      log.error('PlatformAccountService: getByPlatform 失败:', error);
      throw error;
    }
  }

  /**
   * 根据平台获取账号列表（别名方法）
   */
  async findByPlatform(platform: string): Promise<PlatformAccount[]> {
    return await this.getByPlatform(platform);
  }

  /**
   * 更新账号 Cookies
   */
  async updateCookies(id: string, cookies: any[]): Promise<void> {
    this.validateUserId();

    try {
      const encryptedCookies = encryptObject(cookies);
      await this.pool.query(
        'UPDATE platform_accounts SET cookies = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [encryptedCookies, id, this.userId]
      );

      log.info(`PlatformAccountService: 更新 Cookies 成功, ID: ${id}`);
    } catch (error) {
      log.error('PlatformAccountService: updateCookies 失败:', error);
      throw error;
    }
  }

  /**
   * 检查账号是否存在
   */
  async existsByPlatform(platformId: string, platformUserId: string): Promise<boolean> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT COUNT(*) as count FROM platform_accounts WHERE user_id = $1 AND platform = $2 AND platform_id = $3',
        [this.userId, platformId, platformUserId]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      log.error('PlatformAccountService: existsByPlatform 失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认账号
   */
  async getDefaultAccount(platform: string): Promise<PlatformAccount | null> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM platform_accounts WHERE user_id = $1 AND platform = $2 AND is_default = TRUE LIMIT 1',
        [this.userId, platform]
      );

      return result.rows[0] || null;
    } catch (error) {
      log.error('PlatformAccountService: getDefaultAccount 失败:', error);
      throw error;
    }
  }

  /**
   * 设置默认账号
   */
  async setDefaultAccount(id: string, platform: string): Promise<void> {
    this.validateUserId();

    try {
      await this.transaction(async (client) => {
        // 取消该平台的所有默认账号
        await client.query(
          'UPDATE platform_accounts SET is_default = FALSE WHERE user_id = $1 AND platform = $2',
          [this.userId, platform]
        );

        // 设置新的默认账号
        await client.query(
          'UPDATE platform_accounts SET is_default = TRUE WHERE id = $1 AND user_id = $2',
          [id, this.userId]
        );

        log.info(`PlatformAccountService: 设置默认账号成功, ID: ${id}`);
      });
    } catch (error) {
      log.error('PlatformAccountService: setDefaultAccount 失败:', error);
      throw error;
    }
  }

  /**
   * 更新账号状态
   */
  async updateStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        'UPDATE platform_accounts SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4',
        [status, errorMessage || null, id, this.userId]
      );

      log.info(`PlatformAccountService: 更新账号状态成功, ID: ${id}, 状态: ${status}`);
    } catch (error) {
      log.error('PlatformAccountService: updateStatus 失败:', error);
      throw error;
    }
  }

  /**
   * 更新最后使用时间
   */
  async updateLastUsed(id: string): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        'UPDATE platform_accounts SET last_used_at = NOW() WHERE id = $1 AND user_id = $2',
        [id, this.userId]
      );

      log.info(`PlatformAccountService: 更新最后使用时间成功, ID: ${id}`);
    } catch (error) {
      log.error('PlatformAccountService: updateLastUsed 失败:', error);
      throw error;
    }
  }

  /**
   * 获取活跃账号
   */
  async getActiveAccounts(): Promise<PlatformAccount[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM platform_accounts WHERE user_id = $1 AND status = $2 ORDER BY last_used_at DESC',
        [this.userId, 'active']
      );

      return result.rows as PlatformAccount[];
    } catch (error) {
      log.error('PlatformAccountService: getActiveAccounts 失败:', error);
      throw error;
    }
  }

  /**
   * 获取平台账号统计
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
    byPlatform: Record<string, number>;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM platform_accounts WHERE user_id = $1',
        [this.userId]
      );

      const activeResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM platform_accounts WHERE user_id = $1 AND status = $2',
        [this.userId, 'active']
      );

      const inactiveResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM platform_accounts WHERE user_id = $1 AND status = $2',
        [this.userId, 'inactive']
      );

      const errorResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM platform_accounts WHERE user_id = $1 AND status = $2',
        [this.userId, 'error']
      );

      const byPlatformResult = await this.pool.query(
        'SELECT platform, COUNT(*) as count FROM platform_accounts WHERE user_id = $1 GROUP BY platform',
        [this.userId]
      );

      const byPlatform: Record<string, number> = {};
      byPlatformResult.rows.forEach(row => {
        byPlatform[row.platform] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult.rows[0].count),
        active: parseInt(activeResult.rows[0].count),
        inactive: parseInt(inactiveResult.rows[0].count),
        error: parseInt(errorResult.rows[0].count),
        byPlatform
      };
    } catch (error) {
      log.error('PlatformAccountService: getStats 失败:', error);
      throw error;
    }
  }
}
