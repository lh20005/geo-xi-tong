#!/bin/bash

echo "=========================================="
echo "测试单个关键词的话题轮换"
echo "=========================================="
echo ""

DISTILLATION_ID=2
echo "使用蒸馏结果: ID=$DISTILLATION_ID (英国留学机构)"
echo ""

# 1. 查看初始话题使用情况
echo "1. 查看初始话题使用情况..."
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | \
  jq '.topics[0:5] | map({topicId, question: .question[0:30], usageCount})' > /tmp/topics_before.json

echo "前5个话题的使用情况:"
cat /tmp/topics_before.json | jq '.'
echo ""

# 2. 创建任务（生成3篇文章，但只使用这一个关键词）
echo "2. 创建任务（生成3篇文章）..."

# 注意：这里我们需要手动构造一个任务，让它只使用蒸馏结果2
# 但是系统会自动选择3个不同的蒸馏结果
# 所以我们需要创建3个任务，每个任务生成1篇文章

for i in {1..3}; do
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
  echo "    任务ID: $TASK_ID"
  
  # 等待任务完成
  sleep 15
done

echo ""
echo "3. 等待所有任务完成..."
sleep 10
echo ""

# 4. 查看话题使用情况变化
echo "4. 查看话题使用情况变化..."
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | \
  jq '.topics[0:5] | map({topicId, question: .question[0:30], usageCount})' > /tmp/topics_after.json

echo "前5个话题的使用情况:"
cat /tmp/topics_after.json | jq '.'
echo ""

# 5. 对比变化
echo "5. 对比话题使用次数变化..."
echo ""
echo "话题ID | 话题 | 使用前 | 使用后 | 变化"
echo "-------|------|--------|--------|------"

for i in {0..4}; do
  TOPIC_ID=$(cat /tmp/topics_before.json | jq -r ".[$i].topicId")
  QUESTION=$(cat /tmp/topics_before.json | jq -r ".[$i].question")
  BEFORE=$(cat /tmp/topics_before.json | jq -r ".[$i].usageCount")
  AFTER=$(cat /tmp/topics_after.json | jq -r ".[$i].usageCount")
  DIFF=$((AFTER - BEFORE))
  
  if [ $DIFF -gt 0 ]; then
    echo "$TOPIC_ID | $QUESTION | $BEFORE | $AFTER | +$DIFF ✓"
  else
    echo "$TOPIC_ID | $QUESTION | $BEFORE | $AFTER | $DIFF"
  fi
done

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "预期结果："
echo "- 前3个话题的usageCount应该各增加1"
echo "- 每篇文章应该使用不同的话题"
