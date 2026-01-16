#!/usr/bin/env node

/**
 * 文章生成功能快速诊断脚本
 * 
 * 使用方法：
 * node quick-diagnose.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// 检查环境变量配置
function checkEnvConfig() {
  logSection('1. 检查环境变量配置');
  
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env 文件不存在', 'red');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  const config = {};
  lines.forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      config[match[1].trim()] = match[2].trim();
    }
  });
  
  log('✅ .env 文件存在', 'green');
  log(`   API URL: ${config.VITE_API_BASE_URL || '未配置'}`, 'blue');
  log(`   WS URL: ${config.VITE_WS_BASE_URL || '未配置'}`, 'blue');
  
  if (!config.VITE_API_BASE_URL) {
    log('⚠️  VITE_API_BASE_URL 未配置', 'yellow');
    return false;
  }
  
  return config.VITE_API_BASE_URL;
}

// 检查服务器连接
function checkServerConnection(apiUrl) {
  return new Promise((resolve) => {
    logSection('2. 检查服务器连接');
    
    const url = `${apiUrl}/api/health`;
    log(`正在测试连接: ${url}`, 'blue');
    
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'GET',
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('✅ 服务器连接正常', 'green');
          log(`   状态码: ${res.statusCode}`, 'blue');
          try {
            const json = JSON.parse(data);
            log(`   响应: ${JSON.stringify(json)}`, 'blue');
          } catch (e) {
            log(`   响应: ${data}`, 'blue');
          }
          resolve(true);
        } else {
          log(`⚠️  服务器响应异常: ${res.statusCode}`, 'yellow');
          log(`   响应: ${data}`, 'blue');
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      log(`❌ 服务器连接失败: ${error.message}`, 'red');
      resolve(false);
    });
    
    req.on('timeout', () => {
      log('❌ 服务器连接超时', 'red');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// 检查关键文件
function checkKeyFiles() {
  logSection('3. 检查关键文件');
  
  const files = [
    'src/pages/ArticleGenerationPage.tsx',
    'src/components/TaskConfigModal.tsx',
    'src/api/articleGenerationApi.ts',
    'src/api/client.ts',
    'src/config/env.ts'
  ];
  
  let allExist = true;
  
  files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      log(`✅ ${file}`, 'green');
    } else {
      log(`❌ ${file} 不存在`, 'red');
      allExist = false;
    }
  });
  
  return allExist;
}

// 检查 package.json 依赖
function checkDependencies() {
  logSection('4. 检查依赖包');
  
  const packagePath = path.join(__dirname, 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    log('❌ package.json 不存在', 'red');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = [
    'axios',
    'antd',
    'react',
    'react-dom'
  ];
  
  let allInstalled = true;
  
  requiredDeps.forEach(dep => {
    if (dependencies[dep]) {
      log(`✅ ${dep}: ${dependencies[dep]}`, 'green');
    } else {
      log(`❌ ${dep} 未安装`, 'red');
      allInstalled = false;
    }
  });
  
  // 检查 node_modules
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    log('✅ node_modules 目录存在', 'green');
  } else {
    log('❌ node_modules 目录不存在，请运行 npm install', 'red');
    allInstalled = false;
  }
  
  return allInstalled;
}

// 生成诊断报告
function generateReport(results) {
  logSection('诊断报告');
  
  const { envConfig, serverConnection, keyFiles, dependencies } = results;
  
  log('\n总结:', 'cyan');
  log(`  环境配置: ${envConfig ? '✅ 正常' : '❌ 异常'}`, envConfig ? 'green' : 'red');
  log(`  服务器连接: ${serverConnection ? '✅ 正常' : '❌ 异常'}`, serverConnection ? 'green' : 'red');
  log(`  关键文件: ${keyFiles ? '✅ 完整' : '❌ 缺失'}`, keyFiles ? 'green' : 'red');
  log(`  依赖包: ${dependencies ? '✅ 完整' : '❌ 缺失'}`, dependencies ? 'green' : 'red');
  
  const allGood = envConfig && serverConnection && keyFiles && dependencies;
  
  if (allGood) {
    log('\n✅ 所有检查通过！', 'green');
    log('\n如果文章生成仍然无反馈，请：', 'yellow');
    log('  1. 打开浏览器开发者工具（Ctrl+Shift+I）', 'blue');
    log('  2. 查看 Console 标签页的错误日志', 'blue');
    log('  3. 查看 Network 标签页的请求详情', 'blue');
    log('  4. 参考 diagnose-article-generation.md 文档', 'blue');
  } else {
    log('\n❌ 发现问题，请根据上述检查结果修复', 'red');
    
    if (!envConfig) {
      log('\n修复建议 - 环境配置:', 'yellow');
      log('  1. 确保 .env 文件存在', 'blue');
      log('  2. 配置 VITE_API_BASE_URL=https://jzgeo.cc', 'blue');
      log('  3. 配置 VITE_WS_BASE_URL=wss://jzgeo.cc/ws', 'blue');
    }
    
    if (!serverConnection) {
      log('\n修复建议 - 服务器连接:', 'yellow');
      log('  1. 检查网络连接', 'blue');
      log('  2. 确认服务器地址正确', 'blue');
      log('  3. 检查防火墙/代理设置', 'blue');
      log('  4. 联系服务器管理员', 'blue');
    }
    
    if (!keyFiles) {
      log('\n修复建议 - 关键文件:', 'yellow');
      log('  1. 确保代码完整', 'blue');
      log('  2. 重新克隆代码仓库', 'blue');
    }
    
    if (!dependencies) {
      log('\n修复建议 - 依赖包:', 'yellow');
      log('  1. 运行 npm install', 'blue');
      log('  2. 删除 node_modules 后重新安装', 'blue');
    }
  }
  
  log('\n详细诊断文档: diagnose-article-generation.md', 'cyan');
}

// 主函数
async function main() {
  log('文章生成功能快速诊断工具', 'cyan');
  log('================================\n', 'cyan');
  
  const results = {
    envConfig: false,
    serverConnection: false,
    keyFiles: false,
    dependencies: false
  };
  
  // 1. 检查环境配置
  const apiUrl = checkEnvConfig();
  results.envConfig = !!apiUrl;
  
  // 2. 检查服务器连接
  if (apiUrl) {
    results.serverConnection = await checkServerConnection(apiUrl);
  }
  
  // 3. 检查关键文件
  results.keyFiles = checkKeyFiles();
  
  // 4. 检查依赖
  results.dependencies = checkDependencies();
  
  // 5. 生成报告
  generateReport(results);
}

// 运行诊断
main().catch(error => {
  log(`\n❌ 诊断过程出错: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
