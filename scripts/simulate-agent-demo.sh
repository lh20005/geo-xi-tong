#!/bin/bash
# 代理商数据模拟脚本 - 用于演示
# 
# 功能：为 zhuangxiu 用户生成拟真的代理商数据
# 每次执行会：
#   1. 处理历史待结算佣金（T+1 自动结算）
#   2. 随机新增 1-3 个邀请用户
#   3. 新用户有 60% 概率付费
#   4. 付费用户产生佣金记录
#
# 注意：这只是修改数据库数字，不会触发真实的微信支付分账！

SSH_KEY="/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem"
SERVER="ubuntu@124.221.247.107"

echo "🚀 正在连接服务器执行模拟..."
echo ""

ssh -i "$SSH_KEY" "$SERVER" "cd /var/www/geo-system/server && node scripts/simulateAgentDemo.js"

echo ""
echo "💡 提示：刷新代理商中心页面查看数据变化"
