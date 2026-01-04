import { pool } from '../db/database';
import { storageService } from '../services/StorageService';
import { storageQuotaService } from '../services/StorageQuotaService';

async function quickDiagnose() {
  console.log('=== 快速诊断 testuser2 ===\n');

  try {
    // 1. 获取用户ID
    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      ['testuser2']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ 用户ID: ${userId}\n`);

    // 2. 检查存储使用记录（原始数据）
    const storageResult = await pool.query(
      `SELECT 
        total_storage_bytes,
        storage_quota_bytes,
        purchased_storage_bytes,
        image_storage_bytes,
        document_storage_bytes,
        image_count,
        document_count
      FROM user_storage_usage
      WHERE user_id = $1`,
      [userId]
    );

    if (storageResult.rows.length === 0) {
      console.log('⚠️  没有存储记录，初始化中...');
      await pool.query('SELECT initialize_user_storage($1)', [userId]);
      return quickDiagnose();
    }

    const raw = storageResult.rows[0];
    console.log('📊 原始数据库记录:');
    console.log(`   total_storage_bytes: ${raw.total_storage_bytes} (类型: ${typeof raw.total_storage_bytes})`);
    console.log(`   storage_quota_bytes: ${raw.storage_quota_bytes} (类型: ${typeof raw.storage_quota_bytes})`);
    console.log(`   purchased_storage_bytes: ${raw.purchased_storage_bytes} (类型: ${typeof raw.purchased_storage_bytes})`);
    console.log(`   image_storage_bytes: ${raw.image_storage_bytes}`);
    console.log(`   document_storage_bytes: ${raw.document_storage_bytes}`);
    console.log(`   image_count: ${raw.image_count}`);
    console.log(`   document_count: ${raw.document_count}\n`);

    // 3. 通过服务获取（跳过缓存）
    console.log('🔍 通过 StorageService 获取:');
    const usage = await storageService.getUserStorageUsage(userId, true);
    console.log(`   总使用: ${usage.totalStorageBytes} bytes`);
    console.log(`   配额: ${usage.storageQuotaBytes} bytes`);
    console.log(`   购买的: ${usage.purchasedStorageBytes} bytes`);
    console.log(`   有效配额: ${usage.storageQuotaBytes + usage.purchasedStorageBytes} bytes`);
    console.log(`   可用: ${usage.availableBytes} bytes`);
    console.log(`   使用率: ${usage.usagePercentage}%\n`);

    // 4. 测试小文件上传
    console.log('🧪 测试配额检查 (1KB 文件):');
    const check = await storageQuotaService.checkQuota(userId, 1024);
    console.log(`   允许: ${check.allowed}`);
    console.log(`   当前使用: ${check.currentUsageBytes} bytes`);
    console.log(`   配额: ${check.quotaBytes} bytes`);
    console.log(`   可用: ${check.availableBytes} bytes`);
    if (!check.allowed) {
      console.log(`   ❌ 原因: ${check.reason}`);
    }
    console.log();

    // 5. 检查实际文件
    const imagesResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size
       FROM images i
       JOIN albums a ON i.album_id = a.id
       WHERE a.user_id = $1`,
      [userId]
    );
    
    const docsResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
       FROM knowledge_documents kd
       JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
       WHERE kb.user_id = $1`,
      [userId]
    );

    console.log('📁 实际文件统计:');
    console.log(`   图片: ${imagesResult.rows[0].count} 个, ${imagesResult.rows[0].total_size} bytes`);
    console.log(`   文档: ${docsResult.rows[0].count} 个, ${docsResult.rows[0].total_size} bytes`);
    const actualTotal = Number(imagesResult.rows[0].total_size) + Number(docsResult.rows[0].total_size);
    console.log(`   实际总计: ${actualTotal} bytes\n`);

    // 6. 诊断结论
    console.log('=== 诊断结论 ===');
    const effectiveQuota = usage.storageQuotaBytes + usage.purchasedStorageBytes;
    
    if (effectiveQuota === -1) {
      console.log('✅ 无限存储配额');
    } else if (usage.totalStorageBytes >= effectiveQuota) {
      console.log('❌ 问题：存储空间已满');
      console.log(`   已使用: ${usage.totalStorageBytes} bytes`);
      console.log(`   配额: ${effectiveQuota} bytes`);
      console.log(`   超出: ${usage.totalStorageBytes - effectiveQuota} bytes`);
    } else {
      console.log('✅ 存储空间充足');
      console.log(`   已使用: ${usage.totalStorageBytes} bytes (${usage.usagePercentage}%)`);
      console.log(`   配额: ${effectiveQuota} bytes`);
      console.log(`   可用: ${usage.availableBytes} bytes`);
    }

    // 检查数据不一致
    const diff = Math.abs(actualTotal - usage.totalStorageBytes);
    if (diff > 1024) {
      console.log(`\n⚠️  警告: 数据不一致 (差异 ${diff} bytes)`);
      console.log('   记录的使用量与实际文件大小不匹配');
    }

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

quickDiagnose();
