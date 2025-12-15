#!/bin/bash

# ============================================
# GEO 优化系统 - 启动脚本
# ============================================
# 
# 功能说明：
# - 自动检查运行环境（Node.js、配置文件、依赖）
# - 同时启动前端和后端服务
# - 自动打开浏览器
# - 优雅处理错误和停止信号
#
# 使用方法：
# 1. 首次使用：chmod +x start.command
# 2. 双击此文件启动系统
# 3. 按 Ctrl+C 停止服务
# ============================================

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 全局变量
SERVICE_PID=""
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# ============================================
# 日志输出模块
# ============================================

# 信息日志（蓝色）
log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

# 成功日志（绿色，带 ✓ 标记）
log_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

# 错误日志（红色）
log_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# 警告日志（黄色）
log_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

# 步骤标题（青色）
log_step() {
    echo -e "\n${CYAN}▶ ${1}${NC}"
}

# ============================================
# 环境检查模块
# ============================================

# 检查 Node.js 是否安装
check_node() {
    log_step "检查 Node.js 环境"
    
    if ! command -v node &> /dev/null; then
        log_error "未检测到 Node.js"
        echo ""
        echo "解决方案："
        echo "  请访问 https://nodejs.org 下载并安装 Node.js 18+"
        echo ""
        return 1
    fi
    
    local node_version=$(node -v)
    log_success "Node.js 已安装 (版本: ${node_version})"
    return 0
}

# 检查并启动 PostgreSQL 数据库
check_database() {
    log_step "检查 PostgreSQL 数据库"
    
    # 检查 PostgreSQL 是否安装
    if ! command -v psql &> /dev/null; then
        log_error "未检测到 PostgreSQL"
        echo ""
        echo "解决方案："
        echo "  macOS: brew install postgresql@14"
        echo "  Ubuntu: sudo apt-get install postgresql"
        echo ""
        return 1
    fi
    
    log_success "PostgreSQL 已安装"
    
    # 检查数据库是否正在运行
    log_info "检查数据库服务状态..."
    
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        log_success "PostgreSQL 服务正在运行"
        
        # 验证数据库连接
        if [ -f ".env" ]; then
            # 从 .env 文件读取数据库配置
            local db_url=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2)
            
            if [ ! -z "$db_url" ]; then
                # 提取数据库名称
                local db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')
                
                if [ ! -z "$db_name" ]; then
                    log_info "验证数据库 '${db_name}' 是否存在..."
                    
                    # 检查数据库是否存在
                    if psql -h localhost -U $(whoami) -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
                        log_success "数据库 '${db_name}' 已存在"
                    else
                        log_warning "数据库 '${db_name}' 不存在"
                        log_info "正在创建数据库..."
                        
                        if createdb -h localhost -U $(whoami) "$db_name" 2>/dev/null; then
                            log_success "数据库 '${db_name}' 创建成功"
                        else
                            log_error "数据库创建失败"
                            echo ""
                            echo "请手动创建数据库："
                            echo "  createdb ${db_name}"
                            echo ""
                            return 1
                        fi
                    fi
                fi
            fi
        fi
        
        return 0
    else
        log_warning "PostgreSQL 服务未运行"
        log_info "正在尝试启动 PostgreSQL..."
        
        # 尝试使用 brew services 启动（macOS）
        if command -v brew &> /dev/null; then
            # 检查是否通过 brew 安装
            if brew services list | grep -q "postgresql"; then
                local pg_service=$(brew services list | grep "postgresql" | awk '{print $1}')
                
                log_info "使用 Homebrew 启动 PostgreSQL (${pg_service})..."
                
                if brew services start "$pg_service" &> /dev/null; then
                    log_success "PostgreSQL 启动命令已执行"
                    
                    # 等待数据库启动
                    log_info "等待数据库服务就绪..."
                    local max_wait=15
                    for i in $(seq 1 $max_wait); do
                        if pg_isready -h localhost -p 5432 &> /dev/null; then
                            log_success "PostgreSQL 服务已就绪"
                            return 0
                        fi
                        sleep 1
                    done
                    
                    log_error "PostgreSQL 启动超时"
                    return 1
                else
                    log_error "PostgreSQL 启动失败"
                    return 1
                fi
            fi
        fi
        
        # 尝试使用 pg_ctl 启动（通用方法）
        if command -v pg_ctl &> /dev/null; then
            log_info "尝试使用 pg_ctl 启动 PostgreSQL..."
            
            # 查找 PostgreSQL 数据目录
            local pg_data_dir=""
            
            # 常见的数据目录位置
            local possible_dirs=(
                "/usr/local/var/postgresql@14"
                "/usr/local/var/postgres"
                "/opt/homebrew/var/postgresql@14"
                "/opt/homebrew/var/postgres"
                "/var/lib/postgresql/14/main"
            )
            
            for dir in "${possible_dirs[@]}"; do
                if [ -d "$dir" ]; then
                    pg_data_dir="$dir"
                    break
                fi
            done
            
            if [ ! -z "$pg_data_dir" ]; then
                log_info "找到数据目录: ${pg_data_dir}"
                
                if pg_ctl -D "$pg_data_dir" start &> /dev/null; then
                    log_success "PostgreSQL 启动成功"
                    
                    # 等待数据库就绪
                    sleep 2
                    
                    if pg_isready -h localhost -p 5432 &> /dev/null; then
                        log_success "PostgreSQL 服务已就绪"
                        return 0
                    fi
                fi
            fi
        fi
        
        # 如果所有方法都失败
        log_error "无法自动启动 PostgreSQL"
        echo ""
        echo "请手动启动 PostgreSQL："
        echo "  macOS (Homebrew): brew services start postgresql@14"
        echo "  Linux (systemd): sudo systemctl start postgresql"
        echo "  或使用: pg_ctl -D /path/to/data start"
        echo ""
        echo "启动后，请重新运行此脚本"
        echo ""
        return 1
    fi
}

# 检查 .env 文件
check_env() {
    log_step "检查环境配置文件"
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            log_warning ".env 文件不存在"
            log_info "正在从 .env.example 复制模板..."
            cp .env.example .env
            log_success ".env 文件已创建"
            echo ""
            echo "⚠️  重要提示："
            echo "  请编辑 .env 文件并配置以下内容："
            echo "  - DATABASE_URL (数据库连接)"
            echo "  - DEEPSEEK_API_KEY 或 GEMINI_API_KEY (AI API密钥)"
            echo ""
            log_warning "配置完成后，请重新运行此脚本"
            return 1
        else
            log_error ".env.example 文件不存在"
            echo ""
            echo "解决方案："
            echo "  请确保项目完整，包含 .env.example 文件"
            echo ""
            return 1
        fi
    fi
    
    log_success ".env 文件已存在"
    return 0
}

# 检查依赖是否已安装
check_deps() {
    log_step "检查项目依赖"
    
    local missing_deps=0
    
    # 检查根目录依赖
    if [ ! -d "node_modules" ]; then
        log_error "根目录依赖未安装"
        missing_deps=1
    else
        log_success "根目录依赖已安装"
    fi
    
    # 检查服务端依赖
    if [ ! -d "server/node_modules" ]; then
        log_error "服务端依赖未安装"
        missing_deps=1
    else
        log_success "服务端依赖已安装"
    fi
    
    # 检查客户端依赖
    if [ ! -d "client/node_modules" ]; then
        log_error "客户端依赖未安装"
        missing_deps=1
    else
        log_success "客户端依赖已安装"
    fi
    
    if [ $missing_deps -eq 1 ]; then
        echo ""
        echo "解决方案："
        echo "  运行以下命令安装所有依赖："
        echo "  npm run install:all"
        echo ""
        return 1
    fi
    
    return 0
}

# ============================================
# 工作目录验证模块
# ============================================

# 检查并切换到正确的工作目录
check_working_directory() {
    log_step "验证工作目录"
    
    # 切换到脚本所在目录
    cd "$SCRIPT_DIR" || {
        log_error "无法切换到脚本目录"
        return 1
    }
    
    # 检查必要的文件和目录
    if [ ! -f "package.json" ]; then
        log_error "未找到 package.json 文件"
        echo ""
        echo "错误："
        echo "  请确保在项目根目录运行此脚本"
        echo ""
        return 1
    fi
    
    if [ ! -d "client" ] || [ ! -d "server" ]; then
        log_error "未找到 client 或 server 目录"
        echo ""
        echo "错误："
        echo "  项目结构不完整，请检查项目文件"
        echo ""
        return 1
    fi
    
    log_success "工作目录正确: $(pwd)"
    return 0
}

# ============================================
# 服务启动模块
# ============================================

# 启动服务
start_services() {
    log_step "启动服务"
    log_info "正在启动前端和后端服务..."
    
    # 使用 npm run dev 启动服务（concurrently 会同时启动前后端）
    npm run dev &
    SERVICE_PID=$!
    
    log_info "服务进程已启动 (PID: ${SERVICE_PID})"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 等待服务就绪
wait_for_ready() {
    log_step "等待服务就绪"
    
    local backend_ready=0
    local frontend_ready=0
    local max_attempts=30
    
    # 等待后端服务就绪
    log_info "检查后端服务 (http://localhost:3000)..."
    for i in $(seq 1 $max_attempts); do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            backend_ready=1
            log_success "后端服务已就绪"
            break
        fi
        sleep 1
    done
    
    if [ $backend_ready -eq 0 ]; then
        log_error "后端服务启动失败"
        echo ""
        echo "可能的原因："
        echo "  1. 端口 3000 被占用"
        echo "     检查: lsof -i :3000"
        echo "     解决: kill -9 <PID>"
        echo ""
        echo "  2. 数据库连接失败"
        echo "     检查数据库状态: pg_isready -h localhost -p 5432"
        echo "     启动数据库: brew services start postgresql@14"
        echo "     检查配置: .env 中的 DATABASE_URL"
        echo ""
        echo "  3. 环境变量配置错误"
        echo "     检查: .env 文件中的配置是否完整"
        echo ""
        echo "  4. 查看详细错误日志"
        echo "     后端日志会显示具体的错误信息"
        echo ""
        return 1
    fi
    
    # 等待前端服务就绪
    log_info "检查前端服务 (http://localhost:5173)..."
    for i in $(seq 1 $max_attempts); do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            frontend_ready=1
            log_success "前端服务已就绪"
            break
        fi
        sleep 1
    done
    
    if [ $frontend_ready -eq 0 ]; then
        log_error "前端服务启动失败"
        echo ""
        echo "可能的原因："
        echo "  1. 端口 5173 被占用"
        echo "     解决: lsof -i :5173 查看占用进程，然后 kill -9 <PID>"
        echo ""
        echo "  2. 依赖安装不完整"
        echo "     解决: cd client && npm install"
        echo ""
        return 1
    fi
    
    return 0
}

# ============================================
# 浏览器打开模块
# ============================================

# 打开浏览器
open_browser() {
    log_step "打开浏览器"
    
    # 额外等待确保页面可访问
    sleep 2
    
    # 使用 open 命令打开浏览器（macOS）
    if command -v open &> /dev/null; then
        open http://localhost:5173
        log_success "浏览器已打开"
    else
        log_warning "无法自动打开浏览器"
        echo ""
        echo "请手动访问："
        echo "  前端: http://localhost:5173"
        echo "  后端: http://localhost:3000"
        echo ""
    fi
}

# ============================================
# 进程管理和清理模块
# ============================================

# 清理函数 - 停止所有服务
cleanup() {
    echo ""
    log_step "正在停止服务..."
    
    if [ ! -z "$SERVICE_PID" ]; then
        # 优雅终止进程
        kill -TERM $SERVICE_PID 2>/dev/null
        
        # 等待进程结束
        wait $SERVICE_PID 2>/dev/null
        
        log_success "服务已停止"
    fi
    
    echo ""
    log_info "感谢使用 GEO 优化系统！"
    echo ""
    
    exit 0
}

# 设置信号捕获
trap cleanup SIGINT SIGTERM

# ============================================
# 主流程
# ============================================

main() {
    # 显示欢迎信息
    echo ""
    echo "============================================"
    echo "   GEO 优化系统 - 启动程序"
    echo "============================================"
    echo ""
    
    # 1. 验证工作目录
    check_working_directory || exit 1
    
    # 2. 环境检查
    check_node || exit 1
    check_database || exit 1
    check_env || exit 1
    check_deps || exit 1
    
    # 3. 启动服务
    start_services
    
    # 4. 等待服务就绪
    if ! wait_for_ready; then
        log_error "服务启动失败，请查看上方错误信息"
        echo ""
        echo "常见问题解决方案："
        echo "  • 查看完整文档: docs/快速开始.md"
        echo "  • 检查端口占用: lsof -i :3000 和 lsof -i :5173"
        echo "  • 查看服务日志以了解详细错误"
        echo ""
        cleanup
    fi
    
    # 5. 打开浏览器
    open_browser
    
    # 6. 显示成功信息和使用说明
    echo ""
    echo "============================================"
    log_success "系统启动成功！"
    echo "============================================"
    echo ""
    echo "访问地址："
    echo "  🌐 前端: http://localhost:5173"
    echo "  🔧 后端: http://localhost:3000"
    echo ""
    echo "使用说明："
    echo "  • 浏览器已自动打开前端页面"
    echo "  • 按 Ctrl+C 可以停止服务"
    echo "  • 服务日志会在下方实时显示"
    echo ""
    echo "============================================"
    echo ""
    
    # 7. 保持脚本运行，等待用户中断
    wait
}

# 执行主流程
main
