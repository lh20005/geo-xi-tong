# 属性测试修复总结

**修复时间**: 2024-12-25  
**状态**: 🔄 进行中

---

## 已完成的修复

### 1. ✅ WebSocket 方法名修复
- **问题**: `SubscriptionService` 使用了不存在的 `sendToUser` 方法
- **修复**: 将所有 `sendToUser` 替换为 `broadcast`
- **文件**: `server/src/services/SubscriptionService.ts`
- **影响**: 3处调用（recordUsage, activateSubscription, applyUpgrade）

### 2. ✅ 订单号唯一性测试
- **状态**: 全部通过 ✅
- **测试数**: 4个测试，400次迭代
- **文件**: `server/src/__tests__/properties/order-uniqueness.property.test.ts`

### 3. 🔄 使用量记录测试
- **状态**: 修复中
- **问题**: Mock 设置不完整，`recordUsage` 调用了多个方法
- **修复**: 
  - 为每个测试添加 `jest.clearAllMocks()`
  - 为 `getUserUsage` 添加 mock
  - 简化"多次记录累加"测试的验证逻辑
- **文件**: `server/src/__tests__/properties/usage-recording.property.test.ts`

### 4. 🔄 配置历史测试
- **状态**: 部分修复
- **问题**: Mock 在迭代间没有重置
- **修复**: 在每个属性测试内部添加 `jest.clearAllMocks()`
- **文件**: `server/src/__tests__/properties/config-history.property.test.ts`

---

## 待修复的测试

### 1. quota-check.property.test.ts
- **问题**: `canUserPerformAction` 的 mock 设置不完整
- **需要 mock**: 
  - `getUserActiveSubscription`
  - `getPlanConfig`
  - `getUserUsage`

### 2. quota-exhaustion.property.test.ts
- **问题**: 类似 quota-check 的 mock 问题

### 3. config-rollback.property.test.ts
- **问题**: Mock 设置不完整

---

## 修复策略

### 当前问题
属性测试的 mock 设置过于复杂，因为：
1. 方法调用链很深（如 `canUserPerformAction` → `getUserActiveSubscription` → `getPlanConfig` → `getUserUsage`）
2. 每个方法都有多个数据库查询
3. 需要为每次迭代正确设置所有 mock

### 建议方案

#### 方案 A: 简化 Mock（推荐）
直接 mock 高层方法而不是底层数据库调用：
```typescript
jest.spyOn(subscriptionService, 'getUserActiveSubscription')
  .mockResolvedValue(mockSubscription);
jest.spyOn(subscriptionService, 'getPlanConfig')
  .mockResolvedValue(mockPlan);
```

#### 方案 B: 使用测试数据库
使用真实的测试数据库而不是 mock，这样可以测试真实的集成行为。

#### 方案 C: 重构测试
将复杂的属性测试拆分为更小的单元测试。

---

## 下一步行动

1. ✅ 完成 WebSocket 修复
2. 🔄 完成 usage-recording 测试修复
3. ⏳ 修复 quota-check 测试
4. ⏳ 修复 quota-exhaustion 测试
5. ⏳ 修复 config-history 剩余测试
6. ⏳ 修复 config-rollback 测试
7. ✅ 运行所有属性测试验证

---

**更新时间**: 2024-12-25  
**进度**: 2/6 测试文件完成

