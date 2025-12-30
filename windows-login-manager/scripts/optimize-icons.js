/**
 * 图标优化脚本 - 使用 sharp 库
 * 运行: node scripts/optimize-icons.js
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('❌ sharp 未安装');
  console.log('请运行: npm install --save-dev sharp');
  console.log('或者: cd windows-login-manager && npm install --save-dev sharp');
  process.exit(1);
}

const imagesDir = path.join(__dirname, '../public/images');
const backupDir = path.join(imagesDir, `backup-${Date.now()}`);

// 创建备份目录
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 获取文件大小（KB）
function getFileSizeKB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(1);
}

// 优化PNG图标
async function optimizePNG(filePath, targetQuality = 80) {
  const filename = path.basename(filePath);
  const backupPath = path.join(backupDir, filename);
  
  console.log(`📦 优化 ${filename}...`);
  
  // 备份原文件
  fs.copyFileSync(filePath, backupPath);
  
  const originalSize = getFileSizeKB(filePath);
  
  try {
    await sharp(filePath)
      .png({
        quality: targetQuality,
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true
      })
      .toFile(filePath + '.tmp');
    
    // 替换原文件
    fs.renameSync(filePath + '.tmp', filePath);
    
    const newSize = getFileSizeKB(filePath);
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    
    console.log(`   原始: ${originalSize}KB → 优化后: ${newSize}KB (减少 ${reduction}%)`);
    
    return { filename, originalSize, newSize, reduction };
  } catch (error) {
    console.error(`   ❌ 优化失败: ${error.message}`);
    // 恢复备份
    fs.copyFileSync(backupPath, filePath);
    return null;
  }
}

// 优化JPEG图标
async function optimizeJPEG(filePath, targetQuality = 80) {
  const filename = path.basename(filePath);
  const backupPath = path.join(backupDir, filename);
  
  console.log(`📦 优化 ${filename}...`);
  
  // 备份原文件
  fs.copyFileSync(filePath, backupPath);
  
  const originalSize = getFileSizeKB(filePath);
  
  try {
    await sharp(filePath)
      .jpeg({
        quality: targetQuality,
        progressive: true,
        mozjpeg: true
      })
      .toFile(filePath + '.tmp');
    
    // 替换原文件
    fs.renameSync(filePath + '.tmp', filePath);
    
    const newSize = getFileSizeKB(filePath);
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    
    console.log(`   原始: ${originalSize}KB → 优化后: ${newSize}KB (减少 ${reduction}%)`);
    
    return { filename, originalSize, newSize, reduction };
  } catch (error) {
    console.error(`   ❌ 优化失败: ${error.message}`);
    // 恢复备份
    fs.copyFileSync(backupPath, filePath);
    return null;
  }
}

// 主函数
async function main() {
  console.log('🎨 开始优化平台图标...\n');
  console.log(`📁 备份目录: ${backupDir}\n`);
  
  const results = [];
  
  // 需要优化的文件列表（> 40KB）
  const filesToOptimize = [
    { path: 'toutiaohao.png', quality: 75 },      // 252KB - 最需要优化
    { path: 'souhu.jpeg', quality: 75 },          // 57KB
    { path: 'gongzhonghao.png', quality: 80 },    // 52KB
    { path: 'xiaohongshu.png', quality: 80 }      // 44KB
  ];
  
  console.log('🔧 优化大文件...\n');
  
  for (const file of filesToOptimize) {
    const filePath = path.join(imagesDir, file.path);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${file.path}`);
      continue;
    }
    
    let result;
    if (file.path.endsWith('.png')) {
      result = await optimizePNG(filePath, file.quality);
    } else if (file.path.endsWith('.jpeg') || file.path.endsWith('.jpg')) {
      result = await optimizeJPEG(filePath, file.quality);
    }
    
    if (result) {
      results.push(result);
    }
    
    console.log('');
  }
  
  // 显示总结
  console.log('✅ 优化完成！\n');
  console.log('📊 优化统计:');
  
  if (results.length > 0) {
    const totalOriginal = results.reduce((sum, r) => sum + parseFloat(r.originalSize), 0);
    const totalNew = results.reduce((sum, r) => sum + parseFloat(r.newSize), 0);
    const totalReduction = ((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1);
    
    console.log(`   优化文件数: ${results.length}`);
    console.log(`   原始总大小: ${totalOriginal.toFixed(1)}KB`);
    console.log(`   优化后总大小: ${totalNew.toFixed(1)}KB`);
    console.log(`   总共减少: ${(totalOriginal - totalNew).toFixed(1)}KB (${totalReduction}%)`);
  }
  
  console.log(`   备份位置: ${backupDir}`);
  console.log('\n💡 提示:');
  console.log('   - 如果效果不满意，可以从备份目录恢复');
  console.log('   - 建议在浏览器中测试图标显示效果');
  console.log('   - 运行 "npm run dev" 查看效果');
}

// 运行
main().catch(console.error);
