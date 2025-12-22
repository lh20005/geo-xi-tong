# 账号保存问题修复

## 问题描述

**现象：** 登录成功后，在账号管理页面看不到保存的登录信息

## 问题分析

### 问题 1：后端 API 不支持 real_username 字段

**位置：** `server/src/routes/platformAccounts.ts`

**问题：**
```typescript
// 修复前
router.post('/accounts', async (req, res) => {
  const { platform_id, account_name, credentials } = req.body;
  // ❌ 没有接收 real_username 字段
  
  const account = await accountService.createAccount({
    platform_id,
    account_name,
    credentials
  });
  // ❌ 使用的是 createAccount，不支持 real_username
});
```

**影响：**
- Windows 端发送的 `real_username` 被忽略
- 账号创建成功，但缺少真实用户名信息

### 问题 2：前端登录成功后没有刷新账号列表

**位置：** `windows-login-manager/src/pages/PlatformSelection.tsx`

**问题：**
```typescript
// 修复前
if (result.success) {
  alert(`登录成功！账号：${result.account?.account_name}`);
  // ❌ 没有刷新账号列表
}
```

**影响：**
- 账号已保存到数据库
- 但前端状态没有更新
- 需要手动刷新页面才能看到新账号

## 修复方案

### 修复 1：后端支持 real_username 字段

**文件：** `server/src/routes/platformAccounts.ts`

```typescript
// 修复后
router.post('/accounts', async (req, res) => {
  const { platform_id, account_name, credentials, real_username } = req.body;
  
  // 如果提供了 real_username，使用 createAccountWithRealUsername
  let account;
  if (real_username) {
    account = await accountService.createAccountWithRealUsername({
      platform_id,
      account_name,
      credentials
    }, real_username);
  } else {
    account = await accountService.createAccount({
      platform_id,
      account_name,
      credentials
    });
  }
  
  // ...
});
```

**效果：**
- ✅ 支持接收 `real_username` 字段
- ✅ 使用正确的方法保存真实用户名
- ✅ 向后兼容（没有 real_username 时使用旧方法）

### 修复 2：前端登录成功后刷新账号列表

**文件：** `windows-login-manager/src/pages/PlatformSelection.tsx`

```typescript
// 修复后
import { useApp } from '../context/AppContext';

const PlatformSelection: React.FC = () => {
  const { refreshAccounts } = useApp();
  
  // ...
  
  if (result.success) {
    alert(`登录成功！账号：${result.account?.account_name}`);
    
    // 刷新账号列表
    try {
      await refreshAccounts();
      console.log('Accounts refreshed after successful login');
    } catch (refreshError) {
      console.error('Failed to refresh accounts:', refreshError);
    }
  }
};
```

**效果：**
- ✅ 登录成功后自动刷新账号列表
- ✅ 新账号立即显示在账号管理页面
- ✅ 无需手动刷新页面

## 数据流程

### 修复后的完整流程

```
1. 用户在浏览器中完成登录
   ↓
2. Windows 端检测到登录成功
   ↓
3. 提取用户信息（包括 real_username）
   ↓
4. 构建账号数据
   {
     platform_id: 'toutiao',
     account_name: '用户名',
     real_username: '用户名',  ← 真实用户名
     credentials: { cookies, storage, userInfo, loginTime }
   }
   ↓
5. 保存到本地缓存
   ↓
6. 同步到后端
   POST /api/accounts
   {
     platform_id: 'toutiao',
     account_name: '用户名',
     real_username: '用户名',  ← 后端现在支持这个字段
     credentials: { ... }
   }
   ↓
7. 后端保存到数据库
   INSERT INTO platform_accounts
   (platform, platform_id, account_name, credentials, real_username, ...)
   ↓
8. 返回成功响应
   ↓
9. 前端刷新账号列表  ← 新增步骤
   GET /api/accounts
   ↓
10. 更新前端状态
   ↓
11. ✅ 账号立即显示在账号管理页面
```

## 测试步骤

### 1. 重启服务

```bash
# 终端 1：重启后端
cd server && npm run dev

# 终端 2：重启 Windows 登录管理器
cd windows-login-manager && npm run dev
```

### 2. 测试登录和账号保存

1. 打开 Windows 登录管理器
2. 点击「平台管理」
3. 选择「头条号」
4. 点击「登录」
5. 在浏览器中完成登录
6. 看到「登录成功」提示
7. 点击「账号管理」
8. **应该立即看到新添加的头条号账号**

### 3. 验证账号信息

检查账号列表中的信息：
- ✅ 平台：头条号
- ✅ 账号名称：你的用户名
- ✅ 真实用户名：你的用户名（应该显示）
- ✅ 状态：活跃
- ✅ 创建时间：刚才的时间

### 4. 验证数据库

```bash
# 连接数据库
psql -d your_database_name

# 查询账号
SELECT id, platform_id, account_name, real_username, status, created_at
FROM platform_accounts
WHERE platform_id = 'toutiao'
ORDER BY created_at DESC
LIMIT 1;

# 应该看到：
# id | platform_id | account_name | real_username | status | created_at
# ---|-------------|--------------|---------------|--------|------------
# 1  | toutiao     | 用户名       | 用户名        | active | 2025-12-22 ...
```

## 故障排查

### 问题 1：仍然看不到账号

**可能原因：**
1. 后端保存失败
2. 前端刷新失败
3. 网络连接问题

**排查步骤：**

1. **检查后端日志：**
   ```
   # 应该看到：
   [LoginManager] Account saved locally
   [LoginManager] Account synced to backend
   Account created: toutiao
   ```

2. **检查前端日志：**
   ```
   # 打开开发者工具（Ctrl+Shift+I）
   # 应该看到：
   Login completed successfully
   Accounts refreshed after successful login
   ```

3. **手动刷新账号列表：**
   - 点击账号管理页面的刷新按钮
   - 或者重启应用

4. **检查数据库：**
   ```sql
   SELECT COUNT(*) FROM platform_accounts WHERE platform_id = 'toutiao';
   ```

### 问题 2：账号保存了但缺少 real_username

**可能原因：**
- 后端代码未更新
- 用户信息提取失败

**解决方法：**

1. **确认后端代码已更新：**
   ```bash
   cd server
   grep -A 10 "real_username" src/routes/platformAccounts.ts
   # 应该看到 createAccountWithRealUsername 的调用
   ```

2. **检查用户信息提取：**
   ```
   # 后端日志应该显示：
   [UserInfoExtractor] Extracted username: 你的用户名
   ```

3. **如果提取失败，检查选择器配置：**
   ```bash
   curl http://localhost:3000/api/platforms/toutiao | jq '.selectors.username'
   ```

### 问题 3：前端刷新失败

**可能原因：**
- AppContext 未正确导入
- refreshAccounts 方法出错

**解决方法：**

1. **检查导入：**
   ```typescript
   // PlatformSelection.tsx
   import { useApp } from '../context/AppContext';
   const { refreshAccounts } = useApp();
   ```

2. **检查错误日志：**
   ```
   # 开发者工具 Console
   Failed to refresh accounts: [错误信息]
   ```

3. **手动测试刷新：**
   ```typescript
   // 在浏览器控制台
   window.electron.refreshAccounts().then(console.log);
   ```

## 相关文件

### 修改文件

- `server/src/routes/platformAccounts.ts` - 支持 real_username 字段
- `windows-login-manager/src/pages/PlatformSelection.tsx` - 登录成功后刷新账号列表

### 相关文件

- `windows-login-manager/electron/login/login-manager.ts` - 账号保存逻辑
- `windows-login-manager/electron/sync/service.ts` - 同步服务
- `windows-login-manager/electron/api/client.ts` - API 客户端
- `windows-login-manager/src/context/AppContext.tsx` - 应用状态管理
- `server/src/services/AccountService.ts` - 账号服务

## 技术要点

### 为什么需要 real_username？

1. **account_name 可能不是真实用户名**
   - 可能是自动生成的（如 `头条号_1234567890`）
   - 可能是用户自定义的别名

2. **real_username 是从页面提取的真实用户名**
   - 直接从登录后的页面元素中提取
   - 更准确地反映用户的实际身份

3. **用于显示和识别**
   - 在账号列表中显示真实用户名
   - 帮助用户识别不同的账号

### 为什么需要刷新账号列表？

1. **React 状态管理**
   - 账号列表存储在 React 状态中
   - 状态不会自动更新

2. **用户体验**
   - 登录成功后立即看到新账号
   - 无需手动刷新页面

3. **数据一致性**
   - 确保前端显示的数据与后端一致
   - 避免缓存导致的数据不同步

## 总结

### 问题本质

1. ❌ 后端 API 不支持 `real_username` 字段
2. ❌ 前端登录成功后没有刷新账号列表

### 解决方案

1. ✅ 修改后端 API 支持 `real_username`
2. ✅ 使用 `createAccountWithRealUsername` 方法
3. ✅ 前端登录成功后调用 `refreshAccounts()`

### 修复效果

- ✅ 账号成功保存到数据库
- ✅ 真实用户名正确保存
- ✅ 登录成功后立即显示在账号列表
- ✅ 无需手动刷新页面

---

**修复日期：** 2025-12-22  
**修复人员：** Kiro AI Assistant  
**测试状态：** 待验证
