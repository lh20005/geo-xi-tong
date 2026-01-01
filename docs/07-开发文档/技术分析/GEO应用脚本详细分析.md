# GEO应用脚本详细分析

## 📍 脚本位置
```
~/Downloads/geo/resources/app-extracted/src/api/script/
```

## 📋 脚本列表

| 文件名 | 平台 | 大小 | 说明 |
|--------|------|------|------|
| `tt.js` | 头条号 | 1.6KB | 今日头条自媒体平台 |
| `xhs.js` | 小红书 | 1.2KB | 小红书创作者平台 |
| `bili.js` | 哔哩哔哩 | 2.3KB | B站创作者中心 |
| `wxgzh.js` | 微信公众号 | 1.7KB | 微信公众平台 |
| `zh.js` | 知乎 | 2.4KB | 知乎创作者中心 |
| `weibo.js` | 微博 | 1B | 微博（空文件） |
| `dy.js` | 抖音 | 1.4KB | 抖音创作者平台 |
| `qeh.js` | 企鹅号 | 1.8KB | 腾讯内容开放平台 |
| `sph.js` | 搜狐号 | 1.1KB | 搜狐号自媒体 |
| `bjh.js` | 百家号 | 3.9KB | 百度百家号 |
| `wy.js` | 网易号 | 1.9KB | 网易号自媒体 |
| `csdn.js` | CSDN | 2.1KB | CSDN技术社区 |
| `kuaishou.js` | 快手 | 1.4KB | 快手创作者平台 |
| `js.js` | 简书 | 2.3KB | 简书创作平台 |
| `sh.js` | 未知 | 1.7KB | 待确认 |

**总计：15个平台脚本**

---

## 🎯 脚本的作用

### 核心功能

这些脚本是 **Electron 应用的预加载脚本（Preload Scripts）**，用于：

1. **登录检测** - 自动检测用户是否登录成功
2. **信息提取** - 提取用户名、头像、粉丝数等信息
3. **Cookie获取** - 获取登录后的Cookie
4. **IPC通信** - 与Electron主进程通信

### 工作原理

```
Electron主进程 → 发送'checkLogin'消息 → 注入脚本
                                          ↓
                                    定时检查DOM元素
                                          ↓
                                    检测到登录成功
                                          ↓
                                    提取用户信息
                                          ↓
Electron主进程 ← 发送用户数据 ← 通过IPC返回
```

---

## 🔍 脚本结构分析

### 通用模式

所有脚本都遵循相同的模式：

```javascript
const { ipcRenderer } = require('electron')

let _interval = '';

// 1. 监听主进程消息
ipcRenderer.on('checkLogin', (event, args) => {
    
    // 2. 定时检查登录状态
    _interval = setInterval(() => {
        
        // 3. 使用选择器检测登录元素
        let element = document.querySelector('.user-name')
        
        if (element !== null) {
            // 4. 提取用户信息
            var value = {
                avatar: '头像URL',
                account: '账号',
                name: '用户名',
                cookie: document.cookie,
                platform: '平台ID',
                follower_count: '粉丝数'
            }
            
            // 5. 发送给主进程
            ipcRenderer.sendToHost('checkLogin', value)
            
            // 6. 清除定时器
            clearInterval(_interval);
        }
    }, 1000)
})
```

---

## 📚 各平台详细分析

### 1. 头条号 (tt.js)

**登录检测选择器**:
```javascript
let name = document.querySelector('.auth-avator-name')
```

**提取信息**:
- 用户名: `.auth-avator-name`
- 头像: `.auth-avator-img` 的 `src` 属性
- 粉丝数: `.data-board-item-primary`

**返回数据**:
```javascript
{
    avatar: srcValue,
    account: '',
    name: name.textContent,
    cookie: document.cookie,
    platform: 'tt',
    follower_count: follower_count
}
```

**检查间隔**: 1秒

---

### 2. 小红书 (xhs.js)

**登录检测选择器**:
```javascript
var name = document.querySelector('.account-name')
```

**提取信息**:
- 用户名: `.account-name`
- 头像: `.avatar img` 的 `src` 属性
- 账号: `.others.description-text div`

**返回数据**:
```javascript
{
    avatar: srcValue,
    account: '',
    name: name.textContent,
    cookies: document.cookie  // 注意：这里是cookies不是cookie
}
```

**检查间隔**: 2秒

---

### 3. 百家号 (bjh.js)

**登录检测选择器**:
```javascript
let imgElement = document.querySelector('.UjPPKm89R4RrZTKhwG5H')
```

**特殊功能**:
1. 检测到登录后，会触发鼠标悬停事件
2. 支持获取作品统计（getWorkers）

**提取信息**:
- 头像: `.UjPPKm89R4RrZTKhwG5H` 的 `src` 属性
- 用户名: `.user-name` (需要分割字符串)

**鼠标悬停触发**:
```javascript
const element = document.querySelector('.p7Psc5P3uJ5lyxeI0ETR');
const mouseOverEvent = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window
});
element.dispatchEvent(mouseOverEvent);
```

**作品统计功能**:
```javascript
ipcRenderer.on('getWorkers', (event, args) => {
    // 点击"笔记管理"菜单
    // 提取各状态的笔记数量
    const list = [
        { label: '全部笔记', value: 0 },
        { label: '已发布', value: 0 },
        { label: '审核中', value: 0 },
        { label: '未通过', value: 0 },
    ]
})
```

**检查间隔**: 500毫秒（最快）

---

### 4. 微信公众号 (wxgzh.js)

**登录检测选择器**:
```javascript
let name = document.querySelector('.weui-desktop_name')
```

**提取信息**:
- 用户名: `.weui-desktop_name`
- 头像: `.weui-desktop-account__img` 的 `src` 属性
- 粉丝数: `.weui-desktop-user_sum span` 第2个元素

**检查间隔**: 2秒

---

### 5. 知乎 (zh.js)

**登录检测选择器**:
```javascript
let title = document.querySelector('img.AppHeader-profileAvatar')
```

**特殊功能**: 使用知乎API获取用户信息

**API请求**:
```javascript
const response = await fetch('https://www.zhihu.com/api/v4/me?include=is_realname', {
    method: 'GET',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': navigator.userAgent
    }
});

const userData = await response.json();
```

**提取信息**:
- 用户名: `userData.name`
- 头像: `userData.avatar_url`
- 粉丝数: `userData.favorite_count`

**检查间隔**: 2秒

---

### 6. 简书 (js.js)

**登录检测选择器**:
```javascript
let imgElements = document.querySelectorAll('.avatar>img')
let secondImgElement = imgElements[0]
```

**特殊功能**: 触发鼠标悬停并点击

**鼠标操作**:
```javascript
const element = document.querySelector('.user');
const mouseOverEvent = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window
});
element.dispatchEvent(mouseOverEvent);
document.querySelector('.user li a').click()
```

**提取信息**:
- 头像: `.avatar>img` 第1个元素的 `src`
- 用户名: `.main-top .name`
- 粉丝数: `.main-top .meta-block p` 第2个元素

**检查间隔**: 1秒

---

## 🆚 与你的项目对比

### 架构差异

| 特性 | GEO应用 | 你的项目 |
|------|---------|---------|
| **应用类型** | Electron桌面应用 | Node.js后端 + React前端 |
| **浏览器控制** | Electron BrowserView | Playwright独立浏览器 |
| **脚本注入** | Preload Scripts | 无需注入 |
| **通信方式** | IPC (进程间通信) | HTTP API |
| **登录检测** | 前端DOM检测 | 后端URL/元素检测 |
| **Cookie获取** | `document.cookie` | `context.cookies()` |

### 技术对比

#### GEO应用的方式（Electron）

```javascript
// 1. 在Electron中加载页面时注入脚本
webview.preload = 'path/to/tt.js'

// 2. 脚本在页面中运行，可以直接访问DOM
let name = document.querySelector('.auth-avator-name')
let cookie = document.cookie

// 3. 通过IPC发送给主进程
ipcRenderer.sendToHost('checkLogin', data)
```

**优点**:
- 可以直接访问页面DOM
- 可以使用 `document.cookie` 获取Cookie
- 可以触发页面事件（点击、悬停等）

**缺点**:
- 只能在Electron环境中使用
- 需要为每个平台编写注入脚本
- 脚本更新需要重新打包应用

#### 你的项目方式（Playwright）

```typescript
// 1. 后端启动浏览器
const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

// 2. 导航到登录页面
await page.goto(loginUrl)

// 3. 等待用户登录
await page.waitForSelector('.user-name')

// 4. 获取Cookie
const cookies = await context.cookies()

// 5. 提取用户名
const username = await page.$eval('.user-name', el => el.textContent)
```

**优点**:
- 独立的浏览器进程，更稳定
- 不需要注入脚本
- 可以在服务器端运行
- 更容易调试和维护

**缺点**:
- 无法直接访问 `document.cookie`（需要用API）
- 需要等待页面加载完成

---

## 💡 可以借鉴的地方

### 1. 选择器配置

GEO应用的选择器是经过实际测试的，可以直接使用：

```javascript
// 头条号
'.auth-avator-name'           // 用户名
'.auth-avator-img'            // 头像
'.data-board-item-primary'    // 粉丝数

// 小红书
'.account-name'               // 用户名
'.avatar img'                 // 头像

// 微信公众号
'.weui-desktop_name'          // 用户名
'.weui-desktop-account__img'  // 头像
'.weui-desktop-user_sum span' // 粉丝数

// 百家号
'.UjPPKm89R4RrZTKhwG5H'      // 头像
'.user-name'                  // 用户名

// 简书
'.avatar>img'                 // 头像
'.main-top .name'             // 用户名
'.main-top .meta-block p'     // 粉丝数
```

### 2. 登录检测策略

**定时检查模式**:
```javascript
_interval = setInterval(() => {
    // 检查登录元素
    if (element !== null) {
        // 登录成功
        clearInterval(_interval);
    }
}, 1000)
```

**不同平台的检查间隔**:
- 百家号: 500ms（最快）
- 头条号、简书: 1000ms
- 小红书、微信公众号、知乎: 2000ms

### 3. 特殊处理技巧

**触发鼠标事件**（百家号、简书）:
```javascript
const mouseOverEvent = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window
});
element.dispatchEvent(mouseOverEvent);
```

**使用API获取数据**（知乎）:
```javascript
const response = await fetch('https://www.zhihu.com/api/v4/me?include=is_realname', {
    method: 'GET',
    credentials: 'include'
});
const userData = await response.json();
```

### 4. 错误处理

```javascript
try {
    let imgElement = document.querySelector('.auth-avator-img');
    srcValue = imgElement.getAttribute('src');
} catch(error) {
    console.log("获取图片失败")
}
```

---

## 🔧 如何应用到你的项目

### 方案1：更新选择器配置

直接使用GEO应用中测试过的选择器：

```typescript
// 在 AccountService.ts 的 extractUserInfo() 中更新
const selectors: { [key: string]: string[] } = {
  'toutiao': [
    '.auth-avator-name',              // GEO应用使用的选择器
    '.semi-navigation-header-username',
    '.user-name'
  ],
  
  'xiaohongshu': [
    '.account-name',                  // GEO应用使用的选择器
    '#header-area > div > div > div:nth-child(2) > div > span'
  ],
  
  'wechat': [
    '.weui-desktop_name',             // GEO应用使用的选择器
    '.weui-desktop-account__info',
    '.weui-desktop-account__nickname'
  ]
};
```

### 方案2：添加粉丝数提取

```typescript
// 扩展用户信息结构
interface UserInfo {
  username: string;
  avatar?: string;
  followerCount?: string;
}

// 在提取用户名的同时提取粉丝数
const followerSelectors = {
  'toutiao': '.data-board-item-primary',
  'wechat': '.weui-desktop-user_sum span:nth-child(2)',
  'jianshu': '.main-top .meta-block p:nth-child(2)'
};
```

### 方案3：使用API获取数据（知乎）

```typescript
// 对于知乎，可以使用API而不是DOM选择器
if (platformId === 'zhihu') {
  const userData = await page.evaluate(async () => {
    const response = await fetch('https://www.zhihu.com/api/v4/me?include=is_realname', {
      method: 'GET',
      credentials: 'include'
    });
    return await response.json();
  });
  
  return {
    username: userData.name,
    avatar: userData.avatar_url,
    followerCount: userData.favorite_count
  };
}
```

### 方案4：调整检查间隔

```typescript
// 根据平台调整等待时间
const platformWaitTimes = {
  'baijiahao': 500,   // 百家号检查最快
  'toutiao': 1000,    // 头条号
  'xiaohongshu': 2000, // 小红书
  'wechat': 2000,     // 微信公众号
  'zhihu': 2000       // 知乎
};

const waitTime = platformWaitTimes[platformId] || 1000;
await new Promise(resolve => setTimeout(resolve, waitTime));
```

---

## 📊 选择器对比表

| 平台 | GEO应用选择器 | 你的项目选择器 | 建议 |
|------|--------------|---------------|------|
| **头条号** | `.auth-avator-name` | `.auth-avator-name` | ✅ 一致 |
| **小红书** | `.account-name` | `#header-area > div > ...` | 🔄 建议改用GEO的 |
| **微信公众号** | `.weui-desktop_name` | `.weui-desktop-account__info` | 🔄 建议添加GEO的 |
| **百家号** | `.UjPPKm89R4RrZTKhwG5H` | 未配置 | ➕ 建议添加 |
| **简书** | `.avatar>img`, `.main-top .name` | `nav .user img` | 🔄 建议添加GEO的 |
| **知乎** | API方式 | `.AppHeader-profile` | 🔄 建议改用API |

---

## 🚀 实施建议

### 第一步：复制脚本作为参考

```bash
# 复制到项目中
mkdir -p reference-scripts/geo-electron-scripts
cp ~/Downloads/geo/resources/app-extracted/src/api/script/*.js \
   reference-scripts/geo-electron-scripts/
```

### 第二步：提取选择器

创建一个选择器映射文件：

```typescript
// server/src/config/platformSelectors.ts
export const platformSelectors = {
  toutiao: {
    username: '.auth-avator-name',
    avatar: '.auth-avator-img',
    followerCount: '.data-board-item-primary'
  },
  xiaohongshu: {
    username: '.account-name',
    avatar: '.avatar img',
    account: '.others.description-text div'
  },
  // ... 其他平台
};
```

### 第三步：更新AccountService

```typescript
import { platformSelectors } from '../config/platformSelectors';

private async extractUserInfo(page: any, platformId: string): Promise<any> {
  const selectors = platformSelectors[platformId];
  
  if (!selectors) {
    return { username: '' };
  }
  
  // 使用GEO应用的选择器
  const username = await page.$eval(selectors.username, 
    el => el.textContent?.trim() || ''
  );
  
  return { username };
}
```

### 第四步：测试验证

```bash
# 逐个测试平台
./test-platform-login.sh toutiao
./test-platform-login.sh xiaohongshu
./test-platform-login.sh wechat
```

---

## ⚠️ 注意事项

### 1. 选择器可能过时

GEO应用的选择器可能已经过时，因为：
- 平台会更新UI
- class名称会变化
- 页面结构会调整

**建议**: 测试时如果失败，检查HTML快照更新选择器

### 2. 不能直接使用脚本

这些脚本是为Electron设计的，不能直接在Playwright中使用，因为：
- 依赖 `ipcRenderer`（Electron特有）
- 使用 `document.cookie`（Playwright需要用API）
- 需要注入到页面中

**建议**: 只提取选择器和逻辑，用Playwright重新实现

### 3. 检查间隔差异

GEO应用使用定时器检查，你的项目使用事件等待：

```javascript
// GEO方式（定时检查）
setInterval(() => {
  if (element) { /* 成功 */ }
}, 1000)

// Playwright方式（事件等待）
await page.waitForSelector('.user-name')
```

**建议**: 保持使用Playwright的方式，更可靠

---

## 📁 相关文件

```
reference-scripts/
└── geo-electron-scripts/      # GEO应用脚本（参考）
    ├── tt.js                  # 头条号
    ├── xhs.js                 # 小红书
    ├── wxgzh.js               # 微信公众号
    ├── zh.js                  # 知乎
    ├── js.js                  # 简书
    └── ...

server/src/
├── services/
│   └── AccountService.ts      # 你的登录服务
└── config/
    └── platformSelectors.ts   # 选择器配置（建议创建）
```

---

## 💡 总结

### GEO应用脚本的价值

1. ✅ **经过实战测试的选择器** - 可以直接使用
2. ✅ **登录检测策略** - 可以借鉴思路
3. ✅ **特殊处理技巧** - 鼠标事件、API调用
4. ✅ **错误处理模式** - try-catch包装

### 如何使用

1. **提取选择器** - 更新你的选择器配置
2. **借鉴逻辑** - 学习登录检测策略
3. **不要直接复制** - 需要适配Playwright
4. **持续测试** - 选择器可能会过时

### 下一步行动

1. 复制脚本到项目作为参考
2. 提取所有平台的选择器
3. 更新 `AccountService.ts` 中的选择器配置
4. 逐个测试各平台登录
5. 根据测试结果调整选择器

现在你完全了解这些脚本的作用和如何使用它们了！🎉
