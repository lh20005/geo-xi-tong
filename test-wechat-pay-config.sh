#!/bin/bash

# 微信支付配置检查脚本

echo "======================================"
echo "  微信支付配置检查"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数
PASS=0
FAIL=0
WARN=0

# 检查函数
check_env_var() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}✗${NC} $var_name: 未配置"
        ((FAIL++))
        return 1
    else
        echo -e "${GREEN}✓${NC} $var_name: 已配置"
        ((PASS++))
        return 0
    fi
}

# 检查文件
check_file() {
    local file_path=$1
    local file_name=$2
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}✗${NC} $file_name: 文件不存在 ($file_path)"
        ((FAIL++))
        return 1
    else
        echo -e "${GREEN}✓${NC} $file_name: 文件存在"
        
        # 检查文件权限
        local perms=$(stat -f "%A" "$file_path" 2>/dev/null || stat -c "%a" "$file_path" 2>/dev/null)
        if [ "$perms" != "600" ] && [ "$perms" != "400" ]; then
            echo -e "${YELLOW}⚠${NC}  警告: 文件权限为 $perms，建议设置为 600"
            echo "   运行: chmod 600 $file_path"
            ((WARN++))
        fi
        
        ((PASS++))
        return 0
    fi
}

# 加载 .env 文件
if [ -f .env ]; then
    echo "📄 加载 .env 文件..."
    export $(cat .env | grep -v '^#' | xargs)
    echo ""
else
    echo -e "${RED}✗${NC} .env 文件不存在"
    echo "请复制 .env.example 并配置参数："
    echo "  cp .env.example .env"
    exit 1
fi

# 1. 检查必需的环境变量
echo "1️⃣  检查环境变量"
echo "-----------------------------------"
check_env_var "WECHAT_PAY_APP_ID"
check_env_var "WECHAT_PAY_MCH_ID"
check_env_var "WECHAT_PAY_API_V3_KEY"
check_env_var "WECHAT_PAY_SERIAL_NO"
check_env_var "WECHAT_PAY_PRIVATE_KEY_PATH"
check_env_var "WECHAT_PAY_NOTIFY_URL"
echo ""

# 2. 检查配置格式
echo "2️⃣  检查配置格式"
echo "-----------------------------------"

# 检查 AppID 格式
if [ ! -z "$WECHAT_PAY_APP_ID" ]; then
    if [[ $WECHAT_PAY_APP_ID =~ ^wx[a-zA-Z0-9]{16}$ ]]; then
        echo -e "${GREEN}✓${NC} AppID 格式正确"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} AppID 格式错误（应为 wx 开头的18位字符）"
        ((FAIL++))
    fi
fi

# 检查商户号格式
if [ ! -z "$WECHAT_PAY_MCH_ID" ]; then
    if [[ $WECHAT_PAY_MCH_ID =~ ^[0-9]{10}$ ]]; then
        echo -e "${GREEN}✓${NC} 商户号格式正确"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} 商户号格式错误（应为10位数字）"
        ((FAIL++))
    fi
fi

# 检查 API V3 密钥长度
if [ ! -z "$WECHAT_PAY_API_V3_KEY" ]; then
    key_length=${#WECHAT_PAY_API_V3_KEY}
    if [ $key_length -eq 32 ]; then
        echo -e "${GREEN}✓${NC} API V3 密钥长度正确（32位）"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} API V3 密钥长度错误（当前 $key_length 位，应为32位）"
        ((FAIL++))
    fi
fi

# 检查证书序列号格式
if [ ! -z "$WECHAT_PAY_SERIAL_NO" ]; then
    serial_length=${#WECHAT_PAY_SERIAL_NO}
    if [ $serial_length -eq 40 ]; then
        echo -e "${GREEN}✓${NC} 证书序列号长度正确（40位）"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠${NC}  证书序列号长度为 $serial_length 位（通常为40位）"
        ((WARN++))
    fi
fi

# 检查回调 URL 格式
if [ ! -z "$WECHAT_PAY_NOTIFY_URL" ]; then
    if [[ $WECHAT_PAY_NOTIFY_URL =~ ^https:// ]]; then
        echo -e "${GREEN}✓${NC} 回调 URL 使用 HTTPS 协议"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} 回调 URL 必须使用 HTTPS 协议"
        ((FAIL++))
    fi
fi

echo ""

# 3. 检查证书文件
echo "3️⃣  检查证书文件"
echo "-----------------------------------"
if [ ! -z "$WECHAT_PAY_PRIVATE_KEY_PATH" ]; then
    check_file "$WECHAT_PAY_PRIVATE_KEY_PATH" "商户私钥文件"
    
    # 检查是否为有效的 PEM 文件
    if [ -f "$WECHAT_PAY_PRIVATE_KEY_PATH" ]; then
        if grep -q "BEGIN PRIVATE KEY" "$WECHAT_PAY_PRIVATE_KEY_PATH"; then
            echo -e "${GREEN}✓${NC} 私钥文件格式正确（PEM 格式）"
            ((PASS++))
        else
            echo -e "${RED}✗${NC} 私钥文件格式错误（应为 PEM 格式）"
            ((FAIL++))
        fi
    fi
fi
echo ""

# 4. 检查网络连接
echo "4️⃣  检查网络连接"
echo "-----------------------------------"

# 检查是否能访问微信支付 API
if command -v curl &> /dev/null; then
    echo "测试微信支付 API 连接..."
    if curl -s --connect-timeout 5 https://api.mch.weixin.qq.com > /dev/null; then
        echo -e "${GREEN}✓${NC} 可以访问微信支付 API"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} 无法访问微信支付 API"
        echo "   请检查网络连接和防火墙设置"
        ((FAIL++))
    fi
else
    echo -e "${YELLOW}⚠${NC}  未安装 curl，跳过网络测试"
    ((WARN++))
fi

echo ""

# 5. 总结
echo "======================================"
echo "  检查结果"
echo "======================================"
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo -e "${YELLOW}警告: $WARN${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ 配置检查通过！${NC}"
    echo ""
    echo "下一步："
    echo "1. 启动服务器: npm run dev"
    echo "2. 查看日志确认微信支付初始化成功"
    echo "3. 测试支付流程"
    echo ""
    echo "详细配置指南请查看: WECHAT_PAY_SETUP_GUIDE.md"
    exit 0
else
    echo -e "${RED}✗ 配置检查失败，请修复以上问题${NC}"
    echo ""
    echo "常见问题："
    echo "1. 环境变量未配置 → 编辑 .env 文件"
    echo "2. 证书文件不存在 → 从微信商户平台下载证书"
    echo "3. 格式错误 → 检查配置参数格式"
    echo ""
    echo "详细配置指南请查看: WECHAT_PAY_SETUP_GUIDE.md"
    exit 1
fi
