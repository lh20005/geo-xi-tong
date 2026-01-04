# 订单记录显示问题修复

## 问题描述
用户 lzc2005 购买了套餐，但在个人中心的订单记录中没有显示购买信息。

## 问题原因
后端 API `/api/orders` 返回的数据结构是：
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {...}
  }
}
```

但前端代码直接使用 `response.data.data`，导致获取到的是整个对象 `{ orders: [...], pagination: {...} }` 而不是订单数组。

## 根本原因分析

### 后端路由 (server/src/routes/orders.ts)
```typescript
router.get('/', authenticate, async (req, res) => {
  const result = await orderService.getUserOrders(userId, page, limit, status);
  
  res.json({
    success: true,
    data: {
      orders: result.orders,      // 订单数组在这里
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit)
      }
    }
  });
});
```

### 前端代码 (client/src/pages/UserCenterPage.tsx)
```typescript
// 错误的代码
const ordersData = response.data.data;  // 这里得到的是 { orders: [...], pagination: {...} }
setOrders(Array.isArray(ordersData) ? ordersData : []);  // 不是数组，设置为空数组
```

## 修复方案

修改 `client/src/pages/UserCenterPage.tsx` 中的 `fetchOrders` 函数：

```typescript
// 修复后
const ordersData = response.data.data?.orders || response.data.data;
setOrders(Array.isArray(ordersData) ? ordersData : []);
```

这样可以兼容两种数据结构：
1. 如果 `data.orders` 存在（标准格式），使用它
2. 否则使用 `data` 本身（向后兼容旧格式）

## 已修复的文件
- ✅ `client/src/pages/UserCenterPage.tsx` - Web 端订单获取逻辑已修复
- ✅ `windows-login-manager/src/pages/UserCenterPage.tsx` - Windows 端订单获取逻辑已修复

## 测试步骤

### Web 端测试

#### 1. 启动服务
```bash
npm run dev
```

#### 2. 登录测试
- 使用用户名 `lzc2005` 登录系统
- 或使用任何有订单记录的用户账号

#### 3. 验证订单显示
1. 进入个人中心页面
2. 点击"订单记录"标签页
3. 检查订单列表是否正确显示

### Windows 端测试

#### 1. 启动 Windows 登录管理器
```bash
cd windows-login-manager
npm run dev
```

#### 2. 登录测试
- 使用用户名 `lzc2005` 登录
- 或使用任何有订单记录的用户账号

#### 3. 验证订单显示
1. 进入用户中心页面
2. 滚动到"订单记录"卡片
3. 检查订单列表是否正确显示

### 4. 验证订单信息
确认以下信息正确显示：
- ✅ 订单号
- ✅ 套餐名称
- ✅ 金额（格式：¥XX.XX）
- ✅ 状态标签（待支付/已支付/已关闭/已退款）
- ✅ 创建时间
- ✅ 支付时间（已支付订单）

## 预期结果

### 订单状态显示
- 🟠 待支付 - 橙色标签
- 🟢 已支付 - 绿色标签
- ⚪ 已关闭 - 灰色标签
- 🔴 已退款 - 红色标签

### 数据格式
- 金额：¥99.00（保留两位小数）
- 时间：2025/1/4 14:30:00（本地化格式）
- 支付时间：未支付显示 "-"

## 相关文件

### 前端
- `client/src/pages/UserCenterPage.tsx` - 用户中心页面
- `client/src/pages/OrderManagementPage.tsx` - 管理员订单管理（无需修改）

### 后端
- `server/src/routes/orders.ts` - 订单路由
- `server/src/services/OrderService.ts` - 订单服务
- `server/src/db/complete-migration.sql` - 订单表结构

## 数据库表结构

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  plan_id INTEGER REFERENCES subscription_plans(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 注意事项

1. **数据一致性**：确保订单数据已正确写入数据库
2. **权限验证**：订单路由使用 `authenticate` 中间件，确保用户只能看到自己的订单
3. **分页支持**：后端支持分页，默认每页10条记录
4. **实时更新**：支付成功后通过 WebSocket 实时推送订单状态变更

## 故障排查

如果订单仍然不显示，检查：

1. **浏览器控制台**：查看是否有 API 错误
2. **网络请求**：检查 `/api/orders` 请求是否成功
3. **响应数据**：确认返回的数据格式正确
4. **数据库查询**：确认用户确实有订单记录
5. **认证状态**：确认用户已正确登录，token 有效
