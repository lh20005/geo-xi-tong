# 个人中心邀请码显示问题修复

## 问题描述

用户登录后访问个人中心页面，邀请码没有正常显示。

## 问题原因

服务器端 `/api/users/profile` 接口返回的数据使用下划线命名（snake_case），但前端期望驼峰命名（camelCase）。

### 数据格式不匹配

**服务器返回**（修复前）:
```json
{
  "success": true,
  "data": {
    "id": 437,
    "username": "testuser",
    "invitation_code": "suvboa",      // ❌ 下划线命名
    "invited_by_code": null,
    "role": "user",
    "is_temp_password": false,
    "created_at": "2025-12-24T...",
    "updated_at": "2025-12-24T...",
    "last_login_at": null
  }
}
```

**前端期望**:
```typescript
interface User {
  id: number;
  username: string;
  invitationCode: string;           // ✓ 驼峰命名
  invitedByCode?: string;
  role: 'admin' | 'user';
  isTempPassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
```

## 解决方案

在服务器端 `server/src/routes/users.ts` 的 `/profile` 接口中添加字段名转换。

### 修改内容

```typescript
router.get('/profile', async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const profile = await userService.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 转换字段名为驼峰命名
    res.json({
      success: true,
      data: {
        id: profile.id,
        username: profile.username,
        invitationCode: profile.invitation_code,      // ✓ 转换
        invitedByCode: profile.invited_by_code,       // ✓ 转换
        role: profile.role,
        isTempPassword: profile.is_temp_password,     // ✓ 转换
        createdAt: profile.created_at,                // ✓ 转换
        updatedAt: profile.updated_at,                // ✓ 转换
        lastLoginAt: profile.last_login_at,           // ✓ 转换
        invitedUsers: profile.invitedUsers
      }
    });
  } catch (error: any) {
    console.error('[User] 获取资料失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取资料失败'
    });
  }
});
```

## 修复后的数据格式

**服务器返回**（修复后）:
```json
{
  "success": true,
  "data": {
    "id": 437,
    "username": "testuser",
    "invitationCode": "suvboa",       // ✓ 驼峰命名
    "invitedByCode": null,
    "role": "user",
    "isTempPassword": false,
    "createdAt": "2025-12-24T...",
    "updatedAt": "2025-12-24T...",
    "lastLoginAt": null,
    "invitedUsers": []
  }
}
```

## 其他接口检查

### 已正确处理的接口

1. **登录接口** (`/api/auth/login`)
   - ✓ 已手动转换字段名
   - 返回驼峰命名的用户数据

2. **注册接口** (`/api/auth/register`)
   - ✓ 已手动转换字段名
   - 返回驼峰命名的用户数据

3. **邀请统计接口** (`/api/invitations/stats`)
   - ✓ InvitationService 直接返回驼峰命名
   - 无需额外转换

### 需要注意的接口

如果有其他接口返回用户数据，也需要进行相同的字段名转换：
- `/api/admin/users` - 用户列表
- `/api/admin/users/:id` - 用户详情
- 其他返回用户对象的接口

## 测试步骤

### 1. 重启服务器
```bash
cd server
npm run dev
```

### 2. 登录测试账户
- 访问: http://localhost:8080/login
- 用户名: `testuser`
- 密码: `password123`

### 3. 访问个人中心
- 登录成功后点击导航栏的"个人中心"
- 或直接访问: http://localhost:8080/profile

### 4. 验证邀请码显示
- 检查"我的邀请码"卡片
- 应该显示: `suvboa`
- 点击"复制"按钮应该能复制邀请码

### 5. 检查浏览器控制台
```javascript
// 打开浏览器控制台，查看 API 响应
// Network -> profile -> Response
{
  "success": true,
  "data": {
    "invitationCode": "suvboa",  // ✓ 应该显示邀请码
    ...
  }
}
```

## 为什么会出现这个问题？

### 数据库命名约定
PostgreSQL 数据库使用下划线命名（snake_case）:
```sql
CREATE TABLE users (
  invitation_code VARCHAR(6),
  invited_by_code VARCHAR(6),
  is_temp_password BOOLEAN,
  ...
);
```

### JavaScript/TypeScript 命名约定
前端代码使用驼峰命名（camelCase）:
```typescript
interface User {
  invitationCode: string;
  invitedByCode?: string;
  isTempPassword: boolean;
  ...
}
```

### 不一致的处理
- 登录和注册接口：手动转换了字段名 ✓
- Profile 接口：直接返回数据库字段名 ✗

## 长期解决方案

### 方案 1: 统一使用转换函数
创建一个通用的字段名转换函数：

```typescript
// utils/fieldConverter.ts
export function toFrontendUser(dbUser: any) {
  return {
    id: dbUser.id,
    username: dbUser.username,
    invitationCode: dbUser.invitation_code,
    invitedByCode: dbUser.invited_by_code,
    role: dbUser.role,
    isTempPassword: dbUser.is_temp_password,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
    lastLoginAt: dbUser.last_login_at
  };
}
```

### 方案 2: 使用 ORM
使用 TypeORM 或 Prisma 等 ORM 工具，自动处理字段名转换：

```typescript
// 使用 Prisma
model User {
  id              Int       @id @default(autoincrement())
  username        String    @unique
  invitationCode  String    @map("invitation_code")  // 自动映射
  invitedByCode   String?   @map("invited_by_code")
  ...
}
```

### 方案 3: 数据库层面使用驼峰命名
修改数据库表结构，使用驼峰命名（不推荐，因为 PostgreSQL 对大小写敏感）。

## 相关文件

- `server/src/routes/users.ts` - 用户路由（已修复）
- `server/src/routes/auth.ts` - 认证路由（已正确处理）
- `server/src/services/InvitationService.ts` - 邀请服务（已正确处理）
- `landing/src/pages/ProfilePage.tsx` - 个人中心页面
- `landing/src/types/user.ts` - 用户类型定义

## 总结

修复后，个人中心页面应该能正常显示邀请码。这个问题的根本原因是数据库命名约定（snake_case）和前端命名约定（camelCase）不一致，需要在 API 层进行转换。

建议在所有返回用户数据的接口中统一进行字段名转换，确保前后端数据格式一致。
