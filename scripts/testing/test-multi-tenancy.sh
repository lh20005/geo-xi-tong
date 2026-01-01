#!/bin/bash

# 多租户功能测试脚本

echo "=========================================="
echo "  多租户功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试数据库迁移结果
echo -e "${YELLOW}1. 验证数据库迁移...${NC}"
echo ""

# 检查user_id字段
TABLES=("albums" "knowledge_bases" "conversion_targets" "article_settings" "distillations" "articles" "generation_tasks" "platform_accounts" "api_configs")

for table in "${TABLES[@]}"; do
    HAS_USER_ID=$(psql -d geo_system -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='$table' AND column_name='user_id';" 2>/dev/null)
    
    if [ -n "$HAS_USER_ID" ]; then
        echo -e "  ${GREEN}✓${NC} $table 表已添加 user_id 字段"
    else
        echo -e "  ${RED}✗${NC} $table 表缺少 user_id 字段"
    fi
done

echo ""
echo -e "${YELLOW}2. 检查现有数据...${NC}"
echo ""

# 统计各表的数据量
for table in "${TABLES[@]}"; do
    COUNT=$(psql -d geo_system -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
    USER1_COUNT=$(psql -d geo_system -t -c "SELECT COUNT(*) FROM $table WHERE user_id = 1;" 2>/dev/null | tr -d ' ')
    
    if [ "$COUNT" -gt 0 ]; then
        echo "  $table: 总计 $COUNT 条，用户1拥有 $USER1_COUNT 条"
    fi
done

echo ""
echo -e "${YELLOW}3. 检查索引...${NC}"
echo ""

# 检查user_id索引
for table in "${TABLES[@]}"; do
    INDEX_NAME="idx_${table}_user_id"
    HAS_INDEX=$(psql -d geo_system -t -c "SELECT indexname FROM pg_indexes WHERE tablename='$table' AND indexname='$INDEX_NAME';" 2>/dev/null)
    
    if [ -n "$HAS_INDEX" ]; then
        echo -e "  ${GREEN}✓${NC} $table 表已创建 user_id 索引"
    else
        echo -e "  ${YELLOW}⚠${NC}  $table 表缺少 user_id 索引"
    fi
done

echo ""
echo -e "${GREEN}=========================================="
echo "  测试完成！"
echo "==========================================${NC}"
echo ""
echo "📝 下一步："
echo "  1. 启动服务器测试API"
echo "  2. 创建第二个测试用户"
echo "  3. 验证数据隔离"
echo ""
