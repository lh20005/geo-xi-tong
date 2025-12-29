const { pool } = require('./database');
const fs = require('fs');
const path = require('path');

/**
 * 多租户数据隔离迁移
 * 为核心业务表添加 user_id 字段
 */
async function migrateMultiTenancy() {
  const client = await pool.connect();
  
  try {
    console.log('开始多租户数据隔离迁移...');
    
    await client.query('BEGIN');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'migrations', 'add-multi-tenancy.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // 执行迁移
    await client.query(sql);
    
    await client.query('COMMIT');
    
    console.log('✅ 多租户数据隔离迁移完成！');
    console.log('');
    console.log('已添加 user_id 字段到以下表：');
    console.log('  - albums (相册)');
    console.log('  - knowledge_bases (知识库)');
    console.log('  - conversion_targets (转化目标)');
    console.log('  - article_settings (文章设置)');
    console.log('  - distillations (关键词蒸馏)');
    console.log('  - articles (文章)');
    console.log('  - generation_tasks (生成任务)');
    console.log('  - platform_accounts (平台账号)');
    console.log('  - distillation_config (蒸馏配置)');
    console.log('  - api_configs (API配置)');
    console.log('');
    console.log('⚠️  注意：现有数据已关联到用户ID=1');
    console.log('');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行迁移
migrateMultiTenancy()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
