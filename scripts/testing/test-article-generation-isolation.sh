#!/bin/bash

# 测试文章生成任务的多租户隔离
# 验证用户lzc2005不能看到testuser的任务

echo "=========================================="
echo "测试文章生成任务的多租户隔离"
echo "=========================================="
echo ""

# 服务器地址
SERVER="http://localhost:3001"

# 测试账号
USER1="lzc2005"
PASS1="lzc2005"
USER2="testuser"
PASS2="testuser123"

echo "步骤 1: 用户 $USER1 登录..."
LOGIN1_RESPONSE=$(curl -s -X POST "$SERVER/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER1\",\"password\":\"$PASS1\"}")

TOKEN1=$(echo $LOGIN1_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN1" ]; then
  echo "❌ 用户 $USER1 登录失败"
  echo "响应: $LOGIN1_RESPONSE"
  exit 1
fi

echo "✅ 用户 $USER1 登录成功"
echo ""

echo "步骤 2: 用户 $USER2 登录..."
LOGIN2_RESPONSE=$(curl -s -X POST "$SERVER/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER2\",\"password\":\"$PASS2\"}")

TOKEN2=$(echo $LOGIN2_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN2" ]; then
  echo "❌ 用户 $USER2 登录失败"
  echo "响应: $LOGIN2_RESPONSE"
  exit 1
fi

echo "✅ 用户 $USER2 登录成功"
echo ""

echo "步骤 3: 用户 $USER1 获取文章生成任务列表..."
TASKS1=$(curl -s -X GET "$SERVER/api/article-generation/tasks?page=1&pageSize=100" \
  -H "Authorization: Bearer $TOKEN1")

echo "用户 $USER1 的任务列表:"
echo "$TASKS1" | jq '.tasks[] | {id, keyword, userId}'
echo ""

echo "步骤 4: 用户 $USER2 获取文章生成任务列表..."
TASKS2=$(curl -s -X GET "$SERVER/api/article-generation/tasks?page=1&pageSize=100" \
  -H "Authorization: Bearer $TOKEN2")

echo "用户 $USER2 的任务列表:"
echo "$TASKS2" | jq '.tasks[] | {id, keyword, userId}'
echo ""

echo "步骤 5: 验证数据隔离..."

# 获取用户1的任务ID列表
USER1_TASK_IDS=$(echo "$TASKS1" | jq -r '.tasks[].id')
# 获取用户2的任务ID列表
USER2_TASK_IDS=$(echo "$TASKS2" | jq -r '.tasks[].id')

# 检查是否有重复
OVERLAP=0
for id1 in $USER1_TASK_IDS; do
  for id2 in $USER2_TASK_IDS; do
    if [ "$id1" = "$id2" ]; then
      echo "❌ 发现重复任务ID: $id1"
      OVERLAP=1
    fi
  done
done

if [ $OVERLAP -eq 0 ]; then
  echo "✅ 数据隔离验证通过：两个用户看不到对方的任务"
else
  echo "❌ 数据隔离验证失败：存在任务ID重复"
  exit 1
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
