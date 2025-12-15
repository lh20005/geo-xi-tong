#!/bin/bash

echo "=========================================="
echo "话题轮换测试 - 最终验证"
echo "=========================================="
echo ""

DISTILLATION_ID=2
echo "测试蒸馏结果: ID=$DISTILLATION_ID (英国留学机构)"
echo ""

# 1. 查看当前话题使用情况
echo "1. 查看当前话题使用情况..."
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | \
  jq '.topics | map({topicId, usageCount}) | group_by(.usageCount) | map({usageCount: .[0].usageCount, count: length, topicIds: map(.topicId)})' > /tmp/topic_stats.json

cat /tmp/topic_stats.json | jq '.'
echo ""

# 2. 创建5个单篇文章任务
echo "2. 创建5个单篇文章任务..."
TASK_IDS=()

for i in {1..5}; do
  echo "  创建任务 $i..."
  TASK_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/article-generation/tasks" \
    -H "Content-Type: application/json" \
    -d "{
      \"distillationId\": $DISTILLATION_ID,
      \"albumId\": 3,
      \"knowledgeBaseId\": 1,
      \"articleSettingId\": 2,
      \"articleCount\": 1
    }")
  
  TASK_ID=$(echo $TASK_RESPONSE | jq -r '.taskId')
  TASK_IDS+=($TASK_ID)
  echo "    任务ID: $TASK_ID"
  
  # 等待一小会儿，让任务开始执行
  sleep 3
done

echo ""
echo "3. 等待所有任务完成..."
sleep 60

echo ""
echo "4. 查看每个任务使用的话题..."
echo ""
echo "任务ID | 话题ID | 话题"
echo "-------|--------|------"

for TASK_ID in "${TASK_IDS[@]}"; do
  ARTICLE=$(curl -s "http://localhost:3000/api/articles?taskId=$TASK_ID" | jq -r '.articles[0]')
  TOPIC_ID=$(echo $ARTICLE | jq -r '.topicId')
  
  if [ "$TOPIC_ID" != "null" ]; then
    TOPIC_INFO=$(curl -s "http://localhost:3000/api/topics/$TOPIC_ID/stats" | jq -r '.question')
    echo "$TASK_ID | $TOPIC_ID | ${TOPIC_INFO:0:30}..."
  else
    echo "$TASK_ID | - | 任务未完成或失败"
  fi
done

echo ""
echo "5. 查看更新后的话题使用情况..."
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | \
  jq '.topics | map({topicId, usageCount}) | group_by(.usageCount) | map({usageCount: .[0].usageCount, count: length, topicIds: map(.topicId)})' > /tmp/topic_stats_after.json

cat /tmp/topic_stats_after.json | jq '.'

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "验证要点："
echo "1. ✓ 每个任务应该使用不同的话题"
echo "2. ✓ 话题按ID顺序轮换（在相同usage_count的话题中）"
echo "3. ✓ 优先使用usage_count最小的话题"
