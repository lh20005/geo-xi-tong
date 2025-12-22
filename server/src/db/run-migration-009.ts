import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 执行 009 迁移：添加平台选择器配置
 */
async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 开始执行迁移 009: 添加平台选择器配置...\n');
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'migrations', '009_add_platform_selectors.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 执行 SQL
    console.log('📝 执行 SQL 语句...');
    await client.query(sql);
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log('\n✅ 迁移 009 执行成功！');
    console.log('\n📊 已更新的配置：');
    console.log('   - 添加 selectors 字段（JSONB 类型）');
    console.log('   - 添加 login_url 字段');
    console.log('   - 更新所有平台的选择器配置');
    console.log('\n💡 现在 Windows 登录管理器可以正确提取用户信息了！');
    
    // 验证配置
    console.log('\n🔍 验证头条号配置...');
    const result = await client.query(
      'SELECT platform_id, platform_name, login_url, selectors FROM platforms_config WHERE platform_id = $1',
      ['toutiao']
    );
    
    if (result.rows.length > 0) {
      const config = result.rows[0];
      console.log('\n头条号配置：');
      console.log('  平台ID:', config.platform_id);
      console.log('  平台名称:', config.platform_name);
      console.log('  登录URL:', config.login_url);
      console.log('  用户名选择器数量:', config.selectors?.username?.length || 0);
      console.log('  登录成功选择器数量:', config.selectors?.loginSuccess?.length || 0);
      
      if (config.selectors?.username) {
        console.log('\n  用户名选择器列表:');
        config.selectors.username.forEach((selector: string, index: number) => {
          console.log(`    ${index + 1}. ${selector}`);
        });
      }
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
runMigration().catch(error => {
  console.error('执行迁移时发生错误:', error);
  process.exit(1);
});
