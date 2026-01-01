# 微信支付配置指南（最新公钥方案）

> **官方文档：** https://pay.weixin.qq.com/doc/v3/partner/4012925323

## ⚠️ 重要说明

**微信支付已推出新的公钥模式，不再需要平台证书！**

- ❌ 旧方案：平台证书模式（已废弃）
- ✅ 新方案：微信支付公钥模式（推荐）

---

## 📋 需要配置的内容

### 1. 从商户平台获取

登录 [微信支付商户平台](https://pay.weixin.qq.com/)：

| 参数 | 获取位置 | 说明 |
|------|---------|------|
| AppID | 账户中心 → AppID管理 | 应用ID |
| 商户号 | 右上角显示 | 10位数字 |
| APIv3密钥 | 账户中心 → API安全 → 设置APIv3密钥 | 32位字符串，自己设置 |
| 证书序列号 | 账户中心 → API安全 → API证书 | 下载证书后查看 |
| 商户私钥 | 账户中心 → API安全 → API证书 | 下载 apiclient_key.pem |
| 微信支付公钥 | 账户中心 → API安全 → 申请公钥 | 下载 pub_key.pem |

### 2. 保存证书文件

```bash
# 创建目录
mkdir -p ~/.wechat-pay

# 保存文件
cp ~/Downloads/apiclient_key.pem ~/.wechat-pay/
cp ~/Downloads/pub_key.pem ~/.wechat-pay/wechat_pay_public_key.pem
```

### 3. 配置环境变量

编辑 `server/.env`：

```env
# 微信支付配置
WECHAT_PAY_APP_ID=wx_your_app_id_here
WECHAT_PAY_MCH_ID=your_merchant_id
WECHAT_PAY_API_V3_KEY=your_32_character_api_v3_key_here
WECHAT_PAY_SERIAL_NO=your_certificate_serial_number_here
WECHAT_PAY_PRIVATE_KEY_PATH=/Users/你的用户名/.wechat-pay/apiclient_key.pem
WECHAT_PAY_NOTIFY_URL=https://你的域名/api/payment/wechat/notify
```

---

## ✅ 验证配置

### 1. 启动服务

```bash
cd server
npm run dev
```

应该看到：
```
✅ 微信支付初始化成功（简化配置模式）
```

### 2. 测试创建订单

访问系统并尝试购买套餐，检查是否能生成二维码。

---

## 🚫 不要做的事情

1. ❌ 不要尝试下载平台证书（旧方案）
2. ❌ 不要运行 `download-platform-cert.ts` 脚本
3. ❌ 不要在代码中配置 `certs` 参数
4. ❌ 不要参考旧的平台证书文档

---

## ✅ 推荐做法

1. ✅ 从商户平台下载微信支付公钥
2. ✅ 使用简化的 SDK 配置
3. ✅ 让 SDK 自动处理验签
4. ✅ 参考最新官方文档

---

## 📚 参考资料

- [微信支付公钥产品简介](https://pay.weixin.qq.com/doc/v3/partner/4012925323)
- [如何使用微信支付公钥验签](https://pay.weixin.qq.com/doc/v3/merchant/4012925324)
- [微信支付APIv3文档](https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml)

---

## 🎯 总结

**新方案更简单：**
- 只需下载一次公钥
- SDK 自动处理验签
- 不需要管理证书更新

**请使用微信支付公钥模式，忘记平台证书！** 🚀
