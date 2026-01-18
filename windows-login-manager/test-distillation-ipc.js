/**
 * 测试蒸馏结果 IPC 通信
 * 
 * 这个脚本直接测试数据库查询，验证数据是否存在
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'geo_windows',
  user: 'lzc',
  password: '',
});

async function testDistillationResults() {
  try {
    console.log('=== 测试蒸馏结果数据 ===\n');

    // 1. 检查 user_id=1 的话题数量
    const topicsResult = await pool.query(`
      SELECT COUNT(*) as count FROM topics WHERE user_id = 1
    `);
    console.log(`✅ user_id=1 的话题总数: ${topicsResult.rows[0].count}`);

    // 2. 检查最近的话题
    const recentTopics = await pool.query(`
      SELECT 
        t.id,
        t.question,
        t.distillation_id,
        t.created_at,
        d.keyword
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      WHERE t.user_id = 1
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    console.log(`\n最近 5 条话题:`);
    recentTopics.rows.forEach(row => {
      console.log(`  - [${row.id}] ${row.keyword}: ${row.question}`);
      console.log(`    蒸馏ID: ${row.distillation_id}, 时间: ${new Date(row.created_at).toLocaleString('zh-CN')}`);
    });

    // 3. 模拟 IPC handler 的查询（完整查询）
    console.log(`\n=== 模拟 IPC Handler 查询 ===`);
    
    const userId = 1;
    const page = 1;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      WHERE t.user_id = $1
    `;
    const countResult = await pool.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].total);
    console.log(`总数查询结果: ${total}`);

    // 查询数据
    const dataQuery = `
      SELECT 
        t.id,
        t.question,
        t.distillation_id,
        t.created_at as "createdAt",
        d.keyword,
        COALESCE(
          (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id),
          0
        ) as "referenceCount"
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await pool.query(dataQuery, [userId, pageSize, offset]);
    console.log(`数据查询结果: ${dataResult.rows.length} 条记录`);

    if (dataResult.rows.length > 0) {
      console.log(`\n前 3 条数据示例:`);
      dataResult.rows.slice(0, 3).forEach((row, index) => {
        console.log(`\n${index + 1}. ID: ${row.id}`);
        console.log(`   关键词: ${row.keyword}`);
        console.log(`   问题: ${row.question}`);
        console.log(`   蒸馏ID: ${row.distillation_id}`);
        console.log(`   引用次数: ${row.referenceCount}`);
        console.log(`   创建时间: ${row.createdAt}`);
      });
    }

    // 4. 检查统计信息
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as "totalTopics",
        COUNT(DISTINCT d.id) as "totalKeywords",
        COALESCE(SUM(
          (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id)
        ), 0) as "totalReferences"
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      WHERE t.user_id = $1
    `;
    const statsResult = await pool.query(statsQuery, [userId]);
    console.log(`\n=== 统计信息 ===`);
    console.log(`总话题数: ${statsResult.rows[0].totalTopics}`);
    console.log(`总关键词数: ${statsResult.rows[0].totalKeywords}`);
    console.log(`总引用次数: ${statsResult.rows[0].totalReferences}`);

    // 5. 检查关键词列表
    const keywordsQuery = `
      SELECT DISTINCT d.keyword
      FROM distillations d
      WHERE d.user_id = $1
      ORDER BY d.keyword
    `;
    const keywordsResult = await pool.query(keywordsQuery, [userId]);
    console.log(`\n=== 关键词列表 ===`);
    console.log(`关键词数量: ${keywordsResult.rows.length}`);
    keywordsResult.rows.forEach(row => {
      console.log(`  - ${row.keyword}`);
    });

    console.log(`\n=== 测试完成 ===`);
    console.log(`\n✅ 如果以上数据都正常显示，说明数据库查询没有问题`);
    console.log(`❌ 如果前端页面仍然看不到数据，问题可能在于：`);
    console.log(`   1. IPC 通信问题（preload 脚本未正确暴露）`);
    console.log(`   2. React 组件状态更新问题`);
    console.log(`   3. 缓存问题`);
    console.log(`   4. 用户 ID 不匹配`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await pool.end();
  }
}

testDistillationResults();
