import { pool } from '../db/database';
import { storageService } from '../services/StorageService';
import { storageQuotaService } from '../services/StorageQuotaService';

/**
 * 测试 testuser 的存储配额问题
 */
async function testTestUserStorage() {
  try {
    console.log('='.repeat(60));
    console.log('测试 testuser 存储配额');
    console.log('='.repeat(60));
    console.log();

    // 1. 获取 testuser 信息
    const userResult = await pool.query(
      'SELECT id, username, email, role FROM users WHERE username = $1',
      ['testuser']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ testuser 不存在');
      return;
    }

    const user = userResult.rows[0];
    const userId = user.id;

    console.log('用户信息:');
    console.log(`  ID: ${user.id}`);
    console.log(`  用户名: ${user.username}`);
    console.log(`  邮箱: ${user.email}`);
    console.log(`  角色: ${user.role}`);
    console.log();

    // 2. 获取存储使用情况（跳过缓存）
    console.log('获取存储使用情况（跳过缓存）...');
    const usage = await storageService.getUserStorageUsage(userId, true);
    
    console.log('存储使用情况:');
    console.log(`  图片: ${formatBytes(usage.imageStorageBytes)} (${usage.imageCount} 个)`);
    console.log(`  文档: ${formatBytes(usage.documentStorageBytes)} (${usage.documentCount} 个)`);
    console.log(`  文章: ${formatBytes(usage.articleStorageBytes)} (${usage.articleCount} 个)`);
    console.log(`  总计: ${formatBytes(usage.totalStorageBytes)}`);
    console.log();

    console.log('配额信息:');
    console.log(`  套餐配额: ${formatBytes(usage.storageQuotaBytes)}`);
    console.log(`  购买配额: ${formatBytes(usage.purchasedStorageBytes)}`);
    const effectiveQuota = usage.storageQuotaBytes + usage.purchasedStorageBytes;
    console.log(`  有效配额: ${formatBytes(effectiveQuota)}`);
    console.log(`  可用空间: ${formatBytes(usage.availableBytes)}`);
    console.log(`  使用率: ${usage.usagePercentage.toFixed(2)}%`);
    console.log();

    // 3. 测试不同大小的文件上传
    const testSizes = [
      100 * 1024,        // 100KB
      1 * 1024 * 1024,   // 1MB
      5 * 1024 * 1024,   // 5MB
      10 * 1024 * 1024,  // 10MB
    ];

    console.log('测试文件上传检查:');
    for (const size of testSizes) {
      const check = await storageQuotaService.checkQuota(userId, size);
      const status = check.allowed ? '✅ 允许' : '❌ 拒绝';
      console.log(`  ${formatBytes(size)}: ${status}`);
      if (!check.allowed) {
        console.log(`    原因: ${check.reason}`);
        console.log(`    当前使用: ${formatBytes(check.currentUsageBytes)}`);
        console.log(`    配额: ${formatBytes(check.quotaBytes)}`);
        console.log(`    可用: ${formatBytes(check.availableBytes)}`);
      }
    }
    console.log();

    // 4. 检查数据库原始值
    const rawResult = await pool.query(
      `SELECT 
        image_storage_bytes,
        document_storage_bytes,
        article_storage_bytes,
        total_storage_bytes,
        storage_quota_bytes,
        purchased_storage_bytes,
        pg_typeof(total_storage_bytes) as total_type,
        pg_typeof(storage_quota_bytes) as quota_type
      FROM user_storage_usage
      WHERE user_id = $1`,
      [userId]
    );

    if (rawResult.rows.length > 0) {
      const raw = rawResult.rows[0];
      console.log('数据库原始值:');
      console.log(`  total_storage_bytes: ${raw.total_storage_bytes} (${raw.total_type})`);
      console.log(`  storage_quota_bytes: ${raw.storage_quota_bytes} (${raw.quota_type})`);
      console.log(`  purchased_storage_bytes: ${raw.purchased_storage_bytes}`);
      console.log();

      // 类型转换测试
      const totalNum = Number(raw.total_storage_bytes);
      const quotaNum = Number(raw.storage_quota_bytes);
      const purchasedNum = Number(raw.purchased_storage_bytes);
      const effectiveNum = quotaNum + purchasedNum;
      const availableNum = effectiveNum - totalNum;

      console.log('类型转换后:');
      console.log(`  总使用: ${formatBytes(totalNum)}`);
      console.log(`  配额: ${formatBytes(quotaNum)}`);
      console.log(`  购买: ${formatBytes(purchasedNum)}`);
      console.log(`  有效配额: ${formatBytes(effectiveNum)}`);
      console.log(`  可用空间: ${formatBytes(availableNum)}`);
      console.log(`  空间充足: ${availableNum > 0 ? '✅ 是' : '❌ 否'}`);
      console.log();
    }

    // 5. 检查用户订阅
    const subResult = await pool.query(
      `SELECT 
        us.id,
        sp.plan_name,
        sp.plan_code,
        us.status,
        us.start_date,
        us.end_date
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1
      ORDER BY us.created_at DESC
      LIMIT 1`,
      [userId]
    );

    if (subResult.rows.length > 0) {
      const sub = subResult.rows[0];
      console.log('当前订阅:');
      console.log(`  套餐: ${sub.plan_name} (${sub.plan_code})`);
      console.log(`  状态: ${sub.status}`);
      console.log(`  开始: ${sub.start_date}`);
      console.log(`  结束: ${sub.end_date}`);
      console.log();

      // 检查套餐的存储配额
      const planResult = await pool.query(
        `SELECT pf.feature_value
         FROM plan_features pf
         JOIN subscription_plans sp ON pf.plan_id = sp.id
         WHERE sp.plan_code = $1 AND pf.feature_code = 'storage_space'`,
        [sub.plan_code]
      );

      if (planResult.rows.length > 0) {
        const planQuota = Number(planResult.rows[0].feature_value);
        console.log(`套餐存储配额: ${formatBytes(planQuota)}`);
        console.log(`用户实际配额: ${formatBytes(usage.storageQuotaBytes)}`);
        console.log(`配额匹配: ${planQuota === usage.storageQuotaBytes ? '✅ 是' : '❌ 否'}`);
        console.log();
      }
    } else {
      console.log('⚠️  用户没有活跃订阅');
      console.log();
    }

    console.log('='.repeat(60));
    console.log('测试完成');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === -1) return '无限';
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

testTestUserStorage().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
