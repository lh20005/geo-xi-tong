import { pool } from '../db/database';

async function diagnoseStorageQuota() {
  try {
    const username = process.argv[2] || 'lzc2005';
    console.log(`=== 诊断用户 ${username} 的存储配额 ===\n`);
    
    // 获取用户ID
    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`用户ID: ${userId}\n`);
    
    // 1. 检查存储配额记录
    const storageQuotaResult = await pool.query(`
      SELECT 
        user_id,
        image_storage_bytes,
        document_storage_bytes,
        article_storage_bytes,
        total_storage_bytes,
        storage_quota_bytes,
        purchased_storage_bytes,
        image_count,
        document_count,
        article_count,
        last_updated_at
      FROM user_storage_usage 
      WHERE user_id = $1
    `, [userId]);
    
    console.log('📊 存储配额记录 (user_storage_usage):');
    if (storageQuotaResult.rows.length === 0) {
      console.log('  ❌ 没有存储配额记录\n');
    } else {
      const row = storageQuotaResult.rows[0];
      const quotaMB = row.storage_quota_bytes / 1024 / 1024;
      const usedMB = row.total_storage_bytes / 1024 / 1024;
      const remainingMB = (row.storage_quota_bytes - row.total_storage_bytes) / 1024 / 1024;
      
      console.log(`  配额限制: ${row.storage_quota_bytes} bytes (${quotaMB.toFixed(2)} MB)`);
      console.log(`  已用空间: ${row.total_storage_bytes} bytes (${usedMB.toFixed(2)} MB)`);
      console.log(`    - 图片: ${row.image_storage_bytes} bytes (${(row.image_storage_bytes / 1024 / 1024).toFixed(2)} MB, ${row.image_count} 个)`);
      console.log(`    - 文档: ${row.document_storage_bytes} bytes (${(row.document_storage_bytes / 1024 / 1024).toFixed(2)} MB, ${row.document_count} 个)`);
      console.log(`    - 文章: ${row.article_storage_bytes} bytes (${(row.article_storage_bytes / 1024 / 1024).toFixed(2)} MB, ${row.article_count} 个)`);
      console.log(`  剩余空间: ${row.storage_quota_bytes - row.total_storage_bytes} bytes (${remainingMB.toFixed(2)} MB)`);
      console.log(`  额外购买: ${row.purchased_storage_bytes} bytes (${(row.purchased_storage_bytes / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  更新时间: ${row.last_updated_at}\n`);
      
      if (remainingMB <= 0) {
        console.log('  ⚠️  警告: 存储空间已用尽或超额！\n');
      }
    }
    
    // 2. 检查实际存储使用
    const actualUsageResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT i.id) as image_count,
        COALESCE(SUM(i.size), 0) as total_image_size,
        COUNT(DISTINCT kd.id) as document_count,
        COALESCE(SUM(kd.file_size), 0) as total_document_size
      FROM users u
      LEFT JOIN albums a ON u.id = a.user_id
      LEFT JOIN images i ON a.id = i.album_id
      LEFT JOIN knowledge_bases kb ON u.id = kb.user_id
      LEFT JOIN knowledge_documents kd ON kb.id = kd.knowledge_base_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);
    
    console.log('📈 实际存储使用:');
    if (actualUsageResult.rows.length > 0) {
      const row = actualUsageResult.rows[0];
      const totalSize = parseInt(row.total_image_size) + parseInt(row.total_document_size);
      console.log(`  图片数量: ${row.image_count}`);
      console.log(`  图片大小: ${row.total_image_size} bytes (${(row.total_image_size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  文档数量: ${row.document_count}`);
      console.log(`  文档大小: ${row.total_document_size} bytes (${(row.total_document_size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  总大小: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)\n`);
    }
    
    // 3. 检查存储事务记录
    const storageTransactionsResult = await pool.query(`
      SELECT 
        resource_type,
        operation,
        COUNT(*) as record_count,
        SUM(size_bytes) as total_size_bytes
      FROM storage_transactions
      WHERE user_id = $1
      GROUP BY resource_type, operation
      ORDER BY resource_type, operation
    `, [userId]);
    
    console.log('📝 存储事务记录 (storage_transactions):');
    if (storageTransactionsResult.rows.length === 0) {
      console.log('  ❌ 没有存储事务记录\n');
    } else {
      storageTransactionsResult.rows.forEach(row => {
        console.log(`  ${row.resource_type} (${row.operation}): ${row.record_count} 条, ${(row.total_size_bytes / 1024 / 1024).toFixed(2)} MB`);
      });
      console.log('');
    }
    
    // 4. 数据一致性检查
    console.log('🔍 数据一致性检查:');
    if (storageQuotaResult.rows.length > 0 && actualUsageResult.rows.length > 0) {
      const quotaUsedBytes = storageQuotaResult.rows[0].total_storage_bytes;
      const actualTotalBytes = parseInt(actualUsageResult.rows[0].total_image_size) + parseInt(actualUsageResult.rows[0].total_document_size);
      
      console.log(`  配额记录: ${quotaUsedBytes} bytes (${(quotaUsedBytes / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  实际使用: ${actualTotalBytes} bytes (${(actualTotalBytes / 1024 / 1024).toFixed(2)} MB)`);
      
      if (quotaUsedBytes === actualTotalBytes) {
        console.log(`  ✅ 完全一致`);
      } else {
        console.log(`  ⚠️  存在差异`);
        console.log(`  差异: ${Math.abs(quotaUsedBytes - actualTotalBytes)} bytes (${Math.abs((quotaUsedBytes - actualTotalBytes) / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
    
    console.log('\n💡 诊断结论:');
    if (storageQuotaResult.rows.length > 0) {
      const row = storageQuotaResult.rows[0];
      const remainingBytes = row.storage_quota_bytes - row.total_storage_bytes;
      
      if (remainingBytes <= 0) {
        console.log('  ❌ 问题: 存储空间已用尽');
        console.log(`     配额: ${(row.storage_quota_bytes / 1024 / 1024).toFixed(2)} MB`);
        console.log(`     已用: ${(row.total_storage_bytes / 1024 / 1024).toFixed(2)} MB`);
        console.log(`     剩余: ${(remainingBytes / 1024 / 1024).toFixed(2)} MB`);
        console.log('  解决方案:');
        console.log('     1. 删除一些图片或文档释放空间');
        console.log('     2. 购买额外存储空间');
        console.log('     3. 升级到更高配额的套餐');
      } else {
        console.log('  ✅ 存储空间充足');
        console.log(`     剩余: ${(remainingBytes / 1024 / 1024).toFixed(2)} MB`);
      }
    } else {
      console.log('  ❌ 问题: 用户没有存储配额记录');
      console.log('  解决方案: 运行存储初始化迁移');
    }
    
  } catch (error) {
    console.error('诊断失败:', error);
  } finally {
    await pool.end();
  }
}

diagnoseStorageQuota();
