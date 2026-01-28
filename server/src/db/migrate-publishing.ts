import { pool } from './database';

/**
 * 多平台文章发布系统数据库迁移
 * 创建所有必需的表和索引
 */
async function migratePublishing() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🚀 开始创建多平台发布系统表...');
    
    // 1. 创建加密密钥表
    console.log('📝 创建 encryption_keys 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id SERIAL PRIMARY KEY,
        key_name VARCHAR(50) UNIQUE NOT NULL,
        key_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 2. 创建平台配置表
    console.log('📝 创建 platforms_config 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS platforms_config (
        id SERIAL PRIMARY KEY,
        platform_id VARCHAR(50) UNIQUE NOT NULL,
        platform_name VARCHAR(100) NOT NULL,
        icon_url VARCHAR(255) NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        adapter_class VARCHAR(100) NOT NULL,
        required_fields TEXT NOT NULL,
        config_schema TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 3. 更新平台账号表（添加新字段）
    console.log('📝 更新 platform_accounts 表...');
    
    // 添加 credentials 字段（如果不存在）
    await client.query(`
      ALTER TABLE platform_accounts 
      ADD COLUMN IF NOT EXISTS credentials TEXT
    `);
    
    // 添加 is_default 字段（如果不存在）
    await client.query(`
      ALTER TABLE platform_accounts 
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false
    `);
    
    // 添加 platform_id 字段（如果不存在）
    await client.query(`
      ALTER TABLE platform_accounts 
      ADD COLUMN IF NOT EXISTS platform_id VARCHAR(50)
    `);
    
    // 将现有的 platform 字段数据复制到 platform_id（如果 platform_id 为空）
    await client.query(`
      UPDATE platform_accounts 
      SET platform_id = platform 
      WHERE platform_id IS NULL
    `);
    
    // 4. 创建发布任务表
    console.log('📝 创建 publishing_tasks 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS publishing_tasks (
        id SERIAL PRIMARY KEY,
        article_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        platform_id VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        config TEXT NOT NULL,
        scheduled_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_account FOREIGN KEY (account_id) 
          REFERENCES platform_accounts(id) ON DELETE CASCADE
      )
    `);
    
    // 5. 创建发布日志表
    console.log('📝 创建 publishing_logs 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS publishing_logs (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        level VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_task FOREIGN KEY (task_id) 
          REFERENCES publishing_tasks(id) ON DELETE CASCADE
      )
    `);
    
    // 创建索引
    console.log('📝 创建索引...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_tasks_article 
      ON publishing_tasks(article_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_tasks_status 
      ON publishing_tasks(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_tasks_scheduled 
      ON publishing_tasks(scheduled_at)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_logs_task 
      ON publishing_logs(task_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_logs_level 
      ON publishing_logs(level)
    `);
    
    // 插入初始平台配置数据
    console.log('📝 插入初始平台配置...');
    
    const platforms = [
      {
        platform_id: 'wangyi',
        platform_name: '网易号',
        icon_url: '/icons/platforms/wangyi.png',
        adapter_class: 'WangyiAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'souhu',
        platform_name: '搜狐号',
        icon_url: '/icons/platforms/souhu.png',
        adapter_class: 'SouhuAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'toutiao',
        platform_name: '头条号',
        icon_url: '/icons/platforms/toutiao.png',
        adapter_class: 'ToutiaoAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'qie',
        platform_name: '企鹅号',
        icon_url: '/icons/platforms/qie.png',
        adapter_class: 'QieAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'zhihu',
        platform_name: '知乎',
        icon_url: '/icons/platforms/zhihu.png',
        adapter_class: 'ZhihuAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'xiaohongshu',
        platform_name: '小红书',
        icon_url: '/icons/platforms/xiaohongshu.png',
        adapter_class: 'XiaohongshuAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'douyin',
        platform_name: '抖音号',
        icon_url: '/icons/platforms/douyin.png',
        adapter_class: 'DouyinAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'bilibili',
        platform_name: '哔哩哔哩',
        icon_url: '/icons/platforms/bilibili.png',
        adapter_class: 'BilibiliAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'csdn',
        platform_name: 'CSDN',
        icon_url: '/icons/platforms/csdn.png',
        adapter_class: 'CSDNAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      },
      {
        platform_id: 'jianshu',
        platform_name: '简书',
        icon_url: '/icons/platforms/jianshu.png',
        adapter_class: 'JianshuAdapter',
        required_fields: JSON.stringify(['username', 'password'])
      }
    ];
    
    for (const platform of platforms) {
      await client.query(`
        INSERT INTO platforms_config 
        (platform_id, platform_name, icon_url, adapter_class, required_fields)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (platform_id) DO NOTHING
      `, [
        platform.platform_id,
        platform.platform_name,
        platform.icon_url,
        platform.adapter_class,
        platform.required_fields
      ]);
    }
    
    await client.query('COMMIT');
    console.log('✅ 多平台发布系统表创建成功！');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行迁移
migratePublishing()
  .then(() => {
    console.log('✅ 迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  });
