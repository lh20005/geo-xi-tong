import { pool } from './database';

async function runMigration() {
  console.log('开始执行数据库迁移...\n');

  try {
    // 步骤1: 给topics表添加usage_count字段
    console.log('步骤1: 添加topics.usage_count字段...');
    await pool.query(`
      ALTER TABLE topics 
      ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0)
    `);
    console.log('✓ 完成\n');

    // 步骤2: 给articles表添加topic_id字段
    console.log('步骤2: 添加articles.topic_id字段...');
    await pool.query(`
      ALTER TABLE articles 
      ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL
    `);
    console.log('✓ 完成\n');

    // 步骤3: 创建话题使用记录表
    console.log('步骤3: 创建topic_usage表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS topic_usage (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES generation_tasks(id) ON DELETE SET NULL,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_article_topic UNIQUE (article_id, topic_id)
      )
    `);
    console.log('✓ 完成\n');

    // 步骤4: 初始化usage_count
    console.log('步骤4: 初始化usage_count...');
    const result = await pool.query(`
      UPDATE topics 
      SET usage_count = 0 
      WHERE usage_count IS NULL
    `);
    console.log(`✓ 完成，更新了 ${result.rowCount} 行\n`);

    // 步骤5: 创建索引
    console.log('步骤5: 创建索引...');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_topics_usage_count ON topics(usage_count ASC, created_at ASC)`);
    console.log('  ✓ idx_topics_usage_count');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_topics_distillation_usage ON topics(distillation_id, usage_count ASC)`);
    console.log('  ✓ idx_topics_distillation_usage');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_topic_usage_topic_id ON topic_usage(topic_id)`);
    console.log('  ✓ idx_topic_usage_topic_id');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_topic_usage_article_id ON topic_usage(article_id)`);
    console.log('  ✓ idx_topic_usage_article_id');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_topic_usage_distillation_id ON topic_usage(distillation_id)`);
    console.log('  ✓ idx_topic_usage_distillation_id');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id)`);
    console.log('  ✓ idx_articles_topic_id\n');

    // 步骤6: 添加注释
    console.log('步骤6: 添加注释...');
    await pool.query(`COMMENT ON COLUMN topics.usage_count IS '话题被用于生成文章的次数'`);
    await pool.query(`COMMENT ON TABLE topic_usage IS '话题使用记录表，追踪每个话题被哪些文章使用'`);
    await pool.query(`COMMENT ON COLUMN articles.topic_id IS '文章使用的具体话题ID'`);
    console.log('✓ 完成\n');

    console.log('✅ 数据库迁移全部完成！\n');
    console.log('新增功能：');
    console.log('1. topics表添加了usage_count字段');
    console.log('2. 创建了topic_usage表用于记录话题使用');
    console.log('3. articles表添加了topic_id字段');
    console.log('4. 创建了6个索引以提高查询性能');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error('详细错误:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
