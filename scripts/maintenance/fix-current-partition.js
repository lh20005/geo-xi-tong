#!/usr/bin/env node

const fs = require('fs');

// 需要修复的平台
const platforms = ['jianshu', 'wechat'];

console.log('🔧 修复 currentPartition 设置...\n');

platforms.forEach(platform => {
  const filePath = `windows-login-manager/electron/login/${platform}-login-manager.ts`;
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${platform}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 查找 createWebView 方法并添加 currentPartition 设置
  const pattern = /(private async createWebView\(\): Promise<void> \{\s+)(await webViewManager\.createWebView)/;
  
  if (pattern.test(content)) {
    content = content.replace(
      pattern,
      `$1// 使用持久化 partition
    this.currentPartition = \`persist:\${this.PLATFORM_ID}\`;
    
    $2`
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已修复: ${platform}`);
  } else {
    console.log(`⚠️  未找到匹配模式: ${platform}`);
  }
});

console.log('\n✨ 修复完成！');
