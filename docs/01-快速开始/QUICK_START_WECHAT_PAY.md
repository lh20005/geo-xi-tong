# 微信支付快速开始指南

## 🚀 5分钟快速测试

### 前提条件
- ✅ 已安装 Node.js 和 npm
- ✅ 已克隆项目代码
- ✅ 已安装依赖 (`npm install`)

### 步骤 1：配置环境变量（2分钟）

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env 文件
nano .env  # 或使用你喜欢的编辑器

# 3. 填入微信支付配置（如果还没有，可以先跳过，系统会提示）
WECHAT_PAY_APP_ID=wx1234567890abcdef
WECHAT_PAY_MCH_ID=1234567890
WECHAT_PAY_API_V3_KEY=your_32_character_api_v3_key_here
WECHAT_PAY_SERIAL_NO=1234567890ABCDEF1234567890ABCDEF12345678
WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/certs/apiclient_key.pem
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify
```

### 步骤 2：检查配置（1分钟）

```bash
# 运行配置检查脚本
./test-wechat-pay-config.sh

# 如果看到 "✓ 配置检查通过！"，说明配置正确
# 如果看到错误，按照提示修复
```

### 步骤 3：启动服务（1分钟）

```bash
# 启动后端服务器
cd server
npm run dev

# 在另一个终端启动前端
cd client
npm run dev

# 查看日志，确认微信支付初始化
# ✅ 微信支付初始化成功  <- 看到这个说明配置正确
# ⚠️ 微信支付配置不完整  <- 看到这个说明需要配置
```

### 步骤 4：测试支付流程（1分钟）

#### 方法 1：使用测试页面（推荐）

```bash
# 在浏览器中打开测试页面
open test-payment-flow.html

# 或直接访问
# file:///path/to/your/project/test-payment-flow.html
```

按照页面提示：
1. 检查配置
2. 输入认证 Token（从浏览器开发者工具获取）
3. 创建测试订单
4. 查看二维码链接
5. 查询订单状态

#### 方法 2：使用 Web 界面

1. 访问 http://localhost:5173
2. 登录系统
3. 点击右上角用户菜单 → "个人中心"
4. 点击"购买套餐"或"升级套餐"
5. 选择套餐并确认
6. 查看支付页面和二维码

## 📋 完整配置指南

如果你还没有微信支付账号，请查看详细配置指南：

👉 [WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md)

## 🔍 常见问题速查

### Q: 提示"微信支付未配置"怎么办？

**A:** 这是正常的，说明你还没有配置微信支付参数。

**两种选择：**

1. **暂时跳过**（推荐用于开发测试）
   - 系统会继续运行，只是支付功能不可用
   - 可以先开发其他功能
   - 等需要测试支付时再配置

2. **立即配置**（用于生产环境）
   - 按照 [WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md) 配置
   - 需要微信商户平台账号
   - 配置完成后重启服务器

### Q: 如何获取认证 Token？

**A:** 有两种方法：

**方法 1：从浏览器获取**
```javascript
// 1. 登录系统
// 2. 打开浏览器开发者工具（F12）
// 3. 在 Console 中输入：
localStorage.getItem('auth_token')

// 4. 复制输出的 token
```

**方法 2：从 API 获取**
```bash
# 使用用户名密码登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 从响应中获取 token
```

### Q: 测试环境如何配置回调地址？

**A:** 使用 ngrok 暴露本地服务：

```bash
# 1. 安装 ngrok
brew install ngrok  # macOS
# 或访问 https://ngrok.com/download

# 2. 启动 ngrok
ngrok http 3000

# 3. 复制 HTTPS 地址
# 例如: https://abc123.ngrok.io

# 4. 更新 .env 文件
WECHAT_PAY_NOTIFY_URL=https://abc123.ngrok.io/api/payment/wechat/notify

# 5. 重启服务器
```

### Q: 如何测试支付回调？

**A:** 使用 curl 模拟回调：

```bash
# 注意：实际的回调数据需要正确的签名，这里仅用于测试连通性
curl -X POST http://localhost:3000/api/payment/wechat/notify \
  -H "Content-Type: application/json" \
  -d '{}'

# 查看服务器日志
tail -f server/logs/app.log
```

## 🎯 开发模式 vs 生产模式

### 开发模式（本地测试）

```bash
# .env 配置
NODE_ENV=development
WECHAT_PAY_NOTIFY_URL=https://your-ngrok-url.ngrok.io/api/payment/wechat/notify

# 特点：
# - 使用 ngrok 暴露本地服务
# - 可以实时查看日志
# - 方便调试
```

### 生产模式（线上部署）

```bash
# .env 配置
NODE_ENV=production
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify

# 特点：
# - 使用真实域名
# - 配置 HTTPS 证书
# - 设置防火墙和安全组
```

## 📊 测试检查清单

在提交代码或部署前，请确认：

- [ ] 配置检查脚本通过
- [ ] 服务器启动成功
- [ ] 可以创建订单
- [ ] 可以查询订单状态
- [ ] 日志中没有错误信息
- [ ] 前端页面可以正常访问

## 🔗 相关文档

- [WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md) - 详细配置指南
- [WECHAT_PAY_IMPLEMENTATION_SUMMARY.md](./WECHAT_PAY_IMPLEMENTATION_SUMMARY.md) - 实现总结
- [PRODUCT_SUBSCRIPTION_DESIGN.md](./PRODUCT_SUBSCRIPTION_DESIGN.md) - 订阅系统设计

## 💡 下一步

配置完成后，你可以：

1. **测试完整支付流程**
   - 创建订单
   - 扫码支付
   - 查看订单状态
   - 验证订阅开通

2. **查看管理后台**
   - 访问 `/admin/orders` 查看所有订单
   - 查看订单统计和收入数据
   - 管理异常订单

3. **优化用户体验**
   - 自定义支付页面样式
   - 添加支付成功通知
   - 实现自动续费功能

## 🆘 需要帮助？

如果遇到问题：

1. 查看服务器日志：`tail -f server/logs/app.log`
2. 运行配置检查：`./test-wechat-pay-config.sh`
3. 查看详细文档：[WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md)
4. 查看常见问题：[WECHAT_PAY_IMPLEMENTATION_SUMMARY.md](./WECHAT_PAY_IMPLEMENTATION_SUMMARY.md)

祝你使用愉快！🎉
