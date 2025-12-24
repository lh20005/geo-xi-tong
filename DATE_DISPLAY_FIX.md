# 个人资料日期显示问题修复

## 问题描述

个人中心页面的"注册时间"和"最后登录"日期没有正常显示。

## 问题原因

服务器返回的日期对象（Date）在 JSON 序列化时可能没有正确转换为 ISO 字符串格式，导致前端无法正确解析。

## 解决方案

### 1. 服务器端修复

在 `server/src/routes/users.ts` 的 `/profile` 接口中，显式将日期对象转换为 ISO 字符串：

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

    // 转换字段名为驼峰命名，并确保日期格式正确
    res.json({
      success: true,
      data: {
        id: profile.id,
        username: profile.username,
        invitationCode: profile.invitation_code,
        invitedByCode: profile.invited_by_code,
        role: profile.role,
        isTempPassword: profile.is_temp_password,
        createdAt: profile.created_at ? profile.created_at.toISOString() : null,
        updatedAt: profile.updated_at ? profile.updated_at.toISOString() : null,
        lastLoginAt: profile.last_login_at ? profile.last_login_at.toISOString() : null,
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

### 2. 前端显示优化

在 `landing/src/pages/ProfilePage.tsx` 中改进日期显示格式：

**修改前**（只显示日期）:
```typescript
{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
```

**修改后**（显示日期和时间）:
```typescript
{user?.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}) : '-'}
```

### 3. 添加调试日志

在 `loadProfile` 函数中添加日志，方便排查问题：

```typescript
const loadProfile = async () => {
  try {
    const [profileRes, statsRes] = await Promise.all([
      apiClient.getProfile(),
      apiClient.getInvitationStats()
    ]);

    console.log('[Profile] API 响应:', profileRes);

    if (profileRes.success) {
      console.log('[Profile] 用户数据:', profileRes.data);
      setUser(profileRes.data);
    }

    if (statsRes.success) {
      setInvitationStats(statsRes.data);
    }
  } catch (error: any) {
    console.error('[Profile] 加载失败:', error);
    if (error.response?.status === 401) {
      navigate('/login');
    }
  } finally {
    setLoading(false);
  }
};
```

## 修复后的数据格式

### API 响应示例
```json
{
  "success": true,
  "data": {
    "id": 437,
    "username": "testuser",
    "invitationCode": "suvboa",
    "invitedByCode": null,
    "role": "user",
    "isTempPassword": false,
    "createdAt": "2025-12-24T06:50:48.902Z",
    "updatedAt": "2025-12-24T06:54:22.819Z",
    "lastLoginAt": "2025-12-24T06:52:04.437Z",
    "invitedUsers": []
  }
}
```

### 前端显示效果
- **注册时间**: 2025/12/24 14:50
- **最后登录**: 2025/12/24 14:52

## 测试步骤

### 1. 重启服务器
```bash
cd server
npm run dev
```

### 2. 使用测试脚本验证 API
```bash
chmod +x test-profile-api.sh
./test-profile-api.sh
```

预期输出：
```
✓ createdAt 存在
✓ updatedAt 存在
✓ lastLoginAt 存在
✓ invitationCode 存在: suvboa
```

### 3. 浏览器测试
1. 访问 http://localhost:8080/login
2. 登录 testuser（密码: password123）
3. 点击"个人中心"
4. 检查日期显示：
   - 注册时间应该显示完整的日期和时间
   - 最后登录应该显示完整的日期和时间

### 4. 浏览器控制台检查
打开浏览器控制台（F12），查看日志：
```
[Profile] API 响应: {success: true, data: {...}}
[Profile] 用户数据: {id: 437, username: "testuser", createdAt: "2025-12-24T...", ...}
```

## 常见问题

### Q: 为什么需要 toISOString()？
A: 
- PostgreSQL 返回的是 JavaScript Date 对象
- JSON.stringify() 会自动调用 Date.toISOString()
- 但有时候这个转换不可靠，显式调用更安全

### Q: 为什么最后登录显示"从未登录"？
A: 
- 如果用户从未登录过，`last_login_at` 字段为 NULL
- 前端会显示"从未登录"而不是"-"
- 这是正常的，表示该用户是新创建的

### Q: 日期格式可以自定义吗？
A: 
可以，使用 `toLocaleString()` 的选项：
```typescript
new Date(date).toLocaleString('zh-CN', {
  year: 'numeric',      // 2025
  month: '2-digit',     // 12
  day: '2-digit',       // 24
  hour: '2-digit',      // 14
  minute: '2-digit',    // 50
  second: '2-digit',    // 48 (可选)
  hour12: false         // 24小时制
})
```

### Q: 为什么使用 ISO 8601 格式？
A: 
- ISO 8601 是国际标准日期格式
- 格式: `YYYY-MM-DDTHH:mm:ss.sssZ`
- 包含时区信息，避免时区问题
- JavaScript 的 Date 构造函数原生支持

## 日期处理最佳实践

### 1. 服务器端
```typescript
// ✓ 推荐：显式转换为 ISO 字符串
createdAt: profile.created_at ? profile.created_at.toISOString() : null

// ✗ 不推荐：直接返回 Date 对象
createdAt: profile.created_at
```

### 2. 前端显示
```typescript
// ✓ 推荐：使用 toLocaleString 格式化
new Date(user.createdAt).toLocaleString('zh-CN', options)

// ✓ 也可以：使用日期库（如 date-fns, dayjs）
import { format } from 'date-fns';
format(new Date(user.createdAt), 'yyyy/MM/dd HH:mm')

// ✗ 不推荐：直接显示 ISO 字符串
{user.createdAt}  // 显示: 2025-12-24T06:50:48.902Z
```

### 3. 时区处理
```typescript
// 服务器使用 UTC 时间
createdAt: profile.created_at.toISOString()  // UTC

// 前端自动转换为本地时区
new Date(user.createdAt).toLocaleString('zh-CN')  // 本地时区
```

## 相关文件

- `server/src/routes/users.ts` - 用户路由（已修复）
- `landing/src/pages/ProfilePage.tsx` - 个人中心页面（已优化）
- `test-profile-api.sh` - API 测试脚本

## 总结

修复后：
1. ✅ 服务器正确返回 ISO 格式的日期字符串
2. ✅ 前端正确解析并显示日期和时间
3. ✅ 添加了调试日志，方便排查问题
4. ✅ 改进了日期显示格式，更加友好

如果问题仍然存在，请：
1. 检查浏览器控制台的日志
2. 运行 `test-profile-api.sh` 验证 API 响应
3. 确认服务器已重启
