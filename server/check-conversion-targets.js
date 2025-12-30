const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_system',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || ''
});

async function checkConversionTargets() {
  try {
    console.log('\n=== 检查转化目标数据 ===\n');
    
    // 1. 查询所有用户
    const usersResult = await pool.query(`
      SELECT id, username, email 
      FROM users 
      ORDER BY id
    `);
    
    console.log('📋 系统用户列表:');
    usersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}`);
    });
    
    // 2. 查询所有转化目标
    const targetsResult = await pool.query(`
      SELECT 
        ct.id,
        ct.company_name,
        ct.industry,
        ct.website,
        ct.address,
        ct.user_id,
        u.username,
        ct.created_at
      FROM conversion_targets ct
      LEFT JOIN users u ON ct.user_id = u.id
      ORDER BY ct.company_name, ct.user_id
    `);
    
    console.log('\n📊 转化目标列表:');
    if (targetsResult.rows.length === 0) {
      console.log('  (无数据)');
    } else {
      targetsResult.rows.forEach(target => {
        console.log(`\n  ID: ${target.id}`);
        console.log(`  公司名称: ${target.company_name}`);
        console.log(`  行业: ${target.industry || '(空)'}`);
        console.log(`  网站: ${target.website || '(空)'}`);
        console.log(`  地址: ${target.address || '(空)'}`);
        console.log(`  所属用户ID: ${target.user_id}`);
        console.log(`  所属用户名: ${target.username || '(未关联)'}`);
        console.log(`  创建时间: ${target.created_at}`);
      });
    }
    
    // 3. 检查是否有重复的公司名称
    const duplicatesResult = await pool.query(`
      SELECT 
        company_name,
        COUNT(*) as count,
        STRING_AGG(user_id::text, ', ') as user_ids,
        STRING_AGG(u.username, ', ') as usernames
      FROM conversion_targets ct
      LEFT JOIN users u ON ct.user_id = u.id
      GROUP BY company_name
      HAVING COUNT(*) > 1
    `);
    
    console.log('\n⚠️  重复的公司名称:');
    if (duplicatesResult.rows.length === 0) {
      console.log('  (无重复)');
    } else {
      duplicatesResult.rows.forEach(dup => {
        console.log(`\n  公司名称: ${dup.company_name}`);
        console.log(`  出现次数: ${dup.count}`);
        console.log(`  用户ID列表: ${dup.user_ids}`);
        console.log(`  用户名列表: ${dup.usernames}`);
      });
    }
    
    // 4. 检查特定公司名称
    const targetName = '西华县零醛世家装饰';
    const specificResult = await pool.query(`
      SELECT 
        ct.id,
        ct.company_name,
        ct.user_id,
        u.username,
        ct.created_at
      FROM conversion_targets ct
      LEFT JOIN users u ON ct.user_id = u.id
      WHERE ct.company_name = $1
      ORDER BY ct.created_at
    `, [targetName]);
    
    console.log(`\n🔍 查询特定公司名称 "${targetName}":`);
    if (specificResult.rows.length === 0) {
      console.log('  (未找到)');
    } else {
      specificResult.rows.forEach(target => {
        console.log(`\n  ID: ${target.id}`);
        console.log(`  用户ID: ${target.user_id}`);
        console.log(`  用户名: ${target.username || '(未关联)'}`);
        console.log(`  创建时间: ${target.created_at}`);
      });
    }
    
    // 5. 检查唯一约束
    const constraintsResult = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'conversion_targets'::regclass
        AND contype IN ('u', 'p')
      ORDER BY conname
    `);
    
    console.log('\n🔒 表约束:');
    constraintsResult.rows.forEach(constraint => {
      console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_definition}`);
    });
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkConversionTargets();
