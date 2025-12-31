#!/bin/bash

# 修复所有平台登录管理器的账号同步顺序
# 先同步到后端，成功后再保存到本地

echo "开始修复账号同步顺序..."

# 定义所有平台登录管理器文件
files=(
  "windows-login-manager/electron/login/xiaohongshu-login-manager.ts"
  "windows-login-manager/electron/login/toutiao-login-manager.ts"
  "windows-login-manager/electron/login/douyin-login-manager.ts"
  "windows-login-manager/electron/login/wechat-login-manager.ts"
  "windows-login-manager/electron/login/baijiahao-login-manager.ts"
  "windows-login-manager/electron/login/jianshu-login-manager.ts"
  "windows-login-manager/electron/login/zhihu-login-manager.ts"
  "windows-login-manager/electron/login/qie-login-manager.ts"
  "windows-login-manager/electron/login/souhu-login-manager.ts"
  "windows-login-manager/electron/login/wangyi-login-manager.ts"
  "windows-login-manager/electron/login/csdn-login-manager.ts"
  "windows-login-manager/electron/login/bilibili-login-manager.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "处理: $file"
    
    # 检查文件是否包含需要修改的模式
    if grep -q "保存到本地" "$file" && grep -q "同步到后端" "$file"; then
      echo "  ✓ 找到需要修改的代码"
    else
      echo "  ⚠ 未找到标准模式，跳过"
    fi
  else
    echo "  ✗ 文件不存在: $file"
  fi
done

echo ""
echo "需要手动修改每个文件，将顺序改为："
echo "1. 先同步到后端 (syncAccountToBackend)"
echo "2. 成功后再保存到本地 (saveAccountLocally)"
