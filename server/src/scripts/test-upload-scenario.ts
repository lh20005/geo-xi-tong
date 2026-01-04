/**
 * 测试上传场景
 * 模拟用户第一次和第二次上传，检查配额检查是否正确
 */

import { pool } from '../db/database';
import { storageQuotaService } from '../services/StorageQuotaService';
import { storageService } from '../services/StorageService';

async function testUploadScenario() {
  console.log('=== 测试上传场景 ===\n');

  try {
    const testUserId = 438; // testuser2
    const testFileSize = 500000; // 500KB

    console.log(`测试用户: ${testUserId}`);
    console.log(`测试文件大小: ${testFileSize} bytes\n`);

    // 场景1: 第一次上传前检查
    console.log('场景1: 第一次上传前检查配额');
    const check1 = await storageQuotaService.checkQuota(testUserId, testFileSize);
    console.log('  允许上传:', check1.allowed);
    console.log('  当前使用:', check1.currentUsageBytes);
    console.log('  配额:', check1.quotaBytes);
    console.log('  可用:', check1.availableBytes);
    console.log('  原因:', check1.reason || '无');

    // 获取当前存储使用（不使用缓存）
    console.log('\n场景2: 获取当前存储使用（跳过缓存）');
    const usage1 = await storageService.getUserStorageUsage(testUserId, true);
    console.log('  总使用:', usage1.totalStorageBytes);
    console.log('  图片:', usage1.imageStorageBytes);
    console.log('  配额:', usage1.storageQuotaBytes);
    console.log('  可用:', usage1.availableBytes);

    // 场景3: 再次检查配额（应该使用新鲜数据）
    console.log('\n场景3: 再次检查配额');
    const check2 = await storageQuotaService.checkQuota(testUserId, testFileSize);
    console.log('  允许上传:', check2.allowed);
    console.log('  当前使用:', check2.currentUsageBytes);
    console.log('  配额:', check2.quotaBytes);
    console.log('  可用:', check2.availableBytes);
    console.log('  原因:', check2.reason || '无');

    // 场景4: 检查缓存
    console.log('\n场景4: 检查 Redis 缓存');
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    const cacheKey = `storage:user:${testUserId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      console.log('  缓存存在:');
      console.log('    totalStorageBytes:', data.totalStorageBytes);
      console.log('    availableBytes:', data.availableBytes);
    } else {
      console.log('  缓存不存在');
    }

    // 清除缓存
    await redis.del(cacheKey);
    console.log('  ✅ 已清除缓存');

    // 场景5: 清除缓存后再次检查
    console.log('\n场景5: 清除缓存后再次检查配额');
    const check3 = await storageQuotaService.checkQuota(testUserId, testFileSize);
    console.log('  允许上传:', check3.allowed);
    console.log('  当前使用:', check3.currentUsageBytes);
    console.log('  配额:', check3.quotaBytes);
    console.log('  可用:', check3.availableBytes);
    console.log('  原因:', check3.reason || '无');

    await redis.quit();

    // 场景6: 检查数据库中的实际数据
    console.log('\n场景6: 检查数据库中的实际数据');
    const dbResult = await pool.query(
      `SELECT 
        image_storage_bytes,
        document_storage_bytes,
        article_storage_bytes,
        total_storage_bytes,
        storage_quota_bytes,
        purchased_storage_bytes
      FROM user_storage_usage
      WHERE user_id = $1`,
      [testUserId]
    );

    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      console.log('  image_storage_bytes:', row.image_storage_bytes, typeof row.image_storage_bytes);
      console.log('  total_storage_bytes:', row.total_storage_bytes, typeof row.total_storage_bytes);
      console.log('  storage_quota_bytes:', row.storage_quota_bytes, typeof row.storage_quota_bytes);
      console.log('  purchased_storage_bytes:', row.purchased_storage_bytes, typeof row.purchased_storage_bytes);
      
      const effectiveQuota = Number(row.storage_quota_bytes) + Number(row.purchased_storage_bytes);
      const available = effectiveQuota - Number(row.total_storage_bytes);
      console.log('  计算的可用空间:', available);
      console.log('  是否允许上传:', available >= testFileSize);
    }

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

testUploadScenario();
