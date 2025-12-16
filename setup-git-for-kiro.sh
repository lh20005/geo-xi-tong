#!/bin/bash

echo "=========================================="
echo "Kiro Git配置检查和设置"
echo "=========================================="
echo ""

# 检查Git配置
echo "1. 检查Git用户配置"
echo "------------------------------------------"
USER_NAME=$(git config --global user.name)
USER_EMAIL=$(git config --global user.email)

if [ -z "$USER_NAME" ]; then
    echo "❌ 未配置用户名"
    read -p "请输入GitHub用户名: " input_name
    git config --global user.name "$input_name"
    echo "✓ 用户名已设置为: $input_name"
else
    echo "✓ 用户名: $USER_NAME"
fi

if [ -z "$USER_EMAIL" ]; then
    echo "❌ 未配置邮箱"
    read -p "请输入GitHub邮箱: " input_email
    git config --global user.email "$input_email"
    echo "✓ 邮箱已设置为: $input_email"
else
    echo "✓ 邮箱: $USER_EMAIL"
fi
echo ""

# 检查远程仓库
echo "2. 检查远程仓库配置"
echo "------------------------------------------"
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
if [ -z "$REMOTE_URL" ]; then
    echo "❌ 未配置远程仓库"
else
    echo "✓ 远程仓库: $REMOTE_URL"
fi
echo ""

# 检查凭证助手
echo "3. 检查凭证助手配置"
echo "------------------------------------------"
CREDENTIAL_HELPER=$(git config --global credential.helper)
if [ -z "$CREDENTIAL_HELPER" ]; then
    echo "⚠ 未配置凭证助手"
    echo "正在配置..."
    git config --global credential.helper osxkeychain
    echo "✓ 已配置凭证助手: osxkeychain"
else
    echo "✓ 凭证助手: $CREDENTIAL_HELPER"
fi
echo ""

# 测试GitHub连接
echo "4. 测试GitHub连接"
echo "------------------------------------------"
if git ls-remote origin HEAD &>/dev/null; then
    echo "✓ GitHub连接正常"
else
    echo "❌ GitHub连接失败"
    echo ""
    echo "可能的原因："
    echo "1. 需要配置GitHub Personal Access Token"
    echo "2. 需要配置SSH密钥"
    echo ""
    echo "请选择认证方式："
    echo "1) 使用Personal Access Token (HTTPS)"
    echo "2) 使用SSH密钥 (推荐)"
    read -p "请选择 (1 或 2): " auth_choice
    
    if [ "$auth_choice" = "2" ]; then
        echo ""
        echo "配置SSH密钥："
        echo "1. 生成SSH密钥: ssh-keygen -t ed25519 -C \"$USER_EMAIL\""
        echo "2. 添加到ssh-agent: ssh-add ~/.ssh/id_ed25519"
        echo "3. 复制公钥: pbcopy < ~/.ssh/id_ed25519.pub"
        echo "4. 添加到GitHub: https://github.com/settings/keys"
        echo "5. 更改远程URL: git remote set-url origin git@github.com:lh20005/geo-xi-tong.git"
    else
        echo ""
        echo "配置Personal Access Token："
        echo "1. 访问: https://github.com/settings/tokens"
        echo "2. 生成新token，勾选 'repo' 权限"
        echo "3. 复制token"
        echo "4. 下次推送时输入用户名和token"
    fi
fi
echo ""

# 推荐配置
echo "5. 推荐的Git配置"
echo "------------------------------------------"

# 设置默认分支
DEFAULT_BRANCH=$(git config --global init.defaultBranch)
if [ "$DEFAULT_BRANCH" != "main" ]; then
    git config --global init.defaultBranch main
    echo "✓ 设置默认分支为: main"
else
    echo "✓ 默认分支: main"
fi

# 设置推送行为
PUSH_DEFAULT=$(git config --global push.default)
if [ "$PUSH_DEFAULT" != "current" ]; then
    git config --global push.default current
    echo "✓ 设置推送行为为: current"
else
    echo "✓ 推送行为: current"
fi

echo ""

# 显示完整配置
echo "6. 当前Git配置"
echo "------------------------------------------"
echo "用户名: $(git config --global user.name)"
echo "邮箱: $(git config --global user.email)"
echo "凭证助手: $(git config --global credential.helper)"
echo "默认分支: $(git config --global init.defaultBranch)"
echo "推送行为: $(git config --global push.default)"
echo ""

# 测试提交和推送
echo "=========================================="
echo "配置完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 在Kiro中修改文件"
echo "2. 在源代码管理面板中暂存更改"
echo "3. 编写提交信息"
echo "4. 点击提交按钮"
echo "5. 点击推送按钮"
echo ""
echo "如果推送失败，请查看 Kiro_Git配置指南.md"
echo ""
