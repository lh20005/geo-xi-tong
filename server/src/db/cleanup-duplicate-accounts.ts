import { pool } from './database';

/**
 * 清理重复的账号
 * 保留每个平台+用户名组合的最新记录，删除旧的重复记录
 */
async function cleanupDuplicateAccounts() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 开始清理重复账号...\n');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 1. 查找所有重复的账号
    console.log('📝 步骤 1: 查找重复账号...');
    
    const duplicatesQuery = `
      SELECT 
        platform_id,
        COALESCE(real_username, account_name) as unique_identifier,
        COUNT(*) as count,
        array_agg(id ORDER BY created_at DESC) as ids
      FROM platform_accounts
      GROUP BY platform_id, COALESCE(real_username, account_name)
      HAVING COUNT(*) > 1
      ORDER BY platform_id, unique_identifier
    `;
    
    const duplicatesResult = await client.query(duplicatesQuery);
    
    if (duplicatesResult.rows.length === 0) {
      console.log('✅ 没有发现重复账号');
      await client.query('COMMIT');
      return;
    }
    
    console.log(`\n⚠️  发现 ${duplicatesResult.rows.length} 组重复账号：\n`);
    
    let totalDeleted = 0;
    
    for (const row of duplicatesResult.rows) {
      const { platform_id, unique_identifier, count, ids } = row;
      
      console.log(`平台: ${platform_id}`);
      console.log(`用户名: ${unique_identifier}`);
      console.log(`重复数量: ${count}`);
      console.log(`账号 IDs: ${ids.join(', ')}`);
      
      // 保留最新的（第一个），删除其他的
      const keepId = ids[0];
      const deleteIds = ids.slice(1);
      
      console.log(`  ✅ 保留账号 ID: ${keepId} (最新)`);
      console.log(`  ❌ 删除账号 IDs: ${deleteIds.join(', ')}`);
      
      // 删除重复的账号
      for (const deleteId of deleteIds) {
        await client.query('DELETE FROM platform_accounts WHERE id = $1', [deleteId]);
        totalDeleted++;
      }
      
      console.log('');
    }
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log('========================================');
    console.log(`✅ 清理完成！`);
    console.log(`📊 统计：`);
    console.log(`   - 发现重复组: ${duplicatesResult.rows.length}`);
    console.log(`   - 删除账号数: ${totalDeleted}`);
    console.log('========================================\n');
    
    // 显示清理后的账号列表
    console.log('📋 清理后的账号列表：\n');
    
    const accountsResult = await client.query(`
      SELECT 
        id,
        platform_id,
        account_name,
        real_username,
        status,
        created_at
      FROM platform_accounts
      ORDER BY platform_id, created_at DESC
    `);
    
    console.log('ID\t平台\t\t账号名\t\t真实用户名\t状态\t创建时间');
    console.log('─'.repeat(100));
    
    for (const account of accountsResult.rows) {
      console.log(
        `${account.id}\t${account.platform_id}\t\t${account.account_name}\t\t${account.real_username || 'N/A'}\t${account.status}\t${account.created_at.toISOString().split('T')[0]}`
      );
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ 清理失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行清理
cleanupDuplicateAccounts().catch(error => {
  console.error('执行清理时发生错误:', error);
  process.exit(1);
});
