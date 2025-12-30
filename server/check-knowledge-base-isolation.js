const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_system',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || ''
});

async function checkKnowledgeBaseIsolation() {
  try {
    console.log('\n=== 检查知识库多租户隔离 ===\n');
    
    // 1. 检查知识库表结构
    console.log('📊 knowledge_bases 表结构:');
    const kbStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'knowledge_bases'
      ORDER BY ordinal_position
    `);
    kbStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    
    // 2. 检查知识库文档表结构
    console.log('\n📊 knowledge_documents 表结构:');
    const kdStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'knowledge_documents'
      ORDER BY ordinal_position
    `);
    kdStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    
    // 3. 检查知识库数据
    console.log('\n📋 知识库列表:');
    const kbResult = await pool.query(`
      SELECT 
        kb.id,
        kb.name,
        kb.user_id,
        u.username,
        COUNT(kd.id) as doc_count,
        kb.created_at
      FROM knowledge_bases kb
      LEFT JOIN users u ON kb.user_id = u.id
      LEFT JOIN knowledge_documents kd ON kb.id = kd.knowledge_base_id
      GROUP BY kb.id, kb.name, kb.user_id, u.username, kb.created_at
      ORDER BY kb.name, kb.user_id
    `);
    
    if (kbResult.rows.length === 0) {
      console.log('  (无数据)');
    } else {
      kbResult.rows.forEach(kb => {
        console.log(`\n  ID: ${kb.id}`);
        console.log(`  名称: ${kb.name}`);
        console.log(`  用户ID: ${kb.user_id}`);
        console.log(`  用户名: ${kb.username || '(未关联)'}`);
        console.log(`  文档数: ${kb.doc_count}`);
        console.log(`  创建时间: ${kb.created_at}`);
      });
    }
    
    // 4. 检查是否有重复的知识库名称
    console.log('\n\n⚠️  重复的知识库名称:');
    const duplicatesResult = await pool.query(`
      SELECT 
        name,
        COUNT(*) as count,
        STRING_AGG(user_id::text, ', ') as user_ids,
        STRING_AGG(u.username, ', ') as usernames
      FROM knowledge_bases kb
      LEFT JOIN users u ON kb.user_id = u.id
      GROUP BY name
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatesResult.rows.length === 0) {
      console.log('  (无重复)');
    } else {
      duplicatesResult.rows.forEach(dup => {
        console.log(`\n  名称: ${dup.name}`);
        console.log(`  出现次数: ${dup.count}`);
        console.log(`  用户ID列表: ${dup.user_ids}`);
        console.log(`  用户名列表: ${dup.usernames}`);
      });
    }
    
    // 5. 检查知识库文档
    console.log('\n\n📄 知识库文档列表:');
    const docsResult = await pool.query(`
      SELECT 
        kd.id,
        kd.filename,
        kd.knowledge_base_id,
        kb.name as kb_name,
        kb.user_id,
        u.username,
        kd.file_size,
        kd.created_at
      FROM knowledge_documents kd
      JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
      LEFT JOIN users u ON kb.user_id = u.id
      ORDER BY kb.name, kb.user_id, kd.created_at
    `);
    
    if (docsResult.rows.length === 0) {
      console.log('  (无文档)');
    } else {
      docsResult.rows.forEach(doc => {
        console.log(`\n  文档ID: ${doc.id}`);
        console.log(`  文件名: ${doc.filename}`);
        console.log(`  知识库: ${doc.kb_name} (ID: ${doc.knowledge_base_id})`);
        console.log(`  所属用户: ${doc.username} (ID: ${doc.user_id})`);
        console.log(`  文件大小: ${doc.file_size} bytes`);
        console.log(`  创建时间: ${doc.created_at}`);
      });
    }
    
    // 6. 检查约束
    console.log('\n\n🔒 表约束:');
    const constraintsResult = await pool.query(`
      SELECT 
        conrelid::regclass as table_name,
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid::regclass::text IN ('knowledge_bases', 'knowledge_documents')
        AND contype IN ('u', 'p', 'f')
      ORDER BY conrelid::regclass::text, conname
    `);
    
    constraintsResult.rows.forEach(constraint => {
      console.log(`\n  表: ${constraint.table_name}`);
      console.log(`  约束: ${constraint.constraint_name}`);
      console.log(`  定义: ${constraint.constraint_definition}`);
    });
    
    // 7. 检查特定知识库
    const targetName = '装修';
    console.log(`\n\n🔍 查询知识库 "${targetName}":`);
    const specificResult = await pool.query(`
      SELECT 
        kb.id,
        kb.name,
        kb.user_id,
        u.username,
        COUNT(kd.id) as doc_count
      FROM knowledge_bases kb
      LEFT JOIN users u ON kb.user_id = u.id
      LEFT JOIN knowledge_documents kd ON kb.id = kd.knowledge_base_id
      WHERE kb.name = $1
      GROUP BY kb.id, kb.name, kb.user_id, u.username
      ORDER BY kb.user_id
    `, [targetName]);
    
    if (specificResult.rows.length === 0) {
      console.log('  (未找到)');
    } else {
      specificResult.rows.forEach(kb => {
        console.log(`\n  ID: ${kb.id}`);
        console.log(`  用户ID: ${kb.user_id}`);
        console.log(`  用户名: ${kb.username || '(未关联)'}`);
        console.log(`  文档数: ${kb.doc_count}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkKnowledgeBaseIsolation();
