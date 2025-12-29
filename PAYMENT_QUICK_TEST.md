# 支付功能快速测试指南

## 🚀 快速开始

### 1. 启动服务

```bash
# 启动后端
cd server
npm run dev

# 启动营销网站
cd landing
npm run dev

# 启动客户端
cd client
npm run dev
```

### 2. 初始化数据库

```bash
# 连接数据库
psql -U your_user -d your_database

# 执行初始化SQL（如果还没有套餐数据）
INSERT INTO subscription_plans (plan_code, plan_name, price) VALUES
('free', '免费版', 0),
('pro', '专业版', 99),
('enterprise', '企业版', 299);

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit) VALUES
(1, 'daily_articles', '每日生成文章', 10, '篇'),
(1, 'daily_publish', '每日发布文章', 20, '篇'),
(2, 'daily_articles', '每日生成文章', 100, '篇'),
(2, 'daily_publish', '每日发布文章', 200, '篇'),
(3, 'daily_articles', '每日生成文章', -1, '篇'),
(3, 'daily_publish', '每日发布文章', -1, '篇');
```

## 📋 测试场景

### 场景1：未登录用户购买

1. 访问 `http://localhost:8080`
2. 滚动到价格方案部分
3. 点击"专业版"的"点击购买"按钮
4. **预期结果：** 跳转到登录页 `/login`

### 场景2：已登录用户购买

1. 先登录系统 `http://localhost:8080/login`
2. 返回首页 `http://localhost:8080`
3. 滚动到价格方案部分
4. 点击"专业版"的"点击购买"按钮
5. **预期结果：** 弹出支付弹窗，显示：
   - 套餐名称：专业版
   - 支付金额：¥99
   - 二维码（如果微信支付已配置）
   - 或错误提示（如果微信支付未配置）

### 场景3：支付弹窗功能

**测试关闭按钮：**
1. 打开支付弹窗
2. 点击右上角的 X 按钮
3. **预期结果：** 弹窗关闭

**测试未配置微信支付：**
1. 确保 `.env` 中没有配置微信支付
2. 打开支付弹窗
3. **预期结果：** 显示错误提示"请先登录"或"创建订单失败"

### 场景4：管理员查看套餐列表

1. 使用管理员账号登录客户端 `http://localhost:5173`
2. 点击侧边栏"套餐管理"
3. **预期结果：** 显示套餐列表，包含：
   - 免费版 ¥0
   - 专业版 ¥99
   - 企业版 ¥299
   - 每个套餐的功能配额

### 场景5：编辑套餐价格

1. 在套餐管理页面
2. 点击"专业版"的"编辑"按钮
3. 修改价格为 89
4. 点击"确定"
5. **预期结果：** 
   - 价格变动 10.1%，直接保存成功
   - 提示"套餐更新成功"
   - 列表中价格更新为 ¥89

### 场景6：大幅度价格变动

1. 在套餐管理页面
2. 点击"专业版"的"编辑"按钮
3. 修改价格为 50（变动超过20%）
4. 点击"确定"
5. **预期结果：** 
   - 显示确认提示"价格变动超过20%"
   - 需要二次确认

### 场景7：编辑功能配额

1. 在套餐管理页面
2. 点击"专业版"的"编辑"按钮
3. 修改"每日生成文章"为 150
4. 修改"每日发布文章"为 300
5. 点击"确定"
6. **预期结果：** 
   - 保存成功
   - 列表中配额更新

### 场景8：查看配置历史

1. 在套餐管理页面
2. 点击"专业版"的"历史"按钮
3. **预期结果：** 
   - 显示配置历史弹窗
   - 列出所有变更记录
   - 包含：时间、变更类型、字段、旧值、新值、操作人

## 🔍 API测试

### 测试创建订单API

```bash
# 先登录获取token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'

# 使用返回的token创建订单
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plan_id": 2,
    "order_type": "purchase"
  }'
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "order_no": "ORD1234567890123456",
    "amount": 99,
    "plan_name": "专业版",
    "qr_code_url": "weixin://wxpay/bizpayurl?pr=xxx"
  },
  "message": "订单创建成功，请扫码支付"
}
```

### 测试查询订单状态API

```bash
curl -X GET http://localhost:3000/api/orders/ORD1234567890123456/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "order_no": "ORD1234567890123456",
    "status": "pending"
  }
}
```

### 测试更新套餐API

```bash
curl -X PUT http://localhost:3000/api/admin/plans/2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "price": 89,
    "features": [
      {
        "feature_code": "daily_articles",
        "feature_value": 150
      }
    ]
  }'
```

**预期响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "套餐更新成功"
}
```

### 测试获取配置历史API

```bash
curl -X GET http://localhost:3000/api/admin/plans/2/history?limit=10 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**预期响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "change_type": "price",
      "field_name": "price",
      "old_value": "99",
      "new_value": "89",
      "changed_by_name": "admin",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## 🐛 调试技巧

### 1. 查看浏览器控制台

打开浏览器开发者工具（F12），查看：
- **Console** - 查看JavaScript错误
- **Network** - 查看API请求和响应
- **Application > Local Storage** - 查看token

### 2. 查看服务器日志

```bash
# 后端日志
cd server
npm run dev
# 查看控制台输出

# 查看订单创建日志
# 应该看到：创建订单成功，订单号: ORD...

# 查看支付回调日志
# 应该看到：收到微信支付回调: {...}
```

### 3. 查看数据库

```bash
# 查看订单
psql -U your_user -d your_database -c "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;"

# 查看套餐
psql -U your_user -d your_database -c "SELECT * FROM subscription_plans;"

# 查看配置历史
psql -U your_user -d your_database -c "SELECT * FROM product_config_history ORDER BY created_at DESC LIMIT 10;"
```

### 4. 测试微信支付配置

**重要：** 微信支付已改用公钥模式，不再需要下载平台证书。详见官方文档：https://pay.weixin.qq.com/doc/v3/partner/4012925323

```bash
# 检查环境变量
cd server
cat .env | grep WECHAT_PAY

# 应该看到：
# WECHAT_PAY_APP_ID=...
# WECHAT_PAY_MCH_ID=...
# WECHAT_PAY_API_V3_KEY=...
# WECHAT_PAY_SERIAL_NO=...
# WECHAT_PAY_PRIVATE_KEY_PATH=...（商户私钥）
# WECHAT_PAY_NOTIFY_URL=...
```

## ✅ 测试检查清单

### 营销网站支付流程
- [ ] 未登录点击购买跳转登录页
- [ ] 已登录点击购买弹出支付弹窗
- [ ] 支付弹窗显示正确的套餐信息
- [ ] 支付弹窗显示正确的价格
- [ ] 二维码正确显示（如果已配置微信支付）
- [ ] 关闭按钮正常工作
- [ ] 错误提示正确显示

### 后台套餐管理
- [ ] 套餐列表正确显示
- [ ] 统计卡片数据正确
- [ ] 编辑按钮打开编辑弹窗
- [ ] 价格修改正常保存
- [ ] 配额修改正常保存
- [ ] 价格变动超过20%显示确认提示
- [ ] 历史按钮打开历史弹窗
- [ ] 配置历史正确显示

### API接口
- [ ] 创建订单API返回正确
- [ ] 查询订单状态API返回正确
- [ ] 更新套餐API返回正确
- [ ] 获取配置历史API返回正确
- [ ] 权限控制正常（非管理员无法访问）

### 数据库
- [ ] 订单正确插入
- [ ] 订单状态正确更新
- [ ] 配置历史正确记录
- [ ] 套餐数据正确更新

## 🎯 下一步

如果所有测试通过，你可以：

1. **配置微信支付** - 添加真实的微信支付配置
2. **测试真实支付** - 使用微信扫码测试真实支付流程
3. **部署到生产环境** - 部署到腾讯云或其他服务器
4. **监控订单** - 使用订单管理页面监控订单状态

## 📞 需要帮助？

如果遇到问题：
1. 检查浏览器控制台错误
2. 检查服务器日志
3. 检查数据库数据
4. 参考 `PAYMENT_IMPLEMENTATION_GUIDE.md` 详细文档
