import { pool } from '../db/database';

/**
 * 清理没有话题的distillation记录
 * 
 * 这些记录可能是因为：
 * 1. 话题被删除了，但distillation记录因为外键约束无法删除
 * 2. AI蒸馏失败，创建了distillation记录但没有创建话题
 * 3. 其他异常情况
 */
async function cleanupEmptyDistillations() {
  const client = await pool.connect();
  
  try {
    console.log('开始清理没有话题的distillation记录...');
    console.log('');
    
    // 1. 查询没有话题的distillation记录
    console.log('步骤1: 查询没有话题的distillation记录');
    console.log('─'.repeat(80));
    
    const emptyDistillations = await client.query(`
      SELECT 
        d.id,
        d.keyword,
        d.provider,
        d.created_at,
        d.usage_count
      FROM distillations d
      WHERE NOT EXISTS (
        SELECT 1 FROM topics WHERE distillation_id = d.id
      )
      ORDER BY d.created_at DESC
    `);
    
    if (emptyDistillations.rows.length === 0) {
      console.log('✓ 没有找到需要清理的记录');
      console.log('');
      return;
    }
    
    console.log(`找到 ${emptyDistillations.rows.length} 条没有话题的记录：`);
    console.log('');
    console.log('ID\t关键词\t\t\tProvider\t创建时间\t\t使用次数');
    console.log('─'.repeat(80));
    
    for (const row of emptyDistillations.rows) {
      const keywordDisplay = row.keyword.length > 15 
        ? row.keyword.substring(0, 12) + '...' 
        : row.keyword.padEnd(15);
      const createdAt = new Date(row.created_at).toLocaleString('zh-CN');
      console.log(`${row.id}\t${keywordDisplay}\t${row.provider}\t\t${createdAt}\t${row.usage_count}`);
    }
    
    console.log('─'.repeat(80));
    console.log('');
    
    // 2. 检查是否有文章引用这些记录
    console.log('步骤2: 检查文章引用情况');
    console.log('─'.repeat(80));
    
    const distillationIds = emptyDistillations.rows.map(row => row.id);
    
    const articlesCheck = await client.query(
      `SELECT 
        distillation_id,
        COUNT(*) as article_count
       FROM articles
       WHERE distillation_id = ANY($1::int[])
       GROUP BY distillation_id`,
      [distillationIds]
    );
    
    if (articlesCheck.rows.length > 0) {
      console.log('以下distillation记录被文章引用：');
      console.log('');
      console.log('Distillation ID\t文章数量');
      console.log('─'.repeat(40));
      for (const row of articlesCheck.rows) {
        console.log(`${row.distillation_id}\t\t${row.article_count}`);
      }
      console.log('─'.repeat(40));
      console.log('');
      console.log('⚠ 注意：删除这些记录后，相关文章的distillation_id将变为NULL');
      console.log('        （文章本身不会被删除）');
      console.log('');
    } else {
      console.log('✓ 没有文章引用这些记录');
      console.log('');
    }
    
    // 3. 确认删除
    console.log('步骤3: 执行清理');
    console.log('─'.repeat(80));
    
    await client.query('BEGIN');
    
    const deleteResult = await client.query(
      `DELETE FROM distillations 
       WHERE id = ANY($1::int[])`,
      [distillationIds]
    );
    
    await client.query('COMMIT');
    
    console.log(`✓ 成功删除 ${deleteResult.rowCount} 条记录`);
    console.log('');
    
    // 4. 验证清理结果
    console.log('步骤4: 验证清理结果');
    console.log('─'.repeat(80));
    
    const remainingEmpty = await client.query(`
      SELECT COUNT(*) as count
      FROM distillations d
      WHERE NOT EXISTS (
        SELECT 1 FROM topics WHERE distillation_id = d.id
      )
    `);
    
    const remainingCount = parseInt(remainingEmpty.rows[0].count);
    
    if (remainingCount === 0) {
      console.log('✓ 所有没有话题的distillation记录已清理完成');
    } else {
      console.log(`⚠ 仍有 ${remainingCount} 条没有话题的记录`);
    }
    
    console.log('');
    console.log('═'.repeat(80));
    console.log('清理完成');
    console.log('═'.repeat(80));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ 清理失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行清理
cleanupEmptyDistillations()
  .then(() => {
    console.log('');
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
