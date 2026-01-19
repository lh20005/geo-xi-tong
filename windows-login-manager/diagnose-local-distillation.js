const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_windows',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || '',
});

async function diagnose() {
  try {
    console.log('=== Windows 端本地数据库诊断 ===\n');

    // 1. 检查蒸馏记录
    const distillations = await pool.query(`
      SELECT id, keyword, topic_count, created_at 
      FROM distillations 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log('📊 蒸馏记录:');
    console.log('ID | 关键词 | topic_count | 创建时间');
    console.log('---|--------|-------------|----------');
    distillations.rows.forEach(row => {
      console.log(`${row.id} | ${row.keyword} | ${row.topic_count} | ${row.created_at}`);
    });

    // 2. 检查实际话题数量
    console.log('\n📊 实际话题数量对比:');
    const comparison = await pool.query(`
      SELECT 
        d.id, 
        d.keyword, 
        d.topic_count, 
        COUNT(t.id) as actual_topics
      FROM distillations d
      LEFT JOIN topics t ON d.id = t.distillation_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `);

    console.log('ID | 关键词 | topic_count | 实际话题数 | 状态');
    console.log('---|--------|-------------|-----------|------');
    comparison.rows.forEach(row => {
      const status = row.topic_count === parseInt(row.actual_topics) ? '✅' : '❌';
      console.log(`${row.id} | ${row.keyword} | ${row.topic_count} | ${row.actual_topics} | ${status}`);
    });

    // 3. 检查触发器
    console.log('\n🔧 检查触发器:');
    const triggers = await pool.query(`
      SELECT tgname, tgtype, tgenabled 
      FROM pg_trigger 
      WHERE tgrelid = 'topics'::regclass
    `);

    if (triggers.rows.length > 0) {
      console.log('触发器名称 | 类型 | 状态');
      console.log('----------|------|------');
      triggers.rows.forEach(row => {
        const enabled = row.tgenabled === 'O' ? '✅ 启用' : '❌ 禁用';
        console.log(`${row.tgname} | ${row.tgtype} | ${enabled}`);
      });
    } else {
      console.log('❌ 未找到触发器');
    }

    // 4. 统计
    console.log('\n📈 统计信息:');
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_distillations,
        COUNT(CASE WHEN topic_count > 0 THEN 1 END) as with_topics,
        COUNT(CASE WHEN topic_count = 0 THEN 1 END) as without_topics
      FROM distillations
    `);

    const stat = stats.rows[0];
    console.log(`总蒸馏记录: ${stat.total_distillations}`);
    console.log(`有话题的: ${stat.with_topics}`);
    console.log(`无话题的: ${stat.without_topics}`);

    await pool.end();
  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
    process.exit(1);
  }
}

diagnose();
