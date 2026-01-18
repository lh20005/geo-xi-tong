#!/usr/bin/env node

/**
 * 创建本地测试用户脚本
 * 用于在本地开发环境创建测试账号
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// 数据库配置
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function createTestUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 开始创建测试用户...\n');
    
    // 1. 创建管理员账号
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    await client.query(`
      INSERT INTO users (username, password_hash, email, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          updated_at = NOW()
    `, ['admin', adminPassword, 'admin@example.com', 'admin']);
    
    console.log('✅ 管理员账号创建/更新成功');
    console.log('   用户名: admin');
    console.log('   密码:   admin123');
    console.log('   角色:   admin\n');
    
    // 2. 创建普通用户账号
    const userPassword = await bcrypt.hash('test123', 10);
    
    await client.query(`
      INSERT INTO users (username, password_hash, email, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          updated_at = NOW()
    `, ['testuser', userPassword, 'testuser@example.com', 'user']);
    
    console.log('✅ 普通用户账号创建/更新成功');
    console.log('   用户名: testuser');
    console.log('   密码:   test123');
    console.log('   角色:   user\n');
    
    // 3. 查询创建的用户
    const result = await client.query(`
      SELECT id, username, email, role, created_at
      FROM users
      WHERE username IN ('admin', 'testuser')
      ORDER BY id
    `);
    
    console.log('📋 创建的用户列表:');
    result.rows.forEach(user => {
      console.log(`   ID: ${user.id}, 用户名: ${user.username}, 角色: ${user.role}`);
    });
    
    console.log('\n✅ 测试用户创建完成！');
    console.log('\n现在可以使用以下账号登录:');
    console.log('  管理员: admin / admin123');
    console.log('  普通用户: testuser / test123');
    
  } catch (error) {
    console.error('❌ 创建用户失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行创建
createTestUsers().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
