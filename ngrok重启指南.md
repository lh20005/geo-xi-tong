# ngrok 重启指南

## 当前配置

**ngrok URL**: `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev`

**更新时间**: 2026-01-04

## 已更新的配置

### .env 文件
```bash
WECHAT_PAY_NOTIFY_URL=https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api/payment/wechat/notify
```

## 重要地址

### 后端 API
- 基础地址: `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev`
- 健康检查: `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/health`
- 支付回调: `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api/payment/wechat/notify`

### 前端访问
- 主应用: `http://localhost:5173` (本地开发)
- 落地页: `http://localhost:8080` (本地开发)

## 下一步操作

### 1. 重启后端服务

```bash
# 停止当前后端服务 (Ctrl+C)
# 然后重新启动
npm run server:dev
```

### 2. 验证 ngrok 连接

```bash
# 访问 ngrok 管理界面
open http://localhost:4040

# 或者测试 API
curl https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/health
```

### 3. 测试支付回调

```bash
# 测试回调地址是否可访问
curl -X POST https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api/payment/wechat/notify \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## 常用命令

### 查看 ngrok 状态
```bash
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool
```

### 停止 ngrok
```bash
pkill -f ngrok
```

### 启动 ngrok
```bash
ngrok http 3000
```

### 获取当前 URL
```bash
curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4
```

## 自动化脚本

### 重启 ngrok 并更新 .env

创建脚本 `restart-ngrok.sh`:

```bash
#!/bin/bash

echo "停止旧的 ngrok 进程..."
pkill -f ngrok

echo "启动新的 ngrok..."
ngrok http 3000 > /dev/null 2>&1 &

echo "等待 ngrok 启动..."
sleep 5

echo "获取新的 URL..."
NEW_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NEW_URL" ]; then
    echo "❌ 无法获取 ngrok URL"
    exit 1
fi

echo "✅ 新的 ngrok URL: $NEW_URL"

echo "更新 .env 文件..."
sed -i.bak "s|WECHAT_PAY_NOTIFY_URL=.*|WECHAT_PAY_NOTIFY_URL=${NEW_URL}/api/payment/wechat/notify|" .env

echo "✅ .env 已更新"
echo ""
echo "请重启后端服务以加载新的环境变量："
echo "  npm run server:dev"
```

使用方法：
```bash
chmod +x restart-ngrok.sh
./restart-ngrok.sh
```

## 注意事项

1. **ngrok 免费版限制**:
   - 每次重启 URL 都会变化
   - 需要手动更新 .env 文件
   - 需要重启后端服务

2. **微信支付配置**:
   - 回调地址必须是 HTTPS
   - 需要在微信支付商户平台配置白名单
   - 测试时可以使用 ngrok 的 URL

3. **安全建议**:
   - 不要将 ngrok URL 提交到代码仓库
   - 生产环境使用固定域名
   - 定期更换 ngrok URL

## 故障排查

### ngrok 无法启动
```bash
# 检查端口占用
lsof -i :4040

# 检查 ngrok 进程
ps aux | grep ngrok

# 清理并重启
pkill -9 -f ngrok
ngrok http 3000
```

### 回调地址无法访问
```bash
# 检查后端服务是否运行
curl http://localhost:3000/health

# 检查 ngrok 转发
curl https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/health

# 查看 ngrok 日志
open http://localhost:4040
```

### .env 未生效
```bash
# 确认 .env 文件已更新
cat .env | grep WECHAT_PAY_NOTIFY_URL

# 重启后端服务
# Ctrl+C 停止
npm run server:dev
```

## 快速参考

| 项目 | 值 |
|------|-----|
| ngrok URL | `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev` |
| 回调地址 | `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev/api/payment/wechat/notify` |
| 管理界面 | `http://localhost:4040` |
| 本地后端 | `http://localhost:3000` |
| 本地前端 | `http://localhost:5173` |
| 本地落地页 | `http://localhost:8080` |

## 更新历史

- 2026-01-04: 初始配置，URL: `https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev`
