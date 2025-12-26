/**
 * 修改管理员密码脚本
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 生成强密码
function generateStrongPassword() {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // 确保包含各种字符类型
  password += 'A'; // 大写字母
  password += 'a'; // 小写字母
  password += '1'; // 数字
  password += '@'; // 特殊字符
  
  // 填充剩余字符
  for (let i = password.length; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function changeAdminPassword() {
  const client = await pool.connect();
  
  try {
    console.log('🔐 开始修改管理员密码...\n');
    
    // 生成新密码
    const newPassword = generateStrongPassword();
    console.log('✅ 生成新密码:', newPassword);
    console.log('⚠️  请务必保存此密码！\n');
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新数据库
    const result = await client.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username',
      [hashedPassword, 'lzc2005']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ 密码修改成功！');
      console.log('\n新的登录信息:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('用户名: lzc2005');
      console.log('密码:', newPassword);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n⚠️  重要提示:');
      console.log('1. 请立即将新密码保存到安全的地方');
      console.log('2. 不要将密码保存到浏览器密码管理器');
      console.log('3. 定期更换密码以保证安全');
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
changeAdminPassword().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
