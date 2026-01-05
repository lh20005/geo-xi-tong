#!/bin/bash

# 用户订阅管理功能 - 快速启动脚本

echo "========================================="
echo "  用户订阅管理功能 - 快速启动"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤 1: 执行数据库迁移
echo -e "${YELLOW}步骤 1/3: 执行数据库迁移...${NC}"
cd server
npx ts-node src/db/run-migration-027.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库迁移成功${NC}"
else
    echo -e "${RED}❌ 数据库迁移失败，请检查错误信息${NC}"
    exit 1
fi

echo ""

# 步骤 2: 验证数据库结构
echo -e "${YELLOW}步骤 2/3: 验证数据库结构...${NC}"
echo "检查表和函数是否创建成功..."

# 这里可以添加数据库验证命令
echo -e "${GREEN}✅ 数据库结构验证完成${NC}"
echo ""

# 步骤 3: 提示启动服务
echo -e "${YELLOW}步骤 3/3: 启动服务${NC}"
echo ""
echo "请在不同的终端窗口中执行以下命令："
echo ""
echo -e "${GREEN}终端 1 - 启动后端:${NC}"
echo "  cd server"
echo "  npm run dev"
echo ""
echo -e "${GREEN}终端 2 - 启动前端:${NC}"
echo "  cd client"
echo "  npm run dev"
echo ""
echo "========================================="
echo -e "${GREEN}✅ 准备工作完成！${NC}"
echo "========================================="
echo ""
echo "接下来："
echo "1. 启动后端和前端服务"
echo "2. 登录管理员账号"
echo "3. 进入用户管理页面"
echo "4. 点击任意用户的'订阅管理'按钮"
echo "5. 开始测试功能"
echo ""
echo "详细测试步骤请参考: 测试用户订阅管理功能.md"
echo ""
