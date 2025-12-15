import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const migrationFile = path.join(__dirname, 'migrations', 'add_topic_usage_tracking.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('开始执行数据库迁移...');
  console.log('迁移文件:', migrationFile);

  try {
    // 分割SQL语句并逐个执行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\n执行SQL:', statement.substring(0, 100) + '...');
        await pool.query(statement);
        console.log('✓ 成功');
      }
    }

    console.log('\n✅ 数据库迁移完成！');
    console.log('\n新增功能：');
    console.log('1. topics表添加了usage_count字段');
    console.log('2. 创建了topic_usage表用于记录话题使用');
    console.log('3. articles表添加了topic_id字段');
    console.log('4. 创建了相关索引以提高查询性能');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

runMigration();
