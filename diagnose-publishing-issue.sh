#!/bin/bash

echo "=========================================="
echo "诊断发布任务问题"
echo "=========================================="
echo ""

# 检查 .env 文件
if [ ! -f ".env" ]; then
  echo "❌ 错误: .env 文件不存在"
  exit 1
fi

source .env

if [ -z "$DATABASE_URL" ]; then
  echo "❌ 错误: DATABASE_URL 未配置"
  exit 1
fi

echo "✅ 数据库连接配置正常"
echo ""

# 检查表是否存在
echo "=========================================="
echo "1. 检查数据库表"
echo "=========================================="
echo ""

TABLES=$(psql "$DATABASE_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('platform_accounts', 'publishing_tasks', 'publishing_logs', 'platforms_config') ORDER BY table_name;")

if [ -z "$TABLES" ]; then
  echo "❌ 发布系统表不存在！"
  echo ""
  echo "请运行迁移："
  echo "  ./run-publishing-migration.sh"
  echo ""
  exit 1
fi

echo "✅ 找到以下表："
echo "$TABLES"
echo ""

# 检查平台配置
echo "=========================================="
echo "2. 检查平台配置"
echo "=========================================="
echo ""

PLATFORM_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM platforms_config;")

if [ "$PLATFORM_COUNT" -eq 0 ]; then
  echo "❌ 平台配置为空！"
  echo ""
  echo "请运行迁移："
  echo "  ./run-publishing-migration.sh"
  echo ""
  exit 1
fi

echo "✅ 找到 $PLATFORM_COUNT 个平台配置"
echo ""

psql "$DATABASE_URL" -c "SELECT platform_id, platform_name, is_enabled FROM platforms_config ORDER BY platform_id;"
echo ""

# 检查账号
echo "=========================================="
echo "3. 检查平台账号"
echo "=========================================="
echo ""

ACCOUNT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM platform_accounts;")

if [ "$ACCOUNT_COUNT" -eq 0 ]; then
  echo "⚠️  警告: 没有绑定任何平台账号"
  echo ""
  echo "请在'平台登录'页面绑定账号"
  echo ""
else
  echo "✅ 找到 $ACCOUNT_COUNT 个平台账号"
  echo ""
  psql "$DATABASE_URL" -c "SELECT id, platform_id, account_name, status, is_default FROM platform_accounts ORDER BY id;"
  echo ""
fi

# 检查发布任务
echo "=========================================="
echo "4. 检查发布任务"
echo "=========================================="
echo ""

TASK_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM publishing_tasks;")

echo "发布任务总数: $TASK_COUNT"
echo ""

if [ "$TASK_COUNT" -gt 0 ]; then
  psql "$DATABASE_URL" -c "SELECT id, article_id, platform_id, status, created_at FROM publishing_tasks ORDER BY id DESC LIMIT 10;"
  echo ""
fi

# 检查最近的错误
echo "=========================================="
echo "5. 检查最近的错误日志"
echo "=========================================="
echo ""

ERROR_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM publishing_logs WHERE level = 'error';")

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "⚠️  找到 $ERROR_COUNT 条错误日志"
  echo ""
  psql "$DATABASE_URL" -c "SELECT task_id, message, created_at FROM publishing_logs WHERE level = 'error' ORDER BY created_at DESC LIMIT 5;"
  echo ""
else
  echo "✅ 没有错误日志"
  echo ""
fi

# 总结
echo "=========================================="
echo "诊断总结"
echo "=========================================="
echo ""

if [ "$ACCOUNT_COUNT" -eq 0 ]; then
  echo "⚠️  需要绑定平台账号"
  echo "   1. 打开应用"
  echo "   2. 进入'平台登录'页面"
  echo "   3. 选择平台并点击'浏览器登录'"
  echo ""
fi

if [ "$TASK_COUNT" -eq 0 ]; then
  echo "ℹ️  还没有创建任何发布任务"
  echo "   1. 确保已绑定平台账号"
  echo "   2. 进入'文章管理'页面"
  echo "   3. 点击'发布到平台'按钮"
  echo ""
else
  echo "✅ 系统运行正常"
  echo ""
fi

echo "如果创建任务后没有记录，请检查："
echo "  1. 服务器日志（npm run dev 的输出）"
echo "  2. 浏览器控制台的错误信息"
echo "  3. 网络请求是否成功（F12 -> Network）"
echo ""
