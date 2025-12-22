# 抖音号专用登录管理器

## 概述

基于头条登录器的成功经验，为抖音号创建了专用登录管理器，确保登录稳定可靠。

## 设计原则

### 参考头条成功经验

1. **使用 BrowserWindow** - 最稳定的 Electron API
2. **独立实现** - 不依赖通用登录管理器
3. **内置配置** - 所有配置写在代码中
4. **简单的 URL 检测** - 只检测 URL 变化
5. **完善的错误处理** - 统一的资源清理
6. **详细的日志** - `[Douyin]` 前缀标识

## 抖音平台特点

### 登录 URL
```
https://creator.douyin.com/
```

### 成功 URL 模式
```
creator.douyin.com/creator-micro
creator.douyin.com/home
```

### 用户名选择器
```typescript
[
  '.name-_lSSDc',                    // 主要选择器
  '.header-_F2uzl .name-_lSSDc',     // 头部区域
  '.left-zEzdJX .name-_lSSDc',       // 左侧区域
  '[class*="name-"][class*="_"]',    // 动态类名匹配
  '.semi-navigation-header-username', // 导航栏用户名
  '.username',                        // 通用用户名
  '.user-name',                       // 通用用户名
  '[class*="username"]',              // 包含 username 的类
  '[class*="user-name"]'              // 包含 user-name 的类
]
```

## 登录流程

```
1. 创建登录窗口
   ├─ 创建独立 session (persist:douyin)
   ├─ 配置 User-Agent
   └─ 设置窗口属性 (1000x700, modal)

2. 加载登录页面
   ├─ 加载 https://creator.douyin.com/
   ├─ 等待页面加载完成
   └─ 处理加载错误（不中断流程）

3. 等待登录成功
   ├─ 定期检查 URL (每 500ms)
   ├─ 匹配成功 URL 模式
   │  ├─ creator.douyin.com/creator-micro
   │  └─ creator.douyin.com/home
   ├─ 检查取消状态
   └─ 检查超时 (5分钟)

4. 等待页面稳定
   └─ 延迟 2 秒

5. 提取用户信息
   ├─ 尝试所有用户名选择器
   ├─ 找到第一个有内容的元素
   └─ 返回用户名

6. 捕获登录凭证
   ├─ 捕获所有 Cookies
   ├─ 捕获 localStorage
   └─ 捕获 sessionStorage

7. 保存账号
   ├─ 保存到本地缓存
   └─ 更新或添加账号

8. 同步到后端
   ├─ 调用同步服务
   └─ 处理同步失败（不影响本地保存）

9. 清理资源
   ├─ 关闭登录窗口
   └─ 重置状态
```

## 关键代码

### 创建登录窗口

```typescript
const ses = session.fromPartition(`persist:${this.PLATFORM_ID}`, {
  cache: true
});

ses.setUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
);

this.loginWindow = new BrowserWindow({
  width: 1000,
  height: 700,
  parent: parent,
  modal: true,
  show: false,
  webPreferences: {
    session: ses,
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: true
  }
});
```

### URL 检测

```typescript
const checkInterval = setInterval(() => {
  const currentUrl = this.loginWindow.webContents.getURL();
  
  for (const pattern of this.SUCCESS_URL_PATTERNS) {
    if (currentUrl.includes(pattern)) {
      log.info(`[Douyin] 登录成功检测到 URL: ${currentUrl}`);
      resolve(true);
      return;
    }
  }
}, 500);
```

### 用户名提取

```typescript
for (const selector of this.USERNAME_SELECTORS) {
  try {
    const username = await this.loginWindow.webContents.executeJavaScript(`
      (() => {
        const element = document.querySelector('${selector}');
        return element ? element.textContent.trim() : null;
      })()
    `);

    if (username) {
      log.info(`[Douyin] 用户名提取成功 (${selector}): ${username}`);
      return { username };
    }
  } catch (error) {
    log.debug(`[Douyin] 选择器失败: ${selector}`);
  }
}
```

## 日志示例

成功登录时的日志输出：

```
[info] [Douyin] 开始登录流程
[info] [Douyin] 创建登录窗口
[info] [Douyin] 登录窗口已显示
[info] [Douyin] 加载登录页面: https://creator.douyin.com/
[info] [Douyin] 登录页面加载完成
[info] [Douyin] 等待登录成功...
[info] [Douyin] 登录成功检测到 URL: https://creator.douyin.com/creator-micro/...
[info] [Douyin] 等待页面稳定...
[info] [Douyin] 提取用户信息...
[info] [Douyin] 用户名提取成功 (.name-_lSSDc): 你的用户名
[info] [Douyin] 捕获登录凭证...
[info] [Douyin] 捕获 XX 个 Cookies
[info] [Douyin] 捕获 Storage - localStorage: X, sessionStorage: Y
[info] [Douyin] 保存账号到本地...
[info] [Douyin] 账号保存成功
[info] [Douyin] 同步账号到后端...
[info] [Douyin] 账号同步成功
[info] [Douyin] 清理资源...
[info] [Douyin] 登录成功完成
```

## 集成方式

### IPC 处理器

```typescript
// 导入抖音登录管理器
import { douyinLoginManager } from '../login/douyin-login-manager';

// 在登录处理中使用
ipcMain.handle('login-platform', async (event, platformId: string) => {
  // 抖音号使用专用登录管理器
  if (platformId === 'douyin') {
    const result = await douyinLoginManager.login(mainWindow);
    return result;
  }
  
  // 其他平台...
});

// 取消登录
ipcMain.handle('cancel-login', async (event, platformId?: string) => {
  if (platformId === 'douyin') {
    await douyinLoginManager.cancelLogin();
  }
});
```

### 前端调用

前端代码无需修改：

```typescript
// 登录
const result = await window.electron.loginPlatform('douyin');

// 取消
await window.electron.cancelLogin('douyin');
```

## 测试步骤

1. **启动 Windows 客户端**
   ```bash
   cd windows-login-manager
   npm run electron:dev
   ```

2. **执行登录**
   - 点击"平台管理"
   - 选择"抖音号"
   - 点击"登录"按钮

3. **完成登录**
   - 在弹出窗口中输入账号密码
   - 完成登录流程

4. **验证结果**
   - 应用显示"登录成功"
   - 账号出现在列表中
   - 用户名显示正确

## 预期结果

✅ 弹出独立的登录窗口
✅ 显示抖音创作者平台登录页面
✅ 可以正常输入账号密码
✅ 登录后 URL 跳转到后台页面
✅ 窗口自动关闭
✅ 显示"登录成功"
✅ 账号正确保存
✅ 用户名正确显示

## 常见问题

### 1. 登录窗口不显示

**解决方法：**
- 检查主窗口是否已显示
- 查看日志中的错误信息
- 重启应用

### 2. URL 检测失败

**原因：** 成功 URL 模式不匹配

**解决方法：**
- 检查登录后的实际 URL
- 更新 `SUCCESS_URL_PATTERNS`

### 3. 用户名提取失败

**原因：** 页面结构变化

**解决方法：**
- 检查页面元素
- 更新 `USERNAME_SELECTORS`

### 4. Cookie 捕获失败

**原因：** Session 配置问题

**解决方法：**
- 检查 session 配置
- 确认 partition 名称正确

## 与头条登录器的对比

| 特性 | 头条 | 抖音 |
|------|------|------|
| **API** | BrowserWindow | BrowserWindow ✅ |
| **登录 URL** | mp.toutiao.com | creator.douyin.com |
| **成功 URL** | profile_v4, creator | creator-micro, home |
| **选择器数量** | 7 个 | 9 个 |
| **超时时间** | 5 分钟 | 5 分钟 |
| **日志前缀** | [Toutiao] | [Douyin] |

## 优势

1. ✅ **稳定可靠** - 使用成熟的 BrowserWindow API
2. ✅ **独立实现** - 不影响其他平台
3. ✅ **内置配置** - 不依赖后端
4. ✅ **简单检测** - 只使用 URL 变化
5. ✅ **完善日志** - 详细记录每个步骤
6. ✅ **错误处理** - 不会导致崩溃

## 技术亮点

1. **参考成功经验** - 基于头条登录器的成功实现
2. **适配抖音特点** - 针对抖音创作者平台优化
3. **多重选择器** - 9 个用户名选择器确保提取成功
4. **动态类名匹配** - 支持抖音的动态类名

## 总结

抖音专用登录管理器：

✅ **基于头条成功经验**
✅ **适配抖音平台特点**
✅ **稳定可靠的实现**
✅ **完善的错误处理**
✅ **详细的日志记录**

这是一个生产级别的实现，可以确保抖音登录的稳定性和可靠性。
