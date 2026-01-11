#!/bin/bash

# ==========================================
# GEO 系统安全数据库迁移脚本
# ==========================================
# 
# 功能：
# - 自动备份数据库
# - 检查迁移状态
# - 执行迁移（带事务保护）
# - 验证迁移结果
#
# 使用：
# ./scripts/deployment/safe-migrate.sh [--dry-run] [--skip-backup]
# ==========================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 参数解析
DRY_RUN=false
SKIP_BACKUP=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GEO 系统安全数据库迁移${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    log_warning "干运行模式 - 不会执行实际迁移"
fi

# ==========================================
# 1. 检查环境
# ==========================================
log_info "检查环境..."

# 检查是否在正确目录
if [ ! -f "server/package.json" ]; then
    log_error "请在项目根目录运行此脚本"
    exit 1
fi

# 检查 .env 文件
if [ ! -f ".env" ] && [ ! -f "server/.env" ]; then
    log_error "未找到 .env 文件，请先配置环境变量"
    exit 1
fi

log_success "环境检查通过"

# ==========================================
# 2. 检查当前迁移状态
# ==========================================
log_info "检查当前迁移状态..."

cd server

# 获取迁移状态
MIGRATION_STATUS=$(npm run db:status 2>&1) || true

echo "$MIGRATION_STATUS" | tail -20

# 检查是否有待执行的迁移
if echo "$MIGRATION_STATUS" | grep -q "待执行"; then
    PENDING_COUNT=$(echo "$MIGRATION_STATUS" | grep -c "○ 待执行" || echo "0")
    log_warning "发现 $PENDING_COUNT 个待执行的迁移"
else
    log_success "数据库已是最新版本"
    if [ "$DRY_RUN" = false ]; then
        exit 0
    fi
fi

cd ..

# ==========================================
# 3. 备份数据库
# ==========================================
if [ "$SKIP_BACKUP" = false ] && [ "$DRY_RUN" = false ]; then
    log_info "备份数据库..."
    
    BACKUP_DIR="backups"
    BACKUP_FILE="$BACKUP_DIR/backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p "$BACKUP_DIR"
    
    # 从 .env 读取数据库配置
    if [ -f ".env" ]; then
        source .env 2>/dev/null || true
    fi
    
    if [ -n "$DATABASE_URL" ]; then
        # 解析 DATABASE_URL
        # postgresql://user:password@host:port/database
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
        
        if command -v pg_dump &> /dev/null; then
            PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null
            
            if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
                log_success "数据库已备份到: $BACKUP_FILE"
            else
                log_warning "备份可能失败，请手动检查"
            fi
        else
            log_warning "pg_dump 未安装，跳过备份"
        fi
    else
        log_warning "未找到 DATABASE_URL，跳过备份"
    fi
else
    if [ "$SKIP_BACKUP" = true ]; then
        log_warning "跳过备份（--skip-backup）"
    fi
fi

# ==========================================
# 4. 执行迁移
# ==========================================
if [ "$DRY_RUN" = false ]; then
    log_info "执行数据库迁移..."
    
    cd server
    
    # 执行迁移
    if npm run db:migrate; then
        log_success "迁移执行成功"
    else
        log_error "迁移执行失败"
        log_info "尝试回滚..."
        npm run db:rollback || true
        exit 1
    fi
    
    cd ..
else
    log_info "[干运行] 将执行: cd server && npm run db:migrate"
fi

# ==========================================
# 5. 验证迁移结果
# ==========================================
log_info "验证迁移结果..."

cd server

FINAL_STATUS=$(npm run db:status 2>&1) || true

echo "$FINAL_STATUS" | tail -10

if echo "$FINAL_STATUS" | grep -q "数据库已是最新版本"; then
    log_success "迁移验证通过"
else
    log_warning "请手动检查迁移状态"
fi

cd ..

# ==========================================
# 总结
# ==========================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}迁移完成${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    log_info "这是干运行，未执行实际迁移"
    log_info "移除 --dry-run 参数以执行实际迁移"
fi
