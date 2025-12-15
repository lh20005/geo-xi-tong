# 蒸馏结果删除功能测试指南

## 快速测试

### 前提条件
- 服务器正在运行（`npm run dev`）
- 数据库中有蒸馏结果数据

### 测试步骤

#### 1. 通过 UI 测试（推荐）

1. 打开浏览器访问应用
2. 导航到"蒸馏结果"页面
3. 选中一个或多个话题（勾选复选框）
4. 点击"删除选中"按钮
5. 确认删除对话框
6. 验证：
   - ✅ 显示成功消息："成功删除 N 个话题"
   - ✅ 页面自动刷新
   - ✅ 被删除的话题不再显示
   - ✅ 统计数据正确更新

#### 2. 通过 API 测试

##### 测试 1: 删除单个话题（数字 ID）
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": [1]}'
```

**预期响应**:
```json
{
  "success": true,
  "deletedCount": 1
}
```

##### 测试 2: 批量删除（数字 ID）
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": [2, 3, 4]}'
```

**预期响应**:
```json
{
  "success": true,
  "deletedCount": 3
}
```

##### 测试 3: 字符串类型 ID
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": ["5", "6"]}'
```

**预期响应**:
```json
{
  "success": true,
  "deletedCount": 2
}
```

##### 测试 4: 混合类型 ID
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": [7, "8", 9]}'
```

**预期响应**:
```json
{
  "success": true,
  "deletedCount": 3
}
```

##### 测试 5: 无效 ID 处理
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": ["invalid", -1, 0, null]}'
```

**预期响应**:
```json
{
  "error": "部分话题ID无效",
  "details": "话题ID必须是正整数",
  "invalidIds": ["invalid", -1, 0, null]
}
```

##### 测试 6: 空数组
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": []}'
```

**预期响应**:
```json
{
  "success": true,
  "deletedCount": 0
}
```

##### 测试 7: 缺少参数
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**预期响应**:
```json
{
  "error": "请提供要删除的话题ID数组"
}
```

##### 测试 8: 不存在的 ID
```bash
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": [999999]}'
```

**预期响应**:
```json
{
  "success": true,
  "deletedCount": 0
}
```

## 自动化测试脚本

创建一个测试脚本 `test-delete.sh`：

```bash
#!/bin/bash

echo "=== 蒸馏结果删除功能测试 ==="
echo ""

# 获取一些话题 ID
echo "1. 获取话题列表..."
RESULTS=$(curl -s "http://localhost:3000/api/distillation/results?page=1&pageSize=10")
IDS=$(echo "$RESULTS" | jq -r '.data[].id' | head -5)

if [ -z "$IDS" ]; then
  echo "❌ 没有找到话题，请先创建一些蒸馏结果"
  exit 1
fi

echo "找到话题 ID: $IDS"
echo ""

# 测试删除第一个 ID
FIRST_ID=$(echo "$IDS" | head -1)
echo "2. 测试删除单个话题 (ID: $FIRST_ID)..."
RESPONSE=$(curl -s -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d "{\"topicIds\": [$FIRST_ID]}")

if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ 删除成功"
else
  echo "❌ 删除失败: $RESPONSE"
fi
echo ""

# 测试批量删除
SECOND_ID=$(echo "$IDS" | sed -n '2p')
THIRD_ID=$(echo "$IDS" | sed -n '3p')
echo "3. 测试批量删除 (IDs: $SECOND_ID, $THIRD_ID)..."
RESPONSE=$(curl -s -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d "{\"topicIds\": [$SECOND_ID, $THIRD_ID]}")

if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ 批量删除成功"
else
  echo "❌ 批量删除失败: $RESPONSE"
fi
echo ""

# 测试无效 ID
echo "4. 测试无效 ID 处理..."
RESPONSE=$(curl -s -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d '{"topicIds": ["invalid", -1, 0]}')

if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
  echo "✅ 正确拒绝无效 ID"
else
  echo "❌ 应该拒绝无效 ID"
fi
echo ""

echo "=== 测试完成 ==="
```

运行测试：
```bash
chmod +x test-delete.sh
./test-delete.sh
```

## 常见问题

### Q: 删除后页面没有刷新？
A: 检查前端代码中的 `loadData()` 是否在删除成功后被调用。

### Q: 显示"无效的记录id"错误？
A: 这个问题已经修复。如果仍然出现，请确保：
1. 服务器已重启
2. 路由顺序正确（`DELETE /topics` 在 `DELETE /:id` 之前）

### Q: 删除成功但 deletedCount 为 0？
A: 这表示提供的 ID 在数据库中不存在。检查：
1. ID 是否正确
2. 话题是否已被删除
3. 数据库连接是否正常

### Q: 前端显示的错误信息不清楚？
A: 检查前端错误处理代码，确保正确解析后端返回的错误信息。

## 验证清单

- [ ] 单个话题删除正常
- [ ] 批量删除正常
- [ ] 数字类型 ID 正常
- [ ] 字符串类型 ID 正常
- [ ] 混合类型 ID 正常
- [ ] 无效 ID 被正确拒绝
- [ ] 错误信息清晰明确
- [ ] 删除后页面自动刷新
- [ ] 统计数据正确更新
- [ ] 空数组不报错
- [ ] 不存在的 ID 不报错

## 性能测试

测试大批量删除：
```bash
# 生成 100 个 ID 的数组
IDS=$(seq 1 100 | jq -s '.')
curl -X DELETE "http://localhost:3000/api/distillation/topics" \
  -H "Content-Type: application/json" \
  -d "{\"topicIds\": $IDS}"
```

**预期**：
- 响应时间 < 2 秒
- 事务正确处理
- 返回正确的 deletedCount

---

**最后更新**: 2025-12-15
