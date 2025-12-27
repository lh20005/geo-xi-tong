#!/bin/bash

# ==========================================
# 数据库迁移部署脚本
# ==========================================
# 
# 功能：
# - 备份生产数据库
# - 上传迁移文件
# - 执行迁移
# - 验证结果
#
# 使用：
# ./scripts/deployment/deploy-migrations.sh
#
# ==========================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_USER="ubuntu"
SERVER_HOST="43.143.163.6"
SERVER_PASSWORD="Woaini7758521@"
SERVER_PATH="/var/www/geo-system/server"
DB_PASSWORD="H2SwIAkyzT1G4mAhkbtSULfG"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v sshpass &> /dev/null; then
        log_error "sshpass 未安装"
        log_info "安装方法: brew install sshpass (macOS) 或 apt-get install sshpass (Linux)"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 备份数据库
backup_database() {
    log_info "备份生产数据库..."
    
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
        $SERVER_USER@$SERVER_HOST \
        "PGPASSWORD='$DB_PASSWORD' pg_dump -h localhost -U geo_user geo_system > /tmp/$BACKUP_FILE"
    
    # 下载备份到本地
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no \
        $SERVER_USER@$SERVER_HOST:/tmp/$BACKUP_FILE \
        ./backups/
    
    log_success "数据库已备份: ./backups/$BACKUP_FILE"
}

# 上传迁移文件
upload_migrations() {
    log_info "上传迁移文件..."
    
    # 创建远程目录
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
        $SERVER_USER@$SERVER_HOST \
        "mkdir -p $SERVER_PATH/src/db/migrations"
    
    # 上传迁移脚本
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no \
        server/src/db/migrate.ts \
        server/src/db/rollback.ts \
        server/src/db/status.ts \
        $SERVER_USER@$SERVER_HOST:$SERVER_PATH/src/db/
    
    # 上传迁移文件
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no -r \
        server/src/db/migrations/*.sql \
        $SERVER_USER@$SERVER_HOST:$SERVER_PATH/src/db/migrations/
    
    log_success "迁移文件已上传"
}

# 查看迁移状态
check_status() {
    log_info "查看迁移状态..."
    
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
        $SERVER_USER@$SERVER_HOST \
        "cd $SERVER_PATH && npm run db:status"
}

# 执行迁移
run_migrations() {
    log_info "执行数据库迁移..."
    
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
        $SERVER_USER@$SERVER_HOST \
        "cd $SERVER_PATH && npm run db:migrate"
    
    if [ $? -eq 0 ]; then
        log_success "迁移执行成功"
    else
        log_error "迁移执行失败"
        exit 1
    fi
}

# 验证结果
verify_result() {
    log_info "验证迁移结果..."
    
    # 测试API
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_HOST/api/health)
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "API 健康检查通过 (HTTP $HTTP_CODE)"
    else
        log_warning "API 健康检查失败 (HTTP $HTTP_CODE)"
    fi
    
    # 查看最终状态
    check_status
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  数据库迁移部署"
    echo "=========================================="
    echo ""
    
    # 确认操作
    read -p "$(echo -e ${YELLOW}是否继续部署到生产环境？[y/N]: ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        exit 0
    fi
    
    # 创建备份目录
    mkdir -p ./backups
    
    # 执行步骤
    check_dependencies
    backup_database
    upload_migrations
    check_status
    
    # 再次确认
    echo ""
    read -p "$(echo -e ${YELLOW}确认执行迁移？[y/N]: ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        exit 0
    fi
    
    run_migrations
    verify_result
    
    echo ""
    echo "=========================================="
    log_success "部署完成！"
    echo "=========================================="
    echo ""
}

# 运行主函数
main
