#!/usr/bin/env node
/**
 * 打包后处理脚本
 * 自动生成 latest 目录，用于营销页面的固定下载链接
 */

const fs = require('fs');
const path = require('path');

console.log('\n📦 开始生成 latest 目录...\n');

const projectRoot = path.join(__dirname, '..');
const releasePath = path.join(projectRoot, 'release');
const latestPath = path.join(releasePath, 'latest');

// 从 package.json 读取版本号
const packageJson = require(path.join(projectRoot, 'package.json'));
const version = packageJson.version;

console.log(`   当前版本: ${version}`);

// 定义文件映射
const fileMapping = [
  {
    source: `Ai智软精准GEO优化系统 Setup ${version}.exe`,
    target: 'GEO优化系统-Windows.exe',
    platform: 'Windows'
  },
  {
    source: `Ai智软精准GEO优化系统-${version}.dmg`,
    target: 'GEO优化系统-Mac-Intel.dmg',
    platform: 'macOS Intel'
  },
  {
    source: `Ai智软精准GEO优化系统-${version}-arm64.dmg`,
    target: 'GEO优化系统-Mac-Apple.dmg',
    platform: 'macOS Apple Silicon'
  }
];

// 创建 latest 目录
if (!fs.existsSync(latestPath)) {
  fs.mkdirSync(latestPath, { recursive: true });
}

// 复制并重命名文件
let successCount = 0;
fileMapping.forEach(({ source, target, platform }) => {
  const sourcePath = path.join(releasePath, source);
  const targetPath = path.join(latestPath, target);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`   ✅ ${platform}: ${target}`);
    successCount++;
  } else {
    console.log(`   ⚠️  ${platform}: 源文件不存在 - ${source}`);
  }
});

console.log('\n' + '='.repeat(50));
if (successCount === fileMapping.length) {
  console.log('✅ latest 目录生成完成！');
  console.log('📁 位置: release/latest/');
  console.log('🚀 上传到 COS 的 /releases/latest/ 目录即可');
} else {
  console.log(`⚠️  部分文件未生成 (${successCount}/${fileMapping.length})`);
}
console.log('='.repeat(50) + '\n');
