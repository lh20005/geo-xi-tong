# 修复登录 Partition 问题

## 问题
所有平台登录管理器使用固定的 partition（`persist:平台名`），导致：
1. 同一平台的多个账号共享同一个 session
2. 打开登录页面时显示已登录状态
3. 无法为同一平台添加多个账号

## 解决方案
使用临时的、唯一的 partition 进行登录，登录成功后再保存 Cookie。

## 需要修改的文件
1. toutiao-login-manager.ts ✅ 已修复
2. douyin-login-manager.ts
3. xiaohongshu-login-manager.ts
4. wechat-login-manager.ts
5. baijiahao-login-manager.ts
6. jianshu-login-manager.ts
7. zhihu-login-manager.ts
8. qie-login-manager.ts
9. souhu-login-manager.ts
10. wangyi-login-manager.ts
11. csdn-login-manager.ts
12. bilibili-login-manager.ts

## 修改内容

### 1. 添加 currentPartition 属性
```typescript
// 当前登录使用的临时 partition
private currentPartition: string = '';
```

### 2. 修改 createWebView 方法
```typescript
// 使用临时 partition，确保每次登录都是全新的会话
this.currentPartition = `temp-login-${this.PLATFORM_ID}-${Date.now()}`;
log.info(`[平台名] 使用临时 partition: ${this.currentPartition}`);

await webViewManager.createWebView(this.parentWindow, {
  url: this.LOGIN_URL,
  partition: this.currentPartition,  // 使用临时 partition
  userAgent: '...'
});
```

### 3. 修改 captureCredentials 方法
```typescript
// 通过 session 获取 cookies（使用临时 partition）
const ses = session.fromPartition(this.currentPartition);
const electronCookies = await ses.cookies.get({});
```

## 验证
修复后，每次点击"登录"按钮时：
1. 应该打开全新的登录页面（未登录状态）
2. 可以输入不同的账号密码
3. 登录成功后保存 Cookie
4. 可以为同一平台添加多个账号
