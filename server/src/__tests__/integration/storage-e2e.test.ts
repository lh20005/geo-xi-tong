/**
 * 存储空间管理端到端集成测试
 * 
 * 测试完整的存储管理工作流程：
 * - 上传流程（配额检查 + 存储跟踪）
 * - 删除流程（清理 + 配额释放）
 * - 配额更新传播
 * - 警报生成和通知
 * - 管理员管理功能
 * 
 * Feature: storage-space-management
 * Validates: All requirements
 */

import { pool } from '../../db/database';
import { storageService } from '../../services/StorageService';
import { storageQuotaService } from '../../services/StorageQuotaService';
import { storageAlertService } from '../../services/StorageAlertService';
import fs from 'fs/promises';
import path from 'path';

describe('Storage E2E Integration Tests', () => {
  let testUserId: number;
  let adminUserId: number;
  let testImagePath: string;
  let testDocPath: string;

  beforeAll(async () => {
    // 创建测试用户
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['test_storage_user', 'storage@test.com', 'hash', 'user']
    );
    testUserId = userResult.rows[0].id;

    // 创建管理员用户
    const adminResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['test_admin', 'admin@test.com', 'hash', 'admin']
    );
    adminUserId = adminResult.rows[0].id;

    // 初始化存储（20MB 配额）
    await storageService.initializeUserStorage(testUserId, 20 * 1024 * 1024);
    
    // 初始化管理员存储（无限配额）
    await storageService.initializeUserStorage(adminUserId, -1);

    // 创建测试文件路径
    testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    testDocPath = path.join(__dirname, '../fixtures/test-doc.pdf');
  });

  afterAll(async () => {
    // 清理测试数据
    await pool.query('DELETE FROM storage_transactions WHERE user_id IN ($1, $2)', [testUserId, adminUserId]);
    await pool.query('DELETE FROM storage_usage_history WHERE user_id IN ($1, $2)', [testUserId, adminUserId]);
    await pool.query('DELETE FROM user_storage_usage WHERE user_id IN ($1, $2)', [testUserId, adminUserId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
  });

  describe('Complete Upload Flow with Quota Enforcement', () => {
    it('should successfully upload when quota is available', async () => {
      // 1. 检查配额
      const fileSize = 5 * 1024 * 1024; // 5MB
      const quotaCheck = await storageQuotaService.checkQuota(testUserId, fileSize);
      
      expect(quotaCheck.allowed).toBe(true);
      expect(quotaCheck.availableBytes).toBeGreaterThanOrEqual(fileSize);

      // 2. 记录存储使用
      await storageService.recordStorageUsage(
        testUserId,
        'image',
        1,
        fileSize,
        { filename: 'test.jpg' }
      );

      // 3. 验证存储已更新
      const usage = await storageService.getUserStorageUsage(testUserId);
      expect(usage.imageStorageBytes).toBe(fileSize);
      expect(usage.totalStorageBytes).toBe(fileSize);
      expect(usage.imageCount).toBe(1);

      // 4. 验证事务日志已创建
      const txResult = await pool.query(
        'SELECT * FROM storage_transactions WHERE user_id = $1 AND resource_type = $2',
        [testUserId, 'image']
      );
      expect(txResult.rows.length).toBe(1);
      expect(txResult.rows[0].operation).toBe('add');
      expect(txResult.rows[0].size_bytes).toBe(fileSize.toString());
    });

    it('should reject upload when quota would be exceeded', async () => {
      // 当前使用: 5MB, 配额: 20MB
      // 尝试上传 16MB (总共 21MB > 20MB)
      const largeFileSize = 16 * 1024 * 1024;
      const quotaCheck = await storageQuotaService.checkQuota(testUserId, largeFileSize);
      
      expect(quotaCheck.allowed).toBe(false);
      expect(quotaCheck.reason).toContain('exceed');

      // 验证存储未改变
      const usage = await storageService.getUserStorageUsage(testUserId);
      expect(usage.totalStorageBytes).toBe(5 * 1024 * 1024); // 仍然是 5MB
    });

    it('should allow unlimited storage for admin users', async () => {
      const hugeFileSize = 1024 * 1024 * 1024; // 1GB
      const quotaCheck = await storageQuotaService.checkQuota(adminUserId, hugeFileSize);
      
      expect(quotaCheck.allowed).toBe(true);
      expect(quotaCheck.quotaBytes).toBe(-1);

      // 记录大文件
      await storageService.recordStorageUsage(
        adminUserId,
        'document',
        1,
        hugeFileSize
      );

      const usage = await storageService.getUserStorageUsage(adminUserId);
      expect(usage.documentStorageBytes).toBe(hugeFileSize);
      expect(usage.storageQuotaBytes).toBe(-1);
    });
  });

  describe('Complete Deletion Flow with Cleanup', () => {
    it('should properly clean up storage when resource is deleted', async () => {
      // 获取当前使用量
      const beforeUsage = await storageService.getUserStorageUsage(testUserId);
      const beforeTotal = beforeUsage.totalStorageBytes;
      const beforeImageCount = beforeUsage.imageCount;

      // 删除之前上传的图片 (5MB)
      const fileSize = 5 * 1024 * 1024;
      await storageService.removeStorageUsage(
        testUserId,
        'image',
        1,
        fileSize
      );

      // 验证存储已减少
      const afterUsage = await storageService.getUserStorageUsage(testUserId);
      expect(afterUsage.imageStorageBytes).toBe(beforeUsage.imageStorageBytes - fileSize);
      expect(afterUsage.totalStorageBytes).toBe(beforeTotal - fileSize);
      expect(afterUsage.imageCount).toBe(beforeImageCount - 1);

      // 验证删除事务已记录
      const txResult = await pool.query(
        `SELECT * FROM storage_transactions 
         WHERE user_id = $1 AND resource_id = $2 AND operation = 'remove'`,
        [testUserId, 1]
      );
      expect(txResult.rows.length).toBe(1);
    });

    it('should handle multiple resource types independently', async () => {
      // 添加不同类型的资源
      await storageService.recordStorageUsage(testUserId, 'image', 2, 2 * 1024 * 1024);
      await storageService.recordStorageUsage(testUserId, 'document', 1, 3 * 1024 * 1024);
      await storageService.recordStorageUsage(testUserId, 'article', 1, 1 * 1024 * 1024);

      const usage = await storageService.getUserStorageUsage(testUserId);
      expect(usage.imageStorageBytes).toBe(2 * 1024 * 1024);
      expect(usage.documentStorageBytes).toBe(3 * 1024 * 1024);
      expect(usage.articleStorageBytes).toBe(1 * 1024 * 1024);
      expect(usage.totalStorageBytes).toBe(6 * 1024 * 1024);

      // 删除文档，不应影响图片和文章
      await storageService.removeStorageUsage(testUserId, 'document', 1, 3 * 1024 * 1024);

      const afterUsage = await storageService.getUserStorageUsage(testUserId);
      expect(afterUsage.imageStorageBytes).toBe(2 * 1024 * 1024);
      expect(afterUsage.documentStorageBytes).toBe(0);
      expect(afterUsage.articleStorageBytes).toBe(1 * 1024 * 1024);
      expect(afterUsage.totalStorageBytes).toBe(3 * 1024 * 1024);
    });
  });

  describe('Quota Update Propagation', () => {
    it('should update quota when subscription plan changes', async () => {
      const beforeUsage = await storageService.getUserStorageUsage(testUserId);
      expect(beforeUsage.storageQuotaBytes).toBe(20 * 1024 * 1024);

      // 升级到 100MB 配额
      await storageService.updateStorageQuota(testUserId, 100 * 1024 * 1024);

      const afterUsage = await storageService.getUserStorageUsage(testUserId);
      expect(afterUsage.storageQuotaBytes).toBe(100 * 1024 * 1024);
      
      // 验证现有资源未受影响
      expect(afterUsage.imageStorageBytes).toBe(beforeUsage.imageStorageBytes);
      expect(afterUsage.documentStorageBytes).toBe(beforeUsage.documentStorageBytes);
      expect(afterUsage.articleStorageBytes).toBe(beforeUsage.articleStorageBytes);
    });

    it('should add purchased storage cumulatively', async () => {
      const beforeUsage = await storageService.getUserStorageUsage(testUserId);
      const beforeQuota = beforeUsage.storageQuotaBytes;

      // 购买额外 50MB
      await storageService.addPurchasedStorage(testUserId, 50 * 1024 * 1024);

      const afterUsage = await storageService.getUserStorageUsage(testUserId);
      expect(afterUsage.purchasedStorageBytes).toBe(50 * 1024 * 1024);
      expect(afterUsage.storageQuotaBytes).toBe(beforeQuota); // 基础配额不变

      // 有效配额应该是基础 + 购买
      const effectiveQuota = await storageQuotaService.getEffectiveQuota(testUserId);
      expect(effectiveQuota).toBe(beforeQuota + 50 * 1024 * 1024);

      // 再购买 30MB
      await storageService.addPurchasedStorage(testUserId, 30 * 1024 * 1024);

      const finalUsage = await storageService.getUserStorageUsage(testUserId);
      expect(finalUsage.purchasedStorageBytes).toBe(80 * 1024 * 1024);
    });
  });

  describe('Alert Generation and Notification', () => {
    beforeEach(async () => {
      // 重置存储到已知状态
      await pool.query(
        'UPDATE user_storage_usage SET image_storage_bytes = 0, document_storage_bytes = 0, article_storage_bytes = 0, image_count = 0, document_count = 0, article_count = 0 WHERE user_id = $1',
        [testUserId]
      );
      
      // 设置较小的配额以便测试
      await storageService.updateStorageQuota(testUserId, 10 * 1024 * 1024); // 10MB
    });

    it('should generate warning alert at 80% usage', async () => {
      // 使用 8MB (80%)
      await storageService.recordStorageUsage(testUserId, 'image', 10, 8 * 1024 * 1024);

      const alerts = await storageAlertService.checkAndCreateAlerts(testUserId);
      
      expect(alerts.length).toBeGreaterThan(0);
      const warningAlert = alerts.find(a => a.alertType === 'warning');
      expect(warningAlert).toBeDefined();
      expect(warningAlert?.thresholdPercentage).toBe(80);
    });

    it('should generate critical alert at 95% usage', async () => {
      // 使用 9.5MB (95%)
      await storageService.recordStorageUsage(testUserId, 'document', 11, 9.5 * 1024 * 1024);

      const alerts = await storageAlertService.checkAndCreateAlerts(testUserId);
      
      const criticalAlert = alerts.find(a => a.alertType === 'critical');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.thresholdPercentage).toBe(95);
    });

    it('should generate depleted alert at 100% usage', async () => {
      // 使用 10MB (100%)
      await storageService.recordStorageUsage(testUserId, 'article', 12, 10 * 1024 * 1024);

      const alerts = await storageAlertService.checkAndCreateAlerts(testUserId);
      
      const depletedAlert = alerts.find(a => a.alertType === 'depleted');
      expect(depletedAlert).toBeDefined();
      expect(depletedAlert?.thresholdPercentage).toBe(100);
    });

    it('should not create duplicate alerts for same threshold', async () => {
      // 使用 8MB (80%)
      await storageService.recordStorageUsage(testUserId, 'image', 13, 8 * 1024 * 1024);

      // 第一次检查
      const firstAlerts = await storageAlertService.checkAndCreateAlerts(testUserId);
      const firstCount = firstAlerts.filter(a => a.alertType === 'warning').length;

      // 第二次检查（不应创建重复警报）
      const secondAlerts = await storageAlertService.checkAndCreateAlerts(testUserId);
      const secondCount = secondAlerts.filter(a => a.alertType === 'warning').length;

      expect(secondCount).toBe(firstCount);
    });
  });

  describe('Admin Management Functionality', () => {
    let regularUserId: number;

    beforeAll(async () => {
      // 创建普通用户用于管理员操作测试
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['regular_user', 'regular@test.com', 'hash', 'user']
      );
      regularUserId = result.rows[0].id;
      await storageService.initializeUserStorage(regularUserId, 20 * 1024 * 1024);
    });

    afterAll(async () => {
      await pool.query('DELETE FROM storage_transactions WHERE user_id = $1', [regularUserId]);
      await pool.query('DELETE FROM storage_usage_history WHERE user_id = $1', [regularUserId]);
      await pool.query('DELETE FROM user_storage_usage WHERE user_id = $1', [regularUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [regularUserId]);
    });

    it('should allow admin to view any user storage', async () => {
      // 添加一些存储使用
      await storageService.recordStorageUsage(regularUserId, 'image', 20, 5 * 1024 * 1024);

      // 管理员查看用户存储
      const usage = await storageService.getUserStorageUsage(regularUserId);
      
      expect(usage.userId).toBe(regularUserId);
      expect(usage.imageStorageBytes).toBe(5 * 1024 * 1024);
    });

    it('should allow admin to modify user quota', async () => {
      const beforeUsage = await storageService.getUserStorageUsage(regularUserId);
      expect(beforeUsage.storageQuotaBytes).toBe(20 * 1024 * 1024);

      // 管理员修改配额
      await storageService.updateStorageQuota(regularUserId, 50 * 1024 * 1024);

      const afterUsage = await storageService.getUserStorageUsage(regularUserId);
      expect(afterUsage.storageQuotaBytes).toBe(50 * 1024 * 1024);
      
      // 验证用户资源未受影响
      expect(afterUsage.imageStorageBytes).toBe(beforeUsage.imageStorageBytes);
    });

    it('should allow admin to reconcile user storage', async () => {
      // 添加一些存储使用
      await storageService.recordStorageUsage(regularUserId, 'document', 21, 3 * 1024 * 1024);
      await storageService.recordStorageUsage(regularUserId, 'article', 22, 2 * 1024 * 1024);

      // 执行对账
      const reconciliation = await storageService.reconcileStorage(regularUserId);
      
      expect(reconciliation.calculated).toBeDefined();
      expect(reconciliation.calculated.userId).toBe(regularUserId);
      expect(reconciliation.calculated.totalStorageBytes).toBeGreaterThan(0);
    });

    it('should get storage breakdown for any user', async () => {
      const breakdown = await storageService.getStorageBreakdown(regularUserId);
      
      expect(breakdown.images).toBeDefined();
      expect(breakdown.documents).toBeDefined();
      expect(breakdown.articles).toBeDefined();
      
      // 验证百分比总和为 100%
      const totalPercentage = 
        breakdown.images.percentage + 
        breakdown.documents.percentage + 
        breakdown.articles.percentage;
      expect(totalPercentage).toBeCloseTo(100, 1);
    });
  });

  describe('Storage History and Reporting', () => {
    it('should create daily snapshots', async () => {
      // 创建快照
      await storageService.createDailySnapshot(testUserId);

      // 验证快照已创建
      const result = await pool.query(
        `SELECT * FROM storage_usage_history 
         WHERE user_id = $1 AND snapshot_date = CURRENT_DATE`,
        [testUserId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].user_id).toBe(testUserId);
    });

    it('should retrieve storage history for date range', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const history = await storageService.getStorageHistory(
        testUserId,
        startDate,
        endDate
      );

      expect(Array.isArray(history)).toBe(true);
      history.forEach(entry => {
        expect(entry.date).toBeDefined();
        expect(entry.totalBytes).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('File Size Validation', () => {
    it('should enforce maximum file size for images', async () => {
      const oversizedImage = 51 * 1024 * 1024; // 51MB (超过 50MB 限制)
      
      const validation = await storageQuotaService.validateFileSize('image', oversizedImage);
      
      expect(validation.valid).toBe(false);
      expect(validation.maxSizeBytes).toBe(50 * 1024 * 1024);
      expect(validation.reason).toContain('exceed');
    });

    it('should enforce maximum file size for documents', async () => {
      const oversizedDoc = 101 * 1024 * 1024; // 101MB (超过 100MB 限制)
      
      const validation = await storageQuotaService.validateFileSize('document', oversizedDoc);
      
      expect(validation.valid).toBe(false);
      expect(validation.maxSizeBytes).toBe(100 * 1024 * 1024);
    });

    it('should allow files within size limits', async () => {
      const validImage = 30 * 1024 * 1024; // 30MB
      
      const validation = await storageQuotaService.validateFileSize('image', validImage);
      
      expect(validation.valid).toBe(true);
    });
  });

  describe('User Isolation', () => {
    let user1Id: number;
    let user2Id: number;

    beforeAll(async () => {
      // 创建两个测试用户
      const user1 = await pool.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['isolation_user1', 'user1@test.com', 'hash', 'user']
      );
      user1Id = user1.rows[0].id;

      const user2 = await pool.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['isolation_user2', 'user2@test.com', 'hash', 'user']
      );
      user2Id = user2.rows[0].id;

      await storageService.initializeUserStorage(user1Id, 20 * 1024 * 1024);
      await storageService.initializeUserStorage(user2Id, 20 * 1024 * 1024);
    });

    afterAll(async () => {
      await pool.query('DELETE FROM storage_transactions WHERE user_id IN ($1, $2)', [user1Id, user2Id]);
      await pool.query('DELETE FROM storage_usage_history WHERE user_id IN ($1, $2)', [user1Id, user2Id]);
      await pool.query('DELETE FROM user_storage_usage WHERE user_id IN ($1, $2)', [user1Id, user2Id]);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [user1Id, user2Id]);
    });

    it('should isolate storage data between users', async () => {
      // User 1 上传文件
      await storageService.recordStorageUsage(user1Id, 'image', 30, 5 * 1024 * 1024);

      // User 2 上传文件
      await storageService.recordStorageUsage(user2Id, 'document', 31, 3 * 1024 * 1024);

      // 验证 User 1 只看到自己的数据
      const user1Usage = await storageService.getUserStorageUsage(user1Id);
      expect(user1Usage.imageStorageBytes).toBe(5 * 1024 * 1024);
      expect(user1Usage.documentStorageBytes).toBe(0);

      // 验证 User 2 只看到自己的数据
      const user2Usage = await storageService.getUserStorageUsage(user2Id);
      expect(user2Usage.imageStorageBytes).toBe(0);
      expect(user2Usage.documentStorageBytes).toBe(3 * 1024 * 1024);
    });

    it('should prevent cross-user storage calculations', async () => {
      const user1Breakdown = await storageService.getStorageBreakdown(user1Id);
      const user2Breakdown = await storageService.getStorageBreakdown(user2Id);

      // User 1 应该只有图片
      expect(user1Breakdown.images.sizeBytes).toBeGreaterThan(0);
      expect(user1Breakdown.documents.sizeBytes).toBe(0);

      // User 2 应该只有文档
      expect(user2Breakdown.images.sizeBytes).toBe(0);
      expect(user2Breakdown.documents.sizeBytes).toBeGreaterThan(0);
    });
  });
});
