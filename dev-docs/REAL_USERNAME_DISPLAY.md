# 账号真实用户名显示功能

## 功能说明

在账号管理列表中显示平台账号的**真实用户名**，而不仅仅是用户自己输入的账号名称。

## 问题背景

之前的实现中，账号列表只显示 `account_name`（用户自己输入的名称），但用户希望看到平台账号的真实用户名，例如：
- 头条号的真实昵称
- 知乎的真实用户名
- 小红书的真实账号名

## 数据来源

真实用户名存储在 `platform_accounts` 表的 `credentials` 字段中（加密存储）：

```json
{
  "username": "登录用户名",
  "password": "密码",
  "cookies": [...],
  "userInfo": {
    "username": "平台真实用户名"  // ← 这是我们要显示的
  }
}
```

### 提取逻辑

1. **优先使用** `credentials.userInfo.username`（浏览器登录时提取的真实用户名）
2. **其次使用** `credentials.username`（但排除 'browser_login' 这种占位符）

## 实现方案

### 1. 后端修改

#### 文件：`server/src/services/AccountService.ts`

**修改1：Account 接口添加字段**
```typescript
export interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string; // ← 新增：平台真实用户名
  credentials?: any;
  is_default: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
}
```

**修改2：formatAccount 方法提取真实用户名**
```typescript
private formatAccount(row: any, includeCredentials: boolean): Account {
  const account: Account = {
    id: row.id,
    platform_id: row.platform_id,
    account_name: row.account_name,
    is_default: row.is_default,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at
  };
  
  // 始终尝试提取真实用户名（不管是否包含完整凭证）
  if (row.credentials) {
    try {
      const decryptedCredentials = encryptionService.decryptObject(row.credentials);
      
      // 提取真实用户名（优先使用 userInfo.username，其次使用 username）
      if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
        account.real_username = decryptedCredentials.userInfo.username;
      } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
        account.real_username = decryptedCredentials.username;
      }
      
      // 如果需要包含完整凭证
      if (includeCredentials) {
        account.credentials = decryptedCredentials;
      }
    } catch (error) {
      console.error('解密凭证失败:', error);
      if (includeCredentials) {
        account.credentials = null;
      }
    }
  }
  
  return account;
}
```

**关键点**：
- 即使不返回完整凭证，也会提取真实用户名
- 不会暴露敏感信息（密码、Cookie等）
- 只返回用户名这一个字段

### 2. 前端修改

#### 文件：`client/src/api/publishing.ts`

**修改：Account 接口添加字段**
```typescript
export interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string; // ← 新增：平台真实用户名
  credentials?: any;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}
```

#### 文件：`client/src/pages/PlatformManagementPage.tsx`

**修改：表格列定义**
```tsx
const columns = [
  {
    title: '平台',
    // ... 平台显示
  },
  {
    title: '真实用户名',  // ← 改为显示真实用户名
    dataIndex: 'real_username',
    key: 'real_username',
    align: 'center' as const,
    render: (text: string, record: Account) => (
      <Space>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1890ff' }}>
          {text || record.account_name || '未知'}
        </span>
        {record.is_default && <StarFilled style={{ color: '#faad14' }} />}
      </Space>
    )
  },
  {
    title: '备注名称',  // ← 新增备注名称列
    dataIndex: 'account_name',
    key: 'account_name',
    align: 'center' as const,
    render: (text: string) => (
      <span style={{ fontSize: 14, color: '#64748b' }}>{text}</span>
    )
  },
  // ... 其他列
];
```

#### 文件：`client/src/components/Publishing/AccountManagementModal.tsx`

**修改：显示真实用户名**
```tsx
<List.Item.Meta
  title={
    <Space>
      <span>{account.account_name}</span>
      {account.real_username && (
        <Tag color="blue" style={{ fontSize: '12px' }}>
          真实用户名: {account.real_username}
        </Tag>
      )}
      {account.is_default && <Tag color="gold">默认</Tag>}
      <Tag color={account.status === 'active' ? 'green' : 'default'}>
        {account.status === 'active' ? '正常' : '未激活'}
      </Tag>
    </Space>
  }
  description={
    <div>
      {account.real_username && (
        <div style={{ color: '#1890ff', marginBottom: 4 }}>
          平台账号：{account.real_username}
        </div>
      )}
      <div>创建时间：{new Date(account.created_at).toLocaleString()}</div>
      {account.last_used_at && (
        <div>最后使用：{new Date(account.last_used_at).toLocaleString()}</div>
      )}
    </div>
  }
/>
```

## 显示效果

### 平台管理页面 - 账号列表表格

**修改前**：
| 平台 | 账号名称 | 状态 | 创建时间 | 最后使用 | 操作 |
|------|---------|------|---------|---------|------|
| 头条号 | 我的头条号 ⭐ | 正常 | 2024-12-19 22:30:00 | 2024-12-19 23:00:00 | 删除 |

**修改后**：
| 平台 | 真实用户名 | 备注名称 | 状态 | 创建时间 | 最后使用 | 操作 |
|------|-----------|---------|------|---------|---------|------|
| 头条号 | **张三的自媒体** ⭐ | 我的头条号 | 正常 | 2024-12-19 22:30:00 | 2024-12-19 23:00:00 | 删除 |

**关键变化**：
1. 原"账号名称"列改为"真实用户名"列，显示平台真实用户名（蓝色加粗）
2. 新增"备注名称"列，显示用户自己输入的备注（灰色）
3. 真实用户名优先显示，更直观

### 账号管理模态框（保持不变）

```
我的头条号  [真实用户名: 张三的自媒体]  [默认] [正常]
平台账号：张三的自媒体
创建时间：2024-12-19 22:30:00
```

## 使用场景

### 场景1：浏览器登录
用户通过"浏览器登录"功能登录平台时：
1. 系统会自动提取平台的真实用户名
2. 存储在 `credentials.userInfo.username` 中
3. 账号列表会显示这个真实用户名

### 场景2：手动添加账号
用户手动输入用户名密码时：
1. 系统会使用输入的 `username` 作为真实用户名
2. 账号列表会显示这个用户名

### 场景3：旧账号（无真实用户名）
对于之前创建的账号，如果没有提取到真实用户名：
1. `real_username` 字段为空
2. 只显示 `account_name`
3. 不会显示"真实用户名"标签

## 安全性

- ✅ 只返回用户名，不返回密码
- ✅ 不返回 Cookie 数据
- ✅ 不返回其他敏感信息
- ✅ 凭证仍然加密存储在数据库中
- ✅ 只在需要时解密提取用户名

## 测试方法

### 测试1：浏览器登录
1. 打开平台管理页面
2. 选择一个平台（如头条号）
3. 点击"浏览器登录"
4. 完成登录后，查看账号列表
5. **验证**：应该显示平台的真实用户名

### 测试2：手动添加账号
1. 打开平台管理页面
2. 选择一个平台
3. 点击"添加账号"
4. 输入账号名称、用户名、密码
5. 保存后查看账号列表
6. **验证**：应该显示输入的用户名

### 测试3：旧账号兼容性
1. 查看之前创建的账号
2. **验证**：如果没有真实用户名，只显示账号名称，不会报错

## 相关文件

- `server/src/services/AccountService.ts` - 后端账号服务
- `client/src/api/publishing.ts` - 前端API类型定义
- `client/src/pages/PlatformManagementPage.tsx` - 平台管理页面（主要修改）
- `client/src/components/Publishing/AccountManagementModal.tsx` - 账号管理模态框

## 注意事项

1. **性能**：每次获取账号列表都会解密凭证提取用户名，但只解密一次，性能影响很小
2. **兼容性**：对于没有真实用户名的旧账号，不会显示，不会报错
3. **安全性**：只返回用户名，不返回任何敏感信息
4. **显示优先级**：
   - 优先显示 `userInfo.username`（浏览器登录提取）
   - 其次显示 `username`（手动输入）
   - 排除占位符（如 'browser_login'）

## 未来改进

1. **自动更新真实用户名**：在每次登录成功后，自动更新真实用户名
2. **显示更多信息**：可以显示平台头像、粉丝数等信息
3. **批量更新**：提供批量更新真实用户名的功能
