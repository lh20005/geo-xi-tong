# 🚀 ngrok 本地测试指南

## ✅ 当前配置状态

### ngrok 隧道信息
- **公网地址**: `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev`
- **本地端口**: 3000（后端 API）
- **Web 界面**: http://127.0.0.1:4040
- **状态**: ✅ 运行中

### 本地服务端口
- 前端（client）: http://localhost:5173
- 后端（server）: http://localhost:3000
- 营销页（landing）: http://localhost:8080
- Windows 管理器: http://localhost:5174

---

## 📋 测试流程

### 重要说明：ngrok 免费版限制

**ngrok 免费版只能暴露 1 个端口**，我们选择暴露后端（3000），因为：
1. 微信支付回调必须通过公网访问后端
2. Landing 页面已经由后端服务器托管（静态文件服务）
3. 前端主应用（5173）和 Windows 管理器（5174）只需本地访问

### 架构说明

```
ngrok 公网地址 (https://xxx.ngrok-free.dev)
    ↓
后端服务器 (localhost:3000)
    ├── /api/*           → API 接口
    ├── /uploads/*       → 图片资源
    └── /*               → Landing 页面静态文件 (来自 landing/dist)
```

---

### 1. 本地功能测试（不需要 ngrok）

访问本地地址即可测试以下功能：

#### 前端主应用 - http://localhost:5173
- ✅ 用户注册/登录
- ✅ 关键词蒸馏
- ✅ 话题管理
- ✅ AI 文章生成
- ✅ 知识库管理
- ✅ 图库管理
- ✅ 多平台发布
- ✅ WebSocket 实时同步

#### 营销落地页 - 两种访问方式
**方式 1：本地开发服务器**（推荐用于开发调试）
```
http://localhost:8080
```

**方式 2：通过后端托管**（推荐用于测试支付）
```
https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev
```
这个地址访问的是后端服务器托管的 `landing/dist` 静态文件

#### Windows 登录管理器 - http://localhost:5174
- ✅ 平台账号登录管理

---

### 2. 微信支付测试（需要 ngrok）

#### 测试步骤：

**步骤 1：访问营销页**

**通过 ngrok 访问**（推荐，完整测试支付流程）：
```
https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev
```

**或本地访问**（仅测试前端功能）：
```
http://localhost:8080
```

**步骤 2：选择套餐并创建订单**
- 点击任意套餐的"立即购买"按钮
- 系统会生成支付二维码

**步骤 3：使用微信扫码支付**
- 使用微信扫描二维码
- 完成支付（测试环境使用沙箱账号）

**步骤 4：验证回调**
- 支付成功后，微信服务器会调用：
  ```
  https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api/payment/wechat/notify
  ```
- 查看后端日志，应该看到：
  ```
  📥 收到微信支付回调
  ✅ 支付回调处理成功
  ```

**步骤 5：查看订单状态**
- 页面应自动跳转到支付成功页面
- 订单状态应该已更新为"已支付"
- 订阅服务已开通

---

## 🔍 监控和调试

### 1. 查看 ngrok 请求日志
访问 ngrok Web 界面：
```
http://127.0.0.1:4040
```

可以看到：
- 所有通过 ngrok 的 HTTP 请求
- 请求和响应的详细内容
- 微信支付回调的完整数据

### 2. 查看后端日志
后端服务的终端会显示：
- API 请求日志
- 微信支付回调日志
- 错误信息

### 3. 查看前端控制台
浏览器开发者工具（F12）：
- Network 标签：查看 API 请求
- Console 标签：查看前端日志

---

## ⚠️ 注意事项

### ngrok 免费版限制
- ❌ 每次重启 ngrok **进程**，URL 会变化
- ❌ 只能同时运行 1 个隧道
- ❌ 40 连接/分钟限制
- ⚠️ 首次访问会显示警告页面（点击"Visit Site"继续）

### 🔄 URL 什么时候会变化？

**会变化的情况：**
- ❌ 重启 ngrok 进程（`pkill -f ngrok` 后再启动）
- ❌ ngrok 进程崩溃或断开
- ❌ 电脑重启（ngrok 进程会退出）

**不会变化的情况：**
- ✅ 重启后端服务（`npm run server:dev`）
- ✅ 重启前端/营销页/其他服务
- ✅ 修改代码并热重载

**关键点：** 只要 ngrok 进程保持运行，URL 就不会变！

### 如果 ngrok URL 变化了

#### 方法 1：手动更新（传统方式）

1. 重新启动 ngrok：
   ```bash
   ngrok http 3000
   ```

2. 复制新的 URL

3. 更新 `server/.env`：
   ```env
   ALLOWED_ORIGINS=http://localhost,http://localhost:5173,http://localhost:5174,http://localhost:8080,https://新的ngrok地址
   WECHAT_PAY_NOTIFY_URL=https://新的ngrok地址/api/payment/wechat/notify
   ```

4. 重启后端服务

#### 方法 2：自动更新（推荐）⚡

使用自动更新脚本：

```bash
# 1. 启动 ngrok
ngrok http 3000

# 2. 运行自动更新脚本
bash scripts/update-ngrok-url.sh

# 3. 重启后端服务
npm run server:dev
```

脚本会自动：
- ✅ 从 ngrok API 获取当前 URL
- ✅ 更新 `server/.env` 配置
- ✅ 备份原配置文件

---

## 🛠️ 常用命令

### 启动所有服务
```bash
npm run dev:all
```

### 单独启动服务
```bash
# 前端
npm run client:dev

# 后端
npm run server:dev

# 营销页
npm run landing:dev

# Windows 管理器
cd windows-login-manager && npm run dev
```

### 启动 ngrok
```bash
ngrok http 3000
```

### 停止 ngrok
```bash
# 按 Ctrl+C 或
pkill -f ngrok
```

### 查看服务状态
```bash
npm run status
```

---

## 🎯 测试清单

### 基础功能测试（本地）
- [ ] 用户注册
- [ ] 用户登录
- [ ] 创建关键词
- [ ] 生成话题
- [ ] 生成文章
- [ ] 上传知识库文档
- [ ] 上传图片到图库
- [ ] 发布文章到平台

### 支付功能测试（ngrok）
- [ ] 访问营销页
- [ ] 查看套餐信息
- [ ] 创建订单
- [ ] 生成支付二维码
- [ ] 微信扫码支付
- [ ] 验证支付回调
- [ ] 确认订单状态更新
- [ ] 验证订阅权限生效

---

## 🐛 常见问题

### Q1: 访问 ngrok 地址显示空白页？
**A**: ngrok 免费版首次访问会显示警告页面，点击"Visit Site"继续。

### Q2: 微信支付回调失败？
**A**: 检查：
1. ngrok 是否在运行
2. `WECHAT_PAY_NOTIFY_URL` 是否正确
3. 后端服务是否在运行
4. 查看 ngrok Web 界面（http://127.0.0.1:4040）的请求日志

### Q3: 前端无法访问后端 API？
**A**: 
- 本地开发时，前端应该访问 `http://localhost:3000`
- 不需要通过 ngrok 访问后端
- 只有微信服务器需要通过 ngrok 访问

### Q4: CORS 错误？
**A**: 确认 `server/.env` 中的 `ALLOWED_ORIGINS` 包含了所有需要的地址。

---

## 📊 架构说明

```
┌─────────────────────────────────────────────────────────┐
│                    本地开发环境                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  前端 (5173) ──┐                                        │
│  营销页 (8080) ├──> 后端 API (3000) <──┐               │
│  Win管理器(5174)┘                        │               │
│                                          │               │
└──────────────────────────────────────────┼───────────────┘
                                           │
                                           │
                                    ┌──────▼──────┐
                                    │   ngrok     │
                                    │  (隧道)     │
                                    └──────┬──────┘
                                           │
                                           │ HTTPS
                                           │
                                    ┌──────▼──────┐
                                    │  微信服务器  │
                                    │  (支付回调)  │
                                    └─────────────┘
```

**关键点**：
- 本地服务之间直接通信（localhost）
- 只有微信服务器需要通过 ngrok 访问后端
- ngrok 只暴露后端 3000 端口

---

## 🎉 开始测试

现在一切就绪！你可以：

1. **测试本地功能**：直接访问 http://localhost:5173
2. **测试微信支付**：访问 http://localhost:8080 并完成支付流程
3. **监控请求**：访问 http://127.0.0.1:4040 查看 ngrok 日志

祝测试顺利！🚀
