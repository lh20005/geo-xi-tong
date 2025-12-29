#!/bin/bash

# 多租户数据隔离实施脚本

echo "=========================================="
echo "  多租户数据隔离实施向导"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

echo "📋 实施步骤："
echo "  1. 备份数据库"
echo "  2. 执行数据库迁移"
echo "  3. 验证迁移结果"
echo ""

# 询问是否继续
read -p "是否继续？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 步骤1: 备份数据库
echo ""
echo -e "${YELLOW}步骤1: 备份数据库...${NC}"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

# 从环境变量读取数据库配置
if [ -f ".env" ]; then
    source .env
fi

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-geo_system}
DB_USER=${DB_USER:-postgres}

echo "数据库配置："
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

read -p "是否备份数据库？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "正在备份到 $BACKUP_FILE ..."
    PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库备份成功: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}❌ 数据库备份失败${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  跳过数据库备份${NC}"
fi

# 步骤2: 执行迁移
echo ""
echo -e "${YELLOW}步骤2: 执行数据库迁移...${NC}"
echo ""

# 编译TypeScript
echo "编译TypeScript..."
npx tsc server/src/db/migrate-multi-tenancy.ts --esModuleInterop --resolveJsonModule --skipLibCheck

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript编译失败${NC}"
    exit 1
fi

# 执行迁移
echo "执行迁移脚本..."
node server/src/db/migrate-multi-tenancy.js

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 数据库迁移成功！${NC}"
else
    echo ""
    echo -e "${RED}❌ 数据库迁移失败${NC}"
    echo ""
    echo "如需回滚，请执行："
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME < $BACKUP_FILE"
    exit 1
fi

# 步骤3: 验证迁移
echo ""
echo -e "${YELLOW}步骤3: 验证迁移结果...${NC}"
echo ""

# 检查表结构
echo "检查表结构..."
TABLES=("albums" "knowledge_bases" "conversion_targets" "article_settings" "distillations" "articles" "generation_tasks" "platform_accounts" "api_configs")

for table in "${TABLES[@]}"; do
    HAS_USER_ID=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='$table' AND column_name='user_id';")
    
    if [ -n "$HAS_USER_ID" ]; then
        echo -e "  ${GREEN}✓${NC} $table 表已添加 user_id 字段"
    else
        echo -e "  ${RED}✗${NC} $table 表缺少 user_id 字段"
    fi
done

echo ""
echo -e "${GREEN}=========================================="
echo "  多租户数据隔离实施完成！"
echo "==========================================${NC}"
echo ""
echo "📝 下一步："
echo "  1. 查看实施指南: MULTI_TENANCY_IMPLEMENTATION_GUIDE.md"
echo "  2. 修改路由和服务层代码"
echo "  3. 参考示例: server/src/routes/albums-multi-tenant-example.ts"
echo "  4. 测试功能"
echo ""
echo "⚠️  注意："
echo "  - 现有数据已关联到用户ID=1"
echo "  - 需要更新所有路由以支持数据隔离"
echo "  - 备份文件: $BACKUP_FILE"
echo ""
