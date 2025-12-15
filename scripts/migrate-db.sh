#!/bin/bash

# ============================================
# 数据库迁移脚本
# ============================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_success() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_error() { echo -e "${RED}✗ ${1}${NC}"; }

echo ""
echo "============================================"
echo "   数据库迁移"
echo "============================================"
echo ""

# 读取 .env 配置
log_info "读取数据库配置..."
if [ ! -f ".env" ]; then
    log_error ".env 文件不存在"
    exit 1
fi

DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2)
if [ -z "$DATABASE_URL" ]; then
    log_error ".env 中未配置 DATABASE_URL"
    exit 1
fi

# 解析数据库 URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:@]*\).*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')

log_success "数据库配置已读取"

# 运行迁移
log_info "执行数据库迁移..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f server/src/db/schema.sql

if [ $? -eq 0 ]; then
    log_success "数据库迁移完成"
else
    log_error "数据库迁移失败"
    exit 1
fi

echo ""
log_success "迁移成功完成！"
echo ""

exit 0
