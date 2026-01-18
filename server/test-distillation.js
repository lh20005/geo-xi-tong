// 测试蒸馏功能的脚本
const { pool } = require('./dist/db/database');

async function testDistillation() {
  console.log('=== 开始测试蒸馏功能 ===\n');
  
  try {
    // 测试 1: 检查表结构
    console.log('1. 检查 distillations 表结构...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'distillations' 
      ORDER BY ordinal_position
    `);
    console.log('表字段:', tableInfo.rows.map(r => r.column_name).join(', '));
    
    const hasUpdatedAt = tableInfo.rows.some(r => r.column_name === 'updated_at');
    console.log('是否有 updated_at 字段:', hasUpdatedAt ? '✅ 是' : '❌ 否');
    console.log('');
    
    // 测试 2: 测试 INSERT 语句
    console.log('2. 测试 INSERT 语句...');
    const insertResult = await pool.query(
      'INSERT INTO distillations (keyword, provider, user_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      ['测试关键词', 'deepseek', 1]
    );
    console.log('✅ INSERT 成功, ID:', insertResult.rows[0].id);
    console.log('返回的字段:', Object.keys(insertResult.rows[0]).join(', '));
    console.log('');
    
    // 测试 3: 测试 SELECT 查询
    console.log('3. 测试 SELECT 查询...');
    const selectResult = await pool.query(
      'SELECT * FROM distillations WHERE id = $1',
      [insertResult.rows[0].id]
    );
    console.log('✅ SELECT 成功');
    console.log('查询结果:', selectResult.rows[0]);
    console.log('');
    
    // 测试 4: 测试获取历史记录的查询
    console.log('4. 测试获取历史记录查询...');
    const historyQuery = `
      SELECT 
        d.id, 
        d.keyword, 
        d.provider, 
        d.created_at,
        d.usage_count,
        COUNT(t.id) as topic_count
      FROM distillations d
      LEFT JOIN topics t ON d.id = t.distillation_id
      WHERE d.user_id = $1
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `;
    const historyResult = await pool.query(historyQuery, [1]);
    console.log('✅ 历史记录查询成功, 返回', historyResult.rows.length, '条记录');
    console.log('');
    
    // 清理测试数据
    console.log('5. 清理测试数据...');
    await pool.query('DELETE FROM distillations WHERE id = $1', [insertResult.rows[0].id]);
    console.log('✅ 测试数据已清理');
    console.log('');
    
    console.log('=== ✅ 所有测试通过 ===');
    
  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error('错误信息:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误详情:', error.detail);
    console.error('\n完整错误:');
    console.error(error);
  } finally {
    await pool.end();
  }
}

testDistillation();
