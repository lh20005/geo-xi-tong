import { pool } from '../db/database';
import { storageService, StorageUsage } from './StorageService';

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usagePercentage: number;
  reason?: string;
}

export interface FileSizeValidationResult {
  valid: boolean;
  maxSizeBytes: number;
  reason?: string;
}

/**
 * 文件大小限制（字节）
 */
const FILE_SIZE_LIMITS = {
  image: 50 * 1024 * 1024,      // 50 MB
  document: 100 * 1024 * 1024,  // 100 MB
  article: 10 * 1024 * 1024     // 10 MB
};

/**
 * 存储配额服务
 * 负责检查和执行存储配额限制
 */
export class StorageQuotaService {
  private static instance: StorageQuotaService;

  private constructor() {}

  public static getInstance(): StorageQuotaService {
    if (!StorageQuotaService.instance) {
      StorageQuotaService.instance = new StorageQuotaService();
    }
    return StorageQuotaService.instance;
  }

  /**
   * 检查文件上传是否会超出配额
   */
  async checkQuota(
    userId: number,
    fileSizeBytes: number
  ): Promise<QuotaCheckResult> {
    try {
      const usage = await storageService.getUserStorageUsage(userId);
      const effectiveQuota = usage.storageQuotaBytes + usage.purchasedStorageBytes;

      // 无限配额
      if (effectiveQuota === -1) {
        return {
          allowed: true,
          currentUsageBytes: usage.totalStorageBytes,
          quotaBytes: -1,
          availableBytes: -1,
          usagePercentage: 0
        };
      }

      // 计算上传后的使用量
      const afterUploadBytes = usage.totalStorageBytes + fileSizeBytes;
      const allowed = afterUploadBytes <= effectiveQuota;

      return {
        allowed,
        currentUsageBytes: usage.totalStorageBytes,
        quotaBytes: effectiveQuota,
        availableBytes: Math.max(0, effectiveQuota - usage.totalStorageBytes),
        usagePercentage: usage.usagePercentage,
        reason: allowed ? undefined : `存储配额不足。当前使用: ${this.formatBytes(usage.totalStorageBytes)}, 配额: ${this.formatBytes(effectiveQuota)}, 需要: ${this.formatBytes(fileSizeBytes)}`
      };
    } catch (error) {
      console.error('[StorageQuotaService] 检查配额失败:', error);
      throw error;
    }
  }

  /**
   * 验证文件大小是否在限制内
   */
  async validateFileSize(
    resourceType: 'image' | 'document' | 'article',
    fileSizeBytes: number
  ): Promise<FileSizeValidationResult> {
    try {
      const maxSize = FILE_SIZE_LIMITS[resourceType];
      const valid = fileSizeBytes <= maxSize;

      return {
        valid,
        maxSizeBytes: maxSize,
        reason: valid ? undefined : `文件大小 ${this.formatBytes(fileSizeBytes)} 超过 ${resourceType} 类型的最大限制 ${this.formatBytes(maxSize)}`
      };
    } catch (error) {
      console.error('[StorageQuotaService] 验证文件大小失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的有效配额（套餐配额 + 购买的配额）
   */
  async getEffectiveQuota(userId: number): Promise<number> {
    try {
      const usage = await storageService.getUserStorageUsage(userId);
      return usage.storageQuotaBytes + usage.purchasedStorageBytes;
    } catch (error) {
      console.error('[StorageQuotaService] 获取有效配额失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否有无限存储
   */
  async hasUnlimitedStorage(userId: number): Promise<boolean> {
    try {
      const effectiveQuota = await this.getEffectiveQuota(userId);
      return effectiveQuota === -1;
    } catch (error) {
      console.error('[StorageQuotaService] 检查无限存储失败:', error);
      throw error;
    }
  }

  /**
   * 格式化字节为可读格式
   */
  private formatBytes(bytes: number): string {
    if (bytes === -1) return '无限';
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

export const storageQuotaService = StorageQuotaService.getInstance();
