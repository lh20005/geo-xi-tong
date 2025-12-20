# 抖音号真实用户名提取调试 - 完整修复记录

## 问题描述
抖音号登录后，账号管理界面显示的是临时账号名（如 "抖音号_1766159145791"），而不是真实用户名（"Ai来了"）。

## 调查进展

### 1. HTML文件分析 ✅
已找到包含真实用户名的HTML文件：
- `server/debug/douyin_1766158698174.html`
- `server/debug/douyin_1766159129183.html`

在第106行找到用户名元素：
```html
<div class="name-_lSSDc">Ai来了</div>
```

完整结构：
```html
<div class="container-vEyGlK">
  <div class="content-fFY6HC">
    <div class="header-_F2uzl">
      <div class="left-zEzdJX">
        <div class="name-_lSSDc">Ai来了</div>
      </div>
    </div>
  </div>
</div>
```

### 2. 代码审查 ✅
- ✅ 已审查 `server/src/services/adapters/DouyinAdapter.ts`
- ✅ 已审查 `server/src/services/AccountService.ts`
- ✅ 找到 `extractUserInfo` 方法（负责提取用户名）

### 3. 根本原因分析 ✅

**问题1：选择器不够精确**
- 现有选择器列表包含通用选择器，但 `.name-_lSSDc` 没有作为主选择器
- 需要将精确选择器放在列表最前面

**问题2：数据库缺少字段**
- `platform_accounts` 表没有 `real_username` 字段
- 真实用户名只存储在加密的 `credentials` JSON中
- 每次读取都需要解密，效率低且容易出错

**问题3：保存逻辑不完整**
- 登录时提取了用户名，但没有单独保存到数据库字段
- 只能从凭证中提取，如果凭证格式变化会失败

## 修复方案 ✅

### 1. 数据库更新
创建迁移文件：`server/src/db/migrations/008_add_real_username.sql`
```sql
ALTER TABLE platform_accounts 
ADD COLUMN IF NOT EXISTS real_username VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_real_username 
ON platform_accounts(real_username);
```

### 2. 代码更新

#### AccountService.ts
1. **优化选择器配置**
   ```typescript
   'douyin': [
     '.name-_lSSDc',  // 主选择器（从HTML提取）
     '.container-vEyGlK .content-fFY6HC .header-_F2uzl .left-zEzdJX .name-_lSSDc',
     '.header-_F2uzl .name-_lSSDc',
     '[class*="name-"][class*="_"]',
     // ... 其他备用选择器
   ]
   ```

2. **添加新方法**
   - `createAccountWithRealUsername()` - 创建账号时保存真实用户名
   - `updateAccountWithRealUsername()` - 更新账号时保存真实用户名

3. **更新 formatAccount()**
   ```typescript
   // 优先从数据库字段读取
   if (row.real_username) {
     account.real_username = row.real_username;
   }
   // 如果数据库没有，从凭证中提取（向后兼容）
   else if (row.credentials) {
     // ... 解密并提取
   }
   ```

4. **更新 loginWithBrowser()**
   ```typescript
   const realUsername = userInfo.username || '';
   
   if (existingAccount) {
     account = await this.updateAccountWithRealUsername(
       existingAccount.id, 
       { credentials }, 
       realUsername
     );
   } else {
     account = await this.createAccountWithRealUsername(
       { platform_id, account_name, credentials }, 
       realUsername
     );
   }
   ```

### 3. 执行迁移 ✅
```bash
cd server && npm run db:migrate
```

输出：
```
✅ 数据库连接成功
✅ 数据库迁移完成
```

## 测试步骤

### 1. 重启服务器
```bash
npm run dev
```

### 2. 重新登录抖音账号
1. 访问：http://localhost:3000
2. 进入：发布管理 → 账号管理
3. 点击：抖音平台 → 浏览器登录
4. 完成登录流程

### 3. 验证结果
- ✅ 账号名称显示："Ai来了"
- ❌ 不应显示："抖音号_1766159145791"

## 技术细节

### 用户名提取流程
```
浏览器登录 
  ↓
extractUserInfo() - 尝试多个选择器
  ↓
找到 .name-_lSSDc 元素
  ↓
提取文本："Ai来了"
  ↓
createAccountWithRealUsername() 或 updateAccountWithRealUsername()
  ↓
保存到 platform_accounts.real_username
  ↓
formatAccount() 读取并返回
  ↓
前端显示："Ai来了"
```

### 数据存储
```
platform_accounts 表：
- id: 账号ID
- platform_id: 'douyin'
- account_name: 'Ai来了' (可能是临时名称)
- real_username: 'Ai来了' (新增字段，存储真实用户名)
- credentials: {加密的JSON，包含cookies和userInfo}
```

### 向后兼容
- 旧账号（没有real_username）：自动从credentials提取
- 新账号：直接从real_username字段读取
- 重新登录：自动更新real_username字段

## 相关文件
- ✅ `server/src/db/migrations/008_add_real_username.sql` - 数据库迁移
- ✅ `server/src/services/AccountService.ts` - 用户名提取和保存逻辑
- ✅ `server/src/services/adapters/DouyinAdapter.ts` - 抖音适配器
- ✅ `server/debug/douyin_*.html` - HTML快照（用于调试）
- ✅ `dev-docs/DOUYIN_USERNAME_FIX_COMPLETE.md` - 完整修复文档
- ✅ `dev-docs/QUICK_TEST_DOUYIN_USERNAME.md` - 快速测试指南

## 修复状态
- ✅ 数据库迁移完成
- ✅ 代码更新完成
- ✅ 选择器优化完成
- ⏳ 等待用户测试验证

## 下一步
请按照 `QUICK_TEST_DOUYIN_USERNAME.md` 中的步骤进行测试验证。
