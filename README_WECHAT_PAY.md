# 微信支付功能使用指南

## 🎯 快速回答你的问题

### Q: 是不是需要先配置好微信支付，在点击购买按钮后才能出现二维码？

**A: 是的！完全正确！** 

流程是这样的：

```
1. 配置微信支付参数 (.env 文件)
   ↓
2. 启动服务器 (微信支付自动初始化)
   ↓
3. 用户点击"购买套餐"按钮
   ↓
4. 后端调用微信支付 API 创建订单
   ↓
5. 微信返回二维码链接
   ↓
6. 前端显示二维码给用户扫描
   ↓
7. 用户扫码支付
   ↓
8. 微信回调通知支付结果
   ↓
9. 系统自动更新订单状态并开通订阅
```

## 📋 三种使用方式

### 方式 1：完整配置（生产环境）✅

**适用场景：** 你已经有微信商户平台账号，想要正式使用支付功能

**步骤：**

1. **配置环境变量**
   ```bash
   # 编辑 .env 文件
   nano .env
   
   # 填入以下参数：
   WECHAT_PAY_APP_ID=wx1234567890abcdef
   WECHAT_PAY_MCH_ID=1234567890
   WECHAT_PAY_API_V3_KEY=your_32_character_api_v3_key_here
   WECHAT_PAY_SERIAL_NO=1234567890ABCDEF1234567890ABCDEF12345678
   WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/certs/apiclient_key.pem
   WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify
   ```

2. **检查配置**
   ```bash
   ./test-wechat-pay-config.sh
   ```

3. **启动服务器**
   ```bash
   npm run dev
   
   # 看到这个说明配置成功：
   # ✅ 微信支付初始化成功
   ```

4. **测试支付**
   - 访问 http://localhost:5173
   - 登录 → 个人中心 → 购买套餐 → 扫码支付

**详细配置指南：** [WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md)

---

### 方式 2：暂时跳过（开发测试）⚠️

**适用场景：** 你还没有微信商户平台账号，想先开发其他功能

**步骤：**

1. **直接启动服务器**
   ```bash
   npm run dev
   
   # 会看到警告（这是正常的）：
   # ⚠️ 微信支付配置不完整，支付功能已禁用
   ```

2. **其他功能正常使用**
   - 用户管理 ✅
   - 订阅管理 ✅
   - 订单查看 ✅
   - 只是不能创建支付订单 ❌

3. **等需要时再配置**
   - 注册微信商户平台
   - 按照方式 1 配置

---

### 方式 3：使用测试工具（快速验证）🔧

**适用场景：** 你想快速测试支付流程是否正常

**步骤：**

1. **打开测试页面**
   ```bash
   open test-payment-flow.html
   ```

2. **按照页面提示操作**
   - 检查服务器连接
   - 输入认证 Token
   - 创建测试订单
   - 查看二维码链接
   - 查询订单状态

**快速开始指南：** [QUICK_START_WECHAT_PAY.md](./QUICK_START_WECHAT_PAY.md)

## 📚 完整文档列表

| 文档 | 说明 | 适用场景 |
|------|------|----------|
| [WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md) | 详细配置指南 | 首次配置微信支付 |
| [QUICK_START_WECHAT_PAY.md](./QUICK_START_WECHAT_PAY.md) | 5分钟快速开始 | 快速测试 |
| [WECHAT_PAY_IMPLEMENTATION_SUMMARY.md](./WECHAT_PAY_IMPLEMENTATION_SUMMARY.md) | 实现总结 | 了解技术细节 |
| [微信支付功能完成说明.md](./微信支付功能完成说明.md) | 功能说明 | 了解已完成的工作 |
| [test-payment-flow.html](./test-payment-flow.html) | 测试页面 | 可视化测试 |
| [test-wechat-pay-config.sh](./test-wechat-pay-config.sh) | 配置检查脚本 | 验证配置 |

## 🔑 配置参数获取方式

### 1. AppID（应用ID）
- **位置：** 微信商户平台 → 账户中心 → 商户信息
- **格式：** `wx` 开头的18位字符
- **示例：** `wx1234567890abcdef`

### 2. 商户号（MCH_ID）
- **位置：** 微信商户平台 → 账户中心 → 商户信息
- **格式：** 10位数字
- **示例：** `1234567890`

### 3. API v3 密钥
- **位置：** 微信商户平台 → 账户中心 → API安全 → 设置密钥
- **格式：** 32位字符串
- **生成：** `openssl rand -base64 24 | tr -d '/+=' | head -c 32`

### 4. 证书序列号
- **位置：** 微信商户平台 → 账户中心 → API证书 → 查看证书
- **格式：** 40位十六进制字符串
- **获取：** `openssl x509 -in apiclient_cert.pem -noout -serial | cut -d'=' -f2`

### 5. 商户私钥
- **位置：** 微信商户平台 → 账户中心 → API证书 → 下载证书
- **文件：** `apiclient_key.pem`
- **权限：** `chmod 600 apiclient_key.pem`

### 6. 回调地址
- **格式：** 必须是 HTTPS 地址
- **示例：** `https://yourdomain.com/api/payment/wechat/notify`
- **测试：** 使用 ngrok 暴露本地服务

## 🚨 常见问题

### 1. 提示"微信支付未配置"

**原因：** 环境变量未配置或配置不完整

**解决：**
```bash
# 1. 检查 .env 文件是否存在
ls -la .env

# 2. 运行配置检查
./test-wechat-pay-config.sh

# 3. 按照提示修复问题

# 4. 重启服务器
npm run dev
```

### 2. 二维码不显示

**原因：** 创建订单失败或微信支付 API 调用失败

**解决：**
```bash
# 1. 查看服务器日志
tail -f server/logs/app.log

# 2. 检查网络连接
curl https://api.mch.weixin.qq.com

# 3. 验证配置参数
./test-wechat-pay-config.sh
```

### 3. 支付后状态不更新

**原因：** 回调地址不可访问或签名验证失败

**解决：**
```bash
# 1. 检查回调地址是否可访问
curl https://yourdomain.com/api/payment/wechat/notify

# 2. 查看回调日志
tail -f server/logs/app.log | grep notify

# 3. 确认使用 HTTPS 协议
echo $WECHAT_PAY_NOTIFY_URL
```

### 4. 如何获取认证 Token？

**方法 1：从浏览器获取**
```javascript
// 1. 登录系统
// 2. 打开开发者工具（F12）
// 3. 在 Console 输入：
localStorage.getItem('auth_token')
```

**方法 2：从 API 获取**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🎯 推荐流程

### 如果你是第一次使用：

1. **先跳过配置**（方式 2）
   - 直接启动服务器
   - 开发和测试其他功能
   - 熟悉系统

2. **准备微信商户平台**
   - 注册账号
   - 完成企业认证
   - 获取配置参数

3. **完整配置**（方式 1）
   - 配置环境变量
   - 运行配置检查
   - 测试支付流程

4. **使用测试工具验证**（方式 3）
   - 打开测试页面
   - 创建测试订单
   - 验证完整流程

### 如果你已经有微信商户平台账号：

1. **直接完整配置**（方式 1）
   - 按照 [WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md) 配置
   - 运行配置检查
   - 启动服务器

2. **测试支付流程**
   - 使用 Web 界面测试
   - 或使用测试页面验证

## 📊 功能特点

### ✅ 已实现的功能

- **完整的支付流程** - 从创建订单到支付成功
- **安全可靠** - 签名验证、数据加密、异常检测
- **自动处理** - 支付成功后自动开通订阅
- **状态同步** - 实时轮询订单状态
- **友好提示** - 清晰的错误信息和操作指引
- **测试工具** - 配置检查脚本和测试页面

### 🔄 支付流程

```
用户操作          系统处理                微信支付
   │                 │                      │
   ├─点击购买─────────>│                      │
   │                 ├─创建订单              │
   │                 ├─调用微信API──────────>│
   │                 │                      ├─生成二维码
   │                 │<─────────────────────┤
   │<────显示二维码────┤                      │
   │                 │                      │
   ├─扫码支付────────────────────────────────>│
   │                 │                      ├─处理支付
   │                 │<─────支付回调─────────┤
   │                 ├─验证签名              │
   │                 ├─更新订单              │
   │                 ├─开通订阅              │
   │<────支付成功─────┤                      │
```

## 💡 总结

微信支付功能已经完整实现！你现在有三种使用方式：

1. **完整配置** - 用于生产环境，需要微信商户平台账号
2. **暂时跳过** - 用于开发测试，先开发其他功能
3. **测试工具** - 用于快速验证，使用测试页面

**关键点：**
- ✅ 必须先配置微信支付参数才能使用支付功能
- ✅ 点击购买按钮后会调用微信支付 API 生成二维码
- ✅ 用户扫码支付后系统自动处理并开通订阅
- ✅ 如果暂时不配置，其他功能仍然可以正常使用

**下一步：**
- 查看 [WECHAT_PAY_SETUP_GUIDE.md](./WECHAT_PAY_SETUP_GUIDE.md) 了解详细配置
- 或者 [QUICK_START_WECHAT_PAY.md](./QUICK_START_WECHAT_PAY.md) 快速开始
- 使用 `test-payment-flow.html` 测试支付流程

祝你使用愉快！🎉
