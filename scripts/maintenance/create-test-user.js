/**
 * 创建测试用户脚本
 * 用于添加普通用户账号进行权限测试
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// 数据库配置
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function createTestUser() {
  try {
    console.log('🔐 开始创建测试用户...\n');

    // 测试用户信息
    const testUser = {
      username: 'testuser',
      password: 'test123',
      email: 'test@example.com',
      role: 'user'
    };

    // 加密密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(testUser.password, saltRounds);

    // 插入用户
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (username) 
       DO UPDATE SET 
         password_hash = EXCLUDED.password_hash,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, username, email, role, created_at`,
      [testUser.username, passwordHash, testUser.email, testUser.role]
    );

    const user = result.rows[0];

    console.log('✅ 测试用户创建成功！\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 用户信息：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   用户名：${user.username}`);
    console.log(`   密码：  ${testUser.password}`);
    console.log(`   邮箱：  ${user.email}`);
    console.log(`   角色：  ${user.role} (普通用户)`);
    console.log(`   ID：    ${user.id}`);
    console.log(`   创建时间：${user.created_at}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 验证管理员账号是否存在
    const adminCheck = await pool.query(
      `SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1`
    );

    if (adminCheck.rows.length > 0) {
      const admin = adminCheck.rows[0];
      console.log('✅ 管理员账号已存在：');
      console.log(`   用户名：${admin.username}`);
      console.log(`   密码：  admin123 (默认)`);
      console.log(`   角色：  ${admin.role}\n`);
    } else {
      console.log('⚠️  警告：未找到管理员账号，请先创建管理员账号\n');
    }

    console.log('📝 测试说明：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. 使用管理员账号登录：');
    console.log('   - 用户名：admin');
    console.log('   - 密码：admin123');
    console.log('   - 可以看到"系统配置"和"设置"模块\n');
    console.log('2. 使用普通用户账号登录：');
    console.log(`   - 用户名：${testUser.username}`);
    console.log(`   - 密码：${testUser.password}`);
    console.log('   - 看不到"系统配置"和"设置"模块');
    console.log('   - 尝试访问会被重定向\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 创建用户失败：', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 提示：无法连接到数据库，请检查：');
      console.error('   1. PostgreSQL 是否正在运行');
      console.error('   2. 数据库配置是否正确');
      console.error('   3. 环境变量是否设置正确\n');
    }
  } finally {
    await pool.end();
  }
}

// 运行脚本
createTestUser();
