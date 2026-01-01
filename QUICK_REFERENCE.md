# 平台适配器快速参考

## 所有平台适配器一览

### 工作良好的平台（4个）✅

| 平台 | platformId | Adapter类 | 登录URL | 发布URL |
|------|-----------|-----------|---------|---------|
| 抖音 | `douyin` | DouyinAdapter | https://creator.douyin.com/passport/web/login | https://creator.douyin.com/creator-micro/content/upload |
| 头条 | `toutiao` | ToutiaoAdapter | https://mp.toutiao.com/auth/page/login | https://mp.toutiao.com/profile_v4/graphic/publish |
| 小红书 | `xiaohongshu` | XiaohongshuAdapter | https://creator.xiaohongshu.com/login | https://creator.xiaohongshu.com/publish/publish |
| 搜狐号 | `souhu` | SohuAdapter | https://mp.sohu.com/mpfe/v4/login | https://mp.sohu.com/mpfe/v3/main/index |

### 新创建的平台（8个）🆕

| 平台 | platformId | Adapter类 | 登录URL | 发布URL | 状态 |
|------|-----------|-----------|---------|---------|------|
| 网易号 | `wangyi` | WangyiAdapter | https://mp.163.com/login.html | https://mp.163.com/v4/home | ✅ 完整 |
| 百家号 | `baijiahao` | BaijiahaoAdapter | https://baijiahao.baidu.com/builder/rc/login | https://baijiahao.baidu.com/builder/app/homepage | ✅ 完整 |
| 知乎 | `zhihu` | ZhihuAdapter | https://www.zhihu.com/signin | https://www.zhihu.com/creator | ✅ 完整 |
| CSDN | `csdn` | CSDNAdapter | https://passport.csdn.net/login | https://mp.csdn.net/mp_blog/creation/editor | ⚠️ 待完善 |
| 简书 | `jianshu` | JianshuAdapter | https://www.jianshu.com/sign_in | https://www.jianshu.com/writer | ⚠️ 待完善 |
| 微信公众号 | `wechat` | WechatAdapter | https://mp.weixin.qq.com/ | https://mp.weixin.qq.com/ | ⚠️ 待完善 |
| 企鹅号 | `qie` | QieAdapter | https://om.qq.com/userAuth/index | https://om.qq.com/ | ⚠️ 待完善 |
| 哔哩哔哩 | `bilibili` | BilibiliAdapter | https://passport.bilibili.com/login | https://member.bilibili.com/platform/home | ⚠️ 待完善 |

## 登录验证选择器

| 平台 | 验证选择器 | 说明 |
|------|-----------|------|
| 抖音 | `.img-PeynF_` | 用户头像 |
| 头条 | `.auth-avator-name` | 用户名称 |
| 小红书 | `text=发布笔记` | 发布按钮文本 |
| 搜狐号 | `.user-name` | 用户名称 |
| 网易号 | `.topBar__user` | 顶部用户区域 |
| 百家号 | `.UjPPKm89R4RrZTKhwG5H` | 用户头像 |
| 知乎 | `img.AppHeader-profileAvatar` | 头像图片 |
| CSDN | `.hasAvatar` | 头像容器 |
| 简书 | `.avatar>img` | 头像图片 |
| 微信公众号 | `.weui-desktop_name` | 用户名称 |
| 企鹅号 | `span.usernameText-cls2j9OE` | 用户名文本 |
| 哔哩哔哩 | `span.right-entry-text` | 右侧入口文本 |

## 参考代码对照表

| 平台 | 参考文件 | Adapter文件 |
|------|---------|------------|
| 抖音 | dy.js | DouyinAdapter.ts |
| 头条 | tt.js | ToutiaoAdapter.ts |
| 小红书 | xhs.js | XiaohongshuAdapter.ts |
| 搜狐号 | sh.js | SohuAdapter.ts |
| 网易号 | wy.js | WangyiAdapter.ts |
| 百家号 | bjh.js | BaijiahaoAdapter.ts |
| 知乎 | zh.js | ZhihuAdapter.ts |
| CSDN | csdn.js | CSDNAdapter.ts |
| 简书 | js.js | JianshuAdapter.ts |
| 微信公众号 | wxgzh.js | WechatAdapter.ts |
| 企鹅号 | qeh.js | QieAdapter.ts |
| 哔哩哔哩 | bili.js | BilibiliAdapter.ts |

## 使用API验证的平台

| 平台 | API端点 | 说明 |
|------|---------|------|
| 知乎 | `https://www.zhihu.com/api/v4/me?include=is_realname` | 获取用户信息 |
| CSDN | `https://g-api.csdn.net/community/toolbar-api/v1/get-user-info` | 获取用户信息 |
| 哔哩哔哩 | `https://api.bilibili.com/x/web-interface/nav` | 获取导航信息 |

## 如何使用

### 1. 测试登录

```typescript
import { adapterRegistry } from './AdapterRegistry';

// 获取适配器
const adapter = adapterRegistry.getAdapter('wangyi');

// 测试登录
const success = await adapter.performLogin(page, {
  cookies: [/* cookie数组 */]
});
```

### 2. 发布文章

```typescript
// 发布文章
const success = await adapter.performPublish(page, {
  title: '文章标题',
  content: '文章内容',
  keyword: '关键词'
}, {
  /* 发布配置 */
});
```

### 3. 检查适配器是否存在

```typescript
// 检查适配器
if (adapterRegistry.hasAdapter('wangyi')) {
  console.log('网易号适配器已注册');
}

// 获取所有已注册的平台
const platforms = adapterRegistry.getRegisteredPlatforms();
console.log('已注册的平台:', platforms);
```

## 文件位置

- **Adapter文件**: `server/src/services/adapters/`
- **注册表**: `server/src/services/adapters/AdapterRegistry.ts`
- **基类**: `server/src/services/adapters/PlatformAdapter.ts`
- **参考代码**: `/Downloads/geo/resources/app-extracted/src/api/script/`

## 开发建议

### 1. 添加新平台
1. 创建新的Adapter类，继承 `PlatformAdapter`
2. 实现必需的方法：`performLogin`, `performPublish`, `verifyPublishSuccess`
3. 在 `AdapterRegistry.ts` 中导入并注册

### 2. 调试技巧
- 使用 `await this.log('info', '消息')` 记录日志
- 使用 `page.screenshot()` 截图调试
- 使用 `page.pause()` 暂停执行（开发模式）

### 3. 选择器优化
- 优先使用稳定的选择器（ID、data属性）
- 避免使用动态生成的类名
- 使用 `getByRole`, `getByText` 等语义化选择器

## 常见问题

### Q: Cookie登录失败怎么办？
A: 检查Cookie是否过期，或者选择器是否正确。可以使用浏览器开发者工具检查元素。

### Q: 如何获取正确的选择器？
A: 参考对应的登录器代码（.js文件），查看 `document.querySelector()` 使用的选择器。

### Q: 发布功能如何完善？
A: 参考已完成的适配器（抖音、头条、小红书、搜狐号），按照相同的模式实现发布流程。

## 下一步计划

1. ✅ 测试网易号、百家号、知乎的登录功能
2. ⚠️ 完善CSDN、简书、微信公众号、企鹅号、哔哩哔哩的发布功能
3. 🔄 根据测试结果优化选择器
4. 📝 添加更详细的错误处理和日志

## 相关文档

- `NEW_ADAPTERS_README.md` - 新适配器详细说明
- `ADAPTER_IMPLEMENTATION_SUMMARY.md` - 实现总结
- `server/src/services/adapters/README.md` - Adapter开发指南
