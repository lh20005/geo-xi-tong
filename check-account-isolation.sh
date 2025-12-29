#!/bin/bash

# 平台账号隔离问题自动检查脚本

echo ""
echo "========================================"
echo "🔍 平台账号隔离问题检查"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查数据库连接
echo "1. 检查数据库连接..."
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql 未安装，无法直接查询数据库${NC}"
    echo "   使用 Node.js 脚本代替..."
    
    if [ -f "server/check-user-accounts.js" ]; then
        node server/check-user-accounts.js
    else
        echo -e "${RED}❌ 检查脚本不存在${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ psql 已安装${NC}"
    
    # 读取数据库配置
    if [ -f ".env" ]; then
        export $(cat .env | grep DATABASE_URL | xargs)
    fi
    
    # 查询用户信息
    echo ""
    echo "2. 查询用户信息..."
    psql "$DATABASE_URL" -c "
        SELECT id, username, email, created_at 
        FROM users 
        WHERE username IN ('lzc2005', 'testuser')
        ORDER BY id;
    "
    
    # 查询平台账号
    echo ""
    echo "3. 查询平台账号归属..."
    psql "$DATABASE_URL" -c "
        SELECT 
          pa.id,
          pa.platform_id,
          pa.account_name,
          pa.real_username,
          pa.user_id,
          u.username as owner_username,
          pa.created_at
        FROM platform_accounts pa
        LEFT JOIN users u ON pa.user_id = u.id
        WHERE u.username IN ('lzc2005', 'testuser')
        ORDER BY pa.user_id, pa.created_at DESC;
    "
    
    # 检查重复账号
    echo ""
    echo "4. 检查重复账号..."
    DUPLICATES=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*)
        FROM platform_accounts pa1
        JOIN platform_accounts pa2 ON 
          pa1.platform_id = pa2.platform_id 
          AND pa1.real_username = pa2.real_username
          AND pa1.id < pa2.id
        LEFT JOIN users u1 ON pa1.user_id = u1.id
        LEFT JOIN users u2 ON pa2.user_id = u2.id
        WHERE u1.username IN ('lzc2005', 'testuser')
           OR u2.username IN ('lzc2005', 'testuser');
    " | tr -d ' ')
    
    if [ "$DUPLICATES" -gt 0 ]; then
        echo -e "${RED}❌ 发现 $DUPLICATES 个重复账号${NC}"
        psql "$DATABASE_URL" -c "
            SELECT 
              pa1.id as account1_id,
              u1.username as user1_name,
              pa2.id as account2_id,
              u2.username as user2_name,
              pa1.platform_id,
              pa1.real_username
            FROM platform_accounts pa1
            JOIN platform_accounts pa2 ON 
              pa1.platform_id = pa2.platform_id 
              AND pa1.real_username = pa2.real_username
              AND pa1.id < pa2.id
            LEFT JOIN users u1 ON pa1.user_id = u1.id
            LEFT JOIN users u2 ON pa2.user_id = u2.id
            WHERE u1.username IN ('lzc2005', 'testuser')
               OR u2.username IN ('lzc2005', 'testuser');
        "
    else
        echo -e "${GREEN}✅ 没有发现重复账号${NC}"
    fi
fi

echo ""
echo "========================================"
echo "📋 检查完成"
echo "========================================"
echo ""
echo "下一步操作："
echo "1. 如果发现 token 相同，请参考 '账号隔离问题诊断指南.md' 中的方案 1"
echo "2. 如果发现数据库归属错误，请参考方案 2"
echo "3. 如果发现重复账号，请参考方案 3"
echo ""
