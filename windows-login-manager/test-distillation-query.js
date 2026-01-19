const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_windows',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || '',
});

async function testQuery() {
  try {
    console.log('=== 测试蒸馏结果查询 ===\n');

    // 模拟前端查询（无筛选条件）
    const userId = 1; // 假设用户 ID 为 1
    const conditions = ['t.user_id = $1'];
    const params = [userId];
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      ${whereClause}
    `;
    console.log('📊 查询总数 SQL:');
    console.log(countQuery);
    console.log('参数:', params);
    console.log('');

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    console.log(`✅ 总话题数: ${total}\n`);

    // 查询数据
    const page = 1;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

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
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    console.log('📊 查询数据 SQL:');
    console.log(dataQuery);
    console.log('参数:', [...params, pageSize, offset]);
    console.log('');

    const dataResult = await pool.query(dataQuery, [...params, pageSize, offset]);
    console.log(`✅ 返回数据: ${dataResult.rows.length} 条\n`);

    if (dataResult.rows.length > 0) {
      console.log('前 3 条数据:');
      dataResult.rows.slice(0, 3).forEach((row, index) => {
        console.log(`${index + 1}. [${row.keyword}] ${row.question}`);
      });
    } else {
      console.log('❌ 没有返回数据！');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

testQuery();
