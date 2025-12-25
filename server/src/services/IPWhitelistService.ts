import { pool } from '../db/database';
import { auditLogService } from './AuditLogService';
import { Netmask } from 'netmask';

interface IPWhitelistEntry {
  id: number;
  ip_address: string;
  description: string;
  added_by: number;
  created_at: Date;
}

/**
 * IP白名单服务
 * 管理IP访问控制，支持IPv4、IPv6和CIDR格式
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export class IPWhitelistService {
  private static instance: IPWhitelistService;

  private constructor() {}

  public static getInstance(): IPWhitelistService {
    if (!IPWhitelistService.instance) {
      IPWhitelistService.instance = new IPWhitelistService();
    }
    return IPWhitelistService.instance;
  }

  /**
   * 检查IP是否在白名单中
   * 支持精确匹配和CIDR范围匹配
   * Requirements: 9.1, 9.5
   */
  async isWhitelisted(ipAddress: string): Promise<boolean> {
    try {
      // 获取所有白名单条目
      const result = await pool.query(
        'SELECT ip_address FROM ip_whitelist ORDER BY created_at ASC'
      );

      // 如果白名单为空，允许所有IP访问（白名单禁用）
      // Requirements: 9.6
      if (result.rows.length === 0) {
        return true;
      }

      // 检查IP是否在白名单中
      for (const row of result.rows) {
        const whitelistedIP = row.ip_address;

        // 检查是否为CIDR格式
        if (whitelistedIP.includes('/')) {
          try {
            const block = new Netmask(whitelistedIP);
            if (block.contains(ipAddress)) {
              return true;
            }
          } catch (error) {
            console.error(`[IPWhitelist] 无效的CIDR格式: ${whitelistedIP}`, error);
            continue;
          }
        } else {
          // 精确匹配
          if (whitelistedIP === ipAddress) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[IPWhitelist] 检查IP白名单失败:', error);
      // 出错时默认拒绝访问（安全优先）
      return false;
    }
  }

  /**
   * 添加IP到白名单
   * Requirements: 9.3, 9.4
   */
  async addIP(
    ipAddress: string,
    description: string,
    addedBy: number
  ): Promise<void> {
    try {
      // 验证IP格式
      if (!this.validateIPFormat(ipAddress)) {
        throw new Error(`无效的IP地址格式: ${ipAddress}`);
      }

      // 检查IP是否已存在
      const existing = await pool.query(
        'SELECT id FROM ip_whitelist WHERE ip_address = $1',
        [ipAddress]
      );

      if (existing.rows.length > 0) {
        throw new Error(`IP地址已在白名单中: ${ipAddress}`);
      }

      // 添加到白名单
      await pool.query(
        `INSERT INTO ip_whitelist (ip_address, description, added_by) 
         VALUES ($1, $2, $3)`,
        [ipAddress, description, addedBy]
      );

      // 记录审计日志
      await auditLogService.logAction(
        addedBy,
        'ADD_IP_WHITELIST',
        'system',
        null,
        {
          ip_address: ipAddress,
          description
        },
        'system',
        'IPWhitelistService'
      );

      console.log(`[IPWhitelist] IP已添加到白名单: ${ipAddress}, addedBy=${addedBy}`);
    } catch (error) {
      console.error('[IPWhitelist] 添加IP到白名单失败:', error);
      throw error;
    }
  }

  /**
   * 从白名单移除IP
   * Requirements: 9.3
   */
  async removeIP(ipAddress: string, removedBy: number): Promise<void> {
    try {
      const result = await pool.query(
        'DELETE FROM ip_whitelist WHERE ip_address = $1',
        [ipAddress]
      );

      if (result.rowCount === 0) {
        throw new Error(`IP地址不在白名单中: ${ipAddress}`);
      }

      // 记录审计日志
      await auditLogService.logAction(
        removedBy,
        'REMOVE_IP_WHITELIST',
        'system',
        null,
        {
          ip_address: ipAddress
        },
        'system',
        'IPWhitelistService'
      );

      console.log(`[IPWhitelist] IP已从白名单移除: ${ipAddress}, removedBy=${removedBy}`);
    } catch (error) {
      console.error('[IPWhitelist] 从白名单移除IP失败:', error);
      throw error;
    }
  }

  /**
   * 获取白名单列表
   * Requirements: 9.3
   */
  async getWhitelist(): Promise<IPWhitelistEntry[]> {
    try {
      const result = await pool.query(
        `SELECT 
          id,
          ip_address,
          description,
          added_by,
          created_at
         FROM ip_whitelist 
         ORDER BY created_at DESC`
      );

      return result.rows;
    } catch (error) {
      console.error('[IPWhitelist] 获取白名单列表失败:', error);
      return [];
    }
  }

  /**
   * 验证IP格式
   * 支持IPv4、IPv6和CIDR格式
   * Requirements: 9.4
   */
  validateIPFormat(ipAddress: string): boolean {
    // IPv4 正则表达式
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv4 CIDR 正则表达式
    const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    // IPv6 正则表达式（简化版）
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    // IPv6 CIDR 正则表达式
    const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/;

    // 检查是否为CIDR格式
    if (ipAddress.includes('/')) {
      const [ip, prefix] = ipAddress.split('/');
      const prefixNum = parseInt(prefix);

      // 验证IPv4 CIDR
      if (ipv4CidrRegex.test(ipAddress)) {
        // 验证每个八位组
        const octets = ip.split('.');
        if (octets.some(octet => parseInt(octet) > 255)) {
          return false;
        }
        // 验证前缀长度
        return prefixNum >= 0 && prefixNum <= 32;
      }

      // 验证IPv6 CIDR
      if (ipv6CidrRegex.test(ipAddress)) {
        return prefixNum >= 0 && prefixNum <= 128;
      }

      return false;
    }

    // 验证IPv4
    if (ipv4Regex.test(ipAddress)) {
      const octets = ipAddress.split('.');
      return octets.every(octet => {
        const num = parseInt(octet);
        return num >= 0 && num <= 255;
      });
    }

    // 验证IPv6
    if (ipv6Regex.test(ipAddress)) {
      return true;
    }

    return false;
  }

  /**
   * 批量添加IP到白名单
   */
  async addIPs(
    ipAddresses: string[],
    description: string,
    addedBy: number
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const ip of ipAddresses) {
      try {
        await this.addIP(ip, description, addedBy);
        success.push(ip);
      } catch (error) {
        console.error(`[IPWhitelist] 添加IP失败: ${ip}`, error);
        failed.push(ip);
      }
    }

    return { success, failed };
  }

  /**
   * 批量移除IP从白名单
   */
  async removeIPs(
    ipAddresses: string[],
    removedBy: number
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const ip of ipAddresses) {
      try {
        await this.removeIP(ip, removedBy);
        success.push(ip);
      } catch (error) {
        console.error(`[IPWhitelist] 移除IP失败: ${ip}`, error);
        failed.push(ip);
      }
    }

    return { success, failed };
  }

  /**
   * 检查白名单是否为空（即白名单功能是否禁用）
   */
  async isWhitelistEmpty(): Promise<boolean> {
    try {
      const result = await pool.query('SELECT COUNT(*) as count FROM ip_whitelist');
      return parseInt(result.rows[0].count) === 0;
    } catch (error) {
      console.error('[IPWhitelist] 检查白名单是否为空失败:', error);
      return true; // 出错时假设为空（允许访问）
    }
  }
}

export const ipWhitelistService = IPWhitelistService.getInstance();
