/**
 * 更新管理员账号脚本
 * 将 admin 账号更新为 lzc2005
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateAdminAccount() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 开始更新管理员账号...\n');
    
    // 1. 检查旧的 admin 账号
    const oldAdminResult = await client.query(
      'SELECT id, username, role FROM users WHERE username = $1',
      ['admin']
    );
    
    if (oldAdminResult.rows.length > 0) {
      console.log('✅ 找到 admin 账号:', oldAdminResult.rows[0]);
      
      // 更新用户名和密码
      const hashedPassword = await bcrypt.hash('Woaini7758521@', 10);
      await client.query(
        'UPDATE users SET username = $1, password_hash = $2 WHERE username = $3',
        ['lzc2005', hashedPassword, 'admin']
      );
      
      console.log('✅ 已将 admin 账号更新为 lzc2005\n');
    } else {
      console.log('ℹ️  未找到 admin 账号\n');
      
      // 检查 lzc2005 是否已存在
      const newAdminResult = await client.query(
        'SELECT id, username, role FROM users WHERE username = $1',
        ['lzc2005']
      );
      
      if (newAdminResult.rows.length > 0) {
        console.log('⚠️  lzc2005 账号已存在，更新密码...');
        
        // 更新密码和角色
        const hashedPassword = await bcrypt.hash('Woaini7758521@', 10);
        await client.query(
          'UPDATE users SET password_hash = $1, role = $2 WHERE username = $3',
          [hashedPassword, 'admin', 'lzc2005']
        );
        
        console.log('✅ 已更新 lzc2005 账号密码和角色\n');
      } else {
        console.log('📝 创建新的管理员账号 lzc2005...');
        
        // 创建新账号
        const hashedPassword = await bcrypt.hash('Woaini7758521@', 10);
        const invitationCode = 'LZC' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const result = await client.query(
          `INSERT INTO users (username, password_hash, role, invitation_code, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING id, username, role, invitation_code`,
          ['lzc2005', hashedPassword, 'admin', invitationCode]
        );
        
        console.log('✅ 新管理员账号创建成功:');
        console.log(result.rows[0]);
        console.log('');
      }
    }
    
    // 2. 验证最终结果
    const finalResult = await client.query(
      'SELECT id, username, role, invitation_code, created_at FROM users WHERE role = $1',
      ['admin']
    );
    
    console.log('📊 当前所有管理员账号:');
    console.table(finalResult.rows);
    
    console.log('\n✅ 管理员账号更新完成！');
    console.log('\n登录信息:');
    console.log('  用户名: lzc2005');
    console.log('  密码: Woaini7758521@');
    console.log('  角色: admin');
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行更新
updateAdminAccount().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
