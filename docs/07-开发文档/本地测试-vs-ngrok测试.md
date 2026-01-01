# 本地测试 vs ngrok 测试对比

## 快速答案

✅ **可以在本地 8080 测试**，但只能测试部分功能
✅ **完整测试需要使用 ngrok**

---

## 两种测试方式对比

### 方式1：本地测试（http://localhost:8080）

#### 访问地址
```
http://localhost:8080
```

#### 可以测试的功能
- ✅ 创建订单
- ✅ 生成支付二维码
- ✅ 前端轮询订单状态（现在已修复）
- ✅ 页面跳转逻辑
- ✅ UI/UX 交互

#### 不能测试的功能
- ❌ 微信支付回调（微信服务器无法访问 localhost）
- ❌ 真实支付后的订单状态自动更新
- ❌ 支付成功后的自动跳转

#### 适用场景
- 开发调试前端逻辑
- 测试 UI 界面
- 快速迭代开发
- 不需要真实支付的测试

#### 启动方式
```bash
# 已启动，直接访问即可
open http://localhost:8080
```

---

### 方式2：ngrok 测试（公网地址）

#### 访问地址
```
https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev
```

#### 可以测试的功能
- ✅ 所有本地测试的功能
- ✅ 微信支付回调
- ✅ 真实支付流程
- ✅ 支付成功后的完整流程
- ✅ 微信扫码支付

#### 适用场景
- 真实支付测试
- 完整流程验证
- 上线前测试
- 演示给客户

#### 当前状态
```
✅ 后端服务：运行中（端口 3000）
✅ ngrok 隧道：运行中
✅ landing 静态文件：已配置
✅ 支付回调地址：已配置
```

---

## 为什么本地测试不能完整测试支付？

### 问题：微信支付回调

当用户扫码支付成功后，微信服务器会向你的服务器发送支付成功通知：

```
微信服务器 → 你的服务器（回调地址）
```

**本地环境：**
```
回调地址：http://localhost:3000/api/payment/wechat/notify
问题：微信服务器无法访问你的 localhost ❌
```

**ngrok 环境：**
```
回调地址：https://xxx.ngrok-free.dev/api/payment/wechat/notify
结果：微信服务器可以访问 ✅
```

---

## 推荐的开发流程

### 阶段1：本地开发（localhost:8080）
```bash
# 快速开发和调试
1. 修改代码
2. 刷新浏览器
3. 查看效果
4. 重复
```

**优点：**
- 快速刷新
- 实时热更新
- 方便调试

### 阶段2：功能测试（ngrok）
```bash
# 测试完整支付流程
1. 构建 landing: cd landing && npm run build
2. 访问 ngrok 地址
3. 真实支付测试
4. 验证回调
```

**优点：**
- 完整流程
- 真实环境
- 发现问题

---

## 当前可用的测试地址

### 本地开发地址
```
Landing 页面：http://localhost:8080
后端 API：   http://localhost:3000
```

### ngrok 公网地址
```
Landing 页面：https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev
后端 API：   https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api
```

---

## 快速测试命令

### 测试本地环境
```bash
# 测试后端
curl http://localhost:3000/api/health

# 测试 landing
curl http://localhost:8080/

# 在浏览器中打开
open http://localhost:8080
```

### 测试 ngrok 环境
```bash
# 测试后端
curl https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api/health

# 测试 landing
curl https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/

# 在浏览器中打开
open https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev
```

---

## 常见问题

### Q1: 本地测试时，支付完成后页面不跳转？

**原因：** 微信没有发送支付回调，订单状态没有更新

**解决：**
- 方案1：使用 ngrok 测试（推荐）
- 方案2：手动在数据库中更新订单状态（仅用于开发调试）

### Q2: 每次都要用 ngrok 吗？

**不需要！**
- 开发时用 localhost:8080
- 测试支付时用 ngrok
- 只有需要真实支付时才用 ngrok

### Q3: ngrok 地址会变吗？

**免费版会变：**
- 每次重启 ngrok，地址可能改变
- 需要更新 `.env` 中的回调地址

**付费版不变：**
- 可以固定域名
- 不需要每次更新配置

---

## 总结

| 功能 | 本地测试 | ngrok 测试 |
|------|---------|-----------|
| 创建订单 | ✅ | ✅ |
| 生成二维码 | ✅ | ✅ |
| 前端轮询 | ✅ | ✅ |
| 微信回调 | ❌ | ✅ |
| 真实支付 | ❌ | ✅ |
| 开发速度 | 快 | 慢 |
| 测试完整性 | 部分 | 完整 |

**建议：**
- 🚀 开发时用本地：http://localhost:8080
- 🧪 测试时用 ngrok：https://xxx.ngrok-free.dev
