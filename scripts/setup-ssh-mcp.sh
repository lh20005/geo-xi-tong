#!/bin/bash

# SSH MCP 快速配置脚本
# 用于在不同 IDE 中配置 SSH MCP

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置信息
SSH_HOST="124.221.247.107"
SSH_PORT="22"
SSH_USERNAME="ubuntu"
SSH_KEY_PATH="/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem"

# MCP 配置 JSON
MCP_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "ssh-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "@idletoaster/ssh-mcp-server@latest"
      ],
      "env": {
        "SSH_HOST": "$SSH_HOST",
        "SSH_PORT": "$SSH_PORT",
        "SSH_USERNAME": "$SSH_USERNAME",
        "SSH_KEY_PATH": "$SSH_KEY_PATH"
      }
    }
  }
}
EOF
)

echo -e "${GREEN}SSH MCP 配置脚本${NC}"
echo "================================"
echo ""

# 检查 Node.js 和 npx
if ! command -v npx &> /dev/null; then
    echo -e "${RED}错误: 未找到 npx 命令${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓${NC} 检测到 Node.js 和 npx"

# 检查私钥文件
if [ ! -f "$SSH_KEY_PATH" ]; then
    echo -e "${RED}错误: 私钥文件不存在: $SSH_KEY_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} 检测到私钥文件"

# 检查私钥权限
KEY_PERMS=$(stat -f "%OLp" "$SSH_KEY_PATH" 2>/dev/null || stat -c "%a" "$SSH_KEY_PATH" 2>/dev/null)
if [ "$KEY_PERMS" != "600" ]; then
    echo -e "${YELLOW}警告: 私钥权限不正确 ($KEY_PERMS)，正在修复...${NC}"
    chmod 600 "$SSH_KEY_PATH"
    echo -e "${GREEN}✓${NC} 私钥权限已设置为 600"
else
    echo -e "${GREEN}✓${NC} 私钥权限正确"
fi

echo ""
echo "请选择要配置的 IDE:"
echo "1) VS Code (Cline/Claude Dev)"
echo "2) Cursor IDE"
echo "3) Claude Desktop"
echo "4) 显示配置内容（手动配置）"
echo "5) 测试 SSH 连接"
echo "0) 退出"
echo ""
read -p "请输入选项 (0-5): " choice

case $choice in
    1)
        # VS Code
        CONFIG_DIR="$HOME/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings"
        CONFIG_FILE="$CONFIG_DIR/cline_mcp_settings.json"
        
        echo ""
        echo "配置 VS Code..."
        
        # 创建目录
        mkdir -p "$CONFIG_DIR"
        
        # 写入配置
        echo "$MCP_CONFIG" > "$CONFIG_FILE"
        
        echo -e "${GREEN}✓${NC} 配置已写入: $CONFIG_FILE"
        echo ""
        echo -e "${YELLOW}请重启 VS Code 以使配置生效${NC}"
        ;;
        
    2)
        # Cursor
        if [[ "$OSTYPE" == "darwin"* ]]; then
            CONFIG_DIR="$HOME/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
        else
            CONFIG_DIR="$HOME/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
        fi
        CONFIG_FILE="$CONFIG_DIR/cline_mcp_settings.json"
        
        echo ""
        echo "配置 Cursor IDE..."
        
        # 创建目录
        mkdir -p "$CONFIG_DIR"
        
        # 写入配置
        echo "$MCP_CONFIG" > "$CONFIG_FILE"
        
        echo -e "${GREEN}✓${NC} 配置已写入: $CONFIG_FILE"
        echo ""
        echo -e "${YELLOW}请重启 Cursor IDE 以使配置生效${NC}"
        ;;
        
    3)
        # Claude Desktop
        if [[ "$OSTYPE" == "darwin"* ]]; then
            CONFIG_DIR="$HOME/Library/Application Support/Claude"
        else
            CONFIG_DIR="$HOME/.config/Claude"
        fi
        CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
        
        echo ""
        echo "配置 Claude Desktop..."
        
        # 创建目录
        mkdir -p "$CONFIG_DIR"
        
        # 写入配置
        echo "$MCP_CONFIG" > "$CONFIG_FILE"
        
        echo -e "${GREEN}✓${NC} 配置已写入: $CONFIG_FILE"
        echo ""
        echo -e "${YELLOW}请重启 Claude Desktop 以使配置生效${NC}"
        ;;
        
    4)
        # 显示配置
        echo ""
        echo "MCP 配置内容:"
        echo "================================"
        echo "$MCP_CONFIG"
        echo "================================"
        echo ""
        echo "请手动将以上内容复制到对应的配置文件中"
        ;;
        
    5)
        # 测试连接
        echo ""
        echo "测试 SSH 连接..."
        
        if ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=5 "$SSH_USERNAME@$SSH_HOST" "echo 'SSH 连接成功'" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} SSH 连接测试成功"
            
            # 测试服务器信息
            echo ""
            echo "服务器信息:"
            ssh -i "$SSH_KEY_PATH" "$SSH_USERNAME@$SSH_HOST" "uname -a"
            
            echo ""
            echo "PM2 进程状态:"
            ssh -i "$SSH_KEY_PATH" "$SSH_USERNAME@$SSH_HOST" "pm2 status" 2>/dev/null || echo "PM2 未安装或未运行"
        else
            echo -e "${RED}✗${NC} SSH 连接失败"
            echo "请检查:"
            echo "  - 服务器 IP: $SSH_HOST"
            echo "  - 用户名: $SSH_USERNAME"
            echo "  - 私钥路径: $SSH_KEY_PATH"
        fi
        ;;
        
    0)
        echo "退出"
        exit 0
        ;;
        
    *)
        echo -e "${RED}无效的选项${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}配置完成！${NC}"
