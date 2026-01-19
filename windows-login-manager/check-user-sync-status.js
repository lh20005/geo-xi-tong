#!/usr/bin/env node

/**
 * 检查用户同步状态
 * 诊断为什么用户信息没有同步到本地数据库
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function checkUserSyncStatus() {
  console.log('='.repeat(60));
  console.log('用户同步状态诊断');
  console.log('='.repeat(60));
  console.log();

  // 1. 检查数据库连接
  console.log('1. 检查数据库连接...');
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'geo_windows',
    user: 'lzc',
    password: '',
  });

  try {
    const result = await pool.query('SELECT NOW()');
    console.log('   ✅ 数据库连接成功');
    console.log(`   时间: ${result.rows[0].now}`);
  } catch (error) {
    console.log('   ❌ 数据库连接失败:', error.message);
    process.exit(1);
  }
  console.log();

  // 2. 检查 users 表是否存在
  console.log('2. 检查 users 表...');
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('   ✅ users 表存在');
    } else {
      console.log('   ❌ users 表不存在');
      process.exit(1);
    }
  } catch (error) {
    console.log('   ❌ 检查失败:', error.message);
    process.exit(1);
  }
  console.log();

  // 3. 检查 users 表中的数据
  console.log('3. 检查 users 表数据...');
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY synced_at DESC');
    
    if (result.rows.length === 0) {
      console.log('   ⚠️  users 表为空（没有用户数据）');
      console.log();
      console.log('   可能原因：');
      console.log('   1. 您还没有重新登录');
      console.log('   2. 登录时使用的是旧版本应用（未编译）');
      console.log('   3. 登录时数据库同步失败（检查日志）');
    } else {
      console.log(`   ✅ 找到 ${result.rows.length} 个用户:`);
      result.rows.forEach(user => {
        console.log(`      - ID: ${user.id}, 用户名: ${user.username}, 同步时间: ${user.synced_at}`);
      });
    }
  } catch (error) {
    console.log('   ❌ 查询失败:', error.message);
  }
  console.log();

  // 4. 检查 Electron Store
  console.log('4. 检查 Electron Store...');
  const storePath = path.join(
    process.env.HOME,
    'Library/Application Support/ai-geo-system/ai-geo-system.json'
  );
  
  try {
    if (fs.existsSync(storePath)) {
      const storeData = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      
      if (storeData.user) {
        console.log('   ✅ Electron Store 中有用户信息:');
        console.log(`      - ID: ${storeData.user.id}`);
        console.log(`      - 用户名: ${storeData.user.username}`);
        console.log(`      - 角色: ${storeData.user.role}`);
      } else {
        console.log('   ⚠️  Electron Store 中没有用户信息');
      }
    } else {
      console.log('   ⚠️  Electron Store 文件不存在');
    }
  } catch (error) {
    console.log('   ❌ 读取失败:', error.message);
  }
  console.log();

  // 5. 检查编译后的代码
  console.log('5. 检查编译后的代码...');
  const handlerPath = path.join(__dirname, 'dist-electron/ipc/handler.js');
  
  try {
    if (fs.existsSync(handlerPath)) {
      const handlerCode = fs.readFileSync(handlerPath, 'utf-8');
      
      if (handlerCode.includes('同步用户信息到本地数据库')) {
        console.log('   ✅ 编译后的代码包含用户同步逻辑');
      } else {
        console.log('   ❌ 编译后的代码不包含用户同步逻辑');
        console.log('   需要重新编译: npm run build:electron');
      }
    } else {
      console.log('   ❌ 编译后的文件不存在');
      console.log('   需要编译: npm run build:electron');
    }
  } catch (error) {
    console.log('   ❌ 检查失败:', error.message);
  }
  console.log();

  // 6. 检查日志文件
  console.log('6. 检查日志文件...');
  const logPath = path.join(process.env.HOME, 'Library/Logs/ai-geo-system/main.log');
  
  try {
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n');
      const recentLines = lines.slice(-100);
      
      const loginLines = recentLines.filter(line => 
        line.includes('IPC: login') || 
        line.includes('用户信息') ||
        line.includes('同步')
      );
      
      if (loginLines.length > 0) {
        console.log('   ✅ 找到相关日志:');
        loginLines.slice(-5).forEach(line => {
          console.log(`      ${line}`);
        });
      } else {
        console.log('   ⚠️  没有找到相关日志');
        console.log('   最后日志时间:', lines[lines.length - 2] || '无');
      }
    } else {
      console.log('   ⚠️  日志文件不存在');
    }
  } catch (error) {
    console.log('   ❌ 读取失败:', error.message);
  }
  console.log();

  // 7. 检查蒸馏数据
  console.log('7. 检查蒸馏数据...');
  try {
    const result = await pool.query(`
      SELECT 
        d.id,
        d.user_id,
        d.keyword,
        d.topic_count,
        d.created_at,
        (SELECT COUNT(*) FROM topics t WHERE t.distillation_id = d.id) as actual_topic_count
      FROM distillations d
      ORDER BY d.created_at DESC
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('   ⚠️  没有蒸馏数据');
    } else {
      console.log(`   ✅ 找到 ${result.rows.length} 条蒸馏记录:`);
      result.rows.forEach(d => {
        console.log(`      - ID: ${d.id}, user_id: ${d.user_id}, 关键词: ${d.keyword}, 话题数: ${d.topic_count}/${d.actual_topic_count}, 时间: ${d.created_at}`);
      });
    }
  } catch (error) {
    console.log('   ❌ 查询失败:', error.message);
  }
  console.log();

  // 总结
  console.log('='.repeat(60));
  console.log('诊断总结');
  console.log('='.repeat(60));
  console.log();
  console.log('下一步操作：');
  console.log();
  console.log('1. 如果 users 表为空：');
  console.log('   → 退出当前应用');
  console.log('   → 重新登录 aizhiruan');
  console.log('   → 检查日志是否有 "✅ 用户信息已同步到本地数据库"');
  console.log();
  console.log('2. 如果编译后的代码不包含同步逻辑：');
  console.log('   → cd windows-login-manager');
  console.log('   → npm run build:electron');
  console.log('   → 重新启动应用');
  console.log();
  console.log('3. 如果仍然不工作：');
  console.log('   → 查看完整日志: tail -f ~/Library/Logs/ai-geo-system/main.log');
  console.log('   → 查找错误信息');
  console.log();

  await pool.end();
}

checkUserSyncStatus().catch(console.error);
