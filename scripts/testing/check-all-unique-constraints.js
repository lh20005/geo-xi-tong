const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_system',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || ''
});

async function checkAllUniqueConstraints() {
  try {
    console.log('\n=== 检查所有表的唯一约束 ===\n');
    
    // 1. 获取所有有 user_id 字段的表
    const tablesResult = await pool.query(`
      SELECT DISTINCT
        t.table_name,
        EXISTS(
          SELECT 1 
          FROM information_schema.columns c2 
          WHERE c2.table_name = t.table_name 
            AND c2.column_name = 'user_id'
        ) as has_user_id
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'pg_%'
      ORDER BY t.table_name
    `);
    
    console.log('📋 数据库表列表:');
    const tablesWithUserId = [];
    tablesResult.rows.forEach(table => {
      const marker = table.has_user_id ? '✓' : ' ';
      console.log(`  [${marker}] ${table.table_name}${table.has_user_id ? ' (有 user_id)' : ''}`);
      if (table.has_user_id) {
        tablesWithUserId.push(table.table_name);
      }
    });
    
    console.log(`\n找到 ${tablesWithUserId.length} 个包含 user_id 的表\n`);
    
    // 2. 检查每个有 user_id 的表的唯一约束
    console.log('=== 检查唯一约束 ===\n');
    
    const problemTables = [];
    
    for (const tableName of tablesWithUserId) {
      const constraintsResult = await pool.query(`
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'u'
        ORDER BY conname
      `, [tableName]);
      
      if (constraintsResult.rows.length > 0) {
        console.log(`\n📊 表: ${tableName}`);
        
        let hasGlobalUnique = false;
        let hasUserLevelUnique = false;
        const globalConstraints = [];
        const userLevelConstraints = [];
        
        constraintsResult.rows.forEach(constraint => {
          const def = constraint.constraint_definition;
          const includesUserId = def.includes('user_id');
          
          if (includesUserId) {
            hasUserLevelUnique = true;
            userLevelConstraints.push(constraint);
            console.log(`  ✓ ${constraint.constraint_name}: ${def}`);
          } else {
            hasGlobalUnique = true;
            globalConstraints.push(constraint);
            console.log(`  ⚠️  ${constraint.constraint_name}: ${def}`);
          }
        });
        
        // 检查是否有问题
        if (hasGlobalUnique && hasUserLevelUnique) {
          console.log(`  ❌ 问题: 同时存在全局唯一约束和用户级唯一约束！`);
          problemTables.push({
            table: tableName,
            globalConstraints,
            userLevelConstraints
          });
        } else if (hasGlobalUnique && !hasUserLevelUnique) {
          console.log(`  ⚠️  警告: 只有全局唯一约束，可能需要改为用户级约束`);
          problemTables.push({
            table: tableName,
            globalConstraints,
            userLevelConstraints: [],
            warning: 'missing_user_level'
          });
        }
      }
    }
    
    // 3. 总结问题
    console.log('\n\n=== 问题总结 ===\n');
    
    if (problemTables.length === 0) {
      console.log('✅ 未发现唯一约束冲突问题');
    } else {
      console.log(`❌ 发现 ${problemTables.length} 个表存在问题:\n`);
      
      problemTables.forEach(problem => {
        console.log(`\n表: ${problem.table}`);
        
        if (problem.warning === 'missing_user_level') {
          console.log('  问题类型: 缺少用户级唯一约束');
          console.log('  全局约束:');
          problem.globalConstraints.forEach(c => {
            console.log(`    - ${c.constraint_name}: ${c.constraint_definition}`);
          });
          console.log('  建议: 评估是否需要改为用户级唯一约束');
        } else {
          console.log('  问题类型: 全局约束与用户级约束冲突');
          console.log('  全局约束 (需要删除):');
          problem.globalConstraints.forEach(c => {
            console.log(`    - ${c.constraint_name}: ${c.constraint_definition}`);
          });
          console.log('  用户级约束 (保留):');
          problem.userLevelConstraints.forEach(c => {
            console.log(`    - ${c.constraint_name}: ${c.constraint_definition}`);
          });
        }
      });
    }
    
    // 4. 生成修复脚本
    if (problemTables.length > 0) {
      console.log('\n\n=== 生成修复脚本 ===\n');
      
      let fixScript = '-- 修复所有表的唯一约束冲突\n';
      fixScript += '-- 生成时间: ' + new Date().toISOString() + '\n\n';
      
      problemTables.forEach(problem => {
        if (problem.warning !== 'missing_user_level') {
          fixScript += `-- 修复表: ${problem.table}\n`;
          problem.globalConstraints.forEach(c => {
            fixScript += `ALTER TABLE ${problem.table} DROP CONSTRAINT IF EXISTS ${c.constraint_name};\n`;
          });
          fixScript += '\n';
        }
      });
      
      const fs = require('fs');
      fs.writeFileSync('fix-all-unique-constraints.sql', fixScript);
      console.log('✅ 修复脚本已生成: fix-all-unique-constraints.sql');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkAllUniqueConstraints();
