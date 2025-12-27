#!/bin/bash

# GEO系统服务器部署脚本
# 用途：清除服务器已有项目并重新部署

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_IP="43.143.163.6"
SERVER_USER="ubuntu"
SSH_KEY="$HOME/.ssh/kiro.pem"
DEPLOY_DIR="/var/www/geo-system"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GEO系统服务器部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查SSH密钥
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}错误: SSH密钥不存在: $SSH_KEY${NC}"
    exit 1
fi

echo -e "${YELLOW}步骤 1/7: 连接到服务器并清除已有项目...${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
    set -e
    
    echo "停止运行中的服务..."
    pm2 stop all || true
    pm2 delete all || true
    
    echo "清除已有项目文件..."
    sudo rm -rf /var/www/geo-system || true
    
    echo "创建部署目录..."
    sudo mkdir -p /var/www/geo-system
    sudo chown -R ubuntu:ubuntu /var/www/geo-system
    
    echo "✓ 服务器清理完成"
ENDSSH

echo -e "${GREEN}✓ 步骤 1 完成${NC}"
echo ""

echo -e "${YELLOW}步骤 2/7: 检查并安装系统依赖...${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
    set -e
    
    echo "更新系统包列表..."
    sudo apt update
    
    echo "检查并安装基础工具..."
    sudo apt install -y curl wget git unzip tar build-essential python3 python3-pip
    
    echo "检查Node.js..."
    if ! command -v node &> /dev/null; then
        echo "安装Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
        sudo apt install -y nodejs
    else
        echo "Node.js已安装: $(node -v)"
    fi
    
    echo "检查PostgreSQL..."
    if ! command -v psql &> /dev/null; then
        echo "安装PostgreSQL..."
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl enable postgresql
        sudo systemctl start postgresql
    else
        echo "PostgreSQL已安装: $(psql --version)"
    fi
    
    echo "检查Redis..."
    if ! command -v redis-cli &> /dev/null; then
        echo "安装Redis..."
        sudo apt install -y redis-server
        sudo systemctl enable redis
        sudo systemctl start redis
    else
        echo "Redis已安装: $(redis-cli --version)"
    fi
    
    echo "检查Nginx..."
    if ! command -v nginx &> /dev/null; then
        echo "安装Nginx..."
        sudo apt install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
    else
        echo "Nginx已安装: $(nginx -v 2>&1)"
    fi
    
    echo "检查PM2..."
    if ! command -v pm2 &> /dev/null; then
        echo "安装PM2..."
        sudo npm install -g pm2
    else
        echo "PM2已安装: $(pm2 -v)"
    fi
    
    echo "检查Google Chrome..."
    if ! command -v google-chrome &> /dev/null; then
        echo "安装Google Chrome..."
        wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb
        sudo apt install -y /tmp/chrome.deb || sudo apt install -f -y
        rm -f /tmp/chrome.deb
    else
        echo "Google Chrome已安装: $(google-chrome --version)"
    fi
    
    echo "安装Puppeteer依赖（Ubuntu 24.04兼容）..."
    sudo apt install -y \
        ca-certificates fonts-liberation libappindicator3-1 libasound2t64 \
        libatk-bridge2.0-0 libatk1.0-0t64 libc6 libcairo2 libcups2t64 libdbus-1-3 \
        libexpat1 libfontconfig1 libgbm1 libgcc-s1 libglib2.0-0t64 libgtk-3-0t64 \
        libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
        libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
        libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
        lsb-release xdg-utils fonts-wqy-zenhei fonts-wqy-microhei
    
    echo "✓ 系统依赖检查完成"
ENDSSH

echo -e "${GREEN}✓ 步骤 2 完成${NC}"
echo ""

echo -e "${YELLOW}步骤 3/7: 配置数据库...${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
    set -e
    
    echo "创建数据库和用户..."
    sudo -u postgres psql << EOF
-- 删除已存在的数据库和用户（如果存在）
DROP DATABASE IF EXISTS geo_system;
DROP USER IF EXISTS geo_user;

-- 创建新的数据库和用户
CREATE DATABASE geo_system;
CREATE USER geo_user WITH PASSWORD 'H2SwIAkyzT1G4mAhkbtSULfG';
GRANT ALL PRIVILEGES ON DATABASE geo_system TO geo_user;

-- 授予schema权限
\c geo_system
GRANT ALL ON SCHEMA public TO geo_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO geo_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO geo_user;
EOF
    
    echo "✓ 数据库配置完成"
ENDSSH

echo -e "${GREEN}✓ 步骤 3 完成${NC}"
echo ""

echo -e "${YELLOW}步骤 4/7: 构建项目...${NC}"
echo "构建前端..."
cd client && npm run build
echo "构建后端..."
cd ../server && npm run build
echo "构建营销网站..."
cd ../landing && npm run build
cd ..

echo -e "${GREEN}✓ 步骤 4 完成${NC}"
echo ""

echo -e "${YELLOW}步骤 5/7: 上传项目文件...${NC}"

# 创建临时目录
TEMP_DIR=$(mktemp -d)
echo "临时目录: $TEMP_DIR"

# 打包后端
echo "打包后端..."
cd server
tar -czf "$TEMP_DIR/server.tar.gz" dist package.json package-lock.json
cd ..

# 打包前端
echo "打包前端..."
cd client
tar -czf "$TEMP_DIR/client.tar.gz" dist
cd ..

# 打包营销网站
echo "打包营销网站..."
cd landing
tar -czf "$TEMP_DIR/landing.tar.gz" dist
cd ..

# 上传文件
echo "上传文件到服务器..."
scp -i "$SSH_KEY" "$TEMP_DIR/server.tar.gz" "$SERVER_USER@$SERVER_IP:/tmp/"
scp -i "$SSH_KEY" "$TEMP_DIR/client.tar.gz" "$SERVER_USER@$SERVER_IP:/tmp/"
scp -i "$SSH_KEY" "$TEMP_DIR/landing.tar.gz" "$SERVER_USER@$SERVER_IP:/tmp/"

# 清理临时文件
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✓ 步骤 5 完成${NC}"
echo ""

echo -e "${YELLOW}步骤 6/7: 在服务器上解压并配置...${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
    set -e
    
    cd /var/www/geo-system
    
    echo "创建目录结构..."
    mkdir -p server client landing
    
    echo "解压文件..."
    tar -xzf /tmp/server.tar.gz -C server/
    tar -xzf /tmp/client.tar.gz -C client/
    tar -xzf /tmp/landing.tar.gz -C landing/
    
    echo "清理临时文件..."
    rm /tmp/server.tar.gz /tmp/client.tar.gz /tmp/landing.tar.gz
    
    echo "创建环境变量文件..."
    cat > .env << 'EOF'
# 数据库配置
DATABASE_URL=postgresql://geo_user:H2SwIAkyzT1G4mAhkbtSULfG@localhost:5432/geo_system

# AI API配置
DEEPSEEK_API_KEY=sk-your-real-deepseek-key
GEMINI_API_KEY=AIzaSy-your-real-gemini-key

# Ollama配置
OLLAMA_BASE_URL=http://localhost:11434

# 服务器配置
PORT=3000
NODE_ENV=production

# JWT密钥
JWT_SECRET=eeca6b8fd34cc378411cee4d5d9e405ba2470f34f31f65ca42a3b2ec6c44a144
JWT_REFRESH_SECRET=fcb44972cd8b6833229122d109cf7bca8254332045fef7a683de973fd84ec392
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# WebSocket配置
WEBSOCKET_PORT=8080

# 管理员账号
ADMIN_USERNAME=lzc2005
ADMIN_PASSWORD=jehI2oBuNMMJehMM

# Puppeteer配置
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=60000

# 限流配置
LOGIN_RATE_LIMIT=5
LOGIN_RATE_WINDOW_MINUTES=15
REGISTRATION_RATE_LIMIT=3
REGISTRATION_RATE_WINDOW_HOURS=1

# CORS配置
ALLOWED_ORIGINS=http://43.143.163.6,https://43.143.163.6

# Redis配置
REDIS_URL=redis://localhost:6379
EOF
    
    chmod 600 .env
    
    echo "安装后端依赖..."
    cd server
    npm ci --production
    
    echo "运行数据库迁移..."
    npm run db:migrate
    
    echo "✓ 项目配置完成"
ENDSSH

echo -e "${GREEN}✓ 步骤 6 完成${NC}"
echo ""

echo -e "${YELLOW}步骤 7/7: 配置Nginx并启动服务...${NC}"

# 上传Nginx配置
echo "上传Nginx配置..."
scp -i "$SSH_KEY" "config/nginx/geo-system.conf" "$SERVER_USER@$SERVER_IP:/tmp/"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
    set -e
    
    echo "配置Nginx..."
    sudo cp /tmp/geo-system.conf /etc/nginx/sites-available/geo-system
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/
    
    echo "测试Nginx配置..."
    sudo nginx -t
    
    echo "重启Nginx..."
    sudo systemctl restart nginx
    
    echo "启动后端服务..."
    cd /var/www/geo-system/server
    pm2 start dist/index.js --name geo-backend
    pm2 startup
    pm2 save
    
    echo "✓ 服务启动完成"
ENDSSH

echo -e "${GREEN}✓ 步骤 7 完成${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "访问地址："
echo -e "  前端应用: ${GREEN}http://$SERVER_IP${NC}"
echo -e "  营销网站: ${GREEN}http://$SERVER_IP/landing${NC}"
echo -e "  后端API:  ${GREEN}http://$SERVER_IP/api/health${NC}"
echo ""
echo -e "管理员账号："
echo -e "  用户名: ${GREEN}lzc2005${NC}"
echo -e "  密码:   ${GREEN}jehI2oBuNMMJehMM${NC}"
echo ""
echo -e "查看服务状态："
echo -e "  ${YELLOW}ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'pm2 status'${NC}"
echo ""
