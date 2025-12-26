#!/bin/bash

# 一键编译脚本
# 用于编译前端、后端和营销网站

set -e

echo "======================================"
echo "   GEO 系统 - 一键编译脚本"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 记录开始时间
START_TIME=$(date +%s)

# 1. 编译前端应用
echo -e "${BLUE}📦 [1/3] 编译前端应用 (client)...${NC}"
cd client
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端编译成功${NC}"
    CLIENT_SIZE=$(du -sh dist | cut -f1)
    echo -e "${BLUE}   编译输出大小: $CLIENT_SIZE${NC}"
else
    echo -e "${RED}❌ 前端编译失败${NC}"
    exit 1
fi
cd ..

echo ""

# 2. 编译后端应用
echo -e "${BLUE}📦 [2/3] 编译后端应用 (server)...${NC}"
cd server
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 后端编译成功${NC}"
    SERVER_SIZE=$(du -sh dist | cut -f1)
    echo -e "${BLUE}   编译输出大小: $SERVER_SIZE${NC}"
else
    echo -e "${RED}❌ 后端编译失败${NC}"
    exit 1
fi
cd ..

echo ""

# 3. 编译营销网站
echo -e "${BLUE}📦 [3/3] 编译营销网站 (landing)...${NC}"
cd landing
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 营销网站编译成功${NC}"
    LANDING_SIZE=$(du -sh dist | cut -f1)
    echo -e "${BLUE}   编译输出大小: $LANDING_SIZE${NC}"
else
    echo -e "${RED}❌ 营销网站编译失败${NC}"
    exit 1
fi
cd ..

echo ""

# 计算总耗时
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 显示总结
echo "======================================"
echo -e "${GREEN}   ✅ 编译完成！${NC}"
echo "======================================"
echo ""
echo "📊 编译结果："
echo "  - 前端应用: $CLIENT_SIZE"
echo "  - 后端应用: $SERVER_SIZE"
echo "  - 营销网站: $LANDING_SIZE"
echo ""
echo "⏱️  总耗时: ${DURATION}秒"
echo ""
echo "📁 编译输出目录："
echo "  - client/dist/"
echo "  - server/dist/"
echo "  - landing/dist/"
echo ""
echo "🚀 下一步："
echo "  1. 打包文件: ./scripts/deployment/package-for-deploy.sh"
echo "  2. 上传到服务器"
echo "  3. 解压并启动服务"
echo ""
