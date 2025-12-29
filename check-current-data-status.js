#!/usr/bin/env node

/**
 * 检查当前数据状态 - 诊断多租户隔离问题
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDataStatus() {
  console.log('🔍 检查当前数据状态...\n');
  console.log('=' .repeat(60));

  try {
    // 1. 检查用户数量
    console.log('\n📊 1. 用户统计');
    console.log('-'.repeat(60));
    const usersResult = await pool.query(`
      SELECT COUNT(*) as total, 
             MIN(created_at) as first_user,
             MAX(created_at) as last_user
      FROM users
    `);
    const userStats = usersResult.rows[0];
    console.log(`总用户数: ${userStats.total}`);
    console.log(`第一个用户创建时间: ${userStats.first_user}`);
    console.log(`最后一个用户创建时间: ${userStats.last_user}`);

    // 显示前5个用户
    const userListResult = await pool.query(`
      SELECT id, username, role, created_at 
      FROM users 
      ORDER BY id 
      LIMIT 5
    `);
    console.log('\n前5个用户:');
    userListResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, 用户名: ${user.username}, 角色: ${user.role}, 创建时间: ${user.created_at}`);
    });

    // 2. 检查各表的 user_id 分布
    console.log('\n\n📊 2. 数据表 user_id 分布');
    console.log('-'.repeat(60));

    const tables = [
      'articles',
      'distillations',
      'conversion_targets',
      'article_settings',
      'generation_tasks',
      'platform_accounts',
      'albums',
      'knowledge_bases'
    ];

    for (const table of tables) {
      try {
        // 检查表是否有 user_id 字段
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'user_id'
        `, [table]);

        if (columnCheck.rows.length === 0) {
          console.log(`\n❌ ${table}: 没有 user_id 字段`);
          continue;
        }

        // 统计数据
        const statsResult = await pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT user_id) as unique_users,
            user_id,
            COUNT(*) as count
          FROM ${table}
          GROUP BY user_id
          ORDER BY count DESC
        `);

        const totalResult = await pool.query(`SELECT COUNT(*) as total FROM ${table}`);
        const total = totalResult.rows[0].total;

        console.log(`\n✅ ${table}:`);
        console.log(`   总记录数: ${total}`);
        
        if (statsResult.rows.length > 0) {
          console.log(`   不同用户数: ${statsResult.rows.length}`);
          console.log(`   user_id 分布:`);
          statsResult.rows.forEach(row => {
            const percentage = ((row.count / total) * 100).toFixed(1);
            console.log(`     - user_id=${row.user_id}: ${row.count} 条记录 (${percentage}%)`);
          });
        } else {
          console.log(`   ⚠️  没有数据`);
        }
      } catch (error) {
        console.log(`\n❌ ${table}: 查询失败 - ${error.message}`);
      }
    }

    // 3. 检查是否所有数据都属于同一个用户
    console.log('\n\n📊 3. 数据共享情况分析');
    console.log('-'.repeat(60));

    let allDataBelongsToUser1 = true;
    let hasSharedData = false;

    for (const table of tables) {
      try {
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'user_id'
        `, [table]);

        if (columnCheck.rows.length === 0) continue;

        const userCountResult = await pool.query(`
          SELECT COUNT(DISTINCT user_id) as unique_users
          FROM ${table}
        `);

        const uniqueUsers = parseInt(userCountResult.rows[0].unique_users);
        
        if (uniqueUsers > 1) {
          allDataBelongsToUser1 = false;
          hasSharedData = false;
        } else if (uniqueUsers === 1) {
          const userIdResult = await pool.query(`
            SELECT DISTINCT user_id FROM ${table} LIMIT 1
          `);
          if (userIdResult.rows.length > 0 && userIdResult.rows[0].user_id !== 1) {
            allDataBelongsToUser1 = false;
          }
        }
      } catch (error) {
        // 忽略错误
      }
    }

    if (allDataBelongsToUser1) {
      console.log('⚠️  所有现有数据都属于 user_id=1 (默认用户)');
      console.log('   这是因为迁移脚本将所有旧数据都分配给了第一个用户');
      hasSharedData = true;
    } else {
      console.log('✅ 数据已经分散到多个用户');
    }

    // 4. 给出建议
    console.log('\n\n💡 4. 诊断结果和建议');
    console.log('-'.repeat(60));

    if (hasSharedData) {
      console.log('\n🔴 问题确认:');
      console.log('   - 所有旧数据都被分配给了 user_id=1');
      console.log('   - 这是迁移脚本的默认行为（见 add-multi-tenancy.sql）');
      console.log('   - 如果你用老用户登录，会看到所有这些数据');
      console.log('   - 如果你创建新用户，新用户不会看到这些旧数据');
      
      console.log('\n✅ 解决方案:');
      console.log('   1. 【推荐】创建新用户进行测试');
      console.log('      - 新用户只会看到自己创建的数据');
      console.log('      - 这样可以验证多租户隔离是否正常工作');
      
      console.log('\n   2. 【可选】清理旧数据');
      console.log('      - 如果旧数据不重要，可以删除');
      console.log('      - 或者将旧数据重新分配给不同的用户');
      
      console.log('\n   3. 【必须】修复路由文件');
      console.log('      - 即使数据有 user_id，路由也必须使用它进行过滤');
      console.log('      - 否则用户仍然可以看到其他用户的数据');
      console.log('      - 查看 fix-tenant-isolation.md 了解详情');
    } else {
      console.log('\n✅ 数据分布正常');
      console.log('   - 数据已经分散到多个用户');
      console.log('   - 但仍需确保路由文件正确使用 user_id 过滤');
    }

    console.log('\n\n🧪 5. 测试建议');
    console.log('-'.repeat(60));
    console.log('运行以下命令测试多租户隔离:');
    console.log('  chmod +x test-tenant-isolation.sh');
    console.log('  ./test-tenant-isolation.sh');

  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkDataStatus();
