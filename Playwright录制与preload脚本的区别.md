# Playwright录制与preload脚本的区别

## 核心结论：❌ 不能直接转换

**Playwright录制器**和**webview preload脚本**是完全不同的东西，用途和技术都不同。

---

## 详细对比

### Playwright录制器

#### 用途
记录你的操作，生成**自动化代码**，用于后端自动发布

#### 生成的代码
```typescript
// Playwright录制器生成的代码
await page.goto('https://mp.weixin.qq.com');
await page.click('#login-btn');
await page.fill('#username', 'test');
await page.fill('#password', 'test');
await page.click('#submit');
await page.click('#new-article');
await page.fill('#title', '标题');
await page.fill('#content', '内容');
await page.click('#publish');
```

#### 特点
- ✅ 记录点击、填写、导航等操作
- ✅ 生成Playwright API调用
- ✅ 用于自动化发布
- ❌ 不能直接用于webview

#### 使用场景
```
开发者使用：
  1. 运行 npx playwright codegen
  2. 手动操作平台
  3. 生成自动化代码
  4. 复制到Adapter
  5. 用于后端自动发布
```

---

### webview preload脚本

#### 用途
在webview中**检测登录状态**，提取Cookie和用户信息

#### 脚本内容
```javascript
// webview preload脚本
const { ipcRenderer } = require('electron');

let _interval = '';

// 监听主进程消息
ipcRenderer.on('checkLogin', (event, args) => {
  console.log('开始检测登录');
  
  // 定时检查登录状态
  _interval = setInterval(() => {
    // 查找登录成功的标志
    let name = document.querySelector('.user-name');
    
    if (name !== null) {
      console.log("登录成功");
      
      // 提取用户信息
      let avatar = document.querySelector('.user-avatar img').src;
      
      // 提取Cookie
      let cookie = document.cookie;
      
      // 发送给主进程
      ipcRenderer.sendToHost('checkLogin', {
        name: name.textContent,
        avatar: avatar,
        cookie: cookie
      });
      
      clearInterval(_interval);
    }
  }, 2000);
});
```

#### 特点
- ✅ 检测登录状态
- ✅ 提取Cookie和用户信息
- ✅ 通过IPC通信
- ❌ 不做自动化操作

#### 使用场景
```
用户使用：
  1. 用户点击登录
  2. webview加载preload脚本
  3. 用户手动登录
  4. preload脚本检测登录成功
  5. 提取Cookie
  6. 发送给主进程
```

---

## 为什么不能直接转换？

### 1. 技术栈不同

| 特性 | Playwright录制器 | webview preload |
|------|-----------------|----------------|
| **运行环境** | Playwright浏览器 | webview |
| **API** | Playwright API | Electron IPC |
| **语法** | `await page.click()` | `document.querySelector()` |
| **通信方式** | Promise | IPC消息 |

### 2. 用途不同

#### Playwright录制器
```typescript
// 目的：自动化操作
await page.click('#login-btn');      // 自动点击
await page.fill('#username', 'test'); // 自动填写
await page.click('#submit');          // 自动提交
```

#### preload脚本
```javascript
// 目的：检测和提取
let name = document.querySelector('.user-name');  // 检测元素
if (name !== null) {                              // 判断登录
  let cookie = document.cookie;                   // 提取Cookie
  ipcRenderer.sendToHost('checkLogin', {...});    // 发送数据
}
```

### 3. 执行时机不同

#### Playwright录制器
- 在后端服务器运行
- 使用已有的Cookie
- 完全自动化执行

#### preload脚本
- 在用户的webview中运行
- 等待用户手动登录
- 只检测不操作

---

## 正确的工作流程

### 场景1：开发自动发布功能（使用Playwright录制器）

```
步骤1：使用Playwright录制器
  $ cd server
  $ npx playwright codegen https://mp.weixin.qq.com
  
  你的操作：
    1. 手动登录
    2. 点击新建图文
    3. 填写标题和内容
    4. 点击发布
  
  生成的代码：
    await page.goto('https://mp.weixin.qq.com');
    await page.click('text=新建图文');
    await page.fill('#title', '标题');
    await page.fill('#content', '内容');
    await page.click('text=发布');

步骤2：创建Adapter
  // server/src/services/adapters/WeixinAdapter.ts
  export class WeixinAdapter extends PlatformAdapter {
    async publish(article, account) {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      
      // 使用Cookie登录
      await context.addCookies(account.cookies);
      
      // 粘贴录制器生成的代码
      await page.goto('https://mp.weixin.qq.com');
      await page.click('text=新建图文');
      await page.fill('#title', article.title);
      await page.fill('#content', article.content);
      await page.click('text=发布');
      
      await browser.close();
    }
  }
```

**用途**：后端自动发布

---

### 场景2：开发登录检测功能（手动编写preload脚本）

```
步骤1：分析登录页面
  1. 打开浏览器开发者工具
  2. 查看登录成功后的页面结构
  3. 找到用户名元素：.user-name
  4. 找到头像元素：.user-avatar img
  5. 记录选择器

步骤2：编写preload脚本
  // windows-login-manager/preload/weixin.js
  const { ipcRenderer } = require('electron');
  
  let _interval = '';
  
  ipcRenderer.on('checkLogin', (event, args) => {
    _interval = setInterval(() => {
      // 使用步骤1找到的选择器
      let name = document.querySelector('.user-name');
      
      if (name !== null) {
        console.log("登录成功");
        
        let avatar = document.querySelector('.user-avatar img').src;
        let cookie = document.cookie;
        
        ipcRenderer.sendToHost('checkLogin', {
          name: name.textContent,
          avatar: avatar,
          cookie: cookie
        });
        
        clearInterval(_interval);
      }
    }, 2000);
  });

步骤3：在webview中使用
  <webview
    src="https://mp.weixin.qq.com"
    preload="./preload/weixin.js"
  />
```

**用途**：用户手动登录时检测

---

## 能否结合使用？

### ✅ 可以！但是间接的

#### 方法：使用Playwright录制器找选择器

```
步骤1：使用Playwright录制器
  $ npx playwright codegen https://mp.weixin.qq.com
  
  你的操作：
    1. 登录
    2. 观察页面元素
  
  Playwright Inspector显示：
    用户名：.weui-desktop_name
    头像：.weui-desktop-account__img

步骤2：手动编写preload脚本
  // 使用Playwright找到的选择器
  const { ipcRenderer } = require('electron');
  
  ipcRenderer.on('checkLogin', (event, args) => {
    setInterval(() => {
      // 使用Playwright找到的选择器
      let name = document.querySelector('.weui-desktop_name');
      let avatar = document.querySelector('.weui-desktop-account__img');
      
      if (name !== null) {
        ipcRenderer.sendToHost('checkLogin', {
          name: name.textContent,
          avatar: avatar.src,
          cookie: document.cookie
        });
      }
    }, 2000);
  });
```

**好处**：
- ✅ Playwright Inspector帮你找选择器
- ✅ 不需要手动查找元素
- ✅ 但仍需手动编写preload脚本

---

## 实际操作指南

### 开发新平台的完整流程

#### 1. 使用Playwright录制器（找选择器 + 生成自动化代码）

```bash
cd server
npx playwright codegen https://新平台.com
```

**操作：**
1. 手动登录
2. 观察Playwright Inspector
3. 记录登录成功后的元素选择器：
   - 用户名：`.user-name`
   - 头像：`.user-avatar img`
4. 继续操作发布流程
5. 复制生成的自动化代码

**得到：**
- ✅ 登录成功的选择器（用于preload）
- ✅ 自动化发布代码（用于Adapter）

#### 2. 编写preload脚本（用于登录检测）

```javascript
// windows-login-manager/preload/新平台.js
const { ipcRenderer } = require('electron');

ipcRenderer.on('checkLogin', (event, args) => {
  setInterval(() => {
    // 使用Playwright找到的选择器
    let name = document.querySelector('.user-name');  // ← 来自Playwright
    
    if (name !== null) {
      let avatar = document.querySelector('.user-avatar img').src;  // ← 来自Playwright
      let cookie = document.cookie;
      
      ipcRenderer.sendToHost('checkLogin', {
        name: name.textContent,
        avatar: avatar,
        cookie: cookie
      });
    }
  }, 2000);
});
```

#### 3. 创建Adapter（用于自动发布）

```typescript
// server/src/services/adapters/NewPlatformAdapter.ts
import { chromium } from 'playwright';

export class NewPlatformAdapter extends PlatformAdapter {
  async publish(article, account) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 使用Cookie登录
    await context.addCookies(account.cookies);
    
    // 粘贴Playwright录制器生成的代码
    await page.goto('https://新平台.com');
    await page.click('text=新建文章');
    await page.fill('#title', article.title);
    await page.fill('#content', article.content);
    await page.click('text=发布');
    
    await browser.close();
    return { success: true };
  }
}
```

#### 4. 配置webview使用preload

```typescript
// src/components/PlatformLoginWebview.tsx
<webview
  src={platformUrl}
  preload={`./preload/${platformId}.js`}  // ← 使用preload脚本
/>
```

---

## 总结

### Playwright录制器的作用

1. ✅ **找选择器**：帮你找到页面元素的选择器
2. ✅ **生成自动化代码**：用于后端Adapter
3. ❌ **不能直接生成preload脚本**

### preload脚本的编写

1. ✅ **手动编写**：基于Electron IPC
2. ✅ **使用Playwright找到的选择器**
3. ✅ **用于检测登录状态**

### 正确的工作流程

```
1. 使用Playwright录制器
   ↓
   找到选择器 + 生成自动化代码
   ↓
2. 手动编写preload脚本
   ↓
   使用Playwright找到的选择器
   ↓
3. 创建Adapter
   ↓
   粘贴Playwright生成的代码
   ↓
4. 完成！
```

### 最终答案

**Q: 可以使用Playwright录制功能制作preload脚本吗？**

**A: 不能直接转换，但可以辅助！**

- ❌ 不能直接生成preload脚本
- ✅ 可以用Playwright找选择器
- ✅ 然后手动编写preload脚本
- ✅ Playwright生成的代码用于Adapter

**推荐流程：**
1. Playwright录制 → 找选择器
2. 手动编写 → preload脚本
3. Playwright代码 → 复制到Adapter

这样既利用了Playwright的强大功能，又正确地实现了两个不同的需求。
