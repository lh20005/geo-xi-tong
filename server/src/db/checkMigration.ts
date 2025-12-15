import { pool } from './database';

async function checkMigration() {
  try {
    console.log('检查数据库迁移状态...\n');

    // 检查topics表的usage_count字段
    const topicsColumn = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'topics' AND column_name = 'usage_count'
    `);
    
    console.log('1. topics.usage_count字段:');
    if (topicsColumn.rows.length > 0) {
      console.log('   ✓ 存在', topicsColumn.rows[0]);
    } else {
      console.log('   ✗ 不存在');
    }

    // 检查topic_usage表
    const topicUsageTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'topic_usage'
    `);
    
    console.log('\n2. topic_usage表:');
    if (topicUsageTable.rows.length > 0) {
      console.log('   ✓ 存在');
      
      // 查看表结构
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'topic_usage'
        ORDER BY ordinal_position
      `);
      console.log('   字段:', columns.rows);
    } else {
      console.log('   ✗ 不存在');
    }

    // 检查articles表的topic_id字段
    const articlesColumn = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'articles' AND column_name = 'topic_id'
    `);
    
    console.log('\n3. articles.topic_id字段:');
    if (articlesColumn.rows.length > 0) {
      console.log('   ✓ 存在', articlesColumn.rows[0]);
    } else {
      console.log('   ✗ 不存在');
    }

    // 检查索引
    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('topics', 'topic_usage', 'articles')
        AND indexname LIKE '%usage%'
      ORDER BY indexname
    `);
    
    console.log('\n4. 相关索引:');
    if (indexes.rows.length > 0) {
      indexes.rows.forEach(row => {
        console.log('   ✓', row.indexname);
      });
    } else {
      console.log('   ✗ 未找到相关索引');
    }

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('检查失败:', error.message);
    process.exit(1);
  }
}

checkMigration();
