#!/bin/bash

# ==========================================
# GEO 系统部署前检查脚本
# ==========================================
# 
# 功能：
# - 检查所有依赖是否安装
# - 验证构建是否成功
# - 检查迁移文件完整性
# - 验证环境变量配置
#
# 使用：./scripts/deployment/pre-deploy-check.sh
# ==========================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
ERRORS=0
WARNINGS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((ERRORS++))
}

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GEO 系统部署前检查${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ==========================================
# 1. 检查 Node.js 版本
# ==========================================
log_info "检查 Node.js 版本..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        log_success "Node.js 版本: $(node -v)"
    else
        log_error "Node.js 版本过低: $(node -v)，需要 v18+"
    fi
else
    log_error "Node.js 未安装"
fi

# ==========================================
# 2. 检查依赖安装
# ==========================================
log_info "检查依赖安装..."

check_deps() {
    local dir=$1
    local name=$2
    if [ -d "$dir/node_modules" ]; then
        log_success "$name 依赖已安装"
    else
        log_error "$name 依赖未安装，请运行: cd $dir && npm install"
    fi
}

check_deps "." "根目录"
check_deps "server" "后端"
check_deps "client" "前端"
check_deps "landing" "落地页"

# ==========================================
# 3. 检查构建产物
# ==========================================
log_info "检查构建产物..."

if [ -f "client/dist/index.html" ]; then
    log_success "前端构建产物存在"
else
    log_warning "前端未构建，请运行: npm run client:build"
fi

if [ -f "server/dist/index.js" ]; then
    log_success "后端构建产物存在"
else
    log_warning "后端未构建，请运行: npm run server:build"
fi

if [ -f "landing/dist/index.html" ]; then
    log_success "落地页构建产物存在"
else
    log_warning "落地页未构建，请运行: npm run landing:build"
fi

# ==========================================
# 4. 检查迁移文件
# ==========================================
log_info "检查数据库迁移文件..."

MIGRATIONS_DIR="server/src/db/migrations"
MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')

if [ "$MIGRATION_COUNT" -gt 0 ]; then
    log_success "发现 $MIGRATION_COUNT 个迁移文件"
    
    # 检查 001 迁移文件是否有实际内容
    if grep -q "CREATE TABLE IF NOT EXISTS users" "$MIGRATIONS_DIR/001_initial_schema.sql"; then
        log_success "001_initial_schema.sql 包含完整表结构"
    else
        log_error "001_initial_schema.sql 可能只是占位符，请检查"
    fi
    
    # 检查迁移文件格式
    for file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            if [[ ! "$filename" =~ ^[0-9]{3}_.+\.sql$ ]]; then
                log_warning "迁移文件命名不规范: $filename"
            fi
            
            if ! grep -q "UP" "$file" || ! grep -q "DOWN" "$file"; then
                log_warning "迁移文件缺少 UP/DOWN 部分: $filename"
            fi
        fi
    done
else
    log_error "未找到迁移文件"
fi

# ==========================================
# 5. 检查环境变量
# ==========================================
log_info "检查环境变量配置..."

check_env_file() {
    local file=$1
    local name=$2
    if [ -f "$file" ]; then
        log_success "$name 环境变量文件存在"
        
        # 检查是否包含默认值
        if grep -q "请使用" "$file" 2>/dev/null; then
            log_warning "$name 包含未修改的默认值，请检查"
        fi
    else
        log_warning "$name 环境变量文件不存在"
    fi
}

check_env_file ".env" "根目录"
check_env_file "server/.env" "后端"
check_env_file "client/.env" "前端"

# ==========================================
# 6. 检查 TypeScript 编译
# ==========================================
log_info "检查 TypeScript 配置..."

if [ -f "server/tsconfig.json" ]; then
    log_success "后端 TypeScript 配置存在"
else
    log_error "后端 TypeScript 配置缺失"
fi

if [ -f "client/tsconfig.json" ]; then
    log_success "前端 TypeScript 配置存在"
else
    log_error "前端 TypeScript 配置缺失"
fi

# ==========================================
# 7. 检查 Nginx 配置
# ==========================================
log_info "检查 Nginx 配置..."

if [ -f "config/nginx/geo-system.conf" ]; then
    log_success "Nginx 配置文件存在"
else
    log_warning "Nginx 配置文件不存在"
fi

# ==========================================
# 8. 检查敏感信息
# ==========================================
log_info "检查敏感信息..."

# 检查是否有硬编码的密码
SENSITIVE_PATTERNS=("password.*=.*['\"]" "secret.*=.*['\"]" "api_key.*=.*['\"]")
SENSITIVE_FILES=$(find . -name "*.ts" -o -name "*.js" -o -name "*.tsx" | grep -v node_modules | head -100)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if echo "$SENSITIVE_FILES" | xargs grep -l "$pattern" 2>/dev/null | head -1 | grep -q .; then
        log_warning "可能存在硬编码的敏感信息，请检查"
        break
    fi
done

# ==========================================
# 总结
# ==========================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}检查完成${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}发现 $ERRORS 个错误，$WARNINGS 个警告${NC}"
    echo -e "${RED}请修复错误后再部署${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}发现 $WARNINGS 个警告${NC}"
    echo -e "${YELLOW}建议修复警告后再部署${NC}"
    exit 0
else
    echo -e "${GREEN}所有检查通过！可以开始部署${NC}"
    exit 0
fi
