/**
 * 诊断账号共享问题
 * 检查是否存在跨用户的账号数据泄露
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function diagnose() {
  console.log('\n========================================');
  console.log('🔍 开始诊断账号隔离问题');
  console.log('========================================\n');

  try {
    // 1. 检查用户列表
    console.log('1️⃣ 检查用户列表:');
    const usersResult = await pool.query(
      'SELECT id, username, email FROM users ORDER BY id'
    );
    console.log(`   找到 ${usersResult.rows.length} 个用户:`);
    usersResult.rows.forEach(user => {
      console.log(`   - ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}`);
    });
    console.log('');

    // 2. 检查平台账号表结构
    console.log('2️⃣ 检查 platform_accounts 表结构:');
    const tableInfoResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'platform_accounts'
      ORDER BY ordinal_position
    `);
    console.log('   表字段:');
    tableInfoResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('');

    // 3. 检查所有平台账号及其所属用户
    console.log('3️⃣ 检查所有平台账号及其所属用户:');
    const accountsResult = await pool.query(`
      SELECT 
        pa.id,
        pa.platform_id,
        pa.account_name,
        pa.real_username,
        pa.user_id,
        u.username as owner_username,
        pa.created_at
      FROM platform_accounts pa
      LEFT JOIN users u ON pa.user_id = u.id
      ORDER BY pa.created_at DESC
    `);
    
    if (accountsResult.rows.length === 0) {
      console.log('   ⚠️  没有找到任何平台账号');
    } else {
      console.log(`   找到 ${accountsResult.rows.length} 个平台账号:`);
      accountsResult.rows.forEach(acc => {
        console.log(`   - ID: ${acc.id}`);
        console.log(`     平台: ${acc.platform_id}`);
        console.log(`     账号名: ${acc.account_name}`);
        console.log(`     真实用户名: ${acc.real_username || '未设置'}`);
        console.log(`     所属用户ID: ${acc.user_id}`);
        console.log(`     所属用户名: ${acc.owner_username || '❌ 用户不存在'}`);
        console.log(`     创建时间: ${acc.created_at}`);
        console.log('');
      });
    }

    // 4. 检查是否存在重复账号（同一平台、同一真实用户名、不同用户ID）
    console.log('4️⃣ 检查是否存在跨用户的重复账号:');
    const duplicatesResult = await pool.query(`
      SELECT 
        platform_id,
        real_username,
        COUNT(*) as count,
        array_agg(DISTINCT user_id) as user_ids,
        array_agg(id) as account_ids
      FROM platform_accounts
      WHERE real_username IS NOT NULL AND real_username != ''
      GROUP BY platform_id, real_username
      HAVING COUNT(DISTINCT user_id) > 1
    `);
    
    if (duplicatesResult.rows.length === 0) {
      console.log('   ✅ 没有发现跨用户的重复账号');
    } else {
      console.log(`   ❌ 发现 ${duplicatesResult.rows.length} 个跨用户的重复账号:`);
      duplicatesResult.rows.forEach(dup => {
        console.log(`   - 平台: ${dup.platform_id}`);
        console.log(`     真实用户名: ${dup.real_username}`);
        console.log(`     出现次数: ${dup.count}`);
        console.log(`     涉及用户ID: ${dup.user_ids.join(', ')}`);
        console.log(`     账号ID: ${dup.account_ids.join(', ')}`);
        console.log('');
      });
    }

    // 5. 检查是否存在 user_id 为 NULL 的账号
    console.log('5️⃣ 检查是否存在 user_id 为 NULL 的账号:');
    const nullUserResult = await pool.query(`
      SELECT id, platform_id, account_name, real_username
      FROM platform_accounts
      WHERE user_id IS NULL
    `);
    
    if (nullUserResult.rows.length === 0) {
      console.log('   ✅ 没有发现 user_id 为 NULL 的账号');
    } else {
      console.log(`   ❌ 发现 ${nullUserResult.rows.length} 个 user_id 为 NULL 的账号:`);
      nullUserResult.rows.forEach(acc => {
        console.log(`   - ID: ${acc.id}, 平台: ${acc.platform_id}, 账号名: ${acc.account_name}`);
      });
    }
    console.log('');

    // 6. 模拟 API 请求：检查每个用户能看到的账号
    console.log('6️⃣ 模拟 API 请求：检查每个用户能看到的账号:');
    for (const user of usersResult.rows) {
      const userAccountsResult = await pool.query(
        'SELECT id, platform_id, account_name, real_username FROM platform_accounts WHERE user_id = $1',
        [user.id]
      );
      console.log(`   用户 ${user.username} (ID: ${user.id}) 能看到 ${userAccountsResult.rows.length} 个账号:`);
      if (userAccountsResult.rows.length > 0) {
        userAccountsResult.rows.forEach(acc => {
          console.log(`     - ID: ${acc.id}, 平台: ${acc.platform_id}, 账号名: ${acc.account_name}, 真实用户名: ${acc.real_username || '未设置'}`);
        });
      }
      console.log('');
    }

    console.log('========================================');
    console.log('✅ 诊断完成');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    await pool.end();
  }
}

diagnose();
