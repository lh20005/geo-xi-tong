/**
 * 修改 lzc2005 管理员密码
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function changePassword() {
  const client = await pool.connect();
  
  try {
    console.log('🔐 开始修改管理员密码...\n');
    
    const newPassword = 'Woshixiaogou2005';
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新数据库
    const result = await client.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username, role',
      [hashedPassword, 'lzc2005']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ 密码修改成功！');
      console.log('\n新的登录信息:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('用户名: lzc2005');
      console.log('密码: Woshixiaogou2005');
      console.log('角色:', result.rows[0].role);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('❌ 未找到用户 lzc2005');
    }
    
  } catch (error) {
    console.error('❌ 修改密码失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行修改
changePassword().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
