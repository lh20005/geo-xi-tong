#!/bin/bash

# 话题轮换使用功能测试脚本

echo "=========================================="
echo "话题轮换使用功能测试"
echo "=========================================="
echo ""

# 选择一个蒸馏结果进行测试
DISTILLATION_ID=2
echo "测试蒸馏结果ID: $DISTILLATION_ID"
echo ""

# 1. 查看初始状态
echo "1. 查看话题初始使用情况..."
echo "API: GET /api/topics/distillation/$DISTILLATION_ID/stats"
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | jq '{
  distillationId,
  total,
  topicsPreview: .topics[0:5] | map({topicId, question: .question[0:30] + "...", usageCount})
}' > /tmp/topics_before.json

cat /tmp/topics_before.json
echo ""

# 2. 获取必要的配置ID
echo "2. 获取配置信息..."

# 获取图库ID
ALBUM_ID=$(curl -s "http://localhost:3000/api/gallery/albums" | jq -r '.albums[0].id')
echo "图库ID: $ALBUM_ID"

# 获取知识库ID
KB_ID=$(curl -s "http://localhost:3000/api/knowledge-bases" | jq -r '.knowledgeBases[0].id')
echo "知识库ID: $KB_ID"

# 获取文章设置ID
SETTING_ID=$(curl -s "http://localhost:3000/api/article-settings" | jq -r '.settings[0].id')
echo "文章设置ID: $SETTING_ID"
echo ""

# 3. 创建文章生成任务（生成3篇文章）
echo "3. 创建文章生成任务（生成3篇文章）..."
echo "API: POST /api/article-generation/tasks"

TASK_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/article-generation/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"distillationId\": $DISTILLATION_ID,
    \"albumId\": $ALBUM_ID,
    \"knowledgeBaseId\": $KB_ID,
    \"articleSettingId\": $SETTING_ID,
    \"articleCount\": 3
  }")

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.taskId')
echo "任务ID: $TASK_ID"
echo "任务状态: $(echo $TASK_RESPONSE | jq -r '.status')"
echo ""

# 4. 等待任务完成
echo "4. 等待任务完成..."
MAX_WAIT=60
WAIT_TIME=0

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  TASK_STATUS=$(curl -s "http://localhost:3000/api/article-generation/tasks/$TASK_ID" | jq -r '.status')
  PROGRESS=$(curl -s "http://localhost:3000/api/article-generation/tasks/$TASK_ID" | jq -r '.progress')
  
  echo "  状态: $TASK_STATUS, 进度: $PROGRESS%"
  
  if [ "$TASK_STATUS" = "completed" ] || [ "$TASK_STATUS" = "failed" ]; then
    break
  fi
  
  sleep 3
  WAIT_TIME=$((WAIT_TIME + 3))
done

echo ""

# 5. 查看任务结果
echo "5. 查看任务结果..."
TASK_DETAIL=$(curl -s "http://localhost:3000/api/article-generation/tasks/$TASK_ID")
echo $TASK_DETAIL | jq '{
  taskId,
  status,
  requestedCount,
  generatedCount,
  progress
}'
echo ""

# 6. 查看话题使用情况变化
echo "6. 查看话题使用情况变化..."
echo "API: GET /api/topics/distillation/$DISTILLATION_ID/stats"
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | jq '{
  distillationId,
  total,
  topicsPreview: .topics[0:5] | map({topicId, question: .question[0:30] + "...", usageCount, lastUsedAt})
}' > /tmp/topics_after.json

cat /tmp/topics_after.json
echo ""

# 7. 对比变化
echo "7. 对比话题使用次数变化..."
echo ""
echo "话题ID | 使用前 | 使用后 | 变化"
echo "-------|--------|--------|------"

for i in {0..4}; do
  TOPIC_ID=$(cat /tmp/topics_before.json | jq -r ".topicsPreview[$i].topicId")
  BEFORE=$(cat /tmp/topics_before.json | jq -r ".topicsPreview[$i].usageCount")
  AFTER=$(cat /tmp/topics_after.json | jq -r ".topicsPreview[$i].usageCount")
  DIFF=$((AFTER - BEFORE))
  
  if [ $DIFF -gt 0 ]; then
    echo "$TOPIC_ID | $BEFORE | $AFTER | +$DIFF ✓"
  else
    echo "$TOPIC_ID | $BEFORE | $AFTER | $DIFF"
  fi
done

echo ""

# 8. 查看生成的文章使用了哪些话题
echo "8. 查看生成的文章使用了哪些话题..."
GENERATED_COUNT=$(echo $TASK_DETAIL | jq -r '.generatedCount')

if [ "$GENERATED_COUNT" -gt 0 ]; then
  echo "成功生成 $GENERATED_COUNT 篇文章"
  echo ""
  
  # 获取该任务生成的文章
  ARTICLES=$(curl -s "http://localhost:3000/api/articles?taskId=$TASK_ID&pageSize=10")
  
  echo "文章列表："
  echo $ARTICLES | jq '.articles[] | {
    id,
    title: .title[0:40] + "...",
    topicId,
    distillationKeyword
  }'
  echo ""
  
  # 查看第一篇文章使用的话题详情
  FIRST_ARTICLE_TOPIC_ID=$(echo $ARTICLES | jq -r '.articles[0].topicId')
  
  if [ "$FIRST_ARTICLE_TOPIC_ID" != "null" ]; then
    echo "第一篇文章使用的话题详情："
    curl -s "http://localhost:3000/api/topics/$FIRST_ARTICLE_TOPIC_ID/stats" | jq '{
      topicId,
      question,
      usageCount,
      lastUsedAt,
      articlesCount: .articles | length
    }'
  fi
else
  echo "❌ 没有成功生成文章"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "验证要点："
echo "1. ✓ 话题使用次数应该增加"
echo "2. ✓ 每篇文章应该使用不同的话题"
echo "3. ✓ 使用次数最少的话题应该被优先选择"
echo "4. ✓ 文章记录了topic_id字段"
