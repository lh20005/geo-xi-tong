#!/bin/bash

# GEO优化系统 - 宣传网站部署脚本
# 适用于腾讯云服务器

set -e

echo "🚀 开始部署GEO优化系统宣传网站..."

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_DIR="/var/www/geo-system"
LANDING_DIR="$PROJECT_DIR/landing"
BUILD_DIR="$LANDING_DIR/dist"
NGINX_CONF="/etc/nginx/sites-available/geo-system"
PM2_APP_NAME="geo-landing"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ 请使用root权限运行此脚本${NC}"
    echo "使用: sudo ./deploy.sh"
    exit 1
fi

# 步骤1: 拉取最新代码
echo -e "${BLUE}📥 拉取最新代码...${NC}"
cd $PROJECT_DIR
git pull origin main

# 步骤2: 安装依赖
echo -e "${BLUE}📦 安装依赖...${NC}"
cd $LANDING_DIR
npm install --production

# 步骤3: 构建项目
echo -e "${BLUE}🔨 构建项目...${NC}"
npm run build

# 检查构建是否成功
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ 构建失败，dist目录不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 构建成功${NC}"

# 步骤4: 使用PM2启动/重启服务
echo -e "${BLUE}🔄 启动/重启服务...${NC}"

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo -e "${BLUE}📦 安装PM2...${NC}"
    npm install -g pm2
fi

# 停止旧服务
pm2 stop $PM2_APP_NAME 2>/dev/null || true
pm2 delete $PM2_APP_NAME 2>/dev/null || true

# 启动新服务（使用vite preview）
cd $LANDING_DIR
pm2 start npm --name $PM2_APP_NAME -- run preview
pm2 save

echo -e "${GREEN}✅ 服务启动成功${NC}"

# 步骤5: 配置Nginx（如果需要）
if [ ! -f "$NGINX_CONF" ]; then
    echo -e "${BLUE}⚙️  配置Nginx...${NC}"
    cp $LANDING_DIR/nginx.conf.example $NGINX_CONF
    
    echo -e "${RED}⚠️  请手动编辑Nginx配置文件：${NC}"
    echo "   $NGINX_CONF"
    echo "   1. 替换域名"
    echo "   2. 配置SSL证书路径"
    echo "   3. 然后运行: sudo nginx -t && sudo nginx -s reload"
else
    echo -e "${GREEN}✅ Nginx配置已存在${NC}"
fi

# 步骤6: 显示服务状态
echo -e "${BLUE}📊 服务状态：${NC}"
pm2 list

# 步骤7: 显示日志位置
echo -e "${BLUE}📝 日志位置：${NC}"
echo "   PM2日志: ~/.pm2/logs/"
echo "   Nginx日志: /var/log/nginx/"

# 完成
echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${BLUE}访问地址：${NC}"
echo "   开发: http://localhost:8080"
echo "   生产: https://your-domain.com"

# 显示下一步操作
echo -e "${BLUE}📋 下一步操作：${NC}"
echo "   1. 检查服务状态: pm2 status"
echo "   2. 查看日志: pm2 logs $PM2_APP_NAME"
echo "   3. 重启服务: pm2 restart $PM2_APP_NAME"
echo "   4. 停止服务: pm2 stop $PM2_APP_NAME"
