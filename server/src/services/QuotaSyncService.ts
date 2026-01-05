/**
 * 配额同步服务
 * 确保配额调整后，所有相关系统立即同步
 */

import { pool } from '../db/database';
import { redisClient } from '../db/redis';
import { getWebSocketService } from './WebSocketService';

export class QuotaSyncService {
  /**
   * 同步用户配额到所有系统
   * 在配额调整后调用此方法
   */
  static async syncUserQuota(userId: number, reason: string = '配额调整'): Promise<void> {
    console.log(`[QuotaSync] 开始同步用户 ${userId} 的配额...`);

    try {
      // 1. 清除 Redis 缓存
      await this.clearUserQuotaCache(userId);

      // 2. 同步存储配额（如果有 storage_space 的自定义配额）
      await this.syncStorageQuota(userId);

      // 3. 推送 WebSocket 通知
      await this.notifyQuotaUpdate(userId, reason);

      // 4. 刷新配额概览
      await this.refreshQuotaOverview(userId);

      console.log(`[QuotaSync] ✅ 用户 ${userId} 的配额同步完成`);
    } catch (error) {
      console.error(`[QuotaSync] ❌ 同步用户 ${userId} 的配额失败:`, error);
      throw error;
    }
  }

  /**
   * 清除用户配额相关的 Redis 缓存
   */
  private static async clearUserQuotaCache(userId: number): Promise<void> {
    const cacheKeys = [
      `user:${userId}:subscription`,
      `user:${userId}:quotas`,
      `user:${userId}:storage`,
      `storage:usage:${userId}`,
      `quota:check:${userId}:*` // 通配符，清除所有配额检查缓存
    ];

    console.log(`[QuotaSync] 清除 Redis 缓存...`);
    
    for (const key of cacheKeys) {
      if (key.includes('*')) {
        // 处理通配符
        const keys = await redisClient.keys(key);
        if (keys.length > 0) {
          for (const k of keys) {
            await redisClient.del(k);
          }
          console.log(`[QuotaSync]   删除 ${keys.length} 个匹配 ${key} 的缓存`);
        }
      } else {
        const deleted = await redisClient.del(key);
        if (deleted > 0) {
          console.log(`[QuotaSync]   删除缓存: ${key}`);
        }
      }
    }
  }

  /**
   * 同步存储配额
   * 从 user_subscriptions.custom_quotas 同步到 user_storage_usage
   */
  private static async syncStorageQuota(userId: number): Promise<void> {
    console.log(`[QuotaSync] 同步存储配额...`);

    const result = await pool.query(`
      SELECT custom_quotas
      FROM user_subscriptions
      WHERE user_id = $1
        AND status = 'active'
        AND end_date > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      console.log(`[QuotaSync]   用户 ${userId} 没有活跃订阅`);
      return;
    }

    const customQuotas = result.rows[0].custom_quotas;
    
    if (customQuotas && customQuotas.storage_space !== undefined) {
      const storageMB = customQuotas.storage_space;
      const storageBytes = storageMB === -1 ? -1 : storageMB * 1024 * 1024;

      await pool.query(`
        UPDATE user_storage_usage
        SET storage_quota_bytes = $1,
            last_updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [storageBytes, userId]);

      console.log(`[QuotaSync]   存储配额已更新: ${storageMB} MB`);
    } else {
      console.log(`[QuotaSync]   没有自定义存储配额`);
    }
  }

  /**
   * 推送 WebSocket 配额更新通知
   */
  private static async notifyQuotaUpdate(userId: number, reason: string): Promise<void> {
    console.log(`[QuotaSync] 推送 WebSocket 通知...`);

    try {
      const wsService = getWebSocketService();
      
      // 获取最新的配额概览
      const overview = await this.getQuotaOverview(userId);

      // 推送配额更新通知
      wsService.broadcast(userId, 'quota_updated', {
        reason,
        overview,
        timestamp: new Date().toISOString()
      });

      // 推送存储配额变更通知
      wsService.broadcast(userId, 'storage_quota_changed', {
        reason,
        timestamp: new Date().toISOString()
      });

      console.log(`[QuotaSync]   WebSocket 通知已发送`);
    } catch (error) {
      console.error(`[QuotaSync]   推送 WebSocket 通知失败:`, error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取用户配额概览
   */
  private static async getQuotaOverview(userId: number): Promise<any[]> {
    const featureCodes = [
      'articles_per_month',
      'publish_per_month',
      'platform_accounts',
      'keyword_distillation',
      'gallery_albums',
      'knowledge_bases'
    ];

    const overview: any[] = [];

    for (const featureCode of featureCodes) {
      const result = await pool.query(`
        SELECT * FROM check_user_quota($1, $2)
      `, [userId, featureCode]);

      if (result.rows.length > 0) {
        overview.push({
          featureCode,
          ...result.rows[0]
        });
      }
    }

    return overview;
  }

  /**
   * 刷新配额概览（用于前端显示）
   */
  private static async refreshQuotaOverview(userId: number): Promise<void> {
    console.log(`[QuotaSync] 刷新配额概览...`);

    // 预热缓存：调用一次所有配额检查
    const featureCodes = [
      'articles_per_month',
      'publish_per_month',
      'platform_accounts',
      'keyword_distillation',
      'gallery_albums',
      'knowledge_bases'
    ];

    for (const featureCode of featureCodes) {
      await pool.query(`SELECT * FROM check_user_quota($1, $2)`, [userId, featureCode]);
    }

    console.log(`[QuotaSync]   配额概览已刷新`);
  }

  /**
   * 批量同步多个用户的配额
   */
  static async syncMultipleUsers(userIds: number[], reason: string = '批量配额调整'): Promise<void> {
    console.log(`[QuotaSync] 批量同步 ${userIds.length} 个用户的配额...`);

    for (const userId of userIds) {
      try {
        await this.syncUserQuota(userId, reason);
      } catch (error) {
        console.error(`[QuotaSync] 同步用户 ${userId} 失败:`, error);
        // 继续处理其他用户
      }
    }

    console.log(`[QuotaSync] ✅ 批量同步完成`);
  }
}
