/**
 * 诊断话题保存问题
 * 
 * 运行此脚本检查：
 * 1. 数据库中的蒸馏记录和话题数量
 * 2. 哪些蒸馏记录缺少话题
 * 3. user_id 是否正确
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'geo_windows',
  user: 'lzc',
  password: '',
});

async function diagnose() {
  try {
    console.log('=== 蒸馏记录诊断 ===\n');

    // 1. 检查所有蒸馏记录
    const distillations = await pool.query(`
      SELECT 
        d.id,
        d.keyword,
        d.topic_count,
        d.user_id,
        d.created_at,
        (SELECT COUNT(*) FROM topics t WHERE t.distillation_id = d.id) as actual_topics
      FROM distillations d
      ORDER BY d.id DESC
      LIMIT 20
    `);

    console.log('最近 20 条蒸馏记录：');
    console.log('ID | 关键词 | 预期话题数 | 实际话题数 | 用户ID | 创建时间');
    console.log('---|--------|-----------|-----------|--------|----------');
    
    distillations.rows.forEach(row => {
      const status = row.topic_count === parseInt(row.actual_topics) ? '✅' : '❌';
      console.log(`${status} ${row.id} | ${row.keyword} | ${row.topic_count} | ${row.actual_topics} | ${row.user_id} | ${new Date(row.created_at).toLocaleString('zh-CN')}`);
    });

    // 2. 统计问题记录
    const problemRecords = distillations.rows.filter(row => 
      row.topic_count !== parseInt(row.actual_topics)
    );

    console.log(`\n\n=== 问题统计 ===`);
    console.log(`总记录数: ${distillations.rows.length}`);
    console.log(`正常记录: ${distillations.rows.length - problemRecords.length}`);
    console.log(`问题记录: ${problemRecords.length}`);

    if (problemRecords.length > 0) {
      console.log('\n问题记录详情：');
      problemRecords.forEach(row => {
        console.log(`  - ID ${row.id}: "${row.keyword}" (预期 ${row.topic_count} 个话题，实际 ${row.actual_topics} 个)`);
      });

      console.log('\n\n=== 建议操作 ===');
      console.log('1. 删除这些无效的蒸馏记录：');
      const ids = problemRecords.map(r => r.id).join(', ');
      console.log(`   DELETE FROM distillations WHERE id IN (${ids});`);
      
      console.log('\n2. 或者在应用中重新执行蒸馏');
      console.log('   - 确保已登录');
      console.log('   - 检查浏览器控制台是否有错误日志');
      console.log('   - 查看 Electron 日志：~/Library/Logs/platform-login-manager/');
    } else {
      console.log('\n✅ 所有记录正常！');
    }

    // 3. 检查 user_id 分布
    console.log('\n\n=== 用户分布 ===');
    const userStats = await pool.query(`
      SELECT 
        user_id,
        COUNT(*) as distillation_count,
        SUM(topic_count) as total_topics_expected,
        (SELECT COUNT(*) FROM topics t WHERE t.user_id = d.user_id) as total_topics_actual
      FROM distillations d
      GROUP BY user_id
      ORDER BY user_id
    `);

    console.log('用户ID | 蒸馏次数 | 预期话题总数 | 实际话题总数');
    console.log('-------|---------|-------------|-------------');
    userStats.rows.forEach(row => {
      const status = row.total_topics_expected === parseInt(row.total_topics_actual) ? '✅' : '❌';
      console.log(`${status} ${row.user_id} | ${row.distillation_count} | ${row.total_topics_expected} | ${row.total_topics_actual}`);
    });

  } catch (error) {
    console.error('诊断失败:', error);
  } finally {
    await pool.end();
  }
}

diagnose();
