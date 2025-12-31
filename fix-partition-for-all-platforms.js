#!/usr/bin/env node

const fs = require('fs');

// 需要修复的平台列表
const platforms = [
  'bilibili',
  'csdn',
  'douyin',
  'qie',
  'toutiao',
  'wangyi',
  'xiaohongshu',
  'zhihu',
  'baijiahao',
  'jianshu',
  'wechat'
];

console.log('🔧 修复所有平台的 partition 配置...\n');

platforms.forEach(platform => {
  const filePath = `windows-login-manager/electron/login/${platform}-login-manager.ts`;
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${platform}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 替换临时 partition 为持久化 partition
  const oldPattern = /\/\/ 使用临时 partition，确保每次登录都是全新的会话\s+this\.currentPartition = `temp-login-\$\{this\.PLATFORM_ID\}-\$\{Date\.now\(\)\}`;/g;
  const newCode = `// 使用持久化 partition，确保 Cookie 可以在测试登录时使用
    this.currentPartition = \`persist:\${this.PLATFORM_ID}\`;`;
  
  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newCode);
    modified = true;
  }
  
  // 更新日志信息
  content = content.replace(
    /log\.info\(`\[.*?\] 使用临时 partition: \$\{this\.currentPartition\}`\);/g,
    (match) => {
      const platformName = match.match(/\[(.*?)\]/)[1];
      return `log.info(\`[${platformName}] 使用持久化 partition: \${this.currentPartition}\`);`;
    }
  );
  
  if (modified || content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已修复: ${platform}`);
  } else {
    console.log(`⚠️  未检测到需要修改的模式: ${platform}`);
  }
});

console.log('\n✨ 批量修复完成！');
console.log('\n📝 说明：');
console.log('   - 旧方案：使用临时 partition (temp-login-xxx)');
console.log('   - 新方案：使用持久化 partition (persist:xxx)');
console.log('   - 效果：测试登录时可以使用保存的 Cookie');
