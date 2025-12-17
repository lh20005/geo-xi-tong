#!/bin/bash

echo "=========================================="
echo "发布系统快速修复"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查环境
echo "1️⃣  检查环境..."
echo ""

if [ ! -f ".env" ]; then
  echo -e "${RED}❌ .env 文件不存在${NC}"
  echo "请创建 .env 文件并配置 DATABASE_URL"
  exit 1
fi

source .env

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL 未配置${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 环境配置正常${NC}"
echo ""

# 2. 运行数据库迁移
echo "=========================================="
echo "2️⃣  运行数据库迁移"
echo "=========================================="
echo ""

echo "正在检查数据库表..."
TABLES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('platform_accounts', 'publishing_tasks', 'publishing_logs', 'platforms_config');")

if [ "$TABLES" -lt 4 ]; then
  echo -e "${YELLOW}⚠️  数据库表不完整，运行迁移...${NC}"
  echo ""
  
  psql "$DATABASE_URL" -f server/src/db/migrations/006_add_publishing_system.sql
  
  if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 迁移成功${NC}"
  else
    echo ""
    echo -e "${RED}❌ 迁移失败${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✅ 数据库表已存在${NC}"
fi

echo ""

# 3. 检查平台配置
echo "=========================================="
echo "3️⃣  检查平台配置"
echo "=========================================="
echo ""

PLATFORM_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM platforms_config;")

if [ "$PLATFORM_COUNT" -lt 12 ]; then
  echo -e "${YELLOW}⚠️  平台配置不完整（$PLATFORM_COUNT/12）${NC}"
  echo "重新插入平台配置..."
  
  psql "$DATABASE_URL" <<EOF
INSERT INTO platforms_config (platform_id, platform_name, icon_url, adapter_class, required_fields) VALUES
('wangyi', '网易号', '/icons/wangyi.png', 'WangyiAdapter', '["username", "password"]'),
('souhu', '搜狐号', '/icons/souhu.png', 'SouhuAdapter', '["username", "password"]'),
('baijiahao', '百家号', '/icons/baijiahao.png', 'BaijiahaoAdapter', '["username", "password"]'),
('toutiao', '头条号', '/icons/toutiao.png', 'ToutiaoAdapter', '["username", "password"]'),
('qie', '企鹅号', '/icons/qie.png', 'QieAdapter', '["username", "password"]'),
('wechat', '微信公众号', '/icons/wechat.png', 'WechatAdapter', '[]'),
('xiaohongshu', '小红书', '/icons/xiaohongshu.png', 'XiaohongshuAdapter', '["username", "password"]'),
('douyin', '抖音号', '/icons/douyin.png', 'DouyinAdapter', '["username", "password"]'),
('bilibili', '哔哩哔哩', '/icons/bilibili.png', 'BilibiliAdapter', '["username", "password"]'),
('zhihu', '知乎', '/icons/zhihu.png', 'ZhihuAdapter', '["username", "password"]'),
('jianshu', '简书', '/icons/jianshu.png', 'JianshuAdapter', '["username", "password"]'),
('csdn', 'CSDN', '/icons/csdn.png', 'CSDNAdapter', '["username", "password"]')
ON CONFLICT (platform_id) DO NOTHING;
EOF
  
  echo -e "${GREEN}✅ 平台配置已更新${NC}"
else
  echo -e "${GREEN}✅ 平台配置完整（$PLATFORM_COUNT/12）${NC}"
fi

echo ""

# 4. 检查 Puppeteer
echo "=========================================="
echo "4️⃣  检查 Puppeteer"
echo "=========================================="
echo ""

cd server

if [ ! -d "node_modules/puppeteer" ]; then
  echo -e "${YELLOW}⚠️  Puppeteer 未安装${NC}"
  echo "正在安装 Puppeteer..."
  npm install puppeteer
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Puppeteer 安装成功${NC}"
  else
    echo -e "${RED}❌ Puppeteer 安装失败${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✅ Puppeteer 已安装${NC}"
fi

cd ..
echo ""

# 5. 测试服务器
echo "=========================================="
echo "5️⃣  测试服务器"
echo "=========================================="
echo ""

HEALTH=$(curl -s http://localhost:3001/api/health 2>/dev/null)

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ 服务器运行正常${NC}"
  echo "$HEALTH" | jq '.'
else
  echo -e "${YELLOW}⚠️  服务器未运行${NC}"
  echo ""
  echo "请在另一个终端运行:"
  echo "  cd server && npm run dev"
fi

echo ""

# 6. 总结
echo "=========================================="
echo "修复完成"
echo "=========================================="
echo ""

ACCOUNT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM platform_accounts;")

if [ "$ACCOUNT_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}📝 下一步操作：${NC}"
  echo ""
  echo "1. 确保服务器正在运行:"
  echo "   cd server && npm run dev"
  echo ""
  echo "2. 打开应用并绑定平台账号:"
  echo "   - 进入'平台登录'页面"
  echo "   - 选择平台"
  echo "   - 点击'浏览器登录'"
  echo ""
  echo "3. 创建发布任务:"
  echo "   - 进入'文章管理'页面"
  echo "   - 点击'发布到平台'"
  echo ""
else
  echo -e "${GREEN}✅ 系统已就绪！${NC}"
  echo ""
  echo "已绑定 $ACCOUNT_COUNT 个平台账号"
  echo ""
  echo "现在可以创建发布任务了！"
  echo ""
fi

echo "如果仍有问题，请运行诊断脚本:"
echo "  ./diagnose-publishing-issue.sh"
echo ""
