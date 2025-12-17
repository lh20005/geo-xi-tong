#!/bin/bash

# DOM方案发布测试脚本
# 用于测试各平台的自动发布功能

echo "🧪 DOM方案发布测试脚本"
echo "================================"
echo ""

# 配置参数
PLATFORM_ID="${1:-toutiao}"  # 默认测试头条号
ARTICLE_ID="${2:-1}"         # 默认文章ID为1
API_BASE="http://localhost:3001/api"

echo "📋 测试配置:"
echo "  平台: ${PLATFORM_ID}"
echo "  文章ID: ${ARTICLE_ID}"
echo "  API地址: ${API_BASE}"
echo ""

# 检查服务是否运行
echo "🔍 检查服务状态..."
if ! curl -s "${API_BASE}/health" > /dev/null 2>&1; then
    echo "❌ 服务未运行！请先启动服务："
    echo "   cd server && npm start"
    exit 1
fi
echo "✅ 服务正常运行"
echo ""

# 检查文章是否存在
echo "🔍 检查文章..."
ARTICLE_CHECK=$(curl -s "${API_BASE}/articles/${ARTICLE_ID}")
if echo "$ARTICLE_CHECK" | grep -q "error"; then
    echo "❌ 文章不存在！请使用有效的文章ID"
    exit 1
fi
ARTICLE_TITLE=$(echo "$ARTICLE_CHECK" | jq -r '.title // "未知"')
echo "✅ 找到文章: ${ARTICLE_TITLE}"
echo ""

# 创建发布任务
echo "📝 创建发布任务..."
TASK_RESPONSE=$(curl -s -X POST "${API_BASE}/publishing/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"article_id\": ${ARTICLE_ID},
    \"platforms\": [\"${PLATFORM_ID}\"],
    \"config\": {}
  }")

TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.task.id // empty')

if [ -z "$TASK_ID" ]; then
    echo "❌ 创建任务失败！"
    echo "$TASK_RESPONSE" | jq '.'
    exit 1
fi

echo "✅ 任务已创建: ID = ${TASK_ID}"
echo ""

# 执行任务
echo "🚀 开始执行任务..."
echo "   (浏览器窗口将会打开，请观察发布过程)"
echo ""

EXECUTE_RESPONSE=$(curl -s -X POST "${API_BASE}/publishing/tasks/${TASK_ID}/execute")
echo "$EXECUTE_RESPONSE" | jq '.'
echo ""

# 等待执行完成
echo "⏳ 等待任务执行..."
for i in {1..30}; do
    sleep 2
    STATUS_RESPONSE=$(curl -s "${API_BASE}/publishing/tasks/${TASK_ID}")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
    
    echo -n "."
    
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
        echo ""
        break
    fi
done
echo ""

# 查看最终状态
echo "📊 任务最终状态:"
echo "================================"
curl -s "${API_BASE}/publishing/tasks/${TASK_ID}" | jq '{
  id: .id,
  status: .status,
  article_title: .article.title,
  platforms: .platforms,
  created_at: .created_at,
  updated_at: .updated_at
}'
echo ""

# 查看平台执行结果
echo "📋 平台执行结果:"
echo "================================"
curl -s "${API_BASE}/publishing/tasks/${TASK_ID}/results" | jq '.results[] | {
  platform: .platform_id,
  status: .status,
  message: .message,
  published_url: .published_url
}'
echo ""

# 总结
if [ "$STATUS" = "completed" ]; then
    echo "✅ 测试成功！任务已完成"
    echo ""
    echo "💡 提示："
    echo "  - 检查浏览器窗口中的发布结果"
    echo "  - 查看控制台日志了解详细过程"
    echo "  - 访问平台确认文章是否发布成功"
else
    echo "❌ 测试失败！任务状态: ${STATUS}"
    echo ""
    echo "💡 排查建议："
    echo "  1. 查看服务器日志: tail -f server/logs/*.log"
    echo "  2. 检查平台账号配置"
    echo "  3. 确认文章包含图片"
    echo "  4. 验证平台选择器是否正确"
fi

echo ""
echo "================================"
echo "测试完成！"
