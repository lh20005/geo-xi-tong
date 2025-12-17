#!/bin/bash

echo "测试平台登录API..."
echo ""

# 测试平台列表
echo "1. 测试平台列表API:"
curl -s http://localhost:3001/api/publishing/platforms | head -20
echo ""
echo ""

# 测试账号列表
echo "2. 测试账号列表API:"
curl -s http://localhost:3001/api/publishing/accounts | head -20
echo ""
echo ""

echo "如果看到JSON数据，说明API正常工作"
echo "如果看到错误或无响应，请检查："
echo "  1. 后端服务是否运行（npm run dev in server/）"
echo "  2. 端口3001是否被占用"
echo "  3. 数据库是否正常连接"
