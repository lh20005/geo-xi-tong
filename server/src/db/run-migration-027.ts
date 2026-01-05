import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function runMigration() {
  console.log('开始执行迁移 027: 用户订阅管理功能...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '027_add_subscription_management.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // 分割 SQL 语句 - 按照函数定义分割
    const statements = migrationSQL
      .split(/;\s*(?=CREATE|ALTER|COMMENT|INSERT|DROP)/gi)
      .filter(stmt => stmt.trim().length > 0);

    // 执行每个语句
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        await client.query(trimmed + (trimmed.endsWith(';') ? '' : ';'));
      }
    }

    await client.query('COMMIT');

    console.log('✅ 迁移 027 执行成功');
    console.log('   - subscription_adjustments 表已创建');
    console.log('   - user_subscriptions 表已扩展');
    console.log('   - get_user_subscription_detail 函数已创建');
    console.log('   - v_subscription_adjustment_history 视图已创建');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移 027 执行失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
