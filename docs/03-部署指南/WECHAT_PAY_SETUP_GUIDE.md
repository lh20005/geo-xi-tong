# 微信支付配置指南

## 📋 配置步骤

### 1. 注册微信商户平台账号

1. 访问 [微信商户平台](https://pay.weixin.qq.com)
2. 点击"注册"，选择"企业"类型
3. 填写企业信息并提交资料
4. 等待审核（通常1-3个工作日）

### 2. 获取配置参数

登录微信商户平台后，获取以下参数：

#### 2.1 AppID（应用ID）
- 位置：**账户中心 > 商户信息 > AppID**
- 格式：`wx1234567890abcdef`（18位字符）
- 说明：微信公众号或小程序的唯一标识

#### 2.2 商户号（MCH_ID）
- 位置：**账户中心 > 商户信息 > 商户号**
- 格式：`1234567890`（10位数字）
- 说明：微信支付商户的唯一标识

#### 2.3 API v3 密钥
- 位置：**账户中心 > API安全 > API v3密钥**
- 格式：32位字符串
- 说明：用于加密和签名的密钥
- ⚠️ **重要**：首次使用需要设置，请妥善保管

**设置步骤：**
1. 进入"账户中心 > API安全 > API v3密钥"
2. 点击"设置密钥"
3. 输入32位字符串（建议使用随机生成）
4. 完成短信验证

**生成随机密钥命令：**
```bash
# macOS/Linux
openssl rand -base64 24 | tr -d '/+=' | head -c 32

# 或使用在线工具
# https://www.random.org/strings/
```

#### 2.4 商户证书
- 位置：**账户中心 > API安全 > API证书**
- 文件：`apiclient_cert.pem`（证书）和 `apiclient_key.pem`（私钥）
- 说明：用于API调用的身份认证

**下载步骤：**
1. 进入"账户中心 > API安全 > API证书"
2. 点击"下载证书"
3. 完成身份验证
4. 下载证书工具并生成证书
5. 保存 `apiclient_key.pem` 文件

#### 2.5 证书序列号
- 位置：**账户中心 > API安全 > API证书 > 查看证书**
- 格式：40位十六进制字符串
- 说明：证书的唯一标识

**获取方式：**
```bash
# 使用 openssl 查看证书序列号
openssl x509 -in apiclient_cert.pem -noout -serial | cut -d'=' -f2
```

### 3. 配置环境变量

编辑项目根目录的 `.env` 文件：

```bash
# ==================== 微信支付配置 ====================

# 微信公众号/小程序 AppID
WECHAT_PAY_APP_ID=wx1234567890abcdef

# 商户号
WECHAT_PAY_MCH_ID=1234567890

# API v3 密钥（32位字符串）
WECHAT_PAY_API_V3_KEY=your_32_character_api_v3_key_here

# 商户证书序列号（40位十六进制）
WECHAT_PAY_SERIAL_NO=1234567890ABCDEF1234567890ABCDEF12345678

# 商户私钥文件路径
WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/certs/apiclient_key.pem

# 支付回调通知地址（必须是公网可访问的 HTTPS 地址）
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify
```

### 4. 存储证书文件

#### 4.1 创建证书目录
```bash
# 在服务器上创建证书目录
mkdir -p /etc/geo-system/certs
chmod 700 /etc/geo-system/certs
```

#### 4.2 上传证书文件
```bash
# 上传私钥文件
scp apiclient_key.pem user@server:/etc/geo-system/certs/

# 设置文件权限（仅所有者可读）
chmod 600 /etc/geo-system/certs/apiclient_key.pem
```

#### 4.3 更新环境变量
```bash
WECHAT_PAY_PRIVATE_KEY_PATH=/etc/geo-system/certs/apiclient_key.pem
```

### 5. 配置支付回调地址

#### 5.1 确保服务器支持 HTTPS
微信支付要求回调地址必须使用 HTTPS 协议。

**配置 SSL 证书：**
```bash
# 使用 Let's Encrypt 免费证书
sudo certbot --nginx -d yourdomain.com
```

#### 5.2 配置 Nginx 反向代理
```nginx
# /etc/nginx/sites-available/geo-system
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 支付回调接口
    location /api/payment/wechat/notify {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 5.3 在微信商户平台配置回调地址
1. 登录微信商户平台
2. 进入"产品中心 > 开发配置"
3. 设置"支付回调URL"为：`https://yourdomain.com/api/payment/wechat/notify`

### 6. 测试配置

#### 6.1 检查配置完整性
```bash
# 启动服务器，查看日志
npm run dev

# 如果配置正确，会看到：
# ✅ 微信支付初始化成功

# 如果配置不完整，会看到：
# ⚠️ 微信支付配置不完整，支付功能已禁用
```

#### 6.2 测试支付流程
```bash
# 1. 创建测试订单
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 1}'

# 2. 查看返回的支付参数
# 应该包含：order_no, amount, payment_params

# 3. 使用微信扫描二维码测试支付
```

## 🔒 安全建议

### 1. 保护敏感信息
- ✅ **不要**将 `.env` 文件提交到代码仓库
- ✅ 使用 `.gitignore` 忽略 `.env` 文件
- ✅ 证书文件权限设置为 `600`（仅所有者可读写）
- ✅ 证书目录权限设置为 `700`（仅所有者可访问）

### 2. 使用环境变量
```bash
# 生产环境建议使用系统环境变量，而不是 .env 文件
export WECHAT_PAY_APP_ID=wx1234567890abcdef
export WECHAT_PAY_MCH_ID=1234567890
# ...
```

### 3. 定期更新密钥
- 建议每6个月更新一次 API v3 密钥
- 更新证书前，确保新旧证书都配置在商户平台

### 4. 监控异常
- 定期检查审计日志
- 监控支付失败率
- 设置异常告警

## 📝 常见问题

### Q1: 提示"微信支付未配置"
**原因：** 环境变量未正确配置

**解决：**
1. 检查 `.env` 文件是否存在
2. 确认所有必需的环境变量都已设置
3. 重启服务器使配置生效

### Q2: 提示"私钥文件不存在"
**原因：** 证书文件路径不正确或文件不存在

**解决：**
1. 检查 `WECHAT_PAY_PRIVATE_KEY_PATH` 路径是否正确
2. 确认文件存在：`ls -la /path/to/apiclient_key.pem`
3. 检查文件权限：`chmod 600 /path/to/apiclient_key.pem`

### Q3: 支付回调未收到
**原因：** 回调地址不可访问或未使用 HTTPS

**解决：**
1. 确认回调地址使用 HTTPS 协议
2. 测试回调地址是否可访问：`curl https://yourdomain.com/api/payment/wechat/notify`
3. 检查防火墙和安全组设置
4. 查看 Nginx 日志：`tail -f /var/log/nginx/error.log`

### Q4: 签名验证失败
**原因：** API v3 密钥或证书配置错误

**解决：**
1. 确认 API v3 密钥长度为32位
2. 确认证书序列号正确
3. 重新下载证书并更新配置

### Q5: 测试环境如何配置？
**方案1：使用微信支付沙箱环境**
- 访问 [微信支付沙箱](https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=23_1)
- 获取沙箱密钥和参数
- 修改 API 请求地址为沙箱地址

**方案2：使用 ngrok 暴露本地服务**
```bash
# 安装 ngrok
brew install ngrok

# 启动 ngrok
ngrok http 3000

# 使用 ngrok 提供的 HTTPS 地址作为回调地址
# 例如：https://abc123.ngrok.io/api/payment/wechat/notify
```

## 🚀 部署检查清单

部署到生产环境前，请确认：

- [ ] 已在微信商户平台完成企业认证
- [ ] 已获取所有必需的配置参数
- [ ] 已下载并妥善保管证书文件
- [ ] 已配置 HTTPS 证书
- [ ] 已在 `.env` 文件中配置所有参数
- [ ] 已设置正确的文件权限
- [ ] 已在微信商户平台配置回调地址
- [ ] 已测试支付流程
- [ ] 已配置监控和告警
- [ ] 已备份证书和密钥

## 📚 参考文档

- [微信支付官方文档](https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml)
- [微信支付开发指南](https://pay.weixin.qq.com/wiki/doc/apiv3/open/pay/chapter2_1.shtml)
- [微信支付 API v3 接口规则](https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay3_0.shtml)
- [微信支付安全规范](https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_0.shtml)

## 💡 下一步

配置完成后，你可以：

1. **测试支付流程**：在用户中心点击"购买套餐"
2. **查看订单管理**：访问 `/admin/orders` 查看所有订单
3. **监控支付状态**：查看审计日志和异常检测
4. **配置自动续费**：实现订阅自动续费功能

如有问题，请查看服务器日志或联系技术支持。
