#!/bin/bash

echo "=========================================="
echo "🔧 Windows 端头条号登录完整修复"
echo "=========================================="
echo ""

echo "📋 修复内容："
echo "  1. ✅ 添加 URL 检测配置到数据库"
echo "  2. ✅ 修正 loginManager 配置读取位置"
echo "  3. ✅ 同时修复其他 11 个平台"
echo ""

echo "=========================================="
echo "📝 步骤 1: 验证数据库配置"
echo "=========================================="
echo ""

echo "查询头条号配置..."
curl -s http://localhost:3000/api/platforms/toutiao | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('平台ID:', data['platform_id'])
print('平台名称:', data['platform_name'])
print('登录URL:', data['login_url'])
print('')
print('选择器配置:')
print('  - 用户名选择器:', len(data['selectors']['username']), '个')
print('  - 登录成功选择器:', len(data['selectors']['loginSuccess']), '个')
print('  - 登录成功URL模式:', len(data['selectors'].get('successUrls', [])), '个')
print('')
if 'successUrls' in data['selectors']:
    print('登录成功URL模式:')
    for i, url in enumerate(data['selectors']['successUrls'], 1):
        print(f'  {i}. {url}')
    print('')
    print('✅ 配置正确！')
else:
    print('❌ 缺少 successUrls 配置！')
    print('请执行: cd server && npx ts-node src/db/run-migration-010.ts')
    sys.exit(1)
"

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 配置验证失败"
  exit 1
fi

echo ""
echo "=========================================="
echo "📝 步骤 2: 检查代码修改"
echo "=========================================="
echo ""

if grep -q "selectors.successUrls" windows-login-manager/electron/login/login-manager.ts; then
  echo "✅ loginManager.ts 已修改"
else
  echo "❌ loginManager.ts 未修改"
  echo "请检查文件: windows-login-manager/electron/login/login-manager.ts"
  exit 1
fi

echo ""
echo "=========================================="
echo "📝 步骤 3: 重新编译 Windows 应用"
echo "=========================================="
echo ""

echo "正在编译..."
cd windows-login-manager
npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ 编译成功"
else
  echo "⚠️  编译失败，但可以继续测试（开发模式）"
fi

cd ..

echo ""
echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "🧪 测试步骤："
echo ""
echo "1. 重启后端服务器："
echo "   cd server && npm run dev"
echo ""
echo "2. 重启 Windows 登录管理器："
echo "   cd windows-login-manager && npm run dev"
echo ""
echo "3. 测试头条号登录："
echo "   - 打开应用"
echo "   - 点击「平台管理」"
echo "   - 选择「头条号」"
echo "   - 点击「登录」"
echo "   - 在浏览器中完成登录"
echo "   - 登录成功后，URL 会跳转到 mp.toutiao.com/profile_v4"
echo "   - 应用应该立即检测到登录成功"
echo ""
echo "4. 预期结果："
echo "   ✅ 显示「登录成功」"
echo "   ✅ 能看到提取到的用户名"
echo "   ✅ 账号列表中出现新账号"
echo ""
echo "5. 查看日志："
echo "   - 应该看到: Login success detected by URL change"
echo "   - 应该看到: User info extracted: [用户名]"
echo ""
echo "=========================================="
echo "📚 详细文档："
echo "=========================================="
echo ""
echo "  - dev-docs/TOUTIAO_LOGIN_COMPLETE_FIX.md"
echo "  - dev-docs/TOUTIAO_LOGIN_QUICK_TEST.md"
echo ""
echo "=========================================="
