import { pool } from '../db/database';

/**
 * 配置历史服务
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

export interface ConfigHistory {
  id: number;
  configKey: string;
  oldValue: string;
  newValue: string;
  changedBy: number;
  ipAddress: string;
  createdAt: Date;
}

export class ConfigHistoryService {
  /**
   * 记录配置变更
   * Requirements: 6.1, 6.2
   */
  async recordChange(
    configKey: string,
    oldValue: any,
    newValue: any,
    changedBy: number,
    ipAddress: string
  ): Promise<number> {
    try {
      const result = await pool.query(
        `INSERT INTO config_history (config_key, old_value, new_value, changed_by, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [
          configKey,
          JSON.stringify(oldValue),
          JSON.stringify(newValue),
          changedBy,
          ipAddress
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      console.error('[ConfigHistory] Error recording change:', error);
      throw error;
    }
  }

  /**
   * 获取配置历史
   * Requirement 6.2
   */
  async getHistory(
    configKey: string,
    limit: number = 10
  ): Promise<ConfigHistory[]> {
    try {
      const result = await pool.query(
        `SELECT id, config_key, old_value, new_value, changed_by, ip_address, created_at
         FROM config_history
         WHERE config_key = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [configKey, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        configKey: row.config_key,
        oldValue: row.old_value,
        newValue: row.new_value,
        changedBy: row.changed_by,
        ipAddress: row.ip_address,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('[ConfigHistory] Error getting history:', error);
      throw error;
    }
  }

  /**
   * 获取所有配置的历史
   */
  async getAllHistory(limit: number = 50): Promise<ConfigHistory[]> {
    try {
      const result = await pool.query(
        `SELECT id, config_key, old_value, new_value, changed_by, ip_address, created_at
         FROM config_history
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        configKey: row.config_key,
        oldValue: row.old_value,
        newValue: row.new_value,
        changedBy: row.changed_by,
        ipAddress: row.ip_address,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('[ConfigHistory] Error getting all history:', error);
      throw error;
    }
  }

  /**
   * 回滚配置
   * Requirements: 6.3, 6.4
   */
  async rollback(
    historyId: number,
    performedBy: number,
    ipAddress: string
  ): Promise<{ configKey: string; rolledBackValue: string }> {
    try {
      // 获取历史记录
      const historyResult = await pool.query(
        'SELECT config_key, old_value, new_value FROM config_history WHERE id = $1',
        [historyId]
      );

      if (historyResult.rows.length === 0) {
        throw new Error('History record not found');
      }

      const { config_key, old_value } = historyResult.rows[0];

      // 记录回滚操作为新的变更
      await this.recordChange(
        config_key,
        JSON.parse(historyResult.rows[0].new_value), // 当前值
        JSON.parse(old_value), // 回滚到的值
        performedBy,
        ipAddress
      );

      return {
        configKey: config_key,
        rolledBackValue: old_value
      };
    } catch (error) {
      console.error('[ConfigHistory] Error rolling back:', error);
      throw error;
    }
  }

  /**
   * 获取配置的当前值（从最新历史记录）
   */
  async getCurrentValue(configKey: string): Promise<string | null> {
    try {
      const result = await pool.query(
        `SELECT new_value FROM config_history
         WHERE config_key = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [configKey]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].new_value;
    } catch (error) {
      console.error('[ConfigHistory] Error getting current value:', error);
      throw error;
    }
  }

  /**
   * 获取配置变更统计
   */
  async getChangeStats(configKey?: string): Promise<{
    totalChanges: number;
    uniqueUsers: number;
    lastChange: Date | null;
  }> {
    try {
      const whereClause = configKey ? 'WHERE config_key = $1' : '';
      const params = configKey ? [configKey] : [];

      const result = await pool.query(
        `SELECT 
           COUNT(*) as total_changes,
           COUNT(DISTINCT changed_by) as unique_users,
           MAX(created_at) as last_change
         FROM config_history
         ${whereClause}`,
        params
      );

      return {
        totalChanges: parseInt(result.rows[0].total_changes),
        uniqueUsers: parseInt(result.rows[0].unique_users),
        lastChange: result.rows[0].last_change
      };
    } catch (error) {
      console.error('[ConfigHistory] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * 删除旧的历史记录
   */
  async cleanupOldHistory(daysToKeep: number = 90): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM config_history
         WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
      );

      return result.rowCount || 0;
    } catch (error) {
      console.error('[ConfigHistory] Error cleaning up history:', error);
      throw error;
    }
  }
}

// 导出单例
export const configHistoryService = new ConfigHistoryService();
