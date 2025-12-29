#!/bin/bash

# 登录
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 查看任务737的详情
curl -s -X GET "http://localhost:3000/api/article-generation/tasks/737" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
