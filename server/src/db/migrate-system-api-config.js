const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行系统级API配置迁移...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'migrations', 'add-system-api-config.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行迁移
    await client.query(sql);
    
    console.log('✅ 系统级API配置迁移完成！');
    console.log('\n创建的表：');
    console.log('  - system_api_configs: 系统级API配置');
    console.log('  - tenant_api_configs: 租户级API配置（可选）');
    console.log('  - api_usage_logs: API使用记录');
    console.log('  - api_quota_configs: API配额配置');
    console.log('\n下一步：');
    console.log('  1. 在.env文件中配置 API_KEY_ENCRYPTION_KEY');
    console.log('  2. 在管理后台配置系统级API密钥');
    console.log('  3. 测试AI功能是否正常工作');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('迁移过程出错:', error);
  process.exit(1);
});
