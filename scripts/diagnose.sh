#!/bin/bash

# ============================================
# 系统诊断脚本
# ============================================
# 
# 功能：快速诊断系统常见问题
# - 检查所有依赖
# - 检查端口占用
# - 检查数据库状态
# - 检查配置文件
# - 提供修复建议
# ============================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_success() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_error() { echo -e "${RED}✗ ${1}${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ ${1}${NC}"; }
log_step() { echo -e "\n${CYAN}▶ ${1}${NC}"; }

ISSUES_FOUND=0

echo ""
echo "============================================"
echo "   GEO 系统诊断工具"
echo "============================================"
echo ""

# 1. 检查 Node.js
log_step "检查 Node.js"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log_success "Node.js 已安装: ${NODE_VERSION}"
else
    log_error "Node.js 未安装"
    echo "  安装: https://nodejs.org"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 2. 检查 npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    log_success "npm 已安装: ${NPM_VERSION}"
else
    log_error "npm 未安装"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 3. 检查 PostgreSQL
log_step "检查 PostgreSQL"
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    log_success "PostgreSQL 已安装: ${PSQL_VERSION}"
    
    # 检查服务状态
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        log_success "PostgreSQL 服务正在运行"
    else
        log_error "PostgreSQL 服务未运行"
        echo "  启动: brew services start postgresql@14"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    log_error "PostgreSQL 未安装"
    echo "  安装: brew install postgresql@14"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 4. 检查端口占用
log_step "检查端口占用"

# 检查 3000 端口（后端）
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID=$(lsof -Pi :3000 -sTCP:LISTEN -t)
    PROCESS=$(ps -p $PID -o comm=)
    log_warning "端口 3000 被占用"
    echo "  进程: ${PROCESS} (PID: ${PID})"
    echo "  停止: kill -9 ${PID}"
else
    log_success "端口 3000 空闲"
fi

# 检查 5173 端口（前端）
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID=$(lsof -Pi :5173 -sTCP:LISTEN -t)
    PROCESS=$(ps -p $PID -o comm=)
    log_warning "端口 5173 被占用"
    echo "  进程: ${PROCESS} (PID: ${PID})"
    echo "  停止: kill -9 ${PID}"
else
    log_success "端口 5173 空闲"
fi

# 5. 检查配置文件
log_step "检查配置文件"

if [ -f ".env" ]; then
    log_success ".env 文件存在"
    
    # 检查必要的配置项
    if grep -q "^DATABASE_URL=" .env; then
        log_success "DATABASE_URL 已配置"
    else
        log_error "DATABASE_URL 未配置"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
    
    # 检查 API 密钥（至少配置一个）
    HAS_API_KEY=0
    if grep -q "^DEEPSEEK_API_KEY=" .env && ! grep -q "^DEEPSEEK_API_KEY=your_" .env; then
        log_success "DEEPSEEK_API_KEY 已配置"
        HAS_API_KEY=1
    fi
    
    if grep -q "^GEMINI_API_KEY=" .env && ! grep -q "^GEMINI_API_KEY=your_" .env; then
        log_success "GEMINI_API_KEY 已配置"
        HAS_API_KEY=1
    fi
    
    if [ $HAS_API_KEY -eq 0 ]; then
        log_warning "未配置 AI API 密钥"
        echo "  需要配置 DEEPSEEK_API_KEY 或 GEMINI_API_KEY"
        echo "  或在应用中配置使用 Ollama 本地模型"
    fi
else
    log_error ".env 文件不存在"
    echo "  创建: cp .env.example .env"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 6. 检查依赖安装
log_step "检查项目依赖"

if [ -d "node_modules" ]; then
    log_success "根目录依赖已安装"
else
    log_error "根目录依赖未安装"
    echo "  安装: npm install"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ -d "server/node_modules" ]; then
    log_success "服务端依赖已安装"
else
    log_error "服务端依赖未安装"
    echo "  安装: cd server && npm install"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ -d "client/node_modules" ]; then
    log_success "客户端依赖已安装"
else
    log_error "客户端依赖未安装"
    echo "  安装: cd client && npm install"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 7. 检查数据库
if [ -f ".env" ] && command -v psql &> /dev/null && pg_isready -h localhost -p 5432 &> /dev/null; then
    log_step "检查数据库"
    
    DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2)
    if [ ! -z "$DATABASE_URL" ]; then
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:@]*\).*/\1/p')
        
        if [ ! -z "$DB_NAME" ]; then
            if psql -h localhost -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
                log_success "数据库 '${DB_NAME}' 存在"
                
                # 检查表
                TABLES=$(psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null)
                if [ ! -z "$TABLES" ] && [ "$TABLES" -gt 0 ]; then
                    log_success "数据库包含 ${TABLES} 个表"
                else
                    log_warning "数据库中没有表"
                    echo "  运行迁移: cd server && npm run migrate"
                fi
            else
                log_error "数据库 '${DB_NAME}' 不存在"
                echo "  创建: createdb ${DB_NAME}"
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        fi
    fi
fi

# 8. 总结
echo ""
echo "============================================"
if [ $ISSUES_FOUND -eq 0 ]; then
    log_success "诊断完成！未发现问题"
    echo "============================================"
    echo ""
    echo "系统状态良好，可以启动应用："
    echo "  ./start.command"
else
    log_warning "诊断完成！发现 ${ISSUES_FOUND} 个问题"
    echo "============================================"
    echo ""
    echo "请根据上方提示解决问题后再启动应用"
fi
echo ""

exit $ISSUES_FOUND
