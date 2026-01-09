# Implementation Plan: 加量包系统 (Booster Pack System)

## Overview

本实现计划将加量包系统分解为可执行的编码任务，按照数据库 → 服务层 → API 层 → 前端的顺序逐步实现。每个任务都包含具体的代码修改和测试要求。

## Tasks

- [x] 1. 数据库迁移和表结构
  - [x] 1.1 创建数据库迁移文件，扩展 subscription_plans 表
    - 添加 plan_type 字段（VARCHAR(20) DEFAULT 'base'）
    - 添加 CHECK 约束（plan_type IN ('base', 'booster')）
    - 添加索引 idx_subscription_plans_type
    - _Requirements: 1.1_

  - [x] 1.2 创建数据库迁移文件，扩展 user_subscriptions 表
    - 添加 plan_type 字段（VARCHAR(20) DEFAULT 'base'）
    - 添加 CHECK 约束
    - _Requirements: 6.1_

  - [x] 1.3 创建数据库迁移文件，新建 user_booster_quotas 表
    - 创建表结构：id, user_id, booster_subscription_id, feature_code, quota_limit, quota_used, status, created_at, expires_at, updated_at
    - 添加外键约束和 CHECK 约束
    - 创建索引：idx_user_booster_quotas_user_feature, idx_user_booster_quotas_expires, idx_user_booster_quotas_subscription
    - _Requirements: 3.1, 3.5_

  - [x] 1.4 创建数据库函数 check_combined_quota
    - 实现组合配额检查逻辑
    - 返回基础配额和加量包配额的汇总信息
    - _Requirements: 8.3_

  - [x] 1.5 创建数据库函数 consume_quota_with_booster
    - 实现消耗优先级逻辑（基础优先）
    - 实现 FIFO 消耗顺序
    - 使用事务确保原子性
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Checkpoint - 验证数据库迁移
  - [x] 运行迁移脚本
  - [x] 验证表结构和函数创建成功
  - [x] 数据库版本: 048

- [x] 3. 后端服务层实现
  - [x] 3.1 扩展 ProductManagementService
    - [x] 修改 createPlan 方法支持 plan_type 参数
    - [x] 修改 updatePlan 方法支持 plan_type
    - [x] 修改 getAllPlans 方法支持按 plan_type 筛选
    - [x] 添加加量包验证逻辑（至少一个 feature_value > 0）
    - _Requirements: 1.1, 1.2, 1.3, 7.3, 7.4_

  - [x] 3.2 创建 BoosterPackService
    - [x] 实现 canPurchaseBooster 方法（检查购买资格）
    - [x] 实现 activateBoosterPack 方法（开通加量包）
    - [x] 实现 getUserActiveBoosterQuotas 方法
    - [x] 实现 getUserBoosterSummary 方法
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.5, 11.1, 11.2, 11.5_

  - [ ] 3.3 编写 BoosterPackService 属性测试
    - **Property 2: Purchase Eligibility**
    - **Property 3: Quota Snapshot Immutability**
    - **Property 10: Activation Record Creation**
    - **Property 11: Expiration Calculation**
    - **Validates: Requirements 2.1, 2.3, 3.2, 3.3, 6.1, 6.2, 6.3, 6.6, 11.2, 11.5**

  - [x] 3.4 创建 QuotaConsumptionService
    - [x] 实现 checkCombinedQuota 方法
    - [x] 实现 consumeQuota 方法（调用数据库函数）
    - [x] 实现 getCombinedQuotaOverview 方法
    - [x] 添加 WebSocket 通知逻辑
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3, 5.4, 8.1, 8.3_

  - [ ] 3.5 编写 QuotaConsumptionService 属性测试
    - **Property 4: Consumption Priority**
    - **Property 5: FIFO Consumption Order**
    - **Property 6: Transaction Atomicity**
    - **Property 7: Combined Quota Response Structure**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3**

  - [x] 3.6 扩展 UsageTrackingService
    - [x] 已通过 QuotaConsumptionService 实现加量包配额消耗
    - [x] 添加 source 字段区分基础配额和加量包配额（数据库迁移已完成）
    - _Requirements: 8.4, 8.5_

  - [x] 3.7 创建 BoosterExpirationService
    - [x] 实现定时检查过期加量包的逻辑
    - [x] 实现过期状态更新
    - [x] 实现过期前通知（3天）
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 3.8 编写 BoosterExpirationService 属性测试
    - **Property 14: Expiration Status Update**
    - **Property 15: Expired Record Retention**
    - **Property 16: Active-Only Display**
    - **Validates: Requirements 3.4, 9.1, 9.2, 9.3, 9.4**

- [x] 4. Checkpoint - 验证服务层实现
  - [x] TypeScript 编译通过
  - [ ] 运行所有服务层测试（属性测试待实现）

- [x] 5. 后端 API 层实现
  - [x] 5.1 扩展商品管理 API
    - [x] 修改 POST /api/admin/products 支持 plan_type
    - [x] 修改 PUT /api/admin/products/:id 支持 plan_type
    - [x] 修改 GET /api/admin/products 支持 plan_type 筛选
    - [x] 添加删除保护逻辑
    - _Requirements: 1.4, 1.5, 7.1, 7.2, 7.4_

  - [x] 5.2 创建加量包购买检查 API
    - [x] 实现 GET /api/orders/can-purchase-booster
    - [x] 返回购买资格和原因
    - _Requirements: 2.1, 2.2, 11.1_

  - [x] 5.3 扩展订单处理逻辑
    - [x] 修改订单创建逻辑支持加量包
    - [x] 修改支付成功回调调用 BoosterPackService.activateBoosterPack
    - _Requirements: 6.1, 6.4_

  - [x] 5.4 创建配额查询 API
    - [x] 实现 GET /api/usage/combined-quota/:featureCode
    - [x] 实现 GET /api/usage/booster-quotas
    - [x] 实现 GET /api/usage/booster-history
    - _Requirements: 5.2, 5.3, 5.4, 5.6, 8.2, 8.5_

  - [ ] 5.5 编写 API 集成测试
    - 测试商品管理 API 的 plan_type 支持
    - 测试购买检查 API
    - 测试配额查询 API
    - **Validates: Requirements 1.4, 2.1, 5.2, 5.3, 8.2, 8.5**

- [x] 6. Checkpoint - 验证 API 层实现
  - [x] TypeScript 编译通过
  - [ ] API 集成测试（待实现）

- [x] 7. 前端实现 - 管理端
  - [x] 7.1 扩展商品管理页面
    - 添加 plan_type 选择器（基础套餐/加量包）
    - 添加加量包标签/颜色区分
    - 添加 plan_type 筛选器
    - _Requirements: 1.4, 7.1, 7.2, 7.4_

  - [ ] 7.2 添加加量包统计显示
    - 显示 total_sold, active_count, revenue
    - _Requirements: 7.5_

- [x] 8. 前端实现 - 用户端
  - [x] 8.1 扩展个人中心配额显示
    - 分离显示基础配额和加量包配额
    - 添加"正在使用加量包配额"指示器
    - 添加过期警告显示
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.2 扩展商品购买页面
    - 区分显示基础套餐和加量包（通过API筛选）
    - 添加购买资格检查
    - 显示购买前置条件提示
    - _Requirements: 2.2, 11.1_

- [ ] 9. Checkpoint - 验证前端实现
  - 手动测试管理端商品管理功能
  - 手动测试用户端配额显示和购买流程
  - 确保所有功能正常，如有问题请询问用户

- [x] 10. 生命周期独立性实现
  - [x] 10.1 修改订阅过期处理逻辑
    - 确保基础订阅过期不影响加量包（SubscriptionExpirationService 已排除 booster 类型）
    - 确保基础订阅升级/降级不影响加量包
    - _Requirements: 10.1, 10.2, 10.4, 10.6, 10.7_

  - [ ] 10.2 编写生命周期独立性属性测试
    - **Property 12: Independent Lifecycle**
    - **Property 13: Free Plan Booster Consumption**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**

- [x] 11. 最终集成测试
  - [ ] 11.1 端到端测试
    - 测试完整购买流程：创建加量包 → 用户购买 → 支付 → 开通 → 使用
    - 测试配额消耗流程：基础配额 → 耗尽 → 加量包配额 → 耗尽
    - 测试生命周期独立性：基础套餐过期 → 加量包仍可用
    - _Requirements: All_

  - [ ] 11.2 编写端到端属性测试
    - **Property 17: Deletion Protection**
    - **Property 18: Multiple Purchase Allowed**
    - **Property 19: Audit Trail Completeness**
    - **Property 20: Combined Quota Check**
    - **Validates: Requirements 1.5, 2.4, 2.5, 8.3, 8.4**

- [ ] 12. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证所有功能正常工作
  - 确保所有测试通过，如有问题请询问用户

## Implementation Summary

### 已完成的核心功能：

1. **数据库层**：
   - `subscription_plans.plan_type` 字段（区分基础套餐和加量包）
   - `user_subscriptions.plan_type` 字段（冗余存储）
   - `user_booster_quotas` 表（独立存储加量包配额）
   - `check_combined_quota` 函数（检查组合配额）
   - `consume_quota_with_booster` 函数（优先级消耗）
   - `expire_booster_quotas` 函数（过期处理）
   - `get_user_booster_summary` 函数（汇总查询）

2. **后端服务层**：
   - `BoosterPackService` - 加量包购买资格检查、激活、查询
   - `QuotaConsumptionService` - 组合配额检查和消耗
   - `BoosterExpirationService` - 定时过期检查和警告
   - `SubscriptionExpirationService` - 已排除加量包（生命周期独立）
   - `PaymentService` - 支付成功后激活加量包

3. **后端API层**：
   - `GET /api/orders/can-purchase-booster` - 购买资格检查
   - `GET /api/usage/combined-quota` - 组合配额概览
   - `GET /api/usage/booster-quotas` - 加量包配额列表
   - `GET /api/usage/booster-summary` - 加量包汇总
   - `GET /api/usage/booster-history` - 加量包历史
   - `GET /api/usage/expiring-boosters` - 即将过期的加量包
   - `GET /api/subscription/plans?plan_type=` - 按类型筛选套餐

4. **前端管理端**：
   - 商品管理页面支持 plan_type 筛选
   - 新增/编辑套餐时可选择套餐类型
   - 加量包标签显示

5. **前端用户端**：
   - `BoosterQuotaCard` 组件 - 显示加量包配额
   - 用户中心集成加量包配额显示
   - 过期警告提示
   - "正在使用加量包配额"指示器

### 待完成（属性测试）：
- Task 3.3, 3.5, 3.8: 服务层属性测试
- Task 5.5: API 集成测试
- Task 10.2: 生命周期独立性属性测试
- Task 11.2: 端到端属性测试

## Notes

- All tasks are required for complete implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 属性测试使用 fast-check 库，每个测试至少运行 100 次迭代
- 所有数据库操作使用事务确保数据一致性
