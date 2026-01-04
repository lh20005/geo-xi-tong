import { pool } from '../db/database';
import { storageService } from '../services/StorageService';
import { storageQuotaService } from '../services/StorageQuotaService';

/**
 * 诊断存储空间问题
 * 检查用户的实际存储使用情况和配额
 */
async function diagnoseStorageIssue(userId?: number) {
  try {
    console.log('='.repeat(60));
    console.log('存储空间诊断工具');
    console.log('='.repeat(60));
    console.log();

    // 如果没有指定用户，获取所有用户
    let userIds: number[] = [];
    if (userId) {
      userIds = [userId];
    } else {
      const result = await pool.query('SELECT id FROM users ORDER BY id');
      userIds = result.rows.map(row => row.id);
    }

    for (const uid of userIds) {
      console.log(`\n用户 ID: ${uid}`);
      console.log('-'.repeat(60));

      // 1. 获取用户信息
      const userResult = await pool.query(
        'SELECT id, username, email, role FROM users WHERE id = $1',
        [uid]
      );
      
      if (userResult.rows.length === 0) {
        console.log('❌ 用户不存在');
        continue;
      }

      const user = userResult.rows[0];
      console.log(`用户名: ${user.username}`);
      console.log(`邮箱: ${user.email}`);
      console.log(`角色: ${user.role}`);
      console.log();

      // 2. 获取存储使用情况
      const usage = await storageService.getUserStorageUsage(uid);
      console.log('📊 存储使用情况:');
      console.log(`  图片: ${formatBytes(usage.imageStorageBytes)} (${usage.imageCount} 个)`);
      console.log(`  文档: ${formatBytes(usage.documentStorageBytes)} (${usage.documentCount} 个)`);
      console.log(`  文章: ${formatBytes(usage.articleStorageBytes)} (${usage.articleCount} 个)`);
      console.log(`  总计: ${formatBytes(usage.totalStorageBytes)}`);
      console.log();

      // 3. 获取配额信息
      console.log('📦 配额信息:');
      console.log(`  套餐配额: ${formatBytes(usage.storageQuotaBytes)}`);
      console.log(`  购买配额: ${formatBytes(usage.purchasedStorageBytes)}`);
      const effectiveQuota = usage.storageQuotaBytes + usage.purchasedStorageBytes;
      console.log(`  有效配额: ${formatBytes(effectiveQuota)}`);
      console.log(`  可用空间: ${formatBytes(usage.availableBytes)}`);
      console.log(`  使用率: ${usage.usagePercentage.toFixed(2)}%`);
      console.log();

      // 4. 检查数据库原始数据
      const rawResult = await pool.query(
        `SELECT 
          image_storage_bytes,
          document_storage_bytes,
          article_storage_bytes,
          total_storage_bytes,
          storage_quota_bytes,
          purchased_storage_bytes
        FROM user_storage_usage
        WHERE user_id = $1`,
        [uid]
      );

      if (rawResult.rows.length > 0) {
        const raw = rawResult.rows[0];
        console.log('🔍 数据库原始值:');
        console.log(`  image_storage_bytes: ${raw.image_storage_bytes} (${typeof raw.image_storage_bytes})`);
        console.log(`  document_storage_bytes: ${raw.document_storage_bytes} (${typeof raw.document_storage_bytes})`);
        console.log(`  article_storage_bytes: ${raw.article_storage_bytes} (${typeof raw.article_storage_bytes})`);
        console.log(`  total_storage_bytes: ${raw.total_storage_bytes} (${typeof raw.total_storage_bytes})`);
        console.log(`  storage_quota_bytes: ${raw.storage_quota_bytes} (${typeof raw.storage_quota_bytes})`);
        console.log(`  purchased_storage_bytes: ${raw.purchased_storage_bytes} (${typeof raw.purchased_storage_bytes})`);
        console.log();

        // 检查类型转换问题
        const imageBytes = parseInt(raw.image_storage_bytes);
        const docBytes = parseInt(raw.document_storage_bytes);
        const articleBytes = parseInt(raw.article_storage_bytes);
        const totalBytes = parseInt(raw.total_storage_bytes);
        const quotaBytes = parseInt(raw.storage_quota_bytes);
        const purchasedBytes = parseInt(raw.purchased_storage_bytes);

        console.log('🔄 类型转换后:');
        console.log(`  图片: ${formatBytes(imageBytes)}`);
        console.log(`  文档: ${formatBytes(docBytes)}`);
        console.log(`  文章: ${formatBytes(articleBytes)}`);
        console.log(`  总计: ${formatBytes(totalBytes)}`);
        console.log(`  配额: ${formatBytes(quotaBytes)}`);
        console.log(`  购买: ${formatBytes(purchasedBytes)}`);
        console.log();

        // 检查计算是否正确
        const calculatedTotal = imageBytes + docBytes + articleBytes;
        const effectiveQuotaCalc = quotaBytes + purchasedBytes;
        const available = effectiveQuotaCalc - totalBytes;

        console.log('✅ 验证计算:');
        console.log(`  计算的总量: ${formatBytes(calculatedTotal)}`);
        console.log(`  数据库总量: ${formatBytes(totalBytes)}`);
        console.log(`  是否匹配: ${calculatedTotal === totalBytes ? '✓' : '✗'}`);
        console.log(`  有效配额: ${formatBytes(effectiveQuotaCalc)}`);
        console.log(`  可用空间: ${formatBytes(available)}`);
        console.log(`  空间充足: ${available > 0 ? '✓' : '✗'}`);
        console.log();
      }

      // 5. 测试上传检查
      const testSizes = [1024, 1024 * 1024, 10 * 1024 * 1024]; // 1KB, 1MB, 10MB
      console.log('🧪 测试上传检查:');
      for (const size of testSizes) {
        const check = await storageQuotaService.checkQuota(uid, size);
        console.log(`  ${formatBytes(size)}: ${check.allowed ? '✓ 允许' : '✗ 拒绝'}`);
        if (!check.allowed) {
          console.log(`    原因: ${check.reason}`);
        }
      }
      console.log();

      // 6. 检查实际文件
      console.log('📁 实际文件统计:');
      
      // 图片
      const imageResult = await pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size
         FROM images i
         JOIN albums a ON i.album_id = a.id
         WHERE a.user_id = $1`,
        [uid]
      );
      console.log(`  图片: ${imageResult.rows[0].count} 个, ${formatBytes(parseInt(imageResult.rows[0].total_size))}`);

      // 文档
      const docResult = await pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
         FROM knowledge_documents kd
         JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
         WHERE kb.user_id = $1`,
        [uid]
      );
      console.log(`  文档: ${docResult.rows[0].count} 个, ${formatBytes(parseInt(docResult.rows[0].total_size))}`);

      // 文章
      const articleResult = await pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(content)), 0) as total_size
         FROM articles
         WHERE user_id = $1`,
        [uid]
      );
      console.log(`  文章: ${articleResult.rows[0].count} 个, ${formatBytes(parseInt(articleResult.rows[0].total_size))}`);

      const actualTotal = 
        parseInt(imageResult.rows[0].total_size) +
        parseInt(docResult.rows[0].total_size) +
        parseInt(articleResult.rows[0].total_size);
      
      console.log(`  实际总计: ${formatBytes(actualTotal)}`);
      console.log(`  记录总计: ${formatBytes(usage.totalStorageBytes)}`);
      console.log(`  差异: ${formatBytes(Math.abs(actualTotal - usage.totalStorageBytes))}`);
      console.log();

      // 7. 检查存储事务
      const transResult = await pool.query(
        `SELECT 
          resource_type,
          operation,
          COUNT(*) as count,
          SUM(size_bytes) as total_bytes
         FROM storage_transactions
         WHERE user_id = $1
         GROUP BY resource_type, operation
         ORDER BY resource_type, operation`,
        [uid]
      );

      if (transResult.rows.length > 0) {
        console.log('📝 存储事务统计:');
        for (const row of transResult.rows) {
          console.log(`  ${row.resource_type} ${row.operation}: ${row.count} 次, ${formatBytes(parseInt(row.total_bytes))}`);
        }
        console.log();
      }
    }

    console.log('='.repeat(60));
    console.log('诊断完成');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('诊断失败:', error);
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

// 从命令行参数获取用户ID
const userId = process.argv[2] ? parseInt(process.argv[2]) : undefined;

diagnoseStorageIssue(userId).catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
