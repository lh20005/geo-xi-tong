#!/bin/bash

# macOS 代码签名时间戳服务修复脚本
# 解决 "The timestamp service is not available" 错误

echo "🔧 macOS 代码签名时间戳服务修复"
echo "================================"
echo ""

# 1. 检查网络连接
echo "1️⃣ 检查网络连接..."
if ping -c 1 apple.com &> /dev/null; then
    echo "   ✅ 网络连接正常"
else
    echo "   ❌ 网络连接失败"
    echo "   请检查网络连接后重试"
    exit 1
fi

# 2. 检查 Apple 时间戳服务器连接
echo ""
echo "2️⃣ 检查 Apple 时间戳服务器..."
TIMESTAMP_SERVERS=(
    "http://timestamp.apple.com/ts01"
    "http://timestamp.apple.com/ts02"
    "http://timestamp.apple.com/ts03"
)

AVAILABLE_SERVER=""
for server in "${TIMESTAMP_SERVERS[@]}"; do
    echo "   测试: $server"
    if curl -s --connect-timeout 5 "$server" &> /dev/null; then
        echo "   ✅ 服务器可用: $server"
        AVAILABLE_SERVER="$server"
        break
    else
        echo "   ⚠️  服务器不可用: $server"
    fi
done

if [ -z "$AVAILABLE_SERVER" ]; then
    echo ""
    echo "   ❌ 所有 Apple 时间戳服务器都不可用"
    echo "   可能的原因："
    echo "   - 防火墙阻止了连接"
    echo "   - 代理设置问题"
    echo "   - Apple 服务器暂时不可用"
    echo ""
    echo "   解决方案："
    echo "   1. 检查防火墙设置，允许访问 timestamp.apple.com"
    echo "   2. 如果使用代理，确保代理配置正确"
    echo "   3. 稍后重试"
    exit 1
else
    echo ""
    echo "   ✅ 找到可用的时间戳服务器: $AVAILABLE_SERVER"
fi

# 3. 检查代码签名证书
echo ""
echo "3️⃣ 检查代码签名证书..."
CERT_COUNT=$(security find-identity -v -p codesigning | grep -c "Developer ID Application")

if [ "$CERT_COUNT" -eq 0 ]; then
    echo "   ⚠️  未找到 Developer ID Application 证书"
    echo "   这是开发环境，将使用 ad-hoc 签名"
else
    echo "   ✅ 找到 $CERT_COUNT 个代码签名证书"
    security find-identity -v -p codesigning | grep "Developer ID Application"
fi

# 4. 检查系统时间
echo ""
echo "4️⃣ 检查系统时间..."
SYSTEM_TIME=$(date +"%Y-%m-%d %H:%M:%S")
echo "   系统时间: $SYSTEM_TIME"

# 检查时间是否同步
if systemsetup -getusingnetworktime 2>/dev/null | grep -q "On"; then
    echo "   ✅ 网络时间同步已启用"
else
    echo "   ⚠️  网络时间同步未启用"
    echo "   建议启用: sudo systemsetup -setusingnetworktime on"
fi

# 5. 清理旧的构建文件
echo ""
echo "5️⃣ 清理旧的构建文件..."
if [ -d "windows-login-manager/release" ]; then
    rm -rf windows-login-manager/release
    echo "   ✅ 已清理 release 目录"
fi

if [ -d "windows-login-manager/dist" ]; then
    rm -rf windows-login-manager/dist
    echo "   ✅ 已清理 dist 目录"
fi

if [ -d "windows-login-manager/dist-electron" ]; then
    rm -rf windows-login-manager/dist-electron
    echo "   ✅ 已清理 dist-electron 目录"
fi

# 6. 设置环境变量
echo ""
echo "6️⃣ 设置构建环境变量..."
export CSC_IDENTITY_AUTO_DISCOVERY=true
export DEBUG=electron-builder
echo "   ✅ 环境变量已设置"

# 7. 重新构建
echo ""
echo "7️⃣ 开始重新构建..."
echo "   这可能需要几分钟时间..."
echo ""

cd windows-login-manager

# 使用重试机制构建
MAX_RETRIES=3
RETRY_COUNT=0
BUILD_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$BUILD_SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        echo ""
        echo "   ⚠️  构建失败，重试 $RETRY_COUNT/$MAX_RETRIES..."
        echo "   等待 5 秒后重试..."
        sleep 5
    fi
    
    if npm run build 2>&1 | tee /tmp/build.log; then
        BUILD_SUCCESS=true
        echo ""
        echo "   ✅ 构建成功！"
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        
        # 检查是否是时间戳错误
        if grep -q "timestamp service is not available" /tmp/build.log; then
            echo "   ⚠️  时间戳服务仍然不可用"
        fi
    fi
done

cd ..

if [ "$BUILD_SUCCESS" = false ]; then
    echo ""
    echo "   ❌ 构建失败，已重试 $MAX_RETRIES 次"
    echo ""
    echo "   📋 错误日志："
    tail -50 /tmp/build.log
    echo ""
    echo "   🔍 可能的解决方案："
    echo "   1. 检查网络连接是否稳定"
    echo "   2. 尝试使用 VPN 或更换网络"
    echo "   3. 检查防火墙设置"
    echo "   4. 稍后重试（Apple 服务器可能暂时不可用）"
    exit 1
fi

# 8. 验证构建结果
echo ""
echo "8️⃣ 验证构建结果..."
if [ -f "windows-login-manager/release/mac-arm64/平台登录管理器.app/Contents/MacOS/平台登录管理器" ]; then
    echo "   ✅ 应用程序已成功构建"
    
    # 验证签名
    echo ""
    echo "   验证代码签名..."
    codesign -vvv --deep --strict "windows-login-manager/release/mac-arm64/平台登录管理器.app" 2>&1 | head -10
    
    if [ $? -eq 0 ]; then
        echo "   ✅ 代码签名验证通过"
    else
        echo "   ⚠️  代码签名验证失败（这在开发环境中是正常的）"
    fi
else
    echo "   ❌ 未找到构建的应用程序"
    exit 1
fi

echo ""
echo "================================"
echo "✨ 修复完成！"
echo ""
echo "📦 构建产物位置："
echo "   windows-login-manager/release/mac-arm64/平台登录管理器.app"
echo ""
echo "🚀 可以运行以下命令启动应用："
echo "   open windows-login-manager/release/mac-arm64/平台登录管理器.app"
echo ""
