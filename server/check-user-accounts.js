const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://lzc@localhost:5432/geo_system'
});

async function checkUserAccounts() {
  try {
    console.log('\n========== 检查用户信息 ==========');
    
    // 1. 查询用户信息
    const usersResult = await pool.query(
      `SELECT id, username, email, created_at 
       FROM users 
       WHERE username IN ('lzc2005', 'testuser')
       ORDER BY id`
    );
    
    console.log('\n用户列表:');
    usersResult.rows.forEach(user => {
      console.log(`  ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}`);
    });
    
    // 2. 查询每个用户的平台账号
    for (const user of usersResult.rows) {
      console.log(`\n========== ${user.username} (ID: ${user.id}) 的平台账号 ==========`);
      
      const accountsResult = await pool.query(
        `SELECT id, platform_id, account_name, real_username, user_id, created_at, updated_at
         FROM platform_accounts
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [user.id]
      );
      
      if (accountsResult.rows.length === 0) {
        console.log('  无平台账号');
      } else {
        accountsResult.rows.forEach(account => {
          console.log(`  账号ID: ${account.id}`);
          console.log(`    平台: ${account.platform_id}`);
          console.log(`    账号名: ${account.account_name}`);
          console.log(`    真实用户名: ${account.real_username || '未设置'}`);
          console.log(`    所属用户ID: ${account.user_id}`);
          console.log(`    创建时间: ${account.created_at}`);
          console.log(`    更新时间: ${account.updated_at}`);
          console.log('');
        });
      }
    }
    
    // 3. 检查是否有账号的 user_id 不匹配
    console.log('\n========== 检查数据一致性 ==========');
    const mismatchResult = await pool.query(
      `SELECT pa.id, pa.platform_id, pa.account_name, pa.user_id, u.username
       FROM platform_accounts pa
       LEFT JOIN users u ON pa.user_id = u.id
       WHERE u.username IN ('lzc2005', 'testuser')
       ORDER BY pa.user_id, pa.created_at DESC`
    );
    
    console.log('\n所有相关账号的归属:');
    mismatchResult.rows.forEach(row => {
      console.log(`  账号ID: ${row.id}, 平台: ${row.platform_id}, 账号名: ${row.account_name}`);
      console.log(`    归属用户: ${row.username} (ID: ${row.user_id})`);
    });
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await pool.end();
  }
}

checkUserAccounts();
