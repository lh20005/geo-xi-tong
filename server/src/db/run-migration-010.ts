import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 执行 010 迁移：修复平台登录检测配置
 */
async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 开始执行迁移 010: 修复平台登录检测配置...\n');
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'migrations', '010_fix_platform_login_detection.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 执行 SQL
    console.log('📝 执行 SQL 语句...');
    await client.query(sql);
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log('\n✅ 迁移 010 执行成功！');
    console.log('\n📊 修复内容：');
    console.log('   - 为所有平台添加 successUrls 配置');
    console.log('   - 使用 URL 变化检测（参考网页端成功经验）');
    console.log('   - 简化登录检测逻辑，提高成功率');
    console.log('\n💡 现在 Windows 登录管理器可以正确检测登录成功了！');
    
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
      console.log('  登录成功URL模式数量:', config.selectors?.successUrls?.length || 0);
      
      if (config.selectors?.successUrls) {
        console.log('\n  登录成功URL模式:');
        config.selectors.successUrls.forEach((url: string, index: number) => {
          console.log(`    ${index + 1}. ${url}`);
        });
      }
      
      console.log('\n💡 检测逻辑：');
      console.log('  1. 优先检测 URL 是否包含 successUrls 中的任一模式');
      console.log('  2. 如果 URL 匹配，立即判定登录成功');
      console.log('  3. 如果 URL 不匹配，再检测 loginSuccess 选择器');
      console.log('  4. 超时时间：5分钟（与网页端一致）');
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
