# 微信支付快速配置指南（针对你的情况）

## 📋 你目前的状态

### ✅ 已有的信息：
1. AppID: `wx_your_app_id_here`
2. 商户号: `your_merchant_id`
3. APIv3密钥: `your_32_character_api_v3_key_here`
4. 证书序列号: `your_certificate_serial_number_here`

### ❌ 缺少的信息：
1. **私钥文件** - 需要下载
2. **回调地址** - 需要配置

---

## 🎯 第一步：下载商户私钥文件（最重要！）

**重要：** 微信支付已改用公钥模式，不再需要下载平台证书。详见官方文档：https://pay.weixin.qq.com/doc/v3/partner/4012925323

### 方法：使用微信支付证书工具

#### 1. 下载证书工具

**官方下载地址**：
- 文档页面：https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay7_0.shtml
- 或在商户平台："账户中心" → "API安全" → "下载证书工具"

**选择Mac版本下载**

#### 2. 安装证书工具

1. 下载后得到 `.dmg` 文件
2. 双击打开
3. 拖到"应用程序"文件夹
4. 如果提示"无法打开"：
   - 系统偏好设置 → 安全性与隐私
   - 点击"仍要打开"

#### 3. 使用证书工具

1. 打开证书工具
2. 输入商户号：`your_merchant_id`
3. 点击"申请证书"
4. 使用微信扫码确认
5. 等待生成（几秒钟）
6. 会生成商户私钥（apiclient_key.pem）

**注意：** 只需要商户私钥，不需要下载平台证书。

#### 4. 找到私钥文件

证书会自动保存到：
```bash
/Users/lzc/cert/apiclient_key.pem
```

#### 5. 移动到安全位置

打开终端，执行：
```bash
# 创建目录
mkdir -p ~/.wechat-pay

# 移动文件
mv ~/cert/apiclient_key.pem ~/.wechat-pay/

# 设置权限
chmod 600 ~/.wechat-pay/apiclient_key.pem

# 验证文件
cat ~/.wechat-pay/apiclient_key.pem
```

**应该看到**：
```
-----BEGIN PRIVATE KEY-----
（很多行内容）
-----END PRIVATE KEY-----
```

**私钥文件路径**：
```
/Users/lzc/.wechat-pay/apiclient_key.pem
```

---

## 🎯 第二步：配置回调地址

### 开发环境：使用ngrok

#### 1. 安装ngrok

```bash
# 使用Homebrew安装
brew install ngrok

# 或访问 https://ngrok.com 下载
```

#### 2. 注册ngrok账号

1. 访问：https://ngrok.com
2. 注册免费账号
3. 获取authtoken

#### 3. 配置ngrok

```bash
# 配置token（只需要一次）
ngrok config add-authtoken 你的token
```

#### 4. 启动ngrok

```bash
# 暴露本地3000端口
ngrok http 3000
```

#### 5. 获取公网地址

启动后会显示：
```
Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

**你的回调地址**：
```
https://abc123.ngrok.io/api/payment/wechat/notify
```

**⚠️ 注意**：
- 每次重启ngrok，地址会变化
- 需要更新.env文件中的回调地址
- 付费版可以固定域名

---

## 🎯 第三步：配置.env文件

编辑 `server/.env` 文件，添加：

```env
# ==================== 微信支付配置 ====================

# 1. AppID
WECHAT_PAY_APP_ID=wx_your_app_id_here

# 2. 商户号
WECHAT_PAY_MCH_ID=your_merchant_id

# 3. APIv3密钥
WECHAT_PAY_API_V3_KEY=your_32_character_api_v3_key_here

# 4. 证书序列号
WECHAT_PAY_SERIAL_NO=your_certificate_serial_number_here

# 5. 私钥文件路径（完成第一步后填写）
WECHAT_PAY_PRIVATE_KEY_PATH=/Users/lzc/.wechat-pay/apiclient_key.pem

# 6. 支付回调地址（完成第二步后填写）
WECHAT_PAY_NOTIFY_URL=https://你的ngrok地址.ngrok.io/api/payment/wechat/notify

# ====================================================
```

---

## 🎯 第四步：重启服务器

```bash
# 停止当前服务器（Ctrl+C）

# 重新启动
cd server
npm run dev
```

**检查启动日志**：

应该看到：
```
✅ 微信支付初始化成功
```

如果看到错误：
```
❌ 微信支付配置不完整
```
说明配置有问题，检查上面的6个参数。

---

## 🎯 第五步：测试支付功能

### 1. 确保所有服务运行

```bash
# 终端1：后端服务器
cd server
npm run dev

# 终端2：ngrok
ngrok http 3000

# 终端3：营销网站
cd landing
npm run dev

# 终端4：客户端
cd client
npm run dev
```

### 2. 测试购买流程

1. 访问：http://localhost:8080
2. 登录账号
3. 滚动到"价格方案"
4. 点击"专业版"的"点击购买"
5. 应该弹出支付弹窗
6. 显示二维码

### 3. 测试支付

1. 使用微信扫描二维码
2. 支付0.01元（测试金额）
3. 支付成功后，页面应该自动跳转
4. 订阅应该自动开通

---

## ⚠️ 常见问题

### 问题1：找不到私钥文件

**解决方案**：
```bash
# 搜索私钥文件
find ~ -name "apiclient_key.pem" 2>/dev/null

# 如果找不到，重新使用证书工具申请
```

### 问题2：私钥文件内容不对

**验证私钥文件**：
```bash
cat /Users/lzc/.wechat-pay/apiclient_key.pem
```

**正确的格式**：
- 开头：`-----BEGIN PRIVATE KEY-----`
- 结尾：`-----END PRIVATE KEY-----`
- 中间：很多行base64编码的内容

**错误的格式**：
- 如果是 `BEGIN CERTIFICATE`：这是公钥证书，不是私钥
- 如果是 `BEGIN CERTIFICATE REQUEST`：这是证书请求，不是私钥

### 问题3：ngrok地址变化了

**解决方案**：
1. 每次重启ngrok都会得到新地址
2. 需要更新 `server/.env` 中的 `WECHAT_PAY_NOTIFY_URL`
3. 重启服务器

**避免频繁变化**：
- 使用ngrok付费版（可以固定域名）
- 或部署到真实服务器

### 问题4：支付后没有回调

**检查清单**：
1. ngrok是否在运行
2. 回调地址是否正确配置
3. 服务器是否在运行
4. 查看服务器日志是否收到回调

---

## ✅ 配置完成检查清单

- [ ] 已下载证书工具
- [ ] 已使用证书工具申请证书
- [ ] 已找到私钥文件 `apiclient_key.pem`
- [ ] 已移动私钥到 `~/.wechat-pay/`
- [ ] 已安装ngrok
- [ ] 已启动ngrok
- [ ] 已获取ngrok公网地址
- [ ] 已编辑 `server/.env` 文件
- [ ] 已填写所有6个配置参数
- [ ] 已重启服务器
- [ ] 启动日志显示"微信支付初始化成功"
- [ ] 已测试购买流程
- [ ] 支付弹窗显示二维码

---

## 📞 需要帮助？

如果遇到问题：

1. **查看详细文档**
   - `HOW_TO_GET_PRIVATE_KEY.md` - 私钥下载详细说明
   - `WECHAT_PAY_SETUP_GUIDE.md` - 完整配置指南
   - `WECHAT_PAY_TROUBLESHOOTING.md` - 故障排除

2. **联系微信支付客服**
   - 商户平台右上角"帮助中心"
   - 在线客服时间：9:00-21:00

3. **问我**
   - 随时可以问我任何问题

---

**创建时间**: 2024年12月29日  
**适用对象**: 你的具体情况  
**预计完成时间**: 30分钟
