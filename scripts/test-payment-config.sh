#!/bin/bash

# 测试微信支付配置脚本
# 使用方法: ./scripts/test-payment-config.sh

echo "🧪 测试微信支付配置..."
echo ""

# 1. 验证安全配置
echo "1️⃣ 验证安全配置..."
npm run security:verify
SECURITY_EXIT_CODE=$?

if [ $SECURITY_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ 安全验证失败，请先修复配置问题"
  exit 1
fi

echo ""
echo "2️⃣ 检查服务器状态..."

# 检查服务器是否运行
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ 服务器正在运行"
else
  echo "⚠️  服务器未运行，正在启动..."
  echo "   请在另一个终端运行: npm run server:dev"
  exit 1
fi

echo ""
echo "3️⃣ 测试环境变量读取..."

# 使用 Node.js 测试环境变量（从 server/.env 读取）
cd server && node -e "
const fs = require('fs');
const path = require('path');

// 手动解析 .env 文件
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const requiredVars = [
  'WECHAT_PAY_APP_ID',
  'WECHAT_PAY_MCH_ID',
  'WECHAT_PAY_API_V3_KEY',
  'WECHAT_PAY_SERIAL_NO',
  'WECHAT_PAY_PRIVATE_KEY_PATH',
  'WECHAT_PAY_PUBLIC_KEY_PATH',
  'WECHAT_PAY_PUBLIC_KEY_ID',
  'WECHAT_PAY_NOTIFY_URL'
];

let allPresent = true;
requiredVars.forEach(varName => {
  if (env[varName]) {
    console.log('✅', varName, '已配置');
  } else {
    console.log('❌', varName, '未配置');
    allPresent = false;
  }
});

process.exit(allPresent ? 0 : 1);
" && cd ..

ENV_EXIT_CODE=$?

if [ $ENV_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ 环境变量配置不完整"
  exit 1
fi

echo ""
echo "4️⃣ 测试文件访问..."

# 测试证书文件
cd server && node -e "
const fs = require('fs');
const path = require('path');

// 手动解析 .env 文件
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const privateKeyPath = env.WECHAT_PAY_PRIVATE_KEY_PATH;
const publicKeyPath = env.WECHAT_PAY_PUBLIC_KEY_PATH;

if (fs.existsSync(privateKeyPath)) {
  console.log('✅ 私钥文件存在:', privateKeyPath);
} else {
  console.log('❌ 私钥文件不存在:', privateKeyPath);
  process.exit(1);
}

if (fs.existsSync(publicKeyPath)) {
  console.log('✅ 公钥文件存在:', publicKeyPath);
} else {
  console.log('❌ 公钥文件不存在:', publicKeyPath);
  process.exit(1);
}
" && cd ..

FILE_EXIT_CODE=$?

if [ $FILE_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ 证书文件访问失败"
  exit 1
fi

echo ""
echo "5️⃣ 测试 API 端点..."

# 测试健康检查
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if [ $? -eq 0 ]; then
  echo "✅ 健康检查: $HEALTH_RESPONSE"
else
  echo "❌ 健康检查失败"
  exit 1
fi

echo ""
echo "============================================================"
echo "🎉 所有测试通过！微信支付配置正确"
echo "============================================================"
echo ""
echo "📝 下一步："
echo "   1. 登录系统获取 token"
echo "   2. 测试创建订单: ./test-payment-now.sh"
echo "   3. 使用微信扫码支付"
echo ""
echo "🔗 测试地址："
echo "   - Landing: https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev"
echo "   - API: https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api"
echo ""
