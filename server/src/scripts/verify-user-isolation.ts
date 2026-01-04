import { pool } from '../db/database';

/**
 * 验证用户隔离是否正确实施
 * 检查所有关键表是否都有 user_id 字段并正确使用
 */
async function verifyUserIsolation() {
  console.log('🔍 开始验证用户隔离...\n');
  
  const client = await pool.connect();
  
  try {
    // 1. 检查 publishing_records 表结构
    console.log('1️⃣  检查 publishing_records 表结构...');
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'publishing_records'
      AND column_name = 'user_id'
    `);
    
    if (tableInfo.rows.length === 0) {
      console.log('   ❌ publishing_records 表缺少 user_id 字段！');
      console.log('   请先运行迁移: npx ts-node src/db/run-migration-011.ts\n');
      return;
    }
    
    console.log(`   ✅ user_id 字段存在 (类型: ${tableInfo.rows[0].data_type}, 可空: ${tableInfo.rows[0].is_nullable})`);
    
    // 2. 检查是否有 NULL 值
    console.log('\n2️⃣  检查数据完整性...');
    const nullCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM publishing_records
      WHERE user_id IS NULL
    `);
    
    const nullCount = parseInt(nullCheck.rows[0].count);
    if (nullCount > 0) {
      console.log(`   ⚠️  发现 ${nullCount} 条记录的 user_id 为 NULL`);
    } else {
      console.log('   ✅ 所有记录都有 user_id');
    }
    
    // 3. 检查索引
    console.log('\n3️⃣  检查索引...');
    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'publishing_records'
      AND indexname LIKE '%user%'
    `);
    
    console.log(`   找到 ${indexes.rows.length} 个与用户相关的索引:`);
    indexes.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });
    
    // 4. 检查外键约束
    console.log('\n4️⃣  检查外键约束...');
    const foreignKeys = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'publishing_records'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%user%'
    `);
    
    if (foreignKeys.rows.length > 0) {
      console.log('   ✅ 找到用户外键约束:');
      foreignKeys.rows.forEach(row => {
        console.log(`   - ${row.constraint_name}`);
      });
    } else {
      console.log('   ⚠️  未找到用户外键约束');
    }
    
    // 5. 统计数据分布
    console.log('\n5️⃣  统计数据分布...');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users,
        MIN(user_id) as min_user_id,
        MAX(user_id) as max_user_id
      FROM publishing_records
    `);
    
    const stat = stats.rows[0];
    console.log(`   总记录数: ${stat.total_records}`);
    console.log(`   涉及用户数: ${stat.unique_users}`);
    console.log(`   用户ID范围: ${stat.min_user_id} - ${stat.max_user_id}`);
    
    // 6. 检查每个用户的记录数
    console.log('\n6️⃣  各用户记录数分布...');
    const userStats = await client.query(`
      SELECT 
        u.id as user_id,
        u.username,
        COUNT(pr.id) as record_count
      FROM users u
      LEFT JOIN publishing_records pr ON u.id = pr.user_id
      GROUP BY u.id, u.username
      ORDER BY record_count DESC
      LIMIT 10
    `);
    
    console.log('   前10个用户:');
    userStats.rows.forEach(row => {
      console.log(`   - 用户 #${row.user_id} (${row.username}): ${row.record_count} 条记录`);
    });
    
    // 7. 检查孤立记录（记录存在但关联的文章或账号不属于同一用户）
    console.log('\n7️⃣  检查数据一致性...');
    
    const articleMismatch = await client.query(`
      SELECT COUNT(*) as count
      FROM publishing_records pr
      INNER JOIN articles a ON pr.article_id = a.id
      WHERE pr.user_id != a.user_id
    `);
    
    const articleMismatchCount = parseInt(articleMismatch.rows[0].count);
    if (articleMismatchCount > 0) {
      console.log(`   ⚠️  发现 ${articleMismatchCount} 条记录的 user_id 与文章的 user_id 不匹配`);
    } else {
      console.log('   ✅ 所有记录的 user_id 与文章的 user_id 一致');
    }
    
    const accountMismatch = await client.query(`
      SELECT COUNT(*) as count
      FROM publishing_records pr
      INNER JOIN platform_accounts pa ON pr.account_id = pa.id
      WHERE pr.user_id != pa.user_id
    `);
    
    const accountMismatchCount = parseInt(accountMismatch.rows[0].count);
    if (accountMismatchCount > 0) {
      console.log(`   ⚠️  发现 ${accountMismatchCount} 条记录的 user_id 与账号的 user_id 不匹配`);
    } else {
      console.log('   ✅ 所有记录的 user_id 与账号的 user_id 一致');
    }
    
    // 8. 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 验证总结');
    console.log('='.repeat(60));
    
    const issues = [];
    if (nullCount > 0) issues.push(`${nullCount} 条记录缺少 user_id`);
    if (articleMismatchCount > 0) issues.push(`${articleMismatchCount} 条记录与文章 user_id 不匹配`);
    if (accountMismatchCount > 0) issues.push(`${accountMismatchCount} 条记录与账号 user_id 不匹配`);
    
    if (issues.length === 0) {
      console.log('✅ 所有检查通过！用户隔离已正确实施。');
    } else {
      console.log('⚠️  发现以下问题:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('\n建议运行修复脚本或手动修复这些问题。');
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行验证
verifyUserIsolation().catch(error => {
  console.error('执行验证时发生错误:', error);
  process.exit(1);
});
