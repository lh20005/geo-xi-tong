#!/bin/bash

# 测试存储配额检查接口的响应
# 需要先登录获取 token

echo "=== 测试存储配额检查接口 ==="
echo ""

# 请替换为你的实际 token
TOKEN="your_token_here"

echo "1. 测试配额检查（假设上传 10MB 文件）"
curl -X POST http://localhost:3000/api/storage/check-quota \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fileSizeBytes": 10485760,
    "resourceType": "image"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "=== 测试完成 ==="
