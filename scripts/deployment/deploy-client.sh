#!/bin/bash

# GEO系统 - 客户端部署脚本
# 用途：构建并部署前端应用到生产服务器

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_USER="ubuntu"
SERVER_HOST="43.143.163.6"
SERVER_PASSWORD="Woaini7758521@"
REMOTE_PATH="/var/www/geo-system/client/dist"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GEO系统 - 客户端部署${NC}"
echo -e "${GREEN}========================================${NC}"

# 步骤1: 构建前端
echo -e "\n${YELLOW}[1/4] 构建前端应用...${NC}"
cd client
npm run build
cd ..

# 步骤2: 同步文件到服务器
echo -e "\n${YELLOW}[2/4] 同步文件到服务器...${NC}"
sshpass -p "$SERVER_PASSWORD" rsync -avz --delete \
  client/dist/ \
  ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/

# 步骤3: 同步环境变量
echo -e "\n${YELLOW}[3/4] 同步环境变量...${NC}"
sshpass -p "$SERVER_PASSWORD" scp \
  client/.env \
  ${SERVER_USER}@${SERVER_HOST}:/var/www/geo-system/client/.env

# 步骤4: 重载Nginx
echo -e "\n${YELLOW}[4/4] 重载Nginx服务...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh ${SERVER_USER}@${SERVER_HOST} \
  "sudo systemctl reload nginx"

# 验证部署
echo -e "\n${YELLOW}验证部署...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER_HOST}/app/)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ 前端应用部署成功！${NC}"
  echo -e "${GREEN}✓ 访问地址: http://${SERVER_HOST}/app/${NC}"
else
  echo -e "${RED}✗ 部署验证失败 (HTTP $HTTP_CODE)${NC}"
  exit 1
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
