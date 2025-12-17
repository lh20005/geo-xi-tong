#!/bin/bash

echo "=========================================="
echo "运行发布系统数据库迁移"
echo "=========================================="
echo ""

# 检查 .env 文件
if [ ! -f ".env" ]; then
  echo "❌ 错误: .env 文件不存在"
  echo "请先创建 .env 文件并配置 DATABASE_URL"
  exit 1
fi

# 读取数据库URL
source .env

if [ -z "$DATABASE_URL" ]; then
  echo "❌ 错误: DATABASE_URL 未配置"
  echo "请在 .env 文件中配置 DATABASE_URL"
  exit 1
fi

echo "数据库连接: $DATABASE_URL"
echo ""

# 运行迁移
echo "正在运行迁移..."
psql "$DATABASE_URL" -f server/src/db/migrations/006_add_publishing_system.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "=========================================="
  echo "✅ 迁移成功完成！"
  echo "=========================================="
  echo ""
  echo "已创建以下表："
  echo "  - platform_accounts (平台账号)"
  echo "  - publishing_tasks (发布任务)"
  echo "  - publishing_logs (发布日志)"
  echo "  - platforms_config (平台配置)"
  echo ""
  echo "已插入12个平台配置数据"
  echo ""
else
  echo ""
  echo "=========================================="
  echo "❌ 迁移失败"
  echo "=========================================="
  echo ""
  echo "请检查："
  echo "  1. 数据库连接是否正常"
  echo "  2. 数据库用户是否有创建表的权限"
  echo "  3. 迁移SQL文件是否正确"
  echo ""
  exit 1
fi
