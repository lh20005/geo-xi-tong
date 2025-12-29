#!/usr/bin/env node

/**
 * 微信支付安全配置验证工具
 * 用于检查环境变量配置是否完整和安全
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvFile() {
  const envPath = path.join(__dirname, '../server/.env');
  
  if (!fs.existsSync(envPath)) {
    log('❌ 错误: server/.env 文件不存在', 'red');
    log('   请复制 .env.example 并填写配置', 'yellow');
    return false;
  }
  
  log('✅ server/.env 文件存在', 'green');
  return true;
}

function loadEnv() {
  const envPath = path.join(__dirname, '../server/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  });
  
  return env;
}

function validateConfig(env) {
  log('\n🔍 开始验证微信支付配置...', 'cyan');
  
  const requiredFields = [
    { key: 'WECHAT_PAY_APP_ID', name: 'AppID', pattern: /^wx[a-z0-9]{16}$/ },
    { key: 'WECHAT_PAY_MCH_ID', name: '商户号', pattern: /^\d{10}$/ },
    { key: 'WECHAT_PAY_API_V3_KEY', name: 'APIv3密钥', minLength: 32, maxLength: 32 },
    { key: 'WECHAT_PAY_SERIAL_NO', name: '证书序列号', pattern: /^[A-F0-9]{40}$/ },
    { key: 'WECHAT_PAY_PRIVATE_KEY_PATH', name: '私钥文件路径', isPath: true },
    { key: 'WECHAT_PAY_PUBLIC_KEY_PATH', name: '公钥文件路径', isPath: true },
    { key: 'WECHAT_PAY_PUBLIC_KEY_ID', name: '公钥ID', pattern: /^PUB_KEY_ID_/ },
    { key: 'WECHAT_PAY_NOTIFY_URL', name: '回调地址', pattern: /^https:\/\// },
  ];
  
  let allValid = true;
  let warnings = [];
  
  requiredFields.forEach(field => {
    const value = env[field.key];
    
    // 检查是否存在
    if (!value) {
      log(`❌ ${field.name} (${field.key}): 未配置`, 'red');
      allValid = false;
      return;
    }
    
    // 检查是否是占位符
    if (value.includes('your_') || value.includes('here') || value.includes('example')) {
      log(`⚠️  ${field.name} (${field.key}): 使用了占位符，请填写真实值`, 'yellow');
      warnings.push(field.name);
      return;
    }
    
    // 检查格式
    if (field.pattern && !field.pattern.test(value)) {
      log(`❌ ${field.name} (${field.key}): 格式不正确`, 'red');
      allValid = false;
      return;
    }
    
    // 检查长度
    if (field.minLength && value.length < field.minLength) {
      log(`❌ ${field.name} (${field.key}): 长度不足 (需要至少 ${field.minLength} 个字符)`, 'red');
      allValid = false;
      return;
    }
    
    if (field.maxLength && value.length > field.maxLength) {
      log(`❌ ${field.name} (${field.key}): 长度过长 (最多 ${field.maxLength} 个字符)`, 'red');
      allValid = false;
      return;
    }
    
    // 检查文件路径
    if (field.isPath) {
      if (!fs.existsSync(value)) {
        log(`❌ ${field.name} (${field.key}): 文件不存在 - ${value}`, 'red');
        allValid = false;
        return;
      }
      
      // 检查文件权限
      try {
        const stats = fs.statSync(value);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        if (mode !== '600' && mode !== '400') {
          log(`⚠️  ${field.name}: 文件权限不安全 (${mode})，建议设置为 600`, 'yellow');
          warnings.push(`${field.name}权限`);
        }
      } catch (error) {
        // 忽略权限检查错误
      }
    }
    
    log(`✅ ${field.name}: 配置正确`, 'green');
  });
  
  return { allValid, warnings };
}

function checkGitignore() {
  log('\n🔍 检查 .gitignore 配置...', 'cyan');
  
  const gitignorePath = path.join(__dirname, '../.gitignore');
  
  if (!fs.existsSync(gitignorePath)) {
    log('❌ .gitignore 文件不存在', 'red');
    return false;
  }
  
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const requiredPatterns = ['.env', '*.pem', '*.key'];
  let allFound = true;
  
  requiredPatterns.forEach(pattern => {
    if (content.includes(pattern)) {
      log(`✅ ${pattern} 已排除`, 'green');
    } else {
      log(`❌ ${pattern} 未排除`, 'red');
      allFound = false;
    }
  });
  
  return allFound;
}

function checkDocuments() {
  log('\n🔍 检查文档中的敏感信息...', 'cyan');
  
  const sensitivePatterns = [
    { pattern: 'wx76c24846b57dfaa9', name: '真实 AppID' },
    { pattern: '1103960104', name: '真实商户号' },
    { pattern: '3453DGDsdf3gsd564DSFDSR2N67N8Lfs', name: '真实 APIv3密钥' },
  ];
  
  const excludeFiles = ['微信支付安全审计报告.md', '✅安全修复完成.md'];
  const mdFiles = fs.readdirSync(__dirname + '/..')
    .filter(f => f.endsWith('.md') && !excludeFiles.includes(f));
  
  let foundSensitive = false;
  
  sensitivePatterns.forEach(({ pattern, name }) => {
    mdFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(pattern)) {
        log(`⚠️  ${file} 包含 ${name}`, 'yellow');
        foundSensitive = true;
      }
    });
  });
  
  if (!foundSensitive) {
    log('✅ 未在文档中发现敏感信息', 'green');
  }
  
  return !foundSensitive;
}

function generateReport(results) {
  log('\n' + '='.repeat(60), 'blue');
  log('📊 安全验证报告', 'cyan');
  log('='.repeat(60), 'blue');
  
  if (results.configValid && results.gitignoreValid && results.docsClean) {
    log('\n🎉 恭喜！所有安全检查都通过了！', 'green');
    
    if (results.warnings.length > 0) {
      log('\n⚠️  警告事项:', 'yellow');
      results.warnings.forEach(w => log(`   - ${w}`, 'yellow'));
    }
    
    log('\n✅ 你的微信支付配置是安全的', 'green');
  } else {
    log('\n❌ 发现安全问题，请修复后再部署', 'red');
    
    if (!results.configValid) {
      log('   - 环境变量配置不完整或不正确', 'red');
    }
    if (!results.gitignoreValid) {
      log('   - .gitignore 配置不完整', 'red');
    }
    if (!results.docsClean) {
      log('   - 文档中包含敏感信息', 'red');
    }
  }
  
  log('\n' + '='.repeat(60), 'blue');
}

// 主函数
function main() {
  log('🔒 微信支付安全配置验证工具', 'cyan');
  log('='.repeat(60), 'blue');
  
  // 检查 .env 文件
  if (!checkEnvFile()) {
    process.exit(1);
  }
  
  // 加载环境变量
  const env = loadEnv();
  
  // 验证配置
  const { allValid, warnings } = validateConfig(env);
  
  // 检查 .gitignore
  const gitignoreValid = checkGitignore();
  
  // 检查文档
  const docsClean = checkDocuments();
  
  // 生成报告
  generateReport({
    configValid: allValid,
    gitignoreValid,
    docsClean,
    warnings,
  });
  
  // 退出码
  process.exit(allValid && gitignoreValid ? 0 : 1);
}

main();
