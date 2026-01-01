# ✅ 搜狐号测试登录 URL 修复完成

## 问题描述
点击搜狐号账号的"测试登录"按钮后，弹出的页面显示：**"你可能输入了错误的网址,或者该网页已被删除"**

## 问题根源
数据库中搜狐号平台的 `home_url` 字段未设置或设置错误，导致测试登录时打开了错误的 URL。

## 修复方案

### 1. 添加数据库字段
在 `platforms_config` 表中添加 `login_url` 和 `home_url` 字段：

```sql
ALTER TABLE platforms_config 
ADD COLUMN IF NOT EXISTS login_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS home_url VARCHAR(500);
```

### 2. 更新搜狐号配置
设置正确的登录 URL 和主页 URL：

```sql
UPDATE platforms_config 
SET 
  login_url = 'https://mp.sohu.com/mpfe/v4/login',
  home_url = 'https://mp.sohu.com/mpfe/v4/contentManagement/first/page'
WHERE platform_id = 'souhu';
```

### 3. 验证配置
```sql
SELECT platform_id, platform_name, login_url, home_url 
FROM platforms_config 
WHERE platform_id = 'souhu';
```

**结果**：
```
 platform_id | platform_name |             login_url             |                         home_url                         
-------------+---------------+-----------------------------------+----------------------------------------------------------
 souhu       | 搜狐号        | https://mp.sohu.com/mpfe/v4/login | https://mp.sohu.com/mpfe/v4/contentManagement/first/page
```

## URL 说明

### login_url（登录页面）
- **用途**：用户首次登录时打开的页面
- **搜狐号**：`https://mp.sohu.com/mpfe/v4/login`

### home_url（主页/后台首页）
- **用途**：测试登录时打开的页面，用于验证 Cookie 是否有效
- **搜狐号**：`https://mp.sohu.com/mpfe/v4/contentManagement/first/page`
- **特点**：这是登录成功后的内容管理页面，可以验证登录状态

## 测试登录逻辑

在 `windows-login-manager/electron/ipc/handler.ts` 中：

```typescript
// 获取平台配置
const platforms = await apiClient.getPlatforms();
const platform = platforms.find((p: any) => p.platform_id === account.platform_id);

// 优先使用 home_url，如果没有才使用 login_url
const testUrl = (platform as any).home_url || platform.login_url;

// 使用对应平台的 partition 打开页面
await webViewManager.createWebView(mainWindow, {
  url: testUrl,
  partition: `persist:${account.platform_id}`,
});
```

## 所有平台的 URL 配置

| 平台 | login_url | home_url |
|------|-----------|----------|
| 头条号 | https://mp.toutiao.com/auth/page/login/ | https://mp.toutiao.com/profile_v4/index |
| 抖音号 | https://creator.douyin.com/auth | https://creator.douyin.com/creator-micro/home |
| 小红书 | https://creator.xiaohongshu.com/login | https://creator.xiaohongshu.com/creator/home |
| 微信公众号 | https://mp.weixin.qq.com/ | https://mp.weixin.qq.com/ |
| 百家号 | https://baijiahao.baidu.com/builder/author/register/index | https://baijiahao.baidu.com/builder/rc/home |
| 简书 | https://www.jianshu.com/sign_in | https://www.jianshu.com/writer |
| 知乎 | https://www.zhihu.com/signin | https://www.zhihu.com/creator |
| 企鹅号 | https://om.qq.com/userAuth/index | https://om.qq.com/article/articlePublish |
| **搜狐号** | https://mp.sohu.com/mpfe/v4/login | **https://mp.sohu.com/mpfe/v4/contentManagement/first/page** |
| 网易号 | https://mp.163.com/login.html | https://mp.163.com/v3/main/index.html |
| CSDN | https://passport.csdn.net/login | https://mp.csdn.net/ |
| 哔哩哔哩 | https://passport.bilibili.com/login | https://member.bilibili.com/platform/home |

## 测试步骤

### 1. 重启后端服务
```bash
cd server
npm run dev
```

### 2. 重启 Windows 登录管理器
```bash
cd windows-login-manager
npm run dev
```

### 3. 测试搜狐号
1. 在账号列表中找到搜狐号账号
2. 点击"测试登录"按钮
3. **预期结果**：打开搜狐号内容管理页面
4. **验证**：页面应该显示已登录状态，能看到用户信息

### 4. 观察日志
```bash
tail -f ~/Library/Logs/windows-login-manager/main.log | grep "test-account-login"
```

**预期日志**：
```
IPC: test-account-login - 123
IPC: 从后端获取账号 123
IPC: 从后端获取到 X 个账号
Test login webview opened for account: xxx
```

## 验证结果

### ✅ 成功标志
1. 打开的页面 URL 是 `https://mp.sohu.com/mpfe/v4/contentManagement/first/page`
2. 页面显示已登录状态
3. 能看到用户名、头像等信息
4. 可以正常访问内容管理功能

### ❌ 失败标志
1. 页面显示"你可能输入了错误的网址"
2. 页面要求重新登录
3. Cookie 失效或不存在

## 修改的文件

### 数据库迁移
- ✅ `server/src/db/migrations/add-platform-urls.sql`

### 代码文件
- ✅ `windows-login-manager/electron/ipc/handler.ts`（已有正确逻辑）

## 为什么需要 home_url？

### 问题场景
如果测试登录时打开 `login_url`（登录页面）：
- ❌ 已登录用户会看到登录表单
- ❌ 无法直观验证登录状态
- ❌ 可能触发重复登录

### 解决方案
使用 `home_url`（主页/后台首页）：
- ✅ 已登录用户直接看到后台界面
- ✅ 可以直观验证登录状态
- ✅ 可以立即使用平台功能
- ✅ 更好的用户体验

## 其他平台参考

如果其他平台也遇到类似问题，可以：

1. **检查数据库配置**：
   ```sql
   SELECT platform_id, login_url, home_url 
   FROM platforms_config 
   WHERE platform_id = 'xxx';
   ```

2. **更新 home_url**：
   ```sql
   UPDATE platforms_config 
   SET home_url = 'https://正确的主页URL'
   WHERE platform_id = 'xxx';
   ```

3. **重启服务**：
   - 重启后端服务
   - 重启 Windows 登录管理器

## 编译状态
✅ 数据库迁移已执行
✅ 所有平台 URL 已配置
✅ 搜狐号 home_url 已修复
✅ 可以立即测试

## 下一步
1. 重启后端服务
2. 重启 Windows 登录管理器
3. 测试搜狐号的"测试登录"功能
4. 验证打开的是正确的内容管理页面
