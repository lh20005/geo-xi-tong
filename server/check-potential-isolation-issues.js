const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_system',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || ''
});

async function checkPotentialIsolationIssues() {
  try {
    console.log('\n=== 检查潜在的多租户隔离问题 ===\n');
    
    // 需要检查的表和字段
    const checksToPerform = [
      {
        table: 'albums',
        nameField: 'name',
        description: '相册名称'
      },
      {
        table: 'article_settings',
        nameField: 'title',
        description: '文章设置标题'
      },
      {
        table: 'knowledge_bases',
        nameField: 'name',
        description: '知识库名称'
      },
      {
        table: 'distillation_config',
        nameField: 'name',
        description: '蒸馏配置名称'
      },
      {
        table: 'platform_accounts',
        nameField: 'platform_name',
        description: '平台账号'
      }
    ];
    
    const issues = [];
    
    for (const check of checksToPerform) {
      console.log(`\n📊 检查表: ${check.table} (${check.description})`);
      
      // 1. 检查是否有唯一约束
      const constraintsResult = await pool.query(`
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'u'
        ORDER BY conname
      `, [check.table]);
      
      console.log(`  唯一约束: ${constraintsResult.rows.length} 个`);
      constraintsResult.rows.forEach(c => {
        const includesUserId = c.constraint_definition.includes('user_id');
        const includesNameField = c.constraint_definition.includes(check.nameField);
        const marker = includesUserId ? '✓' : '⚠️';
        console.log(`    ${marker} ${c.constraint_name}: ${c.constraint_definition}`);
      });
      
      // 2. 检查是否有重复的名称（跨用户）
      const duplicatesResult = await pool.query(`
        SELECT 
          ${check.nameField},
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as user_count,
          STRING_AGG(DISTINCT user_id::text, ', ') as user_ids
        FROM ${check.table}
        WHERE ${check.nameField} IS NOT NULL
        GROUP BY ${check.nameField}
        HAVING COUNT(*) > 1 AND COUNT(DISTINCT user_id) > 1
        ORDER BY count DESC
        LIMIT 5
      `);
      
      if (duplicatesResult.rows.length > 0) {
        console.log(`  ⚠️  发现跨用户重复的${check.description}:`);
        duplicatesResult.rows.forEach(dup => {
          console.log(`    - "${dup[check.nameField]}" (${dup.count}次, ${dup.user_count}个用户: ${dup.user_ids})`);
        });
        
        issues.push({
          table: check.table,
          field: check.nameField,
          description: check.description,
          duplicates: duplicatesResult.rows
        });
      } else {
        console.log(`  ✓ 未发现跨用户重复`);
      }
      
      // 3. 检查总记录数和用户分布
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users,
          MIN(user_id) as min_user_id,
          MAX(user_id) as max_user_id
        FROM ${check.table}
      `);
      
      const stats = statsResult.rows[0];
      console.log(`  统计: ${stats.total_records} 条记录, ${stats.unique_users} 个用户 (ID: ${stats.min_user_id}-${stats.max_user_id})`);
    }
    
    // 总结
    console.log('\n\n=== 总结 ===\n');
    
    if (issues.length === 0) {
      console.log('✅ 未发现明显的多租户隔离问题');
    } else {
      console.log(`⚠️  发现 ${issues.length} 个表存在跨用户重复数据:\n`);
      
      issues.forEach(issue => {
        console.log(`\n表: ${issue.table}`);
        console.log(`字段: ${issue.field} (${issue.description})`);
        console.log(`重复项数量: ${issue.duplicates.length}`);
        console.log(`建议: 检查是否需要添加 UNIQUE (user_id, ${issue.field}) 约束`);
      });
    }
    
    // 特别检查：查找所有没有任何唯一约束的表
    console.log('\n\n=== 检查缺少唯一约束的表 ===\n');
    
    const tablesWithUserId = [
      'albums', 'api_configs', 'article_settings', 'articles',
      'auth_logs', 'conversion_targets', 'distillation_config',
      'distillations', 'generation_tasks', 'knowledge_bases',
      'orders', 'password_history', 'platform_accounts',
      'publishing_tasks', 'refresh_tokens', 'security_events',
      'user_permissions', 'user_sessions', 'user_subscriptions',
      'user_usage'
    ];
    
    for (const table of tablesWithUserId) {
      const constraintsResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'u'
      `, [table]);
      
      if (constraintsResult.rows[0].count === 0) {
        console.log(`  ⚠️  ${table} - 没有任何唯一约束`);
      }
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkPotentialIsolationIssues();
