# GEO系统最终测试指南

## 系统状态总结

✅ **所有组件已部署并正常运行**

### 1. 数据库状态
- ✅ 40个表全部创建完成
- ✅ 管理员用户 `lzc2005` 已创建
- ✅ 所有必需字段和索引已添加

### 2. 后端服务
- ✅ PM2 进程稳定运行
- ✅ API 健康检查正常
- ✅ 登录接口正常工作

### 3. 前端应用
- ✅ 落地页已更新（最新版本）
- ✅ 客户端应用资源路径正确
- ✅ Nginx 配置正确

## 完整测试流程

### 步骤 1: 访问落地页
```
URL: http://43.143.163.6
预期: 显示GEO系统营销页面
```

### 步骤 2: 点击登录
```
操作: 点击页面右上角"立即登录"按钮
预期: 跳转到登录页面
```

### 步骤 3: 输入凭据
```
用户名: lzc2005
密码: jehI2oBuNMMJehMM
操作: 点击"登录"按钮
预期: 显示"登录成功！正在跳转..."
```

### 步骤 4: 自动跳转
```
预期: 自动跳转回落地页首页
状态: 右上角显示用户名和"进入系统"按钮
```

### 步骤 5: 进入系统
```
操作: 点击"进入系统"按钮
预期: 跳转到 http://43.143.163.6/app/
结果: 显示GEO系统工作台
```

## 技术细节

### 登录流程
1. 用户在落地页登录
2. Token 保存到 localStorage
3. 页面跳转回首页
4. 首页检测到登录状态，显示"进入系统"按钮

### 进入系统流程
1. 点击"进入系统"按钮
2. 从 localStorage 读取 token、refresh_token、user_info
3. 构造 URL: `http://43.143.163.6/app/?token=xxx&refresh_token=xxx&user_info=xxx`
4. 跳转到客户端应用
5. 客户端应用从 URL 参数提取 token 并保存
6. 清除 URL 参数，跳转到首页

### 配置信息
```javascript
// 落地页配置 (landing/src/config/env.ts)
remoteTest: {
  apiUrl: `http://${window.location.hostname}/api`,
  clientUrl: `http://${window.location.hostname}/app`,
  environment: 'remote-test'
}

// 客户端配置 (client/vite.config.ts)
base: '/app/'
```

### Nginx 路由
```nginx
location / {
  # 落地页
  root /var/www/geo-system/landing/dist;
  try_files $uri $uri/ /index.html;
}

location /app/ {
  # 客户端应用
  alias /var/www/geo-system/client/dist/;
  try_files $uri $uri/ /app/index.html;
}

location /api/ {
  # 后端 API
  proxy_pass http://localhost:3000/api/;
}
```

## 故障排查

### 如果登录后没有跳转
1. 打开浏览器开发者工具 (F12)
2. 查看 Console 标签页
3. 检查是否有 JavaScript 错误
4. 检查 Network 标签页，确认登录请求返回 200

### 如果点击"进入系统"没有反应
1. 打开浏览器开发者工具 (F12)
2. 查看 Console 标签页
3. 检查 localStorage 中是否有 token:
   ```javascript
   localStorage.getItem('auth_token')
   localStorage.getItem('refresh_token')
   localStorage.getItem('user_info')
   ```
4. 检查是否有 JavaScript 错误

### 如果跳转到 /app/ 后显示 403
1. 检查 Nginx 配置
2. 检查文件权限
3. 重启 Nginx: `sudo systemctl restart nginx`

### 如果客户端应用资源 404
1. 检查 vite.config.ts 中的 base 配置
2. 重新构建客户端: `npm run build`
3. 重新部署: `scp -r client/dist/* ubuntu@43.143.163.6:/var/www/geo-system/client/dist/`

## 验证命令

### 检查后端服务
```bash
ssh ubuntu@43.143.163.6 "pm2 list"
curl http://43.143.163.6/api/health
```

### 检查数据库
```bash
ssh ubuntu@43.143.163.6 "PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' psql -h localhost -U geo_user -d geo_system -c 'SELECT COUNT(*) FROM users;'"
```

### 测试登录 API
```bash
curl -X POST http://43.143.163.6/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"lzc2005","password":"jehI2oBuNMMJehMM"}'
```

## 系统访问信息

- **落地页**: http://43.143.163.6
- **客户端应用**: http://43.143.163.6/app/
- **API 端点**: http://43.143.163.6/api/
- **管理员账号**: lzc2005
- **管理员密码**: jehI2oBuNMMJehMM

## 已解决的问题

1. ✅ 数据库迁移不完整 - 已创建所有40个表
2. ✅ 管理员用户未创建 - 已创建 lzc2005 用户
3. ✅ 登录 API 500 错误 - 已修复所有缺失的表和字段
4. ✅ 落地页配置未更新 - 已重新构建并部署
5. ✅ 客户端资源路径错误 - 已配置 base: '/app/'

## 下次部署注意事项

1. 使用 `server/src/db/complete-migration.sql` 进行完整数据库迁移
2. 确保在服务器启动时调用 `authService.initializeDefaultAdmin()`
3. 落地页和客户端都需要重新构建后部署
4. 检查 Nginx 配置中的路径和 alias 设置
