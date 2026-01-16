import { PostgresDatabase, PostgresConfig } from '../electron/database/postgres';
import * as readline from 'readline';

/**
 * 数据库配置向导
 * 
 * 功能：
 * 1. 引导用户输入数据库配置
 * 2. 测试数据库连接
 * 3. 保存配置到文件
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function setupDatabase() {
  console.log('🔧 PostgreSQL 数据库配置向导\n');
  console.log('请输入数据库连接信息（直接回车使用默认值）\n');

  try {
    // 获取配置
    const host = await question('数据库主机 (localhost): ') || 'localhost';
    const portStr = await question('数据库端口 (5432): ') || '5432';
    const port = parseInt(portStr, 10);
    const database = await question('数据库名称 (geo_windows): ') || 'geo_windows';
    const user = await question('用户名 (postgres): ') || 'postgres';
    const password = await question('密码: ');

    const config: PostgresConfig = {
      host,
      port,
      database,
      user,
      password
    };

    console.log('\n📡 测试数据库连接...');

    // 测试连接
    const db = PostgresDatabase.getInstance();
    await db.initialize(config);

    console.log('✅ 数据库连接成功！\n');

    // 保存配置
    console.log('💾 保存配置...');
    db.saveConfig(config);
    console.log('✅ 配置已保存\n');

    await db.close();

    console.log('🎉 数据库配置完成！');
    console.log('\n下一步：');
    console.log('  1. 运行 npm run db:init 初始化数据库结构');
    console.log('  2. 运行 npm run db:import-data 导入测试数据');

  } catch (error) {
    console.error('\n❌ 配置失败:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupDatabase();
