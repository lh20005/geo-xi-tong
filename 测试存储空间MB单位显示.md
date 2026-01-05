# 测试存储空间 MB 单位显示

## 修改内容总结

### 1. 新增格式化函数
- ✅ `client/src/api/storage.ts` - 添加 `formatStorageMB()` 函数
- ✅ `windows-login-manager/src/api/storage.ts` - 添加 `formatStorageMB()` 函数

### 2. 前端显示更新
- ✅ `landing/src/pages/HomePage.tsx` - 落地页套餐功能显示（MB/GB）
- ✅ `client/src/pages/ProductManagementPage.tsx` - 商品管理功能配额显示（MB/GB）
- ✅ `client/src/pages/UserCenterPage.tsx` - 个人中心配额统计和套餐功能显示

### 3. 后端已支持
- ✅ `server/src/services/SubscriptionService.ts` - 已将 bytes 转换为 MB 返回

## 测试步骤

### 测试 1: 落地页套餐显示
```bash
# 访问落地页
open http://localhost:8080

# 检查点：
# 1. 滚动到"价格方案"部分
# 2. 查看每个套餐卡片的功能列表
# 3. 存储空间应该显示为：
#    - 体验版: 100 MB
#    - 专业版: 1 GB (1024 MB)
#    - 企业版: 不限
```

**预期结果：**
- ✅ 体验版显示 "存储空间 100MB"
- ✅ 专业版显示 "存储空间 1GB"
- ✅ 企业版显示 "存储空间 不限"

### 测试 2: 商品管理页面
```bash
# 1. 登录管理员账号
# 2. 访问商品管理页面
open http://localhost:5173/product-management

# 检查点：
# 1. 查看套餐列表的"功能配额"列
# 2. 存储空间应该显示为：
#    - 100 MB
#    - 1 GB
#    - 无限制
```

**预期结果：**
- ✅ 功能配额列显示 "存储空间: 100 MB"
- ✅ 功能配额列显示 "存储空间: 1 GB"
- ✅ 功能配额列显示 "存储空间: 无限制"

### 测试 3: 编辑套餐功能配额
```bash
# 1. 在商品管理页面点击"编辑"按钮
# 2. 查看功能配额部分
# 3. 添加新的存储空间配额

# 检查点：
# 1. 单位显示应该是 "MB"
# 2. 输入 100，显示为 "100 MB"
# 3. 输入 1024，显示为 "1024 MB"（在列表中会显示为 1 GB）
```

**预期结果：**
- ✅ 单位输入框显示 "MB"
- ✅ 保存后列表正确显示

### 测试 4: 个人中心配额统计
```bash
# 1. 登录普通用户账号
# 2. 访问个人中心
open http://localhost:5173/user-center

# 检查点：
# 1. 查看"配额统计"标签页
# 2. 存储空间进度条应该显示：
#    - "已使用 50 MB / 100 MB" 或
#    - "已使用 500 MB / 1 GB"
```

**预期结果：**
- ✅ 进度条显示格式化的 MB/GB 单位
- ✅ 百分比计算正确
- ✅ 无限制套餐显示"无限"

### 测试 5: 个人中心套餐详情
```bash
# 在个人中心的"我的订阅"标签页

# 检查点：
# 1. 查看"套餐功能"部分
# 2. 存储空间应该显示为：
#    - "100 MB" 或 "1 GB" 或 "无限制"
```

**预期结果：**
- ✅ 套餐功能显示格式化的存储空间
- ✅ 不再显示 bytes 单位

### 测试 6: 用户管理订阅详情
```bash
# 1. 登录管理员账号
# 2. 访问用户管理页面
# 3. 点击某个用户的"订阅管理"按钮
# 4. 查看订阅详情抽屉

# 检查点：
# 1. 配额统计中的存储空间
# 2. 应该显示 MB/GB 单位
```

**预期结果：**
- ✅ 订阅详情正确显示 MB/GB 单位

## 格式化规则

### formatStorageMB() 函数逻辑
```typescript
formatStorageMB(100)    => "100 MB"
formatStorageMB(1024)   => "1 GB"
formatStorageMB(1536)   => "1.5 GB"
formatStorageMB(2048)   => "2 GB"
formatStorageMB(10240)  => "10 GB"
formatStorageMB(-1)     => "无限"
formatStorageMB(0)      => "0 MB"
```

### 显示规则
- 小于 1024 MB：显示 MB 单位
- 大于等于 1024 MB：转换为 GB 单位
- 大于等于 10 GB：不显示小数
- 小于 10 GB：显示一位小数
- -1 表示无限制

## 数据库验证

### 检查 plan_features 表
```sql
-- 查看存储空间配额的单位
SELECT 
  sp.plan_name,
  pf.feature_name,
  pf.feature_value,
  pf.feature_unit,
  CASE 
    WHEN pf.feature_value = -1 THEN '无限制'
    WHEN pf.feature_value >= 1024 THEN CONCAT(pf.feature_value / 1024, ' GB')
    ELSE CONCAT(pf.feature_value, ' MB')
  END as display_value
FROM plan_features pf
JOIN subscription_plans sp ON pf.plan_id = sp.id
WHERE pf.feature_code = 'storage_space'
ORDER BY sp.display_order;
```

**预期结果：**
```
plan_name    | feature_value | feature_unit | display_value
-------------|---------------|--------------|---------------
体验版       | 100           | MB           | 100 MB
专业版       | 1024          | MB           | 1 GB
企业版       | -1            | MB           | 无限制
```

## 回归测试

### 确保不影响现有功能
- [ ] 存储空间上传检查仍然正常工作
- [ ] 配额警报仍然正常触发
- [ ] 存储空间购买功能正常
- [ ] 套餐升级后配额正确更新

## 已知问题

### 无

## 相关文件清单

### 修改的文件
1. `client/src/api/storage.ts` - 添加 formatStorageMB
2. `windows-login-manager/src/api/storage.ts` - 添加 formatStorageMB
3. `landing/src/pages/HomePage.tsx` - 更新显示逻辑
4. `client/src/pages/ProductManagementPage.tsx` - 更新显示逻辑
5. `client/src/pages/UserCenterPage.tsx` - 更新显示逻辑

### 未修改的文件（已经正确）
- `server/src/services/SubscriptionService.ts` - 已返回 MB 单位
- `server/src/db/migrations/020_update_storage_unit_to_mb.sql` - 已完成迁移

## 完成标记

- [x] 添加格式化函数
- [x] 更新落地页显示
- [x] 更新商品管理显示
- [x] 更新个人中心显示
- [ ] 执行完整测试
- [ ] 验证所有显示位置
- [ ] 确认无回归问题
