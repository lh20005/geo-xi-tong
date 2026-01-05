/**
 * 运行迁移 032: 修复 check_user_quota 函数以支持 custom_quotas
 */

import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('========================================');
  console.log('运行迁移 032: 修复 check_user_quota 函数');
  console.log('========================================\n');

  try {
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '032_fix_check_user_quota_to_use_custom_quotas.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('执行迁移...\n');
    
    // 执行迁移
    await pool.query(migrationSQL);

    console.log('\n✅ 迁移 032 执行成功！\n');
    
    // 验证修复
    console.log('验证修复...\n');
    
    const testResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        us.custom_quotas->>'articles_per_month' as custom_articles,
        (SELECT quota_limit FROM check_user_quota(u.id, 'articles_per_month')) as check_articles
      FROM users u
      JOIN user_subscriptions us ON u.id = us.user_id
      WHERE us.custom_quotas IS NOT NULL
        AND us.custom_quotas ? 'articles_per_month'
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      LIMIT 3
    `);

    if (testResult.rows.length > 0) {
      console.log('配额一致性检查:');
      testResult.rows.forEach(row => {
        const match = row.custom_articles === row.check_articles;
        const icon = match ? '✅' : '❌';
        console.log(`  ${icon} ${row.username}: custom_quotas=${row.custom_articles}, check_user_quota=${row.check_articles}`);
      });
    }

    console.log('\n========================================');
    console.log('迁移完成');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
