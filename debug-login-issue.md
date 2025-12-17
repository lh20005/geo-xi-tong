# 调试登录信息未保存问题

## 问题描述

用户登录头条号成功，浏览器自动关闭，但表格中没有显示登录信息。

## 检查结果

1. ✅ 表格代码已完整实现
2. ❌ 数据库中没有记录
3. ❓ 需要检查后端是否成功保存

## 需要检查的点

### 1. 查看后端日志

在运行 `npm run dev` 的终端中，应该能看到：

```
[浏览器登录] 启动浏览器，准备打开 头条号 登录页面...
[浏览器登录] 找到Chrome: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
[浏览器登录] 正在打开登录页面: https://mp.toutiao.com/auth/page/login/
[浏览器登录] 已打开 头条号 登录页面，等待用户登录...
[等待登录] 使用 toutiao 特定的等待条件
[等待登录] 检测到URL变化，当前URL: xxx
[浏览器登录] 检测到登录成功，正在获取Cookie...
[浏览器登录] 成功获取 X 个Cookie
[提取用户信息] toutiao: xxx
[浏览器登录] 正在保存账号信息: xxx
[浏览器登录] 创建新账号
[浏览器登录] 账号保存成功 ID: xxx
```

**请检查是否看到这些日志，特别是最后几行。**

### 2. 查看浏览器控制台

在浏览器开发者工具（F12）的Console中，应该能看到：

```
[前端] 点击平台卡片: 头条号 toutiao
[前端] 调用 loginWithBrowser API...
[前端] API返回结果: {success: true, message: "登录成功", account: {...}}
```

**请检查返回的结果是什么。**

### 3. 检查数据库

```bash
psql -d geo_system -c "SELECT * FROM platform_accounts;"
```

应该能看到记录。

## 可能的原因

### 原因1：登录检测失败

头条号的登录检测条件可能不准确，导致系统认为还没登录成功。

**解决方案**：
修改 `server/src/services/AccountService.ts` 中的等待条件：

```typescript
'toutiao': async () => {
  await page.waitForFunction(
    `window.location.href.includes('content') || window.location.href.includes('profile')`,
    { timeout: 300000 }
  );
}
```

### 原因2：Cookie获取失败

可能获取到的Cookie为空。

**检查**：
查看后端日志中是否有"成功获取 0 个Cookie"。

### 原因3：数据库保存失败

可能是数据库连接或权限问题。

**检查**：
查看后端日志中是否有数据库错误。

### 原因4：前端没有刷新

虽然调用了 `loadData()`，但可能没有成功刷新。

**解决方案**：
手动刷新浏览器页面。

## 立即诊断步骤

### 步骤1：查看后端完整日志

在运行 `npm run dev` 的终端中，找到从点击卡片到现在的所有日志。

### 步骤2：再次测试并记录

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 点击头条号卡片
4. 记录所有日志输出
5. 登录成功后，记录返回的结果

### 步骤3：检查数据库

```bash
# 查看所有账号
psql -d geo_system -c "SELECT id, platform_id, account_name, status, created_at FROM platform_accounts;"

# 查看最近的记录
psql -d geo_system -c "SELECT * FROM platform_accounts ORDER BY created_at DESC LIMIT 1;"
```

### 步骤4：手动刷新页面

登录成功后，手动刷新浏览器页面（Ctrl+R 或 Cmd+R），看表格是否出现。

## 需要提供的信息

请提供以下信息以便诊断：

1. **后端日志**：从点击卡片到登录完成的所有日志
2. **浏览器控制台**：Console中的所有输出
3. **API返回结果**：`[前端] API返回结果:` 后面的内容
4. **数据库查询结果**：`SELECT * FROM platform_accounts;` 的结果

## 临时解决方案

如果问题持续，可以尝试：

1. **手动刷新页面**
2. **重启后端服务**
3. **清除浏览器缓存**
4. **使用其他平台测试**（如知乎）
