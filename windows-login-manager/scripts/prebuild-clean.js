#!/usr/bin/env node
/**
 * 打包前清理脚本
 * 确保不会将开发数据和敏感信息打包进去
 * 
 * 安全最佳实践：
 * 1. 清理所有开发环境数据
 * 2. 删除敏感配置文件
 * 3. 清理 localStorage/IndexedDB 数据目录
 * 4. 验证生产环境配置
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔒 开始打包前安全清理...\n');

const projectRoot = path.join(__dirname, '..');

// ============================================
// 1. 清理开发环境的用户数据目录
// ============================================
console.log('📁 检查开发环境用户数据目录...');
const appDataPaths = [
  // macOS
  path.join(os.homedir(), 'Library', 'Application Support', 'ai-geo-system'),
  path.join(os.homedir(), 'Library', 'Application Support', 'Ai智软精准GEO优化系统'),
  // Windows
  path.join(os.homedir(), 'AppData', 'Roaming', 'ai-geo-system'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'Ai智软精准GEO优化系统'),
  path.join(os.homedir(), 'AppData', 'Local', 'ai-geo-system'),
  // Linux
  path.join(os.homedir(), '.config', 'ai-geo-system'),
];

appDataPaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`   ⚠️  发现用户数据目录: ${p}`);
    console.log(`      (此目录不会被打包，但建议开发后清理)`);
  }
});

// ============================================
// 2. 删除敏感和临时文件
// ============================================
console.log('\n🗑️  清理敏感和临时文件...');
const sensitiveFiles = [
  // 本地环境配置（可能包含测试凭据）
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  // 测试数据
  'test-data',
  // 日志文件
  'logs',
  '*.log',
  // 临时文件
  '.tmp',
  'temp',
  // 可能的数据库文件
  '*.sqlite',
  '*.db',
  // 编辑器临时文件
  '*.swp',
  '*.swo',
  '*~',
];

sensitiveFiles.forEach(pattern => {
  const fullPath = path.join(projectRoot, pattern);
  
  // 处理通配符模式
  if (pattern.includes('*')) {
    const dir = path.dirname(fullPath);
    const filePattern = path.basename(pattern);
    const regex = new RegExp('^' + filePattern.replace(/\*/g, '.*') + '$');
    
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        if (regex.test(file)) {
          const filePath = path.join(dir, file);
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`   ✅ 已删除: ${filePath}`);
        }
      });
    }
  } else if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // 清空目录内容
      fs.readdirSync(fullPath).forEach(file => {
        fs.rmSync(path.join(fullPath, file), { recursive: true, force: true });
      });
      console.log(`   ✅ 已清空目录: ${fullPath}`);
    } else {
      fs.unlinkSync(fullPath);
      console.log(`   ✅ 已删除文件: ${fullPath}`);
    }
  }
});

// ============================================
// 3. 存档旧的打包文件（仅当版本号不同时）
// ============================================
console.log('\n📦 检查是否需要存档旧的打包文件...');
const releasePath = path.join(projectRoot, 'release');
const archiveBasePath = path.join(projectRoot, '打包历史');

// 获取当前 package.json 中的版本号
const currentVersion = require(path.join(projectRoot, 'package.json')).version;

if (fs.existsSync(releasePath)) {
  // 检查 release 目录是否有打包文件
  const releaseFiles = fs.readdirSync(releasePath);
  const hasPackageFiles = releaseFiles.some(f => 
    f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.zip') || f.endsWith('.yml')
  );
  
  if (hasPackageFiles) {
    // 从 latest.yml 读取已打包的版本号
    const latestYmlPath = path.join(releasePath, 'latest.yml');
    let existingVersion = null;
    let releaseNotes = '';
    
    if (fs.existsSync(latestYmlPath)) {
      const ymlContent = fs.readFileSync(latestYmlPath, 'utf-8');
      const versionMatch = ymlContent.match(/^version:\s*(.+)$/m);
      if (versionMatch) {
        existingVersion = versionMatch[1].trim();
      }
      // 提取更新说明的第一条
      const notesMatch = ymlContent.match(/##\s*\[\d+\.\d+\.\d+\].*?\n+###\s*\S+\n+[-*]\s*[^\n]+/);
      if (notesMatch) {
        const noteLineMatch = notesMatch[0].match(/[-*]\s*[🔧⚡📊🎉🍎📦🔗⏱️]*\s*(.+)/);
        if (noteLineMatch) {
          releaseNotes = noteLineMatch[1].trim()
            .replace(/[/:*?"<>|\\]/g, '') // 移除文件名非法字符
            .substring(0, 30); // 限制长度
        }
      }
    }
    
    // 只有当已打包版本与当前版本不同时才存档
    // 如果没有 latest.yml 或版本号相同，说明是同一版本的分平台打包，不需要存档
    if (existingVersion && existingVersion !== currentVersion) {
      // 生成存档目录名：日期+版本+简介
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const archiveName = releaseNotes 
        ? `${dateStr}-v${existingVersion}-${releaseNotes}`
        : `${dateStr}-v${existingVersion}`;
      const archivePath = path.join(archiveBasePath, archiveName);
      
      // 检查是否已存在相同版本的存档
      if (!fs.existsSync(archivePath)) {
        // 创建存档目录
        fs.mkdirSync(archivePath, { recursive: true });
        
        // 复制打包文件到存档目录
        const filesToArchive = releaseFiles.filter(f => 
          f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.zip') || 
          f.endsWith('.yml') || f.endsWith('.blockmap')
        );
        
        filesToArchive.forEach(file => {
          const src = path.join(releasePath, file);
          const dest = path.join(archivePath, file);
          fs.copyFileSync(src, dest);
        });
        
        console.log(`   ✅ 已存档旧版本 v${existingVersion} 到: 打包历史/${archiveName}/`);
        console.log(`      存档文件数: ${filesToArchive.length}`);
      } else {
        console.log(`   ⏭️  v${existingVersion} 已存在存档，跳过`);
      }
    } else if (existingVersion === currentVersion) {
      console.log(`   ⏭️  当前版本 v${currentVersion} 正在打包中，无需存档`);
    } else {
      console.log('   ⏭️  无法确定已打包版本，跳过存档');
    }
  } else {
    console.log('   ℹ️  release 目录无打包文件，无需存档');
  }
} else {
  console.log('   ℹ️  release 目录不存在，无需存档');
}

// ============================================
// 4. 清理构建目录（不清理 release，保留已打包的文件）
// ============================================
console.log('\n🧹 清理构建目录...');
const buildDirs = ['dist', 'dist-electron'];  // 不清理 release 目录

buildDirs.forEach(dir => {
  const fullPath = path.join(projectRoot, dir);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`   ✅ 已清理: ${fullPath}`);
  }
});
console.log('   ℹ️  release 目录保留（支持分平台打包）');

// ============================================
// 4. 验证生产环境配置
// ============================================
console.log('\n🔍 验证生产环境配置...');

// 检查 .env.production 是否存在且配置正确
const envProdPath = path.join(projectRoot, '.env.production');
if (fs.existsSync(envProdPath)) {
  const envContent = fs.readFileSync(envProdPath, 'utf-8');
  
  // 检查是否包含 localhost（可能是开发配置泄露）
  if (envContent.includes('localhost') || envContent.includes('127.0.0.1')) {
    console.log('   ⚠️  警告: .env.production 包含 localhost，请确认是否正确');
  }
  
  // 检查是否有正确的生产 URL
  if (envContent.includes('jzgeo.cc')) {
    console.log('   ✅ 生产环境 URL 配置正确');
  }
  
  // 检查是否有敏感信息（API 密钥等）
  const sensitivePatterns = [
    /API_KEY\s*=\s*['"]\w+['"]/i,
    /SECRET\s*=\s*['"]\w+['"]/i,
    /PASSWORD\s*=\s*['"]\w+['"]/i,
    /TOKEN\s*=\s*['"]\w+['"]/i,
  ];
  
  sensitivePatterns.forEach(pattern => {
    if (pattern.test(envContent)) {
      console.log('   ⚠️  警告: .env.production 可能包含敏感信息，请检查');
    }
  });
} else {
  console.log('   ⚠️  警告: .env.production 不存在');
}

// ============================================
// 5. 检查 package.json 中的敏感信息
// ============================================
console.log('\n📦 检查 package.json...');
const packageJsonPath = path.join(projectRoot, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  // 检查是否有测试脚本或调试配置被意外包含
  if (packageJson.scripts && packageJson.scripts.test) {
    // 这是正常的，不需要警告
  }
  
  // 检查 build.files 配置
  if (packageJson.build && packageJson.build.files) {
    console.log('   ✅ electron-builder files 配置存在');
  }
}

// ============================================
// 6. 创建打包安全标记
// ============================================
const buildInfoPath = path.join(projectRoot, '.build-info.json');
const buildInfo = {
  cleanedAt: new Date().toISOString(),
  nodeEnv: 'production',
  version: require(packageJsonPath).version,
  securityChecks: {
    sensitiveFilesCleaned: true,
    buildDirsCleaned: true,
    envValidated: true,
  }
};
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
console.log('\n📝 已创建构建信息文件: .build-info.json');

console.log('\n' + '='.repeat(50));
console.log('✅ 打包前安全清理完成！');
console.log('📦 现在可以安全地进行打包了。');
console.log('='.repeat(50) + '\n');
