import { pool } from '../db/database';
import { storageService } from '../services/StorageService';
import { storageQuotaService } from '../services/StorageQuotaService';

async function diagnoseTestuser2Storage() {
  console.log('=== 诊断 testuser2 存储空间问题 ===\n');

  try {
    // 1. 获取用户信息
    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1',
      ['testuser2']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 用户 testuser2 不存在');
      return;
    }

    const user = userResult.rows[0];
    console.log('✅ 用户信息:');
    console.log(`   ID: ${user.id}`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   邮箱: ${user.email}\n`);

    // 2. 检查订阅信息
    const subscriptionResult = await pool.query(
      `SELECT 
        s.id, s.product_id, s.status, s.start_date, s.end_date,
        p.name as product_name, p.storage_quota_mb
      FROM subscriptions s
      JOIN products p ON s.product_id = p.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1`,
      [user.id]
    );

    if (subscriptionResult.rows.length === 0) {
      console.log('⚠️  没有找到订阅记录\n');
    } else {
      const sub = subscriptionResult.rows[0];
      console.log('✅ 订阅信息:');
      console.log(`   订阅ID: ${sub.id}`);
      console.log(`   套餐: ${sub.product_name}`);
      console.log(`   状态: ${sub.status}`);
      console.log(`   存储配额: ${sub.storage_quota_mb} MB`);
      console.log(`   开始日期: ${sub.start_date}`);
      console.log(`   结束日期: ${sub.end_date}\n`);
    }

    // 3. 检查存储使用记录（原始数据）
    const storageResult = await pool.query(
      `SELECT 
        user_id,
        image_storage_bytes,
        document_storage_bytes,
        article_storage_bytes,
        total_storage_bytes,
        image_count,
        document_count,
        article_count,
        storage_quota_bytes,
        purchased_storage_bytes,
        last_updated_at
      FROM user_storage_usage
      WHERE user_id = $1`,
      [user.id]
    );

    if (storageResult.rows.length === 0) {
      console.log('⚠️  没有找到存储使用记录\n');
    } else {
      const storage = storageResult.rows[0];
      console.log('📊 存储使用记录（原始数据）:');
      console.log(`   图片存储: ${storage.image_storage_bytes} bytes (${storage.image_count} 个)`);
      console.log(`   文档存储: ${storage.document_storage_bytes} bytes (${storage.document_count} 个)`);
      console.log(`   文章存储: ${storage.article_storage_bytes} bytes (${storage.article_count} 个)`);
      console.log(`   总存储: ${storage.total_storage_bytes} bytes`);
      console.log(`   存储配额: ${storage.storage_quota_bytes} bytes`);
      console.log(`   购买的存储: ${storage.purchased_storage_bytes} bytes`);
      console.log(`   最后更新: ${storage.last_updated_at}`);
      console.log(`   数据类型: total=${typeof storage.total_storage_bytes}, quota=${typeof storage.storage_quota_bytes}\n`);
    }

    // 4. 通过服务获取存储使用（跳过缓存）
    console.log('🔍 通过 StorageService 获取（跳过缓存）:');
    const usage = await storageService.getUserStorageUsage(user.id, true);
    console.log(`   总使用: ${usage.totalStorageBytes} bytes`);
    console.log(`   配额: ${usage.storageQuotaBytes} bytes`);
    console.log(`   购买的: ${usage.purchasedStorageBytes} bytes`);
    console.log(`   有效配额: ${usage.storageQuotaBytes + usage.purchasedStorageBytes} bytes`);
    console.log(`   可用: ${usage.availableBytes} bytes`);
    console.log(`   使用率: ${usage.usagePercentage}%\n`);

    // 5. 测试配额检查
    const testFileSizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
    console.log('🧪 测试配额检查:');
    for (const size of testFileSizes) {
      const check = await storageQuotaService.checkQuota(user.id, size);
      console.log(`   上传 ${size} bytes: ${check.allowed ? '✅ 允许' : '❌ 拒绝'}`);
      if (!check.allowed) {
        console.log(`      原因: ${check.reason}`);
      }
    }
    console.log();

    // 6. 检查实际文件
    console.log('📁 检查实际图片文件:');
    const imagesResult = await pool.query(
      `SELECT i.id, i.filename, i.size, i.created_at, a.name as album_name
       FROM images i
       JOIN albums a ON i.album_id = a.id
       WHERE a.user_id = $1
       ORDER BY i.created_at DESC`,
      [user.id]
    );
    console.log(`   图片数量: ${imagesResult.rows.length}`);
    if (imagesResult.rows.length > 0) {
      console.log('   最近的图片:');
      imagesResult.rows.slice(0, 5).forEach(img => {
        console.log(`     - ${img.filename} (${img.size} bytes) - ${img.album_name}`);
      });
    }
    console.log();

    // 7. 检查知识库文件
    console.log('📚 检查知识库文件:');
    const docsResult = await pool.query(
      `SELECT id, filename, file_size, created_at
       FROM knowledge_base
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );
    console.log(`   文档数量: ${docsResult.rows.length}`);
    if (docsResult.rows.length > 0) {
      console.log('   最近的文档:');
      docsResult.rows.slice(0, 5).forEach(doc => {
        console.log(`     - ${doc.filename} (${doc.file_size} bytes)`);
      });
    }
    console.log();

    // 8. 检查存储事务记录
    console.log('📝 最近的存储事务:');
    const transactionsResult = await pool.query(
      `SELECT 
        resource_type, action, size_bytes, created_at, metadata
       FROM storage_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.id]
    );
    if (transactionsResult.rows.length > 0) {
      transactionsResult.rows.forEach(tx => {
        console.log(`   ${tx.created_at}: ${tx.action} ${tx.resource_type} (${tx.size_bytes} bytes)`);
      });
    } else {
      console.log('   没有事务记录');
    }
    console.log();

    // 9. 计算实际使用量
    console.log('🔢 计算实际使用量:');
    const actualImageSize = imagesResult.rows.reduce((sum, img) => sum + Number(img.size), 0);
    const actualDocSize = docsResult.rows.reduce((sum, doc) => sum + Number(doc.file_size || 0), 0);
    const actualTotal = actualImageSize + actualDocSize;
    
    console.log(`   实际图片大小: ${actualImageSize} bytes`);
    console.log(`   实际文档大小: ${actualDocSize} bytes`);
    console.log(`   实际总大小: ${actualTotal} bytes`);
    console.log(`   记录的总大小: ${usage.totalStorageBytes} bytes`);
    console.log(`   差异: ${Math.abs(actualTotal - usage.totalStorageBytes)} bytes\n`);

    // 10. 诊断结论
    console.log('=== 诊断结论 ===');
    const effectiveQuota = usage.storageQuotaBytes + usage.purchasedStorageBytes;
    
    if (effectiveQuota === -1) {
      console.log('✅ 用户有无限存储配额');
    } else if (usage.totalStorageBytes >= effectiveQuota) {
      console.log('❌ 存储空间已满');
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
    if (Math.abs(actualTotal - usage.totalStorageBytes) > 1024) {
      console.log('\n⚠️  警告: 实际文件大小与记录不一致！');
      console.log('   建议运行存储对账脚本修复');
    }

  } catch (error) {
    console.error('❌ 诊断过程出错:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

diagnoseTestuser2Storage();
