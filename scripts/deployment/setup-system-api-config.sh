#!/bin/bash

echo "=========================================="
echo "系统级API配置设置向导"
echo "=========================================="
echo ""

# 检查.env文件是否存在
if [ ! -f .env ]; then
  echo "❌ 未找到.env文件，请先创建.env文件"
  echo "提示：可以复制.env.example文件："
  echo "  cp .env.example .env"
  exit 1
fi

# 检查API_KEY_ENCRYPTION_KEY是否已配置
if grep -q "^API_KEY_ENCRYPTION_KEY=请使用强随机字符串" .env || ! grep -q "^API_KEY_ENCRYPTION_KEY=" .env; then
  echo "📝 生成API密钥加密密钥..."
  ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  
  # 更新或添加API_KEY_ENCRYPTION_KEY
  if grep -q "^API_KEY_ENCRYPTION_KEY=" .env; then
    # macOS和Linux兼容的sed命令
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
    else
      sed -i "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
    fi
  else
    echo "" >> .env
    echo "API_KEY_ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
  fi
  
  echo "✅ API密钥加密密钥已生成并保存到.env文件"
else
  echo "✅ API密钥加密密钥已配置"
fi

echo ""
echo "📊 执行数据库迁移..."
node server/src/db/migrate-system-api-config.js

if [ $? -eq 0 ]; then
  echo ""
  echo "=========================================="
  echo "✅ 系统级API配置设置完成！"
  echo "=========================================="
  echo ""
  echo "下一步操作："
  echo "1. 重启服务器"
  echo "2. 使用管理员账号登录"
  echo "3. 进入【系统设置】->【AI配置】"
  echo "4. 配置DeepSeek或其他AI服务的API密钥"
  echo "5. 测试AI功能"
  echo ""
  echo "注意事项："
  echo "- API密钥将被加密存储在数据库中"
  echo "- 所有用户将共享系统级API配置"
  echo "- 可以通过配额系统控制每个租户的使用量"
  echo ""
else
  echo ""
  echo "❌ 设置失败，请检查错误信息"
  exit 1
fi
