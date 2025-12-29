# ✅ ngrok 微信支付测试 - 问题已修复

## 🎯 问题总结

### 1. 服务器启动崩溃
**原因：** `wechatpay-axios-plugin` 初始化时尝试调用微信支付API验证证书，但配置不正确导致404错误

**解决方案：** 使用微信支付公钥模式，配置正确的公钥文件路径

### 2. CORS 跨域问题
**原因：** 环境变量配置在错误的文件中
- 代码读取：`根目录/.env`
- 配置位置：`server/.env` ❌

**解决方案：** 在根目录 `.env` 文件中添加 ngrok 域名到 `ALLOWED_ORIGINS`

---

## ✅ 当前配置

### 环境变量（根目录 `.env`）
```env
# CORS 配置
ALLOWED_ORIGINS=http://localhost,http://localhost:5173,http://localhost:5174,http://localhost:8080,https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev

# 微信支付配置
WECHAT_PAY_APP_ID=wx76c24846b57dfaa9
WECHAT_PAY_MCH_ID=1103960104
WECHAT_PAY_API_V3_KEY=3453DGDsdf3gsd564DSFDSR2N67N8Lfs
WECHAT_PAY_SERIAL_NO=305B80592042FA4A46F7A68E10044169EE13093D
WECHAT_PAY_PRIVATE_KEY_PATH=/Users/lzc/.wechat-pay/apiclient_key.pem
WECHAT_PAY_NOTIFY_URL=https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api/payment/wechat/notify
```

### 微信支付公钥
- 位置：`~/.wechat-pay/wechat_pay_public_key.pem`
- 公钥ID：`PUB_KEY_ID_0111039601042025122900292089000201`

---

## 🚀 测试步骤

### 1. 确认服务运行
```bash
# 后端服务应该在运行
ps aux | grep "node.*server"

# 检查健康状态
curl http://localhost:3000/api/health
```

### 2. 确认 ngrok 运行
```bash
# 检查 ngrok 状态
ps aux | grep ngrok

# 查看 ngrok 地址
open http://localhost:4040
```

### 3. 测试登录（从 ngrok 域名）
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev" \
  -d '{"username":"lzc2005","password":"Woshixiaogou2005"}'
```

**预期结果：**
```json
{
  "success": true,
  "data": {
    "token": "...",
    "user": {...}
  }
}
```

### 4. 访问 ngrok 地址测试支付
```
https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev
```

**测试流程：**
1. 首次访问点击 "Visit Site"（ngrok 警告页）
2. 登录账号（用户名：lzc2005，密码：Woshixiaogou2005）
3. 选择套餐，点击"立即购买"
4. 弹出支付二维码
5. 使用微信扫码支付
6. 支付成功后页面自动跳转

---

## 📝 技术细节

### PaymentService 配置
```typescript
// 使用微信支付公钥模式
const publicKeyPath = privateKeyPath.replace('apiclient_key.pem', 'wechat_pay_public_key.pem');

if (fs.existsSync(publicKeyPath)) {
  const wechatPayPublicKey = fs.readFileSync(publicKeyPath, 'utf8');
  const publicKeyId = `PUB_KEY_ID_01${mchId}2025122900292089000201`;
  
  this.wechatpay = new Wechatpay({
    mchid: mchId,
    serial: serialNo,
    privateKey: privateKey,
    certs: {
      [publicKeyId]: wechatPayPublicKey,
    },
  });
}
```

### CORS 配置
```typescript
// server/src/index.ts
const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || [...])
  .map(o => o.trim())
  .filter(Boolean);

// 添加 ngrok 域名
allowedOrigins.push('https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev');
```

---

## ⚠️ 注意事项

### ngrok 免费版限制
- 每次重启 ngrok，域名可能会变化
- 需要更新 `.env` 中的回调地址和 CORS 配置
- 首次访问会显示警告页面

### 环境变量文件
- **根目录 `.env`**：后端服务读取的配置
- **server/.env**：仅用于参考，不会被读取

### 密码
- 管理员密码：`Woshixiaogou2005`（根目录 `.env` 中配置）
- 测试密码：`TestDocker2024!`（server/.env 中配置，但不会被使用）

---

## 🎉 测试结果

✅ 后端服务启动成功  
✅ CORS 配置正确  
✅ 登录功能正常  
✅ 微信支付初始化成功  
✅ 可以通过 ngrok 访问  

**下一步：** 测试完整的支付流程（创建订单 → 扫码支付 → 接收回调 → 页面跳转）
