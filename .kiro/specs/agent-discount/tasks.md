# Implementation Plan: 代理商折扣功能

## Overview

本实现计划将代理商折扣功能分为 5 个主要阶段：数据库迁移、后端服务、API 路由、前端界面、测试验证。采用增量开发方式，每个阶段完成后进行测试验证。

**核心设计要点**：
- 折扣比例随套餐配置，实时查询，范围 1-100（100 表示无折扣）
- 首次购买折扣仅限一次，支付成功后标记
- 订单记录完整的折扣信息（原价、折扣比例、实付金额）
- 不影响现有支付流程，仅在符合条件时应用折扣

## Tasks

- [x] 1. 数据库迁移
  - [x] 1.1 创建代理商折扣数据库迁移文件
    - 为 subscription_plans 表添加 agent_discount_rate 字段（INTEGER，默认 100）
    - 添加 CHECK 约束确保值在 1-100 范围内
    - 为 orders 表添加 original_price、discount_rate、is_agent_discount 字段
    - 为 users 表添加 first_purchase_discount_used 字段
    - 创建必要的索引
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
    - **File: server/src/db/migrations/044_agent_discount_system.sql**
    - **Status: 已执行**

- [x] 2. 后端核心服务实现
  - [x] 2.1 创建 DiscountService 折扣服务
    - 实现 checkDiscountEligibility 检查用户折扣资格
    - 实现 calculateDiscountedPrice 计算折扣价格
    - 实现 getUserDiscountPrices 获取用户的折扣价格信息
    - 实现 markFirstPurchaseDiscountUsed 标记已使用折扣
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.4_
    - **File: server/src/services/DiscountService.ts**
  - [x] 2.2 编写 DiscountService 属性测试
    - **Property 1: 折扣比例输入验证** ✓
    - **Property 3: 折扣资格判断** ✓
    - **Property 4: 折扣价格计算准确性** ✓
    - **Validates: Requirements 1.2, 2.1-2.6, 3.1, 3.2, 3.4**
    - **File: server/src/services/__tests__/DiscountService.test.ts**
  - [x] 2.3 扩展 ProductManagementService 支持折扣配置
    - 修改 getAllPlans 返回 agentDiscountRate 字段
    - 修改 getPlanById 返回 agentDiscountRate 字段
    - 修改 updatePlan 支持更新 agentDiscountRate
    - 添加折扣比例验证逻辑
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_
    - **File: server/src/services/ProductManagementService.ts**
  - [x] 2.4 编写 ProductManagementService 属性测试
    - **Property 2: 折扣配置持久化** ✓
    - **Validates: Requirements 1.5**
    - **File: server/src/services/__tests__/ProductManagementService.test.ts**

- [x] 3. Checkpoint - 核心服务测试
  - 所有属性测试通过 ✓
  - 数据库迁移正确执行 ✓

- [x] 4. 支付流程折扣集成
  - [x] 4.1 扩展 PaymentService 支持折扣
    - 修改 createWeChatPayOrder 检查用户折扣资格
    - 在订单创建时应用折扣价格
    - 保存原价、折扣比例、折扣标记到订单
    - 在订单描述中注明"代理商专属优惠"
    - _Requirements: 3.5, 3.6, 5.1, 5.2, 5.3, 5.4_
    - **File: server/src/services/PaymentService.ts**
  - [x] 4.2 修改支付回调处理
    - 支付成功后标记用户已使用首次购买折扣
    - 支付失败不标记
    - _Requirements: 5.5, 8.4_
    - **File: server/src/services/PaymentService.ts**
  - [x] 4.3 扩展 OrderService 支持折扣订单
    - 修改 createOrder 支持折扣选项
    - 保存 original_price, discount_rate, is_agent_discount 到订单
    - 添加 isAgentDiscount 筛选参数到 getAllOrders
    - **File: server/src/services/OrderService.ts**
  - [x] 4.4 编写支付折扣属性测试
    - **Property 5: 订单折扣应用完整性** ✓
    - **Property 6: 首次购买折扣状态管理** ✓
    - **Property 9: 折扣比例快照** ✓
    - **Validates: Requirements 3.5, 3.6, 5.2, 5.3, 5.5, 5.6, 8.3, 8.4**
    - **File: server/src/services/__tests__/DiscountService.test.ts**

- [x] 5. API 路由实现
  - [x] 5.1 创建折扣检查 API
    - GET /api/subscription/discount-check - 检查用户折扣资格
    - 返回用户资格状态和所有套餐的折扣价格
    - _Requirements: 2.1, 2.2, 2.3, 4.5_
    - **File: server/src/routes/subscription.ts**
  - [x] 5.2 扩展套餐管理 API
    - 修改 GET /api/subscription/plans 返回折扣信息
    - 修改 PUT /api/admin/products/plans/:id 支持折扣配置
    - 添加折扣比例验证
    - _Requirements: 1.1, 1.2, 1.5, 1.6_
    - **Files: server/src/routes/subscription.ts, server/src/routes/admin/productManagement.ts**

- [x] 6. Checkpoint - API 测试
  - API 路由已实现 ✓
  - 折扣资格检查正确 ✓
  - 折扣配置保存正确 ✓

- [x] 7. 管理后台前端
  - [x] 7.1 修改套餐编辑表单
    - 在 PlanEditModal 中添加"代理商折扣"输入框
    - 添加输入验证（1-100 整数）
    - 显示折扣说明（如"80 表示 8 折"）
    - _Requirements: 1.1, 1.2, 1.3_
    - **File: client/src/pages/ProductManagementPage.tsx**
  - [x] 7.2 修改套餐列表显示
    - 在套餐列表表格中添加"代理商折扣"列
    - 显示折扣比例（如"80%"或"无折扣"）
    - _Requirements: 1.6_
    - **File: client/src/pages/ProductManagementPage.tsx**
  - [x] 7.3 扩展订单管理页面
    - 在订单详情中显示折扣信息（原价、折扣价、节省金额）
    - 添加"代理商折扣订单"筛选选项
    - _Requirements: 6.3, 6.4_
    - **File: client/src/pages/OrderManagementPage.tsx**

- [x] 8. 落地页前端
  - [x] 8.1 创建折扣资格检查 Hook
    - 实现 useDiscountEligibility 自定义 Hook
    - 调用 /api/subscription/discount-check 获取折扣信息
    - 缓存结果避免重复请求
    - _Requirements: 4.1, 4.5_
    - **File: landing/src/hooks/useDiscountEligibility.ts**
  - [x] 8.2 修改套餐卡片组件
    - 有折扣时显示原价（划线）和折扣价
    - 显示"代理商专属优惠"标签
    - 无折扣时只显示原价
    - _Requirements: 4.2, 4.3, 4.4_
    - **File: landing/src/pages/HomePage.tsx**
  - [x] 8.3 修改支付弹窗
    - 使用折扣价创建订单
    - 显示优惠信息
    - _Requirements: 4.6, 5.1_
    - **File: landing/src/components/PaymentModal.tsx**

- [x] 9. Checkpoint - 前端功能测试
  - 管理后台折扣配置功能已实现 ✓
  - 落地页折扣展示已实现 ✓
  - 订单管理页面折扣筛选已实现 ✓

- [x] 10. 边界情况和安全
  - [x] 10.1 实现边界情况处理
    - NULL 折扣比例视为 100
    - 代理商状态不影响用户折扣
    - 退款不恢复折扣资格
    - _Requirements: 8.1, 8.2, 8.5_
  - [x] 10.2 编写边界情况属性测试
    - **Property 8: 代理商状态不影响用户折扣** ✓
    - **Validates: Requirements 8.2**
    - **File: server/src/services/__tests__/DiscountService.test.ts**
  - [x] 10.3 添加折扣统计功能
    - 统计代理商折扣订单数量
    - 统计优惠总金额
    - _Requirements: 6.5_
    - **File: server/src/services/DiscountService.ts (getDiscountStatistics)**
    - **File: server/src/routes/admin/orders.ts (stats/summary endpoint)**
  - [x] 10.4 编写统计属性测试
    - **Property 7: 折扣统计准确性** ✓
    - **Validates: Requirements 6.5**
    - **File: server/src/services/__tests__/DiscountService.test.ts**

- [x] 11. Final Checkpoint - 完整流程测试
  - 所有属性测试通过 ✓ (34 tests total)
  - 数据库迁移已执行 ✓
  - 代码无诊断错误 ✓

## Notes

- All tasks including property-based tests are completed ✓
- 折扣比例范围 1-100，100 表示无折扣
- 折扣价计算：原价 × (折扣比例 / 100)，四舍五入到分
- 最小支付金额 0.01 元
- 首次购买折扣仅限一次，支付成功后标记
- 退款不恢复折扣资格
- 本功能不影响现有支付流程

## API 端点汇总

### 用户 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/subscription/discount-check | 检查用户折扣资格和价格 |
| GET | /api/subscription/plans | 获取套餐列表（含折扣信息） |

### 管理员 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/products/plans | 获取所有套餐（含折扣配置） |
| PUT | /api/admin/products/plans/:id | 更新套餐（含折扣配置） |
| GET | /api/admin/orders | 获取订单列表（支持 isAgentDiscount 筛选） |
| GET | /api/admin/orders/stats/summary | 获取订单统计（含折扣统计） |

## 数据库变更汇总

| 表 | 字段 | 类型 | 说明 |
|---|------|------|------|
| subscription_plans | agent_discount_rate | INTEGER | 代理商折扣比例（1-100，默认100） |
| orders | original_price | DECIMAL(12,2) | 原价 |
| orders | discount_rate | INTEGER | 使用的折扣比例 |
| orders | is_agent_discount | BOOLEAN | 是否使用代理商折扣 |
| users | first_purchase_discount_used | BOOLEAN | 是否已使用首次购买折扣 |

## 已完成文件列表

1. `server/src/db/migrations/044_agent_discount_system.sql` - 数据库迁移 ✓
2. `server/src/services/DiscountService.ts` - 折扣服务 ✓
3. `server/src/services/__tests__/DiscountService.test.ts` - 折扣服务测试 (28 tests) ✓
4. `server/src/services/__tests__/ProductManagementService.test.ts` - 套餐管理测试 (6 tests) ✓
5. `server/src/services/ProductManagementService.ts` - 套餐管理服务（已扩展） ✓
6. `server/src/services/OrderService.ts` - 订单服务（已扩展） ✓
7. `server/src/services/PaymentService.ts` - 支付服务（已扩展） ✓
8. `server/src/routes/subscription.ts` - 订阅路由（已扩展） ✓
9. `server/src/routes/admin/orders.ts` - 管理员订单路由（已扩展） ✓
10. `client/src/pages/ProductManagementPage.tsx` - 管理后台套餐管理页面（已扩展） ✓
11. `client/src/pages/OrderManagementPage.tsx` - 管理后台订单管理页面（已扩展） ✓
12. `landing/src/hooks/useDiscountEligibility.ts` - 折扣资格检查 Hook ✓
13. `landing/src/pages/HomePage.tsx` - 落地页首页（已扩展） ✓
14. `landing/src/components/PaymentModal.tsx` - 支付弹窗（已扩展） ✓

## 测试结果

```
DiscountService: 28 tests passed
ProductManagementService: 6 tests passed
Total: 34 tests passed
```
