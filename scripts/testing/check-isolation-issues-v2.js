const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_system',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || ''
});

async function checkIsolationIssues() {
  try {
    console.log('\n=== 检查多租户隔离问题 ===\n');
    
    // 需要检查的表和字段
    const checksToPerform = [
      {
        table: 'albums',
        nameField: 'name',
        description: '相册名称',
        shouldBeUnique: true
      },
      {
        table: 'article_settings',
        nameField: 'name',
        description: '文章设置名称',
        shouldBeUnique: true
      },
      {
        table: 'knowledge_bases',
        nameField: 'name',
        description: '知识库名称',
        shouldBeUnique: true
      },
      {
        table: 'distillation_config',
        nameField: 'prompt',
        description: '蒸馏配置',
        shouldBeUnique: false // prompt 可能很长，不适合做唯一约束
      },
      {
        table: 'platform_accounts',
        nameField: 'platform',
        secondField: 'platform_id',
        description: '平台账号',
        shouldBeUnique: true,
        compositeKey: true
      }
    ];
    
    const issues = [];
    const recommendations = [];
    
    for (const check of checksToPerform) {
      console.log(`\n📊 检查表: ${check.table} (${check.description})`);
      
      // 1. 检查唯一约束
      const constraintsResult = await pool.query(`
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'u'
        ORDER BY conname
      `, [check.table]);
      
      const hasUserLevelConstraint = constraintsResult.rows.some(c => 
        c.constraint_definition.includes('user_id') && 
        c.constraint_definition.includes(check.nameField)
      );
      
      console.log(`  唯一约束: ${constraintsResult.rows.length} 个`);
      if (constraintsResult.rows.length > 0) {
        constraintsResult.rows.forEach(c => {
          const includesUserId = c.constraint_definition.includes('user_id');
          const marker = includesUserId ? '✓' : '⚠️';
          console.log(`    ${marker} ${c.constraint_name}: ${c.constraint_definition}`);
        });
      } else {
        console.log(`    (无)`);
      }
      
      // 2. 检查跨用户重复
      let duplicatesResult;
      if (check.compositeKey) {
        duplicatesResult = await pool.query(`
          SELECT 
            ${check.nameField},
            ${check.secondField},
            COUNT(*) as count,
            COUNT(DISTINCT user_id) as user_count,
            STRING_AGG(DISTINCT user_id::text, ', ') as user_ids
          FROM ${check.table}
          WHERE ${check.nameField} IS NOT NULL 
            AND ${check.secondField} IS NOT NULL
          GROUP BY ${check.nameField}, ${check.secondField}
          HAVING COUNT(*) > 1 AND COUNT(DISTINCT user_id) > 1
          ORDER BY count DESC
          LIMIT 5
        `);
      } else {
        duplicatesResult = await pool.query(`
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
      }
      
      if (duplicatesResult.rows.length > 0) {
        console.log(`  ⚠️  发现跨用户重复:`);
        duplicatesResult.rows.forEach(dup => {
          if (check.compositeKey) {
            console.log(`    - ${check.nameField}="${dup[check.nameField]}", ${check.secondField}="${dup[check.secondField]}" (${dup.count}次, ${dup.user_count}个用户)`);
          } else {
            console.log(`    - "${dup[check.nameField]}" (${dup.count}次, ${dup.user_count}个用户: ${dup.user_ids})`);
          }
        });
        
        if (check.shouldBeUnique) {
          issues.push({
            table: check.table,
            field: check.nameField,
            secondField: check.secondField,
            description: check.description,
            duplicates: duplicatesResult.rows.length,
            compositeKey: check.compositeKey
          });
        }
      } else {
        console.log(`  ✓ 未发现跨用户重复`);
      }
      
      // 3. 建议
      if (check.shouldBeUnique && !hasUserLevelConstraint) {
        const constraintName = check.compositeKey 
          ? `unique_user_${check.nameField}_${check.secondField}`
          : `unique_user_${check.nameField}`;
        const constraintDef = check.compositeKey
          ? `UNIQUE (user_id, ${check.nameField}, ${check.secondField})`
          : `UNIQUE (user_id, ${check.nameField})`;
        
        recommendations.push({
          table: check.table,
          constraintName,
          constraintDef,
          description: check.description
        });
        console.log(`  💡 建议: 添加约束 ${constraintDef}`);
      }
      
      // 4. 统计
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users
        FROM ${check.table}
      `);
      
      const stats = statsResult.rows[0];
      console.log(`  统计: ${stats.total_records} 条记录, ${stats.unique_users} 个用户`);
    }
    
    // 总结
    console.log('\n\n=== 总结 ===\n');
    
    if (issues.length === 0) {
      console.log('✅ 未发现跨用户重复数据');
    } else {
      console.log(`⚠️  发现 ${issues.length} 个表存在跨用户重复:\n`);
      issues.forEach(issue => {
        console.log(`  - ${issue.table}: ${issue.duplicates} 个重复项`);
      });
    }
    
    if (recommendations.length > 0) {
      console.log(`\n💡 建议添加 ${recommendations.length} 个唯一约束:\n`);
      
      let sqlScript = '-- 添加用户级唯一约束\n';
      sqlScript += '-- 生成时间: ' + new Date().toISOString() + '\n\n';
      
      recommendations.forEach(rec => {
        console.log(`  ${rec.table}: ${rec.constraintDef}`);
        sqlScript += `-- ${rec.description}\n`;
        sqlScript += `ALTER TABLE ${rec.table}\n`;
        sqlScript += `ADD CONSTRAINT ${rec.constraintName} ${rec.constraintDef};\n\n`;
      });
      
      const fs = require('fs');
      fs.writeFileSync('add-user-level-constraints.sql', sqlScript);
      console.log('\n✅ SQL脚本已生成: add-user-level-constraints.sql');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkIsolationIssues();
