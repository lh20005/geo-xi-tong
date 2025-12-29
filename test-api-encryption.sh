#!/bin/bash

echo "=========================================="
echo "测试API密钥加密功能"
echo "=========================================="
echo ""

# 检查.env文件
if [ ! -f .env ]; then
  echo "❌ 未找到.env文件"
  exit 1
fi

# 检查API_KEY_ENCRYPTION_KEY
if ! grep -q "^API_KEY_ENCRYPTION_KEY=" .env; then
  echo "❌ .env文件中未找到API_KEY_ENCRYPTION_KEY"
  echo ""
  echo "请在.env文件中添加："
  echo "API_KEY_ENCRYPTION_KEY=9dd3d46d9016666e7140827a261fb805b000e2c92f4d00d3176fef94e041fe5f"
  exit 1
fi

# 检查是否是默认值
if grep -q "^API_KEY_ENCRYPTION_KEY=请使用强随机字符串" .env; then
  echo "⚠️  检测到默认的加密密钥，正在更新..."
  
  # macOS和Linux兼容的sed命令
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=9dd3d46d9016666e7140827a261fb805b000e2c92f4d00d3176fef94e041fe5f|" .env
  else
    sed -i "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=9dd3d46d9016666e7140827a261fb805b000e2c92f4d00d3176fef94e041fe5f|" .env
  fi
  
  echo "✅ 加密密钥已更新"
else
  echo "✅ API_KEY_ENCRYPTION_KEY 已配置"
fi

echo ""
echo "=========================================="
echo "测试加密服务"
echo "=========================================="
echo ""

# 创建测试脚本
cat > /tmp/test-encryption.js << 'EOF'
require('dotenv').config();
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('API_KEY_ENCRYPTION_KEY not set');
    }
    this.algorithm = 'aes-256-cbc';
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    this.ivLength = 16;
  }

  encrypt(text) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

try {
  const service = new EncryptionService();
  
  // 测试加密和解密
  const testKey = 'sk-test1234567890abcdef';
  console.log('原始密钥:', testKey);
  
  const encrypted = service.encrypt(testKey);
  console.log('加密后:', encrypted.substring(0, 50) + '...');
  
  const decrypted = service.decrypt(encrypted);
  console.log('解密后:', decrypted);
  
  if (testKey === decrypted) {
    console.log('\n✅ 加密/解密测试通过！');
    process.exit(0);
  } else {
    console.log('\n❌ 加密/解密测试失败！');
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ 测试失败:', error.message);
  process.exit(1);
}
EOF

# 运行测试
node /tmp/test-encryption.js

if [ $? -eq 0 ]; then
  echo ""
  echo "=========================================="
  echo "✅ 所有测试通过！"
  echo "=========================================="
  echo ""
  echo "下一步："
  echo "1. 重启服务器: npm run dev"
  echo "2. 使用管理员账号登录"
  echo "3. 进入【系统配置】页面"
  echo "4. 配置DeepSeek API密钥"
  echo "5. 保存后查看控制台是否显示'密钥已加密存储'"
  echo ""
else
  echo ""
  echo "=========================================="
  echo "❌ 测试失败"
  echo "=========================================="
  echo ""
  echo "请检查："
  echo "1. .env文件中的API_KEY_ENCRYPTION_KEY是否正确"
  echo "2. Node.js版本是否支持crypto模块"
  echo ""
fi

# 清理临时文件
rm -f /tmp/test-encryption.js
