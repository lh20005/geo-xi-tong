#!/bin/bash

echo "=========================================="
echo "🔍 调试头条号配置"
echo "=========================================="
echo ""

echo "1️⃣ 检查数据库配置..."
echo ""

# 使用环境变量中的数据库连接信息
psql $DATABASE_URL -c "
SELECT 
  platform_id,
  platform_name,
  login_url,
  jsonb_pretty(selectors) as selectors_json
FROM platforms_config 
WHERE platform_id = 'toutiao';
" 2>/dev/null || echo "⚠️ 无法连接数据库，请检查 DATABASE_URL 环境变量"

echo ""
echo "2️⃣ 检查 API 返回..."
echo ""

# 检查后端是否运行
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ 后端服务运行中"
  echo ""
  echo "API 返回的头条号配置："
  curl -s http://localhost:3000/api/platforms/toutiao | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(json.dumps(data, indent=2, ensure_ascii=False))
    print('\n✅ API 返回正常')
    
    # 检查关键字段
    if 'selectors' in data:
        selectors = data['selectors']
        print(f'\n📊 选择器统计:')
        print(f'  - username 选择器数量: {len(selectors.get(\"username\", []))}')
        print(f'  - loginSuccess 选择器数量: {len(selectors.get(\"loginSuccess\", []))}')
        
        if len(selectors.get('username', [])) == 0:
            print('\n❌ 错误: username 选择器为空！')
        if len(selectors.get('loginSuccess', [])) == 0:
            print('\n❌ 错误: loginSuccess 选择器为空！')
    else:
        print('\n❌ 错误: 缺少 selectors 字段！')
except Exception as e:
    print(f'❌ 解析失败: {e}')
"
else
  echo "❌ 后端服务未运行"
  echo "请先启动后端: cd server && npm run dev"
fi

echo ""
echo "=========================================="
echo "3️⃣ 检查 Windows 登录管理器日志"
echo "=========================================="
echo ""
echo "请查看 Windows 登录管理器的日志文件："
echo "  macOS: ~/Library/Logs/windows-login-manager/main.log"
echo "  Windows: %USERPROFILE%\\AppData\\Roaming\\windows-login-manager\\logs\\main.log"
echo "  Linux: ~/.config/windows-login-manager/logs/main.log"
echo ""
echo "关键日志关键词："
echo "  - 'IPC: login-platform' - 登录请求"
echo "  - 'Platform not found' - 平台配置未找到"
echo "  - 'Login detection' - 登录检测过程"
echo "  - 'Login success detected' - 登录成功检测"
echo "  - 'Login timeout' - 登录超时"
echo "  - 'Failed to extract' - 用户信息提取失败"
echo ""
echo "=========================================="
echo "4️⃣ 手动测试步骤"
echo "=========================================="
echo ""
echo "1. 确保后端运行: cd server && npm run dev"
echo "2. 确保 Windows 登录管理器运行: cd windows-login-manager && npm run dev"
echo "3. 在应用中点击头条号登录"
echo "4. 完成登录后，查看控制台输出"
echo ""
echo "预期看到的日志："
echo "  ✅ 'Starting login detection...'"
echo "  ✅ 'Login success detected by element' 或 'Login success detected by URL change'"
echo "  ✅ 'Extracted field using selector: .auth-avator-name'"
echo "  ✅ 'User info extracted: [用户名]'"
echo ""
echo "如果看到错误："
echo "  ❌ 'Login timeout' - 登录检测超时（5分钟）"
echo "  ❌ 'Failed to extract username' - 所有选择器都失败"
echo "  ❌ 'Platform not found' - API 未返回平台配置"
echo ""
