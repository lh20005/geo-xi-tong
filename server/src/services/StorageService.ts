import { pool } from '../db/database';
import { getWebSocketService } from './WebSocketService';
import Redis from 'ioredis';
import { storageAlertService } from './StorageAlertService';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export interface StorageUsage {
  userId: number;
  imageStorageBytes: number;
  documentStorageBytes: number;
  articleStorageBytes: number;
  totalStorageBytes: number;
  imageCount: number;
  documentCount: number;
  articleCount: number;
  storageQuotaBytes: number;
  purchasedStorageBytes: number;
  availableBytes: number;
  usagePercentage: number;
}

export interface StorageBreakdown {
  images: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
  documents: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
  articles: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
}

export interface StorageHistoryEntry {
  date: Date;
  totalBytes: number;
  imageBytes: number;
  documentBytes: number;
  articleBytes: number;
}

/**
 * 存储服务
 * 负责跟踪和管理用户存储使用
 */
export class StorageService {
  private static instance: StorageService;
  private readonly CACHE_TTL = 300; // 5 minutes

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * 获取用户存储使用情况
   */
  async getUserStorageUsage(userId: number): Promise<StorageUsage> {
    try {
      // 尝试从缓存获取
      const cacheKey = `storage:user:${userId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // 从数据库获取
      const result = await pool.query(
        `SELECT 
          user_id as "userId",
          image_storage_bytes as "imageStorageBytes",
          document_storage_bytes as "documentStorageBytes",
          article_storage_bytes as "articleStorageBytes",
          total_storage_bytes as "totalStorageBytes",
          image_count as "imageCount",
          document_count as "documentCount",
          article_count as "articleCount",
          storage_quota_bytes as "storageQuotaBytes",
          purchased_storage_bytes as "purchasedStorageBytes"
        FROM user_storage_usage
        WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // 如果没有记录，初始化
        await pool.query('SELECT initialize_user_storage($1)', [userId]);
        return this.getUserStorageUsage(userId);
      }

      const row = result.rows[0];
      
      // 将所有 BIGINT 字段从字符串转换为数字
      const imageStorageBytes = parseInt(row.imageStorageBytes);
      const documentStorageBytes = parseInt(row.documentStorageBytes);
      const articleStorageBytes = parseInt(row.articleStorageBytes);
      const totalStorageBytes = parseInt(row.totalStorageBytes);
      const storageQuotaBytes = parseInt(row.storageQuotaBytes);
      const purchasedStorageBytes = parseInt(row.purchasedStorageBytes);
      
      const effectiveQuota = storageQuotaBytes + purchasedStorageBytes;
      
      const usage: StorageUsage = {
        userId: row.userId,
        imageStorageBytes,
        documentStorageBytes,
        articleStorageBytes,
        totalStorageBytes,
        imageCount: row.imageCount,
        documentCount: row.documentCount,
        articleCount: row.articleCount,
        storageQuotaBytes,
        purchasedStorageBytes,
        availableBytes: effectiveQuota === -1 ? -1 : Math.max(0, effectiveQuota - totalStorageBytes),
        usagePercentage: effectiveQuota === -1 ? 0 : 
          Math.round((totalStorageBytes / effectiveQuota) * 100 * 100) / 100
      };

      // 缓存结果
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(usage));

      return usage;
    } catch (error) {
      console.error('[StorageService] 获取存储使用失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储明细
   */
  async getStorageBreakdown(userId: number): Promise<StorageBreakdown> {
    try {
      const usage = await this.getUserStorageUsage(userId);
      const total = usage.totalStorageBytes || 1; // 避免除以0

      return {
        images: {
          sizeBytes: usage.imageStorageBytes,
          count: usage.imageCount,
          percentage: Math.round((usage.imageStorageBytes / total) * 100 * 100) / 100
        },
        documents: {
          sizeBytes: usage.documentStorageBytes,
          count: usage.documentCount,
          percentage: Math.round((usage.documentStorageBytes / total) * 100 * 100) / 100
        },
        articles: {
          sizeBytes: usage.articleStorageBytes,
          count: usage.articleCount,
          percentage: Math.round((usage.articleStorageBytes / total) * 100 * 100) / 100
        }
      };
    } catch (error) {
      console.error('[StorageService] 获取存储明细失败:', error);
      throw error;
    }
  }

  /**
   * 初始化用户存储
   */
  async initializeUserStorage(userId: number, quotaBytes?: number): Promise<void> {
    try {
      if (quotaBytes !== undefined) {
        // 使用指定的配额
        await pool.query(
          `INSERT INTO user_storage_usage (
            user_id, storage_quota_bytes, image_storage_bytes, 
            document_storage_bytes, article_storage_bytes,
            image_count, document_count, article_count
          ) VALUES ($1, $2, 0, 0, 0, 0, 0, 0)
          ON CONFLICT (user_id) DO NOTHING`,
          [userId, quotaBytes]
        );
      } else {
        // 使用数据库函数自动计算配额
        await pool.query('SELECT initialize_user_storage($1)', [userId]);
      }

      // 清除缓存
      await this.clearCache(userId);
      
      console.log(`[StorageService] 用户 ${userId} 存储已初始化`);
    } catch (error) {
      console.error('[StorageService] 初始化存储失败:', error);
      throw error;
    }
  }

  /**
   * 记录存储使用
   */
  async recordStorageUsage(
    userId: number,
    resourceType: 'image' | 'document' | 'article',
    resourceId: number,
    sizeBytes: number,
    metadata?: any
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 使用数据库函数记录
      await client.query(
        'SELECT record_storage_usage($1, $2, $3, $4, $5, $6)',
        [userId, resourceType, resourceId, 'add', sizeBytes, metadata ? JSON.stringify(metadata) : null]
      );

      await client.query('COMMIT');

      // 清除缓存
      await this.clearCache(userId);

      // 推送更新通知
      await this.notifyStorageUpdate(userId);

      // 检查并创建警报（异步，不阻塞主流程）
      this.checkStorageAlerts(userId).catch(err => {
        console.error('[StorageService] 检查警报失败:', err);
      });

      console.log(`[StorageService] 记录存储使用: 用户=${userId}, 类型=${resourceType}, 大小=${sizeBytes}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[StorageService] 记录存储使用失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 移除存储使用
   */
  async removeStorageUsage(
    userId: number,
    resourceType: 'image' | 'document' | 'article',
    resourceId: number,
    sizeBytes: number
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 使用数据库函数记录
      await client.query(
        'SELECT record_storage_usage($1, $2, $3, $4, $5, $6)',
        [userId, resourceType, resourceId, 'remove', sizeBytes, null]
      );

      await client.query('COMMIT');

      // 清除缓存
      await this.clearCache(userId);

      // 推送更新通知
      await this.notifyStorageUpdate(userId);

      console.log(`[StorageService] 移除存储使用: 用户=${userId}, 类型=${resourceType}, 大小=${sizeBytes}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[StorageService] 移除存储使用失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新存储配额
   */
  async updateStorageQuota(userId: number, newQuotaBytes: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE user_storage_usage 
         SET storage_quota_bytes = $1, last_updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [newQuotaBytes, userId]
      );

      // 清除缓存
      await this.clearCache(userId);

      // 推送更新通知
      await this.notifyQuotaChange(userId, newQuotaBytes);

      console.log(`[StorageService] 更新配额: 用户=${userId}, 新配额=${newQuotaBytes}`);
    } catch (error) {
      console.error('[StorageService] 更新配额失败:', error);
      throw error;
    }
  }

  /**
   * 添加购买的存储
   */
  async addPurchasedStorage(userId: number, additionalBytes: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE user_storage_usage 
         SET purchased_storage_bytes = purchased_storage_bytes + $1,
             last_updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [additionalBytes, userId]
      );

      // 清除缓存
      await this.clearCache(userId);

      // 推送更新通知
      await this.notifyStorageUpdate(userId);

      console.log(`[StorageService] 添加购买存储: 用户=${userId}, 增加=${additionalBytes}`);
    } catch (error) {
      console.error('[StorageService] 添加购买存储失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储历史
   */
  async getStorageHistory(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<StorageHistoryEntry[]> {
    try {
      const result = await pool.query(
        `SELECT 
          snapshot_date as date,
          total_storage_bytes as "totalBytes",
          image_storage_bytes as "imageBytes",
          document_storage_bytes as "documentBytes",
          article_storage_bytes as "articleBytes"
        FROM storage_usage_history
        WHERE user_id = $1 
          AND snapshot_date BETWEEN $2 AND $3
        ORDER BY snapshot_date ASC`,
        [userId, startDate, endDate]
      );

      return result.rows;
    } catch (error) {
      console.error('[StorageService] 获取存储历史失败:', error);
      throw error;
    }
  }

  /**
   * 创建每日快照
   */
  async createDailySnapshot(userId: number): Promise<void> {
    try {
      const usage = await this.getUserStorageUsage(userId);
      const today = new Date().toISOString().split('T')[0];

      await pool.query(
        `INSERT INTO storage_usage_history (
          user_id, snapshot_date, 
          image_storage_bytes, document_storage_bytes, article_storage_bytes,
          total_storage_bytes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, snapshot_date) 
        DO UPDATE SET
          image_storage_bytes = EXCLUDED.image_storage_bytes,
          document_storage_bytes = EXCLUDED.document_storage_bytes,
          article_storage_bytes = EXCLUDED.article_storage_bytes,
          total_storage_bytes = EXCLUDED.total_storage_bytes`,
        [
          userId, today,
          usage.imageStorageBytes, usage.documentStorageBytes, usage.articleStorageBytes,
          usage.totalStorageBytes
        ]
      );

      console.log(`[StorageService] 创建快照: 用户=${userId}, 日期=${today}`);
    } catch (error) {
      console.error('[StorageService] 创建快照失败:', error);
      throw error;
    }
  }

  /**
   * 对账存储使用
   */
  async reconcileStorage(userId: number): Promise<{
    calculated: StorageUsage;
    actual: StorageUsage;
    discrepancy: number;
  }> {
    try {
      // 获取当前记录的使用量
      const actual = await this.getUserStorageUsage(userId);

      // 这里应该扫描实际文件系统，但为了简化，我们返回当前值
      // 在实际实现中，需要扫描 uploads 目录
      const calculated = actual;

      const discrepancy = Math.abs(calculated.totalStorageBytes - actual.totalStorageBytes);

      return { calculated, actual, discrepancy };
    } catch (error) {
      console.error('[StorageService] 对账失败:', error);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  private async clearCache(userId: number): Promise<void> {
    try {
      await redis.del(`storage:user:${userId}`);
    } catch (error) {
      console.error('[StorageService] 清除缓存失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 推送存储更新通知
   */
  private async notifyStorageUpdate(userId: number): Promise<void> {
    try {
      const wsService = getWebSocketService();
      const usage = await this.getUserStorageUsage(userId);
      const breakdown = await this.getStorageBreakdown(userId);

      wsService.broadcast(userId, 'storage_updated', {
        usage,
        breakdown
      });
    } catch (error) {
      console.error('[StorageService] 推送更新通知失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 推送配额变更通知
   */
  private async notifyQuotaChange(userId: number, newQuotaBytes: number): Promise<void> {
    try {
      const wsService = getWebSocketService();
      
      wsService.broadcast(userId, 'storage_quota_changed', {
        userId,
        newQuotaBytes
      });
    } catch (error) {
      console.error('[StorageService] 推送配额变更通知失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 检查存储警报
   */
  private async checkStorageAlerts(userId: number): Promise<void> {
    try {
      await storageAlertService.checkAndCreateAlerts(userId);
    } catch (error) {
      console.error('[StorageService] 检查存储警报失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 计算文本内容的字节大小
   */
  static calculateTextSize(text: string): number {
    return Buffer.byteLength(text, 'utf8');
  }
}

export const storageService = StorageService.getInstance();
