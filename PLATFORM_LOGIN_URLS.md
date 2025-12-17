# 平台登录URL配置

## 已支持的平台

所有平台都已配置登录URL，点击任意平台卡片都会打开浏览器。

### 自媒体平台

| 平台ID | 平台名称 | 登录URL | 状态 |
|--------|----------|---------|------|
| wangyi | 网易号 | https://mp.163.com/login.html | ✅ 已配置 |
| souhu | 搜狐号 | https://mp.sohu.com/login | ✅ 已配置 |
| baijiahao | 百家号 | https://baijiahao.baidu.com/builder/author/register/index | ✅ 已配置 |
| toutiao | 头条号 | https://mp.toutiao.com/auth/page/login/ | ✅ 已配置 |
| qie | 企鹅号 | https://om.qq.com/userAuth/index | ✅ 已配置 |

### 社交媒体平台

| 平台ID | 平台名称 | 登录URL | 状态 |
|--------|----------|---------|------|
| wechat | 微信公众号 | https://mp.weixin.qq.com/ | ✅ 已配置 |
| xiaohongshu | 小红书 | https://creator.xiaohongshu.com/login | ✅ 已配置 |
| douyin | 抖音号 | https://creator.douyin.com/ | ✅ 已配置 |
| bilibili | 哔哩哔哩 | https://member.bilibili.com/platform/home | ✅ 已配置 |

### 技术社区平台

| 平台ID | 平台名称 | 登录URL | 状态 |
|--------|----------|---------|------|
| zhihu | 知乎 | https://www.zhihu.com/signin | ✅ 已配置 |
| jianshu | 简书 | https://www.jianshu.com/sign_in | ✅ 已配置 |
| csdn | CSDN | https://passport.csdn.net/login | ✅ 已配置 |
| juejin | 掘金 | https://juejin.cn/login | ✅ 已配置 |
| segmentfault | SegmentFault | https://segmentfault.com/user/login | ✅ 已配置 |
| oschina | 开源中国 | https://www.oschina.net/home/login | ✅ 已配置 |
| cnblogs | 博客园 | https://account.cnblogs.com/signin | ✅ 已配置 |
| v2ex | V2EX | https://www.v2ex.com/signin | ✅ 已配置 |

## 使用方法

1. 打开平台登录页面
2. 点击任意平台卡片
3. 浏览器会自动打开该平台的登录页面
4. 在浏览器中输入账号密码登录
5. 登录成功后浏览器自动关闭
6. Cookie自动保存到数据库

## 登录检测机制

每个平台都配置了特定的登录成功检测条件：

### 自媒体平台检测

- **网易号**：检测URL包含 `mp.163.com` 且不包含 `login`
- **搜狐号**：检测URL包含 `mp.sohu.com` 且不包含 `login`
- **百家号**：检测URL包含 `baijiahao.baidu.com` 且不包含 `register`
- **头条号**：检测URL包含 `content` 或 `profile`
- **企鹅号**：检测URL包含 `om.qq.com` 且不包含 `userAuth`

### 社交媒体平台检测

- **微信公众号**：检测URL包含 `home` 或 `cgi-bin`
- **小红书**：检测URL包含 `creator.xiaohongshu.com` 且不包含 `login`
- **抖音号**：检测URL包含 `creator.douyin.com` 且不包含 `login`
- **哔哩哔哩**：检测URL包含 `member.bilibili.com` 且不包含 `login`

### 技术社区平台检测

- **知乎**：检测URL不包含 `signin`
- **简书**：检测URL不包含 `sign_in`
- **CSDN**：检测URL不包含 `login` 和 `passport`
- **掘金**：检测URL不包含 `login`
- **SegmentFault**：检测URL不包含 `login`
- **开源中国**：检测URL不包含 `login`
- **博客园**：检测URL不包含 `signin`
- **V2EX**：检测URL不包含 `signin`

## 用户信息提取

系统会尝试从登录后的页面提取用户名：

### 配置的选择器

```typescript
{
  // 自媒体平台
  'wangyi': '.user-info .name',
  'souhu': '.user-name',
  'baijiahao': '.author-name',
  'toutiao': '.user-name',
  'qie': '.user-info-name',
  
  // 社交媒体平台
  'wechat': '.account_info_title',
  'xiaohongshu': '.username',
  'douyin': '.semi-navigation-header-username',
  'bilibili': '.user-name',
  
  // 技术社区平台
  'zhihu': '.AppHeader-profile',
  'jianshu': '.user-name',
  'csdn': '.user-name',
  'juejin': '.username',
  'segmentfault': '.user-name',
  'oschina': '.user-name',
  'cnblogs': '.user-name',
  'v2ex': '.username'
}
```

如果无法提取用户名，系统会自动生成账号名称：`平台名_时间戳`

## 添加新平台

如果需要添加新平台，在 `server/src/services/AccountService.ts` 中修改三个方法：

### 1. 添加登录URL

```typescript
private getPlatformLoginUrl(platformId: string): string | null {
  const loginUrls: { [key: string]: string } = {
    // ... 现有平台
    'new_platform': 'https://new-platform.com/login'
  };
  return loginUrls[platformId] || null;
}
```

### 2. 添加登录检测条件

```typescript
private async waitForLogin(page: any, platformId: string): Promise<void> {
  const waitConditions: { [key: string]: () => Promise<void> } = {
    // ... 现有平台
    'new_platform': async () => {
      await page.waitForFunction(
        `!window.location.href.includes('login')`,
        { timeout: 300000 }
      );
    }
  };
  // ...
}
```

### 3. 添加用户信息选择器（可选）

```typescript
private async extractUserInfo(page: any, platformId: string): Promise<any> {
  const selectors: { [key: string]: string } = {
    // ... 现有平台
    'new_platform': '.user-name'
  };
  // ...
}
```

## 注意事项

1. **登录超时**：每个平台的登录等待时间为5分钟（300秒）
2. **Cookie有效期**：Cookie的有效期由各平台决定
3. **二次验证**：某些平台可能需要手机验证码或二次验证
4. **扫码登录**：某些平台（如微信）可能需要扫码登录
5. **自动保存**：登录成功后Cookie会自动加密保存到数据库

## 测试建议

建议按以下顺序测试平台：

1. **简单平台**（推荐先测试）：
   - 知乎
   - 简书
   - CSDN
   - 掘金

2. **中等难度**：
   - 头条号
   - 百家号
   - 搜狐号

3. **复杂平台**：
   - 微信公众号（需要扫码）
   - 企鹅号（可能需要企业认证）
   - 小红书（可能需要手机验证）

## 故障排查

### 问题1：浏览器打开但无法检测登录成功

**原因**：登录检测条件不准确

**解决**：
1. 手动登录该平台
2. 查看登录后的URL特征
3. 修改 `waitForLogin` 方法中的检测条件

### 问题2：无法提取用户名

**原因**：选择器不正确

**解决**：
1. 登录后打开浏览器开发者工具
2. 查找包含用户名的元素
3. 更新 `extractUserInfo` 方法中的选择器

### 问题3：某些平台需要验证码

**解决**：
- 在浏览器中手动输入验证码
- 系统会等待你完成所有验证步骤

## 更新日志

- 2024-12-16：添加所有18个平台的登录URL支持
- 2024-12-16：为每个平台配置特定的登录检测条件
- 2024-12-16：为每个平台配置用户信息提取选择器
