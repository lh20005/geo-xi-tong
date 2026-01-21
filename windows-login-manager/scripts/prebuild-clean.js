#!/usr/bin/env node
/**
 * 打包前清理脚本
 * 确保不会将开发数据打包进去
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧹 开始打包前清理...');

// 清理可能存在的本地存储数据（开发环境可能创建的）
const appDataPaths = [
  // macOS
  path.join(os.homedir(), 'Library', 'Application Support', 'ai-geo-system'),
  // Windows
  path.join(os.homedir(), 'AppData', 'Roaming', 'ai-geo-system'),
  path.join(os.homedir(), 'AppData', 'Local', 'ai-geo-system'),
  // Linux
  path.join(os.homedir(), '.config', 'ai-geo-system'),
];

// 注意：我们不删除用户数据目录，只是提醒开发者
console.log('\n⚠️  提醒：以下目录包含用户数据，打包时不会包含这些数据：');
appDataPaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`   - ${p} (存在)`);
  }
});

// 清理项目目录中可能存在的临时文件
const projectRoot = path.join(__dirname, '..');
const cleanupPaths = [
  path.join(projectRoot, 'test-data'),
  path.join(projectRoot, '.env.local'),
];

cleanupPaths.forEach(p => {
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      // 清空目录但保留目录本身
      const files = fs.readdirSync(p);
      files.forEach(file => {
        const filePath = path.join(p, file);
        fs.rmSync(filePath, { recursive: true, force: true });
      });
      console.log(`✅ 已清空目录: ${p}`);
    } else {
      // 删除文件
      fs.unlinkSync(p);
      console.log(`✅ 已删除文件: ${p}`);
    }
  }
});

// 确保 dist 和 dist-electron 目录是干净的
const distPaths = [
  path.join(projectRoot, 'dist'),
  path.join(projectRoot, 'dist-electron'),
];

distPaths.forEach(p => {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`✅ 已清理构建目录: ${p}`);
  }
});

console.log('\n✅ 打包前清理完成！');
console.log('📦 现在可以安全地进行打包了。');
