#!/bin/bash

echo "======================================"
echo "抖音登录修复验证脚本"
echo "======================================"
echo ""

# 检查编译状态
echo "1. 检查代码编译状态..."
if [ -f "server/dist/services/AccountService.js" ]; then
    echo "✓ 编译文件存在"
    
    # 检查是否包含新的登录检测逻辑
    if grep -q "hasValidPath" server/dist/services/AccountService.js; then
        echo "✓ 新的登录检测逻辑已编译"
    else
        echo "✗ 警告：未找到新的登录检测逻辑，需要重新编译"
        echo ""
        echo "请运行："
        echo "  cd server && npm run build"
        exit 1
    fi
else
    echo "✗ 编译文件不存在，需要编译"
    echo ""
    echo "请运行："
    echo "  cd server && npm run build"
    exit 1
fi

echo ""
echo "2. 检查服务器状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✓ 服务器正在运行"
else
    echo "✗ 服务器未运行"
    echo ""
    echo "请启动服务器："
    echo "  cd server && npm start"
    exit 1
fi

echo ""
echo "3. 获取抖音平台信息..."
PLATFORM_INFO=$(curl -s http://localhost:3000/api/platforms | jq -r '.[] | select(.platform_id=="douyin")')

if [ -n "$PLATFORM_INFO" ]; then
    echo "✓ 找到抖音平台配置"
    echo "$PLATFORM_INFO" | jq '.'
else
    echo "✗ 未找到抖音平台配置"
fi

echo ""
echo "4. 检查现有抖音账号..."
DOUYIN_ACCOUNTS=$(curl -s http://localhost:3000/api/platform-accounts/platform/douyin)
ACCOUNT_COUNT=$(echo "$DOUYIN_ACCOUNTS" | jq '. | length')

echo "当前抖音账号数量: $ACCOUNT_COUNT"

if [ "$ACCOUNT_COUNT" -gt 0 ]; then
    echo ""
    echo "现有账号列表："
    echo "$DOUYIN_ACCOUNTS" | jq -r '.[] | "  - ID: \(.id), 名称: \(.account_name), 创建时间: \(.created_at)"'
    
    echo ""
    echo "⚠️  建议："
    echo "   如果这些账号是在修复前创建的（未真正登录），建议删除后重新登录"
    echo ""
    echo "   删除账号命令："
    echo "$DOUYIN_ACCOUNTS" | jq -r '.[] | "   curl -X DELETE http://localhost:3000/api/platform-accounts/\(.id)"'
fi

echo ""
echo "======================================"
echo "测试步骤"
echo "======================================"
echo ""
echo "请按以下步骤测试修复效果："
echo ""
echo "【测试1：未登录情况】"
echo "1. 打开前端页面：http://localhost:5173"
echo "2. 进入「平台登录」页面"
echo "3. 点击「抖音」平台"
echo "4. 浏览器打开登录页面后，不要登录"
echo "5. 观察：系统应该持续等待，不会保存登录信息"
echo ""
echo "【测试2：正常登录】"
echo "1. 在打开的浏览器中完成登录（扫码或密码）"
echo "2. 等待跳转到创作者中心首页"
echo "3. 观察控制台输出：应该看到「抖音登录成功」"
echo "4. 检查账号列表：应该出现新的抖音账号"
echo ""
echo "【测试3：使用账号发布】"
echo "1. 创建发布任务，选择抖音平台"
echo "2. 选择刚才保存的账号"
echo "3. 执行发布"
echo "4. 观察：应该能成功登录并发布"
echo ""
echo "======================================"
echo "查看日志"
echo "======================================"
echo ""
echo "实时查看服务器日志："
echo "  tail -f server/logs/app.log | grep -i douyin"
echo ""
echo "搜索登录相关日志："
echo "  grep '等待登录.*抖音' server/logs/app.log"
echo "  grep '抖音登录检测' server/logs/app.log"
echo ""
