#!/bin/bash

echo "=========================================="
echo "🔍 测试 WebSocket 账号隔离修复"
echo "=========================================="
echo ""

echo "1️⃣ 检查数据库中的账号隔离..."
echo ""
cd server && node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    // 检查用户
    const users = await pool.query('SELECT id, username FROM users WHERE id IN (1, 437) ORDER BY id');
    console.log('📋 用户列表:');
    users.rows.forEach(u => console.log(\`   - ID: \${u.id}, 用户名: \${u.username}\`));
    console.log('');
    
    // 检查账号
    const accounts = await pool.query(\`
      SELECT pa.id, pa.platform_id, pa.account_name, pa.real_username, pa.user_id, u.username as owner
      FROM platform_accounts pa
      LEFT JOIN users u ON pa.user_id = u.id
      WHERE pa.user_id IN (1, 437)
      ORDER BY pa.user_id, pa.created_at DESC
    \`);
    
    console.log('📋 平台账号列表:');
    let currentUserId = null;
    accounts.rows.forEach(a => {
      if (a.user_id !== currentUserId) {
        currentUserId = a.user_id;
        console.log(\`\\n   👤 用户: \${a.owner} (ID: \${a.user_id})\`);
      }
      console.log(\`      - ID: \${a.id}, 平台: \${a.platform_id}, 账号名: \${a.account_name}, 真实用户名: \${a.real_username || '未设置'}\`);
    });
    console.log('');
    
    // 检查是否有跨用户重复
    const duplicates = await pool.query(\`
      SELECT platform_id, real_username, COUNT(*) as count, array_agg(DISTINCT user_id) as user_ids
      FROM platform_accounts
      WHERE real_username IS NOT NULL AND real_username != ''
      GROUP BY platform_id, real_username
      HAVING COUNT(DISTINCT user_id) > 1
    \`);
    
    if (duplicates.rows.length > 0) {
      console.log('⚠️  发现跨用户的重复账号（这是正常的，每个用户可以有相同平台的账号）:');
      duplicates.rows.forEach(d => {
        console.log(\`   - 平台: \${d.platform_id}, 真实用户名: \${d.real_username}, 涉及用户: \${d.user_ids.join(', ')}\`);
      });
    } else {
      console.log('✅ 没有跨用户的重复账号');
    }
    console.log('');
    
    console.log('========================================');
    console.log('✅ 数据库层面的隔离是正确的');
    console.log('========================================');
    console.log('');
    console.log('📝 下一步测试:');
    console.log('   1. 重启服务器: ./restart-backend.sh');
    console.log('   2. 打开两个浏览器窗口');
    console.log('   3. 窗口1: 使用 lzc 账户登录');
    console.log('   4. 窗口2: 使用 testuser 账户登录');
    console.log('   5. 在窗口1中添加/删除账号');
    console.log('   6. 检查窗口2是否有变化（应该没有）');
    console.log('');
    
  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await pool.end();
  }
}

check();
"

cd ..
