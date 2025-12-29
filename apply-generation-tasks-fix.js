#!/usr/bin/env node

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixGenerationTasks() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 开始修复 generation_tasks 表...\n');
    
    // 1. 检查 user_id 字段是否存在
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'generation_tasks' AND column_name = 'user_id'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ user_id 字段已存在');
      
      // 检查是否为 NOT NULL
      const checkNullable = await client.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'generation_tasks' AND column_name = 'user_id'
      `);
      
      if (checkNullable.rows[0].is_nullable === 'YES') {
        console.log('⚠️  user_id 字段允许为空，需要修复...');
        
        // 为现有数据设置默认值
        await client.query(`UPDATE generation_tasks SET user_id = 1 WHERE user_id IS NULL`);
        console.log('✅ 已为现有数据设置默认 user_id');
        
        // 设置为 NOT NULL
        await client.query(`ALTER TABLE generation_tasks ALTER COLUMN user_id SET NOT NULL`);
        console.log('✅ 已将 user_id 设置为必填字段');
      } else {
        console.log('✅ user_id 字段已经是必填字段');
      }
    } else {
      console.log('⚠️  user_id 字段不存在，开始添加...');
      
      // 添加字段
      await client.query(`
        ALTER TABLE generation_tasks 
        ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('✅ 已添加 user_id 字段');
      
      // 为现有数据设置默认值
      await client.query(`UPDATE generation_tasks SET user_id = 1 WHERE user_id IS NULL`);
      console.log('✅ 已为现有数据设置默认 user_id');
      
      // 设置为 NOT NULL
      await client.query(`ALTER TABLE generation_tasks ALTER COLUMN user_id SET NOT NULL`);
      console.log('✅ 已将 user_id 设置为必填字段');
    }
    
    // 2. 检查索引是否存在
    const checkIndex = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'generation_tasks' AND indexname = 'idx_generation_tasks_user_id'
    `);
    
    if (checkIndex.rows.length === 0) {
      await client.query(`CREATE INDEX idx_generation_tasks_user_id ON generation_tasks(user_id)`);
      console.log('✅ 已创建索引 idx_generation_tasks_user_id');
    } else {
      console.log('✅ 索引已存在');
    }
    
    // 3. 验证表结构
    console.log('\n📊 当前表结构:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'generation_tasks' 
      ORDER BY ordinal_position
    `);
    
    console.table(columns.rows);
    
    console.log('\n✅ 修复完成！');
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixGenerationTasks().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
