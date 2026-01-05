# 用户管理搜索功能SQL修复

## 问题描述

用户管理页面的搜索功能报错：
```
column reference "username" is ambiguous
```

## 问题原因

在 `UserService.getUsers()` 方法中，当使用搜索参数时，SQL查询的WHERE子句中的 `username` 字段没有指定表别名。由于查询使用了LEFT JOIN连接两个users表（主表u和被邀请用户表invited），导致数据库无法确定应该使用哪个表的username字段。

## 错误的SQL

```sql
-- WHERE子句中的username没有表别名
WHERE username ILIKE $1

-- COUNT查询也缺少表别名
SELECT COUNT(*) as total FROM users WHERE username ILIKE $1
```

## 修复方案

为WHERE子句中的username字段添加表别名 `u.`，并在COUNT查询中也添加表别名。

## 修复后的代码

### 文件：`server/src/services/UserService.ts`

```typescript
async getUsers(
  page: number = 1,
  pageSize: number = 10,
  search?: string
): Promise<{
  users: Array<User & { invitedCount: number }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const offset = (page - 1) * pageSize;
  
  let whereClause = '';
  const params: any[] = [];
  
  if (search) {
    // 修复：添加表别名 u.
    whereClause = 'WHERE u.username ILIKE $1';
    params.push(`%${search}%`);
  }
  
  // 修复：在COUNT查询中添加表别名 u
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM users u ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total);
  
  // 获取用户列表（包括邀请数量）
  const usersResult = await pool.query(
    `SELECT 
      u.id, u.username, u.invitation_code, u.invited_by_code, u.role, 
      u.is_temp_password, u.created_at, u.updated_at, u.last_login_at,
      COUNT(invited.id) as invited_count
     FROM users u
     LEFT JOIN users invited ON invited.invited_by_code = u.invitation_code
     ${whereClause}
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  );
  
  const users = usersResult.rows.map(row => ({
    id: row.id,
    username: row.username,
    invitation_code: row.invitation_code,
    invited_by_code: row.invited_by_code,
    role: row.role,
    is_temp_password: row.is_temp_password,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
    invitedCount: parseInt(row.invited_count)
  }));
  
  return {
    users,
    total,
    page,
    pageSize
  };
}
```

## 修改内容

### 1. WHERE子句修复
**修改前**:
```typescript
whereClause = 'WHERE username ILIKE $1';
```

**修改后**:
```typescript
whereClause = 'WHERE u.username ILIKE $1';
```

### 2. COUNT查询修复
**修改前**:
```sql
SELECT COUNT(*) as total FROM users ${whereClause}
```

**修改后**:
```sql
SELECT COUNT(*) as total FROM users u ${whereClause}
```

## 技术说明

### SQL表别名的重要性

当SQL查询涉及多个表时（通过JOIN连接），如果多个表有相同的列名，必须使用表别名来明确指定使用哪个表的列。

在这个查询中：
- 主表 `users` 使用别名 `u`
- 被邀请用户表 `users` 使用别名 `invited`
- 两个表都有 `username` 列
- 因此WHERE子句中必须使用 `u.username` 而不是 `username`

### 参数占位符

PostgreSQL使用 `$1`, `$2`, `$3` 等作为参数占位符。在动态SQL中，需要根据已有参数的数量来计算新参数的位置：
- `$${params.length + 1}` - LIMIT参数
- `$${params.length + 2}` - OFFSET参数

## 测试验证

### 测试场景

1. **无搜索条件**
   - 访问用户管理页面
   - 应显示所有用户列表
   - 分页功能正常

2. **有搜索条件**
   - 在搜索框输入用户名（如"testuser"）
   - 应返回匹配的用户列表
   - 不应报SQL错误

3. **模糊搜索**
   - 输入部分用户名
   - 应返回所有包含该字符串的用户
   - 大小写不敏感（ILIKE）

### 预期结果

- ✅ 搜索功能正常工作
- ✅ 不再出现 "column reference 'username' is ambiguous" 错误
- ✅ 返回正确的用户列表和总数
- ✅ 分页功能正常

## 部署步骤

1. 修改 `server/src/services/UserService.ts` 文件
2. 重新编译TypeScript代码：
   ```bash
   cd server
   npm run build
   ```
3. 重启后端服务：
   ```bash
   npm run server:dev
   ```
4. 测试用户管理页面的搜索功能

## 相关文件

- `server/src/services/UserService.ts` - 用户服务（已修复）
- `server/src/routes/admin.ts` - 管理员路由
- `client/src/pages/UserManagementPage.tsx` - 前端用户管理页面
- `windows-login-manager/src/pages/UserManagementPage.tsx` - Windows端用户管理页面

## 完成状态 ✅

SQL查询已修复，用户管理页面的搜索功能现在可以正常工作。
