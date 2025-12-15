#!/bin/bash

# ============================================
# 数据库健康检查脚本
# ============================================
# 
# 功能：
# - 检查 PostgreSQL 是否安装
# - 检查 PostgreSQL 服务状态
# - 验证数据库连接
# - 检查数据库和表是否存在
# - 提供详细的诊断信息
# ============================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_success() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_error() { echo -e "${RED}✗ ${1}${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ ${1}${NC}"; }

echo ""
echo "============================================"
echo "   PostgreSQL 数据库健康检查"
echo "============================================"
echo ""

# 1. 检查 PostgreSQL 是否安装
log_info "检查 PostgreSQL 安装..."
if ! command -v psql &> /dev/null; then
    log_error "PostgreSQL 未安装"
    echo ""
    echo "安装方法："
    echo "  macOS: brew install postgresql@14"
    echo "  Ubuntu: sudo apt-get install postgresql"
    echo ""
    exit 1
fi

PSQL_VERSION=$(psql --version | awk '{print $3}')
log_success "PostgreSQL 已安装 (版本: ${PSQL_VERSION})"

# 2. 检查服务状态
log_info "检查 PostgreSQL 服务状态..."
if pg_isready -h localhost -p 5432 &> /dev/null; then
    log_success "PostgreSQL 服务正在运行"
else
    log_error "PostgreSQL 服务未运行"
    echo ""
    echo "启动方法："
    echo "  macOS: brew services start postgresql@14"
    echo "  Linux: sudo systemctl start postgresql"
    echo ""
    exit 1
fi

# 3. 读取 .env 配置
log_info "读取数据库配置..."
if [ ! -f "../.env" ]; then
    log_error ".env 文件不存在"
    exit 1
fi

DATABASE_URL=$(grep "^DATABASE_URL=" ../.env | cut -d '=' -f2)
if [ -z "$DATABASE_URL" ]; then
    log_error ".env 中未配置 DATABASE_URL"
    exit 1
fi

# 解析数据库 URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:@]*\).*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')

log_success "数据库配置已读取"
echo "  数据库名: ${DB_NAME}"
echo "  用户名: ${DB_USER}"
echo "  主机: ${DB_HOST}"

# 4. 检查数据库是否存在
log_info "检查数据库 '${DB_NAME}' 是否存在..."
if psql -h localhost -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    log_success "数据库 '${DB_NAME}' 存在"
else
    log_error "数据库 '${DB_NAME}' 不存在"
    echo ""
    echo "创建数据库："
    echo "  createdb -h localhost -U ${DB_USER} ${DB_NAME}"
    echo ""
    exit 1
fi

# 5. 检查数据库表
log_info "检查数据库表..."
TABLES=$(psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null)

if [ -z "$TABLES" ] || [ "$TABLES" -eq 0 ]; then
    log_warning "数据库中没有表"
    echo ""
    echo "需要运行数据库迁移："
    echo "  cd server && npm run migrate"
    echo ""
else
    log_success "数据库包含 ${TABLES} 个表"
    
    # 列出所有表
    log_info "数据库表列表："
    psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>/dev/null | grep "public" | awk '{print "  - " $3}'
fi

# 6. 测试数据库连接
log_info "测试数据库连接..."
if psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    log_success "数据库连接测试成功"
else
    log_error "数据库连接测试失败"
    exit 1
fi

echo ""
echo "============================================"
log_success "数据库健康检查完成！"
echo "============================================"
echo ""
echo "数据库状态正常，可以启动应用程序"
echo ""

exit 0
