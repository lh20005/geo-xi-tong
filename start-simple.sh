#!/bin/bash

# ============================================
# GEO 优化系统 - 简化启动脚本
# ============================================

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "============================================"
echo "   GEO 优化系统 - 启动中..."
echo "============================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ 未检测到 Node.js，请先安装 Node.js 18+${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 已安装 ($(node -v))${NC}"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}⚠ 正在创建 .env 文件...${NC}"
        cp .env.example .env
        echo -e "${GREEN}✓ .env 文件已创建${NC}"
        echo ""
        echo -e "${YELLOW}请编辑 .env 文件配置必要的环境变量，然后重新运行此脚本${NC}"
        exit 1
    else
        echo -e "${RED}✗ 未找到 .env.example 文件${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ .env 文件已存在${NC}"

# 检查依赖
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}⚠ 检测到缺少依赖，正在安装...${NC}"
    npm run install:all
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ 依赖安装失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ 依赖已安装${NC}"
fi

echo ""
echo -e "${BLUE}▶ 正在启动服务...${NC}"
echo ""

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    jobs -p | xargs -r kill 2>/dev/null
    echo -e "${GREEN}✓ 服务已停止${NC}"
    echo ""
    exit 0
}

# 捕获 Ctrl+C
trap cleanup SIGINT SIGTERM

# 启动服务
npm run dev &
SERVICE_PID=$!

# 等待服务启动
echo "等待服务启动..."
sleep 8

# 检查服务状态
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 后端服务已就绪 (http://localhost:3000)${NC}"
else
    echo -e "${YELLOW}⚠ 后端服务可能还在启动中...${NC}"
fi

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 前端服务已就绪 (http://localhost:5173)${NC}"
else
    echo -e "${YELLOW}⚠ 前端服务可能还在启动中...${NC}"
fi

echo ""
echo "============================================"
echo -e "${GREEN}✓ 系统启动成功！${NC}"
echo "============================================"
echo ""
echo "访问地址："
echo "  🌐 前端: http://localhost:5173"
echo "  🔧 后端: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""
echo "============================================"
echo ""

# 尝试打开浏览器
if command -v open &> /dev/null; then
    sleep 2
    open http://localhost:5173 2>/dev/null
fi

# 等待进程
wait $SERVICE_PID
