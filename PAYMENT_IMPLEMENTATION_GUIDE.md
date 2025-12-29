# 支付功能实施指南

## 📋 功能概述

本指南介绍如何实现完整的微信支付功能，包括：
1. 营销网站点击购买弹出二维码
2. 支付成功自动开通用量
3. 后台管理商品套餐

## ✅ 已完成的功能

### 1. 营销网站支付流程（landing）

**新增文件：**
- `landing/src/components/PaymentModal.tsx` - 支付弹窗组件

**修改文件：**
- `landing/src/pages/HomePage.tsx` - 添加购买按钮处理和支付弹窗

**功能特性：**
- ✅ 点击购买按钮弹出支付二维码
- ✅ 使用第三方API生成二维码图片
- ✅ 每2秒轮询订单状态
- ✅ 支付成功自动跳转到系统应用
- ✅ 未登录用户跳转到登录页
- ✅ 支付失败提示

### 2. 后台套餐管理（client）

**新增文件：**
- `client/src/pages/PlanManagementPage.tsx` - 套餐管理页面

**功能特性：**
- ✅ 查看所有套餐列表
- ✅ 编辑套餐价格和功能配额
- ✅ 价格变动超过20%需要二次确认
- ✅ 查看配置变更历史
- ✅ 统计卡片展示

### 3. 后端API（server）

**新增文件：**
- `server/src/routes/admin/plans.ts` - 套餐管理路由

**修改文件：**
- `server/src/routes/admin.ts` - 添加套餐管理路由
- `server/src/services/SubscriptionService.ts` - 添加 `getPlanById` 方法
- `client/src/App.tsx` - 添加套餐管理路由
- `client/src/components/Layout/Sidebar.tsx` - 添加套餐管理菜单

**已有功能（无需修改）：**
- ✅ `PaymentService` - 微信支付服务
- ✅ `OrderService` - 订单管理服务
- ✅ `ProductService` - 商品管理服务
- ✅ `SubscriptionService` - 订阅管理服务
- ✅ 支付回调自动开通订阅
- ✅ WebSocket实时通知

## 🔧 配置步骤

### 1. 配置微信支付

在 `server/.env` 文件中添加微信支付配置：

```env
# 微信支付配置（使用公钥模式）
WECHAT_PAY_APP_ID=your_app_id
WECHAT_PAY_MCH_ID=your_mch_id
WECHAT_PAY_API_V3_KEY=your_api_v3_key
WECHAT_PAY_SERIAL_NO=your_serial_no
WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/apiclient_key.pem
WECHAT_PAY_NOTIFY_URL=https://your-domain.com/api/payment/wechat/notify
```

**注意：** 微信支付已改用公钥模式，不再需要下载平台证书。详见官方文档：https://pay.weixin.qq.com/doc/v3/partner/4012925323

### 2. 数据库表结构

确保以下表已创建（应该已存在）：

```sql
-- 订阅套餐表
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  plan_code VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 套餐功能配额表
CREATE TABLE plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id),
  feature_code VARCHAR(50) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  feature_value INTEGER NOT NULL,
  feature_unit VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  plan_id INTEGER REFERENCES subscription_plans(id),
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20) DEFAULT 'wechat',
  order_type VARCHAR(20) DEFAULT 'purchase',
  transaction_id VARCHAR(100),
  expired_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户订阅表
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  plan_id INTEGER REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'active',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 商品配置历史表
CREATE TABLE product_config_history (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id),
  changed_by INTEGER REFERENCES users(id),
  change_type VARCHAR(20) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. 初始化套餐数据

```sql
-- 插入套餐
INSERT INTO subscription_plans (plan_code, plan_name, price) VALUES
('free', '免费版', 0),
('pro', '专业版', 99),
('enterprise', '企业版', 299);

-- 插入功能配额
INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit) VALUES
-- 免费版
(1, 'daily_articles', '每日生成文章', 10, '篇'),
(1, 'daily_publish', '每日发布文章', 20, '篇'),
(1, 'platform_accounts', '平台账号', 1, '个'),
(1, 'keywords', '关键词蒸馏', 50, '个'),
(1, 'knowledge_base_size', '知识库容量', 100, 'MB'),
-- 专业版
(2, 'daily_articles', '每日生成文章', 100, '篇'),
(2, 'daily_publish', '每日发布文章', 200, '篇'),
(2, 'platform_accounts', '平台账号', 3, '个'),
(2, 'keywords', '关键词蒸馏', 500, '个'),
(2, 'knowledge_base_size', '知识库容量', 1024, 'MB'),
-- 企业版
(3, 'daily_articles', '每日生成文章', -1, '篇'),
(3, 'daily_publish', '每日发布文章', -1, '篇'),
(3, 'platform_accounts', '平台账号', 10, '个'),
(3, 'keywords', '关键词蒸馏', -1, '个'),
(3, 'knowledge_base_size', '知识库容量', 10240, 'MB');
```

## 🚀 使用流程

### 用户购买流程

1. **访问营销网站** - 用户浏览套餐信息
2. **点击购买按钮** - 触发购买流程
3. **登录检查** - 未登录跳转到登录页
4. **弹出支付弹窗** - 显示二维码和订单信息
5. **微信扫码支付** - 用户使用微信扫码
6. **轮询订单状态** - 前端每2秒查询一次
7. **支付成功** - 自动跳转到系统应用
8. **订阅开通** - 后端自动开通用户订阅

### 管理员管理流程

1. **登录系统** - 使用管理员账号登录
2. **进入套餐管理** - 点击侧边栏"套餐管理"
3. **查看套餐列表** - 查看所有套餐和配额
4. **编辑套餐** - 点击"编辑"按钮
5. **修改价格/配额** - 输入新的价格或配额
6. **保存变更** - 系统自动记录历史
7. **查看历史** - 点击"历史"按钮查看变更记录

## 📊 API接口

### 创建订单
```
POST /api/orders
Authorization: Bearer {token}

Request:
{
  "plan_id": 2,
  "order_type": "purchase"
}

Response:
{
  "success": true,
  "data": {
    "order_no": "ORD1234567890123456",
    "amount": 99,
    "plan_name": "专业版",
    "qr_code_url": "weixin://wxpay/bizpayurl?pr=xxx"
  }
}
```

### 查询订单状态
```
GET /api/orders/{orderNo}/status
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "order_no": "ORD1234567890123456",
    "status": "paid",
    "trade_state": "SUCCESS"
  }
}
```

### 更新套餐配置
```
PUT /api/admin/plans/{planId}
Authorization: Bearer {token}

Request:
{
  "price": 99,
  "features": [
    {
      "feature_code": "daily_articles",
      "feature_value": 100
    }
  ]
}

Response:
{
  "success": true,
  "data": { ... },
  "message": "套餐更新成功"
}
```

### 获取配置历史
```
GET /api/admin/plans/{planId}/history?limit=50
Authorization: Bearer {token}

Response:
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

## 🔒 安全特性

1. **订单超时** - 30分钟未支付自动关闭
2. **价格变动确认** - 超过20%需要二次确认
3. **配置历史记录** - 所有变更都有审计日志
4. **权限控制** - 只有管理员可以修改套餐
5. **签名验证** - 微信支付回调签名验证
6. **幂等性保证** - 防止重复支付

## 🎯 最佳实践

### 1. 二维码生成

使用第三方API生成二维码：
```typescript
const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`;
```

优点：
- 无需安装额外依赖
- 服务器端生成，性能好
- 支持自定义尺寸

### 2. 订单状态轮询

```typescript
useEffect(() => {
  if (!orderNo || paymentStatus !== 'pending') return;

  const interval = setInterval(async () => {
    const response = await axios.get(`/api/orders/${orderNo}/status`);
    if (response.data.data.status === 'paid') {
      setPaymentStatus('success');
      clearInterval(interval);
    }
  }, 2000); // 每2秒查询一次

  return () => clearInterval(interval);
}, [orderNo, paymentStatus]);
```

### 3. 价格变动确认

```typescript
if (priceChange > 0.2) {
  return res.json({
    success: false,
    needConfirm: true,
    message: `价格变动超过20%，请确认是否继续`
  });
}
```

## 🐛 常见问题

### 1. 二维码不显示

**原因：** 微信支付未配置或配置错误

**解决：** 检查 `.env` 文件中的微信支付配置

### 2. 支付成功但未开通

**原因：** 支付回调未正确处理

**解决：** 
- 检查 `WECHAT_PAY_NOTIFY_URL` 是否正确
- 查看服务器日志确认回调是否收到
- 确保回调URL可以从外网访问

### 3. 套餐管理页面空白

**原因：** 数据库中没有套餐数据

**解决：** 运行初始化SQL插入套餐数据

### 4. 价格修改不生效

**原因：** Redis缓存未清除

**解决：** 
- `ProductService.updatePlan` 会自动清除缓存
- 手动清除：`redis-cli DEL plan:{plan_code}`

## 📝 测试清单

- [ ] 未登录用户点击购买跳转到登录页
- [ ] 已登录用户点击购买弹出支付弹窗
- [ ] 支付弹窗显示正确的价格和套餐名称
- [ ] 二维码正确显示
- [ ] 支付成功后自动跳转
- [ ] 订阅正确开通
- [ ] 管理员可以查看套餐列表
- [ ] 管理员可以编辑套餐价格
- [ ] 管理员可以编辑功能配额
- [ ] 价格变动超过20%需要确认
- [ ] 配置历史正确记录
- [ ] 订单超时自动关闭

## 🎉 总结

本实施方案基于互联网最佳实践，提供了完整的支付功能：

1. **用户体验优秀** - 弹窗支付，无需跳转
2. **管理便捷** - 后台随时修改套餐
3. **安全可靠** - 完整的安全机制
4. **易于维护** - 清晰的代码结构
5. **可扩展** - 支持多种支付方式

所有代码已经完成，只需要配置微信支付参数即可使用！
