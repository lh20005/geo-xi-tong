# 你的微信支付配置信息

## ✅ 已获取的信息

### 1. AppID（应用ID）
```
wx_your_app_id_here
```

### 2. 商户号（MCH_ID）
```
your_merchant_id
```

### 3. 证书序列号（SERIAL_NO）
```
your_certificate_serial_number_here
```
**说明**：我已经从你的证书中提取出来了

---

## ❓ 还需要的信息

### 4. APIv3密钥（API_V3_KEY）⚠️ 重要

**这个需要你自己设置！**

#### 如何设置：

**方法A：在商户平台设置（推荐）**
1. 登录微信支付商户平台：https://pay.weixin.qq.com
2. 左侧菜单 → "账户中心" → "API安全"
3. 找到"APIv3密钥"（如果没有，参考故障排除文档）
4. 点击"设置密钥"
5. 输入一个32位的密钥

**方法B：使用我生成的密钥**

我为你生成了一个随机的32位密钥（你可以直接使用）：
```
a7f3e9d2c8b4f6a1e5d9c3b7f2a6e8d4
```

**⚠️ 重要提示**：
- 设置后无法查看，请立即保存！
- 建议复制到安全的地方
- 不要分享给任何人

---

### 5. 私钥文件（PRIVATE_KEY_PATH）⚠️ 重要

**这个需要你下载！**

**重要：** 微信支付已改用公钥模式，不再需要下载平台证书。详见官方文档：https://pay.weixin.qq.com/doc/v3/partner/4012925323

#### 如何获取：

1. **下载证书工具**
   - 在商户平台"API安全"页面
   - 点击"下载证书工具"
   - 或访问：https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay7_0.shtml

2. **使用证书工具申请证书**
   - 打开证书工具
   - 输入商户号：`your_merchant_id`
   - 点击"申请证书"
   - 使用微信扫码确认
   - 会生成商户私钥（apiclient_key.pem）

3. **找到私钥文件**
   - 文件名：`apiclient_key.pem`（商户私钥）
   - 默认位置：
     - Windows: `C:\Users\你的用户名\cert\apiclient_key.pem`
     - Mac: `/Users/你的用户名/cert/apiclient_key.pem`

4. **移动到安全位置**
   ```bash
   # 创建目录
   mkdir -p ~/.wechat-pay
   
   # 移动文件
   mv ~/cert/apiclient_key.pem ~/.wechat-pay/
   
   # 设置权限（仅自己可读）
   chmod 600 ~/.wechat-pay/apiclient_key.pem
   ```

5. **记录文件路径**
   ```
   Mac/Linux: /Users/你的用户名/.wechat-pay/apiclient_key.pem
   Windows: C:\Users\你的用户名\.wechat-pay\apiclient_key.pem
   ```

**注意：** 只需要商户私钥文件，不需要下载平台证书。SDK 会使用公钥模式自动处理验签。

---

### 6. 回调地址（NOTIFY_URL）

**开发环境（使用内网穿透）**：

1. **安装ngrok**
   ```bash
   # Mac
   brew install ngrok
   
   # 或访问 https://ngrok.com 下载
   ```

2. **启动ngrok**
   ```bash
   ngrok http 3000
   ```

3. **获取公网地址**
   ```
   会显示类似：
   Forwarding: https://abc123.ngrok.io -> http://localhost:3000
   
   你的回调地址就是：
   https://abc123.ngrok.io/api/payment/wechat/notify
   ```

**生产环境**：
```
https://your-domain.com/api/payment/wechat/notify
```

---

## 📝 完整配置示例

等你获取了上面的信息后，编辑 `server/.env` 文件：

```env
# ==================== 微信支付配置 ====================

# 1. AppID（已获取）
WECHAT_PAY_APP_ID=wx_your_app_id_here

# 2. 商户号（已获取）
WECHAT_PAY_MCH_ID=your_merchant_id

# 3. APIv3密钥（需要你设置，可以使用我生成的）
WECHAT_PAY_API_V3_KEY=a7f3e9d2c8b4f6a1e5d9c3b7f2a6e8d4

# 4. 证书序列号（已提取）
WECHAT_PAY_SERIAL_NO=your_certificate_serial_number_here

# 5. 私钥文件路径（需要你下载后填写）
WECHAT_PAY_PRIVATE_KEY_PATH=/Users/你的用户名/.wechat-pay/apiclient_key.pem

# 6. 支付回调地址（开发环境使用ngrok）
WECHAT_PAY_NOTIFY_URL=https://your-ngrok-url.ngrok.io/api/payment/wechat/notify

# ====================================================
```

---

## 🎯 下一步操作

### 步骤1：设置APIv3密钥

1. 登录商户平台：https://pay.weixin.qq.com
2. "账户中心" → "API安全" → "APIv3密钥"
3. 点击"设置密钥"
4. 输入：`a7f3e9d2c8b4f6a1e5d9c3b7f2a6e8d4`
5. 确认并保存

### 步骤2：下载私钥文件

1. 下载证书工具
2. 申请证书（商户号：your_merchant_id）
3. 找到 `apiclient_key.pem` 文件
4. 移动到安全位置

### 步骤3：配置.env文件

1. 编辑 `server/.env`
2. 复制上面的配置
3. 修改私钥文件路径为实际路径
4. 修改回调地址（如果使用ngrok）

### 步骤4：重启服务器

```bash
cd server
npm run dev
```

### 步骤5：测试

1. 访问 http://localhost:8080
2. 登录账号
3. 点击"购买"按钮
4. 应该能看到二维码

---

## ⚠️ 安全提示

1. **不要分享私钥文件**
   - `apiclient_key.pem` 是最重要的文件
   - 不要发送给任何人
   - 不要提交到Git

2. **不要分享APIv3密钥**
   - 这是支付的关键密钥
   - 泄露后需要立即重置

3. **不要分享证书序列号**
   - 虽然不如私钥重要
   - 但也应该保密

4. **定期更换密钥**
   - 建议每3-6个月更换一次
   - 增强安全性

---

## 📞 需要帮助？

如果遇到问题：

1. **查看文档**
   - `WECHAT_PAY_SETUP_GUIDE.md` - 完整配置指南
   - `WECHAT_PAY_TROUBLESHOOTING.md` - 故障排除

2. **联系微信支付客服**
   - 商户平台右上角"帮助中心"
   - 在线客服时间：9:00-21:00

3. **问我**
   - 随时可以问我任何问题
   - 我会帮你解决

---

**创建时间**: 2024年12月29日  
**状态**: 等待你完成步骤4、5、6
