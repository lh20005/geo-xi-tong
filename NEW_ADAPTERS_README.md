# 新增平台适配器说明

## 概述

根据 `/Downloads/geo/resources/app-extracted/src/api/script/` 目录中的参考登录器代码，已成功创建了8个新的平台适配器。

## 已创建的适配器

### 1. 网易号 (WangyiAdapter)
- **文件**: `server/src/services/adapters/WangyiAdapter.ts`
- **参考代码**: `wy.js`
- **登录URL**: https://mp.163.com/login.html
- **发布URL**: https://mp.163.com/v4/home
- **登录验证**: `.topBar__user` 元素
- **状态**: ✅ 已创建，支持Cookie登录

### 2. 百家号 (BaijiahaoAdapter)
- **文件**: `server/src/services/adapters/BaijiahaoAdapter.ts`
- **参考代码**: `bjh.js`
- **登录URL**: https://baijiahao.baidu.com/builder/rc/login
- **发布URL**: https://baijiahao.baidu.com/builder/app/homepage
- **登录验证**: `.UjPPKm89R4RrZTKhwG5H` 元素（头像）
- **状态**: ✅ 已创建，支持Cookie登录

### 3. 知乎 (ZhihuAdapter)
- **文件**: `server/src/services/adapters/ZhihuAdapter.ts`
- **参考代码**: `zh.js`
- **登录URL**: https://www.zhihu.com/signin
- **发布URL**: https://www.zhihu.com/creator
- **登录验证**: `img.AppHeader-profileAvatar` 元素
- **特点**: 使用API获取用户信息 (`/api/v4/me`)
- **状态**: ✅ 已创建，支持Cookie登录

### 4. CSDN (CSDNAdapter)
- **文件**: `server/src/services/adapters/CSDNAdapter.ts`
- **参考代码**: `csdn.js`
- **登录URL**: https://passport.csdn.net/login
- **发布URL**: https://mp.csdn.net/mp_blog/creation/editor
- **登录验证**: `.hasAvatar` 元素
- **特点**: 使用API获取用户信息 (`/community/toolbar-api/v1/get-user-info`)
- **状态**: ✅ 已创建，支持Cookie登录，发布功能待完善

### 5. 简书 (JianshuAdapter)
- **文件**: `server/src/services/adapters/JianshuAdapter.ts`
- **参考代码**: `js.js`
- **登录URL**: https://www.jianshu.com/sign_in
- **发布URL**: https://www.jianshu.com/writer
- **登录验证**: `.avatar>img` 元素
- **状态**: ✅ 已创建，支持Cookie登录，发布功能待完善

### 6. 微信公众号 (WechatAdapter)
- **文件**: `server/src/services/adapters/WechatAdapter.ts`
- **参考代码**: `wxgzh.js`
- **登录URL**: https://mp.weixin.qq.com/
- **发布URL**: https://mp.weixin.qq.com/
- **登录验证**: `.weui-desktop_name` 元素
- **特点**: 仅支持扫码登录
- **状态**: ✅ 已创建，支持Cookie登录，发布功能待完善

### 7. 企鹅号 (QieAdapter)
- **文件**: `server/src/services/adapters/QieAdapter.ts`
- **参考代码**: `qeh.js`
- **登录URL**: https://om.qq.com/userAuth/index
- **发布URL**: https://om.qq.com/
- **登录验证**: `span.usernameText-cls2j9OE` 元素
- **状态**: ✅ 已创建，支持Cookie登录，发布功能待完善

### 8. 哔哩哔哩 (BilibiliAdapter)
- **文件**: `server/src/services/adapters/BilibiliAdapter.ts`
- **参考代码**: `bili.js`
- **登录URL**: https://passport.bilibili.com/login
- **发布URL**: https://member.bilibili.com/platform/home
- **登录验证**: `span.right-entry-text` 元素
- **特点**: 使用API获取用户信息 (`/x/web-interface/nav`)
- **状态**: ✅ 已创建，支持Cookie登录，发布功能待完善

## 实现特点

### 1. 登录功能
所有适配器都实现了基于Cookie的登录验证：
- 优先使用Cookie登录
- 检查特定的DOM元素来验证登录状态
- 部分平台（知乎、CSDN、B站）使用API验证登录

### 2. 参考代码模式
参考登录器代码的核心模式：
```javascript
// 定时检查登录状态
setInterval(() => {
  // 查找特定元素
  let element = document.querySelector('.selector')
  
  if (element !== null) {
    // 提取用户信息
    let value = {
      avatar: srcValue,
      account: '',
      name: name.textContent,
      cookie: document.cookie
    }
    
    // 发送登录成功消息
    ipcRenderer.sendToHost('checkLogin', value)
    clearInterval(_interval);
  }
}, 1000)
```

### 3. 人性化操作
所有适配器都实现了人性化操作：
- `randomWait()`: 随机等待3-5秒，模拟人类思考
- `humanClick()`: 点击前后都有等待
- `humanType()`: 输入前后都有等待

### 4. 图片处理
- 支持Markdown和HTML格式的图片
- 自动提取文章中的第一张图片作为封面
- 支持相对路径和绝对路径

## 注册状态

所有适配器已在 `AdapterRegistry.ts` 中注册：

```typescript
// 工作良好的适配器（4个）
- XiaohongshuAdapter (小红书) ✅
- DouyinAdapter (抖音) ✅
- ToutiaoAdapter (头条) ✅
- SohuAdapter (搜狐号) ✅

// 新创建的适配器（8个）
- WangyiAdapter (网易号) ✅
- BaijiahaoAdapter (百家号) ✅
- ZhihuAdapter (知乎) ✅
- CSDNAdapter (CSDN) ⚠️ 发布功能待完善
- JianshuAdapter (简书) ⚠️ 发布功能待完善
- WechatAdapter (微信公众号) ⚠️ 发布功能待完善
- QieAdapter (企鹅号) ⚠️ 发布功能待完善
- BilibiliAdapter (哔哩哔哩) ⚠️ 发布功能待完善
```

总计：**12个平台适配器**

## 下一步工作

### 优先级1：完善发布功能
需要为以下平台完善发布功能：
1. CSDN
2. 简书
3. 微信公众号
4. 企鹅号
5. 哔哩哔哩

### 优先级2：测试登录功能
测试所有新创建的适配器的Cookie登录功能：
1. 网易号
2. 百家号
3. 知乎

### 优先级3：优化选择器
根据实际测试结果，优化DOM选择器：
- 登录验证选择器
- 发布页面选择器
- 表单输入选择器

## 参考文件对照表

| 平台 | 参考文件 | Adapter文件 | 状态 |
|------|---------|------------|------|
| 抖音 | dy.js | DouyinAdapter.ts | ✅ 已完成 |
| 头条 | tt.js | ToutiaoAdapter.ts | ✅ 已完成 |
| 小红书 | xhs.js | XiaohongshuAdapter.ts | ✅ 已完成 |
| 搜狐号 | sh.js | SohuAdapter.ts | ✅ 已完成 |
| 网易号 | wy.js | WangyiAdapter.ts | ✅ 已创建 |
| 百家号 | bjh.js | BaijiahaoAdapter.ts | ✅ 已创建 |
| 知乎 | zh.js | ZhihuAdapter.ts | ✅ 已创建 |
| CSDN | csdn.js | CSDNAdapter.ts | ⚠️ 待完善 |
| 简书 | js.js | JianshuAdapter.ts | ⚠️ 待完善 |
| 微信公众号 | wxgzh.js | WechatAdapter.ts | ⚠️ 待完善 |
| 企鹅号 | qeh.js | QieAdapter.ts | ⚠️ 待完善 |
| 哔哩哔哩 | bili.js | BilibiliAdapter.ts | ⚠️ 待完善 |
| 快手 | kuaishou.js | - | ❌ 未创建 |
| 视频号 | sph.js | - | ❌ 未创建 |
| 微博 | weibo.js | - | ❌ 未创建 |

## 技术要点

### Cookie登录流程
1. 从数据库读取保存的Cookie
2. 在创建浏览器上下文时设置Cookie
3. 导航到发布页面
4. 检查特定元素验证登录状态
5. 如果登录失败，提示用户手动登录

### 选择器策略
参考登录器使用的选择器类型：
- **类名选择器**: `.topBar__user`, `.hasAvatar`
- **标签+类名**: `img.AppHeader-profileAvatar`
- **层级选择器**: `.avatar>img`
- **属性选择器**: `span.usernameText-cls2j9OE`

### API验证方式
部分平台使用API验证登录：
- **知乎**: `https://www.zhihu.com/api/v4/me?include=is_realname`
- **CSDN**: `https://g-api.csdn.net/community/toolbar-api/v1/get-user-info`
- **B站**: `https://api.bilibili.com/x/web-interface/nav`

## 总结

✅ 已成功创建8个新的平台适配器
✅ 所有适配器都支持Cookie登录
✅ 已在AdapterRegistry中注册
⚠️ 部分平台的发布功能需要进一步完善
💡 建议优先测试和完善网易号、百家号、知乎的发布功能
