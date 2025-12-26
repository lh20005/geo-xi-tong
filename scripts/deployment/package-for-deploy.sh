#!/bin/bash

# 打包部署文件脚本
# 用于将编译后的文件打包成 tar.gz 格式

set -e

echo "======================================"
echo "   GEO 系统 - 打包部署文件"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 创建打包目录
PACKAGE_DIR="deploy-packages"
mkdir -p $PACKAGE_DIR

# 记录开始时间
START_TIME=$(date +%s)

# 1. 检查编译输出是否存在
echo -e "${BLUE}🔍 检查编译输出...${NC}"

if [ ! -d "client/dist" ]; then
    echo -e "${RED}❌ client/dist/ 不存在，请先运行编译${NC}"
    echo "   运行: npm run build 或 ./scripts/deployment/build-all.sh"
    exit 1
fi

if [ ! -d "server/dist" ]; then
    echo -e "${RED}❌ server/dist/ 不存在，请先运行编译${NC}"
    echo "   运行: npm run build 或 ./scripts/deployment/build-all.sh"
    exit 1
fi

if [ ! -d "landing/dist" ]; then
    echo -e "${RED}❌ landing/dist/ 不存在，请先运行编译${NC}"
    echo "   运行: npm run build 或 ./scripts/deployment/build-all.sh"
    exit 1
fi

echo -e "${GREEN}✅ 所有编译输出都存在${NC}"
echo ""

# 2. 打包前端
echo -e "${BLUE}📦 [1/5] 打包前端应用...${NC}"
cd client
tar -czf ../$PACKAGE_DIR/client-dist.tar.gz dist package.json
cd ..
CLIENT_SIZE=$(du -sh $PACKAGE_DIR/client-dist.tar.gz | cut -f1)
echo -e "${GREEN}✅ 前端打包完成 ($CLIENT_SIZE)${NC}"
echo ""

# 3. 打包后端
echo -e "${BLUE}📦 [2/5] 打包后端应用...${NC}"
cd server
tar -czf ../$PACKAGE_DIR/server-dist.tar.gz dist package.json package-lock.json
cd ..
SERVER_SIZE=$(du -sh $PACKAGE_DIR/server-dist.tar.gz | cut -f1)
echo -e "${GREEN}✅ 后端打包完成 ($SERVER_SIZE)${NC}"
echo ""

# 4. 打包营销网站
echo -e "${BLUE}📦 [3/5] 打包营销网站...${NC}"
cd landing
tar -czf ../$PACKAGE_DIR/landing-dist.tar.gz dist package.json
cd ..
LANDING_SIZE=$(du -sh $PACKAGE_DIR/landing-dist.tar.gz | cut -f1)
echo -e "${GREEN}✅ 营销网站打包完成 ($LANDING_SIZE)${NC}"
echo ""

# 5. 打包配置文件
echo -e "${BLUE}📦 [4/5] 打包配置文件...${NC}"
tar -czf $PACKAGE_DIR/config.tar.gz config/
CONFIG_SIZE=$(du -sh $PACKAGE_DIR/config.tar.gz | cut -f1)
echo -e "${GREEN}✅ 配置文件打包完成 ($CONFIG_SIZE)${NC}"
echo ""

# 6. 复制环境变量示例
echo -e "${BLUE}📦 [5/5] 复制环境变量示例...${NC}"
cp .env.example $PACKAGE_DIR/
echo -e "${GREEN}✅ 环境变量示例已复制${NC}"
echo ""

# 计算总耗时
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 显示总结
echo "======================================"
echo -e "${GREEN}   ✅ 打包完成！${NC}"
echo "======================================"
echo ""
echo "📦 打包文件："
echo "  - client-dist.tar.gz ($CLIENT_SIZE)"
echo "  - server-dist.tar.gz ($SERVER_SIZE)"
echo "  - landing-dist.tar.gz ($LANDING_SIZE)"
echo "  - config.tar.gz ($CONFIG_SIZE)"
echo "  - .env.example"
echo ""
echo "📁 打包目录: $PACKAGE_DIR/"
echo "⏱️  总耗时: ${DURATION}秒"
echo ""
echo "🚀 下一步："
echo "  1. 上传文件到服务器:"
echo "     scp $PACKAGE_DIR/*.tar.gz ubuntu@YOUR_SERVER_IP:/var/www/geo-system/"
echo "     scp $PACKAGE_DIR/.env.example ubuntu@YOUR_SERVER_IP:/var/www/geo-system/"
echo ""
echo "  2. 在服务器上解压:"
echo "     cd /var/www/geo-system"
echo "     tar -xzf client-dist.tar.gz"
echo "     tar -xzf server-dist.tar.gz"
echo "     tar -xzf landing-dist.tar.gz"
echo "     tar -xzf config.tar.gz"
echo ""
echo "  3. 配置环境变量:"
echo "     cp .env.example .env"
echo "     nano .env"
echo ""
echo "  4. 安装后端依赖并启动:"
echo "     cd server && npm ci --production"
echo "     pm2 start dist/index.js --name geo-backend"
echo ""
