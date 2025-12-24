const { Pool } = require('pg');
require('dotenv').config();

// 从 DATABASE_URL 解析配置
const databaseUrl = process.env.DATABASE_URL || 'postgresql://lzc@localhost:5432/geo_system';
const url = new URL(databaseUrl);

const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password || undefined
});

async function checkUsers() {
  try {
    console.log('正在连接数据库...');
    console.log('数据库 URL:', process.env.DATABASE_URL);
    console.log('数据库配置:', {
      host: url.hostname,
      port: url.port,
      database: url.pathname.slice(1),
      user: url.username
    });
    
    const result = await pool.query('SELECT id, username, created_at, updated_at, last_login_at FROM users LIMIT 3');
    
    console.log('\n========================================');
    console.log('数据库中的用户数据：');
    console.log('========================================');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length > 0) {
      console.log('\n========================================');
      console.log('第一个用户详细信息：');
      console.log('========================================');
      console.log('ID:', result.rows[0].id);
      console.log('用户名:', result.rows[0].username);
      console.log('created_at 类型:', typeof result.rows[0].created_at);
      console.log('created_at 值:', result.rows[0].created_at);
      console.log('created_at 是否为 null:', result.rows[0].created_at === null);
      console.log('created_at 是否为 undefined:', result.rows[0].created_at === undefined);
      
      if (result.rows[0].created_at) {
        console.log('created_at 转为 ISO 字符串:', result.rows[0].created_at.toISOString());
      }
    } else {
      console.log('\n⚠️  警告：数据库中没有用户数据');
    }
    
    await pool.end();
    console.log('\n✅ 检查完成');
  } catch (error) {
    console.error('\n❌ 查询失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

checkUsers();
