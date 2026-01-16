/**
 * 测试 PostgreSQL 数据库连接
 * 
 * 使用方法：
 * npx ts-node scripts/test-db-connection.ts
 */

import { Pool } from 'pg';

async function testConnection() {
  console.log('🔍 测试 PostgreSQL 数据库连接...\n');

  const config = {
    host: 'localhost',
    port: 5432,
    database: 'geo_windows',
    user: 'lzc',
    password: ''
  };

  console.log('📋 数据库配置:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Password: ${config.password ? '***' : '(空)'}\n`);

  const pool = new Pool(config);

  try {
    // 测试连接
    console.log('📡 连接数据库...');
    const client = await pool.connect();
    console.log('✅ 数据库连接成功\n');

    // 查询表数量
    console.log('📊 查询数据库信息...');
    const tablesResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log(`✅ 表数量: ${tablesResult.rows[0].count}\n`);

    // 查询各表的记录数
    console.log('📈 各表记录数:');
    const tables = [
      'articles',
      'albums',
      'images',
      'knowledge_bases',
      'platform_accounts',
      'publishing_tasks',
      'distillations',
      'topics',
      'conversion_targets',
      'article_settings'
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${result.rows[0].count}`);
      } catch (error: any) {
        console.log(`   ${table}: ❌ ${error.message}`);
      }
    }

    // 测试一个简单的查询
    console.log('\n🧪 测试查询（获取前 3 篇文章）:');
    const articlesResult = await client.query(`
      SELECT id, title, created_at 
      FROM articles 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    if (articlesResult.rows.length > 0) {
      articlesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. [${row.id}] ${row.title}`);
      });
    } else {
      console.log('   (暂无文章)');
    }

    client.release();
    console.log('\n✅ 所有测试通过！');

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
