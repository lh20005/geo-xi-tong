#!/bin/bash
# GEO系统服务器部署脚本
# 使用方法: ./scripts/deploy-to-server.sh [full|update]
# full: 全新部署（清理服务器后部署）
# update: 增量更新（只更新代码）

set -e

# ==================== 配置 ====================
SERVER_IP="43.143.163.6"
SERVER_USER="ubuntu"
SSH_KEY="$HOME/.ssh/kiro_geo.pem"
REMOTE_PATH="/var/www/geo-system"
LOCAL_PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==================== 函数定义 ====================

# SSH执行命令
ssh_exec() {
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "$1"
}

# 本地构建
build_local() {
    log_info "开始本地构建..."
    cd "$LOCAL_PROJECT_ROOT"
    
    # 构建前端
    log_info "构建前端 (client)..."
    cd client && npm run build && cd ..
    
    # 构建后端
    log_info "构建后端 (server)..."
    cd server && npm run build && cd ..
    
    # 构建落地页
    log_info "构建落地页 (landing)..."
    cd landing && npm run build && cd ..
    
    log_info "本地构建完成"
}

# 打包项目
pack_project() {
    log_info "打包项目..."
    cd "$LOCAL_PROJECT_ROOT"
    
    # 创建临时目录
    rm -rf /tmp/geo-deploy
    mkdir -p /tmp/geo-deploy
    
    # 复制必要文件
    cp -r client/dist /tmp/geo-deploy/client-dist
    cp -r server/dist /tmp/geo-deploy/server-dist
    cp -r server/node_modules /tmp/geo-deploy/server-node_modules
    cp server/package.json /tmp/geo-deploy/server-package.json
    cp -r server/src/db/migrations /tmp/geo-deploy/server-migrations
    cp -r landing/dist /tmp/geo-deploy/landing-dist
    
    # 打包
    cd /tmp/geo-deploy
    tar -czf geo-system.tar.gz *
    
    log_info "打包完成: /tmp/geo-deploy/geo-system.tar.gz"
}

# 上传到服务器
upload_to_server() {
    log_info "上传到服务器..."
    scp -i "$SSH_KEY" /tmp/geo-deploy/geo-system.tar.gz "$SERVER_USER@$SERVER_IP:/tmp/"
    log_info "上传完成"
}

# 服务器端部署
deploy_on_server() {
    log_info "在服务器上部署..."
    
    ssh_exec "
        set -e
        
        # 停止服务
        pm2 stop geo-api 2>/dev/null || true
        
        # 备份当前版本
        if [ -d $REMOTE_PATH ]; then
            sudo mv $REMOTE_PATH ${REMOTE_PATH}.backup.\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        fi
        
        # 创建目录
        sudo mkdir -p $REMOTE_PATH
        sudo chown -R ubuntu:ubuntu $REMOTE_PATH
        
        # 解压
        cd $REMOTE_PATH
        tar -xzf /tmp/geo-system.tar.gz
        
        # 整理目录结构
        mkdir -p client server landing
        mv client-dist client/dist
        mv server-dist server/dist
        mv server-node_modules server/node_modules
        mv server-package.json server/package.json
        mkdir -p server/src/db
        mv server-migrations server/src/db/migrations
        mv landing-dist landing/dist
        
        # 创建上传目录
        mkdir -p server/uploads
        
        echo '服务器端文件部署完成'
    "
}

# 配置数据库
setup_database() {
    log_info "配置数据库..."
    
    ssh_exec "
        # 检查数据库是否存在
        if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw geo_system; then
            echo '创建数据库...'
            sudo -u postgres psql -c \"CREATE DATABASE geo_system;\"
            sudo -u postgres psql -c \"CREATE USER geo_user WITH ENCRYPTED PASSWORD 'GeoSystem2026!';\"
            sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE geo_system TO geo_user;\"
            sudo -u postgres psql -d geo_system -c \"GRANT ALL ON SCHEMA public TO geo_user;\"
        else
            echo '数据库已存在'
        fi
    "
}

# 运行迁移
run_migrations() {
    log_info "运行数据库迁移..."
    ssh_exec "cd $REMOTE_PATH/server && npm run db:migrate"
}

# 配置Nginx
setup_nginx() {
    log_info "配置Nginx..."
    
    # 上传配置文件
    scp -i "$SSH_KEY" "$LOCAL_PROJECT_ROOT/config/server-deploy/nginx-geo-system.conf" \
        "$SERVER_USER@$SERVER_IP:/tmp/geo-system-nginx"
    
    ssh_exec "
        sudo cp /tmp/geo-system-nginx /etc/nginx/sites-available/geo-system
        sudo ln -sf /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl reload nginx
    "
}

# 启动服务
start_service() {
    log_info "启动服务..."
    ssh_exec "
        cd $REMOTE_PATH/server
        pm2 start dist/index.js --name geo-api || pm2 restart geo-api
        pm2 save
    "
}

# 健康检查
health_check() {
    log_info "健康检查..."
    sleep 3
    
    RESULT=$(ssh_exec "curl -s http://localhost:3000/api/health")
    if echo "$RESULT" | grep -q '"status":"ok"'; then
        log_info "健康检查通过: $RESULT"
    else
        log_error "健康检查失败: $RESULT"
        exit 1
    fi
}

# 清理服务器
clean_server() {
    log_warn "清理服务器..."
    ssh_exec "
        pm2 delete geo-api 2>/dev/null || true
        sudo rm -rf $REMOTE_PATH
        sudo rm -f /etc/nginx/sites-enabled/geo-system
        sudo rm -f /etc/nginx/sites-available/geo-system
        sudo systemctl reload nginx 2>/dev/null || true
    "
}

# ==================== 主流程 ====================

MODE=${1:-update}

case $MODE in
    full)
        log_warn "执行全新部署（将清理服务器）"
        read -p "确认继续? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        
        clean_server
        build_local
        pack_project
        upload_to_server
        deploy_on_server
        setup_database
        run_migrations
        setup_nginx
        start_service
        health_check
        ;;
    
    update)
        log_info "执行增量更新"
        build_local
        pack_project
        upload_to_server
        deploy_on_server
        run_migrations
        start_service
        health_check
        ;;
    
    *)
        echo "使用方法: $0 [full|update]"
        echo "  full   - 全新部署（清理服务器后部署）"
        echo "  update - 增量更新（只更新代码）"
        exit 1
        ;;
esac

log_info "部署完成！"
log_info "访问地址: http://$SERVER_IP"
log_info "主应用: http://$SERVER_IP/app"
