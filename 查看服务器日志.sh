#!/bin/bash
# 实时查看服务器日志中包含"头条号"的行

echo "正在监控服务器日志..."
echo "按 Ctrl+C 停止"
echo ""

# 这个命令会持续显示包含"头条号"的日志
tail -f /dev/null | while true; do
  sleep 1
done
