#!/bin/bash

# GEO系统 - 性能优化部署脚本
# 用途：一键应用所有性能优化配置

set -e

echo "🚀 GEO系统性能优化脚本"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ 请使用 sudo 运行此脚本${NC}"
    exit 1
fi

# 1. 优化 Nginx 配置
echo -e "${YELLOW}📝 步骤 1/6: 优化 Nginx 配置${NC}"
if [ -f "/etc/nginx/sites-available/geo-system.conf" ]; then
    echo "备份现有配置..."
    cp /etc/nginx/sites-available/geo-system.conf /etc/nginx/sites-available/geo-system.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    echo "应用优化配置..."
    cp config/nginx/geo-system-optimized.conf /etc/nginx/sites-available/geo-system.conf
    
    echo "测试配置..."
    if nginx -t; then
        echo -e "${GREEN}✅ Nginx 配置测试通过${NC}"
        systemctl reload nginx
        echo -e "${GREEN}✅ Nginx 已重新加载${NC}"
    else
        echo -e "${RED}❌ Nginx 配置测试失败，已回滚${NC}"
        cp /etc/nginx/sites-available/geo-system.conf.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/geo-system.conf
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  未找到 Nginx 配置文件，跳过${NC}"
fi
echo ""

# 2. 创建 Nginx 缓存目录
echo -e "${YELLOW}📝 步骤 2/6: 创建 Nginx 缓存目录${NC}"
mkdir -p /var/cache/nginx/geo-system
chown -R www-data:www-data /var/cache/nginx/geo-system
echo -e "${GREEN}✅ 缓存目录已创建${NC}"
echo ""

# 3. 优化 PostgreSQL 配置
echo -e "${YELLOW}📝 步骤 3/6: 优化 PostgreSQL 配置${NC}"
PG_CONF="/etc/postgresql/14/main/postgresql.conf"
if [ -f "$PG_CONF" ]; then
    echo "备份现有配置..."
    cp $PG_CONF ${PG_CONF}.backup.$(date +%Y%m%d_%H%M%S)
    
    echo "应用优化配置..."
    cat >> $PG_CONF << 'EOF'

# ========== GEO系统性能优化配置 ==========
# 添加时间: $(date)

# 内存配置
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 16MB

# 连接配置
max_connections = 100

# 查询优化
random_page_cost = 1.1
effective_io_concurrency = 200

# WAL 配置
wal_buffers = 16MB
checkpoint_completion_target = 0.9
EOF
    
    echo "重启 PostgreSQL..."
    systemctl restart postgresql
    echo -e "${GREEN}✅ PostgreSQL 已优化并重启${NC}"
else
    echo -e "${YELLOW}⚠️  未找到 PostgreSQL 配置文件，跳过${NC}"
fi
echo ""

# 4. 优化 Redis 配置
echo -e "${YELLOW}📝 步骤 4/6: 优化 Redis 配置${NC}"
REDIS_CONF="/etc/redis/redis.conf"
if [ -f "$REDIS_CONF" ]; then
    echo "备份现有配置..."
    cp $REDIS_CONF ${REDIS_CONF}.backup.$(date +%Y%m%d_%H%M%S)
    
    echo "应用优化配置..."
    sed -i 's/^# maxmemory .*/maxmemory 512mb/' $REDIS_CONF
    sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' $REDIS_CONF
    sed -i 's/^appendonly no/appendonly yes/' $REDIS_CONF
    sed -i 's/^# appendfsync everysec/appendfsync everysec/' $REDIS_CONF
    
    echo "重启 Redis..."
    systemctl restart redis
    echo -e "${GREEN}✅ Redis 已优化并重启${NC}"
else
    echo -e "${YELLOW}⚠️  未找到 Redis 配置文件，跳过${NC}"
fi
echo ""

# 5. 优化系统参数
echo -e "${YELLOW}📝 步骤 5/6: 优化系统参数${NC}"

# 优化文件描述符限制
if ! grep -q "geo-system optimization" /etc/security/limits.conf; then
    echo "配置文件描述符限制..."
    cat >> /etc/security/limits.conf << 'EOF'

# GEO系统性能优化 - geo-system optimization
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
EOF
    echo -e "${GREEN}✅ 文件描述符限制已配置${NC}"
else
    echo -e "${YELLOW}⚠️  文件描述符限制已存在，跳过${NC}"
fi

# 优化网络参数
if ! grep -q "geo-system optimization" /etc/sysctl.conf; then
    echo "配置网络参数..."
    cat >> /etc/sysctl.conf << 'EOF'

# GEO系统性能优化 - geo-system optimization
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
fs.file-max = 2097152
EOF
    sysctl -p
    echo -e "${GREEN}✅ 网络参数已配置${NC}"
else
    echo -e "${YELLOW}⚠️  网络参数已存在，跳过${NC}"
fi
echo ""

# 6. 重新构建前端（应用 Vite 优化）
echo -e "${YELLOW}📝 步骤 6/6: 重新构建前端${NC}"
read -p "是否重新构建前端？这将应用 Vite 优化配置 (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd client
    echo "安装依赖..."
    npm install
    echo "构建前端..."
    npm run build
    echo -e "${GREEN}✅ 前端已重新构建${NC}"
    cd ..
else
    echo -e "${YELLOW}⚠️  跳过前端构建${NC}"
fi
echo ""

# 完成
echo "================================"
echo -e "${GREEN}🎉 性能优化完成！${NC}"
echo ""
echo "📊 优化内容："
echo "  ✅ Nginx 配置优化（Gzip、缓存、sendfile）"
echo "  ✅ PostgreSQL 配置优化（内存、连接、查询）"
echo "  ✅ Redis 配置优化（内存、持久化）"
echo "  ✅ 系统参数优化（文件描述符、网络）"
echo "  ✅ 前端构建优化（代码分割、压缩）"
echo ""
echo "📝 下一步建议："
echo "  1. 清理浏览器缓存后测试"
echo "  2. 使用 Lighthouse 测试性能"
echo "  3. 监控服务器资源使用情况"
echo "  4. 考虑接入 CDN 服务"
echo ""
echo "📖 详细文档："
echo "  docs/07-性能优化/服务器性能优化指南.md"
echo ""
