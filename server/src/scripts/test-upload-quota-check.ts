import { storageQuotaService } from '../services/StorageQuotaService';
import { storageService } from '../services/StorageService';
import { pool } from '../db/database';

async function testUploadQuotaCheck() {
  try {
    const username = process.argv[2] || 'lzc2005';
    console.log(`=== 测试用户 ${username} 的上传配额检查 ===\n`);
    
    // 获取用户ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`用户ID: ${userId}\n`);
    
    // 1. 获取存储使用情况（跳过缓存）
    console.log('📊 步骤 1: 获取存储使用情况（跳过缓存）');
    const usage = await storageService.getUserStorageUsage(userId, true);
    console.log('  结果:', JSON.stringify(usage, null, 2));
    console.log('');
    
    // 2. 模拟上传一个 1MB 的文件
    const testFileSize = 1 * 1024 * 1024; // 1 MB
    console.log(`📤 步骤 2: 模拟上传 ${testFileSize} bytes (1 MB) 的文件`);
    
    const quotaCheck = await storageQuotaService.checkQuota(userId, testFileSize);
    console.log('  检查结果:');
    console.log(`    允许上传: ${quotaCheck.allowed ? '✅ 是' : '❌ 否'}`);
    console.log(`    当前使用: ${quotaCheck.currentUsageBytes} bytes (${(quotaCheck.currentUsageBytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`    配额限制: ${quotaCheck.quotaBytes} bytes (${(quotaCheck.quotaBytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`    可用空间: ${quotaCheck.availableBytes} bytes (${(quotaCheck.availableBytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`    使用百分比: ${quotaCheck.usagePercentage.toFixed(2)}%`);
    if (quotaCheck.reason) {
      console.log(`    拒绝原因: ${quotaCheck.reason}`);
    }
    console.log('');
    
    // 3. 检查数据库中的实际记录
    console.log('🔍 步骤 3: 检查数据库中的实际记录');
    const dbResult = await pool.query(`
      SELECT 
        storage_quota_bytes,
        total_storage_bytes,
        image_storage_bytes,
        document_storage_bytes,
        article_storage_bytes,
        purchased_storage_bytes,
        image_count,
        document_count,
        article_count
      FROM user_storage_usage
      WHERE user_id = $1
    `, [userId]);
    
    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      console.log('  数据库记录:');
      console.log(`    配额: ${row.storage_quota_bytes} bytes (${(row.storage_quota_bytes / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`    总使用: ${row.total_storage_bytes} bytes (${(row.total_storage_bytes / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`    图片: ${row.image_storage_bytes} bytes (${row.image_count} 个)`);
      console.log(`    文档: ${row.document_storage_bytes} bytes (${row.document_count} 个)`);
      console.log(`    文章: ${row.article_storage_bytes} bytes (${row.article_count} 个)`);
      console.log(`    额外购买: ${row.purchased_storage_bytes} bytes`);
      console.log('');
      
      // 4. 数据一致性检查
      console.log('✅ 步骤 4: 数据一致性检查');
      const serviceTotal = usage.totalStorageBytes;
      const dbTotal = row.total_storage_bytes;
      
      if (serviceTotal === dbTotal) {
        console.log(`  ✅ 一致: Service (${serviceTotal}) = DB (${dbTotal})`);
      } else {
        console.log(`  ❌ 不一致: Service (${serviceTotal}) ≠ DB (${dbTotal})`);
        console.log(`  差异: ${Math.abs(serviceTotal - dbTotal)} bytes`);
      }
    } else {
      console.log('  ❌ 数据库中没有记录');
    }
    
    console.log('\n💡 结论:');
    if (quotaCheck.allowed) {
      console.log('  ✅ 用户可以上传文件');
    } else {
      console.log('  ❌ 用户无法上传文件');
      console.log(`  原因: ${quotaCheck.reason}`);
      console.log('\n  可能的解决方案:');
      console.log('    1. 删除一些现有文件释放空间');
      console.log('    2. 购买额外存储空间');
      console.log('    3. 升级到更高配额的套餐');
      console.log('    4. 检查数据是否同步（运行存储同步脚本）');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

testUploadQuotaCheck();
