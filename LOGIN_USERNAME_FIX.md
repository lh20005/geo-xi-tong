# 登录用户名提取修复

## 问题描述
网易号、百家号、B站、简书、CSDN 登录后无法正确保存用户信息（用户名）。

## 修复方案

参考 `/Users/lzc/Downloads/geo/resources/app-extracted/src/api/script/` 中的 Electron 版本实现，优化了用户信息提取逻辑。

### 1. 新增 API 提取方式

为以下平台添加了通过 API 获取用户信息的支持：

| 平台 | API 地址 | 提取字段 |
|------|----------|----------|
| B站 | `https://api.bilibili.com/x/web-interface/nav` | `data.uname` |
| CSDN | `https://g-api.csdn.net/community/toolbar-api/v1/get-user-info` | `data.nickName` |
| 知乎 | `https://www.zhihu.com/api/v4/me?include=is_realname` | `name` |

### 2. 优化登录检测策略

为以下平台添加了专门的登录检测策略：

- **网易号**: 检测 `.topBar__user>span` 元素
- **百家号**: 检测 `.UjPPKm89R4RrZTKhwG5H` 头像元素，并触发 hover 事件显示用户名
- **CSDN**: 检测 `.hasAvatar` 元素
- **简书**: 检测 `.avatar>img` 元素，并点击跳转到个人主页

### 3. 更新 DOM 选择器

根据参考脚本更新了各平台的选择器：

| 平台 | 主要选择器 |
|------|-----------|
| 网易号 | `.topBar__user>span:nth-child(3)` |
| 百家号 | `.user-name` |
| B站 | `span.right-entry-text` (API 优先) |
| 简书 | `.main-top .name` |
| CSDN | `.hasAvatar` (API 优先) |
| 知乎 | `img.AppHeader-profileAvatar` (API 优先) |
| 抖音 | `.name-_lSSDc` |
| 头条号 | `.auth-avator-name` |
| 搜狐号 | `.user-name` |
| 小红书 | `.account-name` |

### 4. 优化导航配置

为以下平台添加了登录后导航到特定页面的配置：

- **网易号**: 导航到 `https://mp.163.com/home/index.html`
- **百家号**: 导航到 `https://baijiahao.baidu.com/builder/rc/home`
- **B站**: 导航到 `https://member.bilibili.com/platform/home`
- **CSDN**: 导航到 `https://www.csdn.net/`
- **简书**: 特殊处理，点击用户头像跳转到个人主页

## 提取流程

1. 登录成功后，首先尝试通过 API 获取用户信息
2. 如果 API 方式失败，回退到 DOM 选择器方式
3. 按优先级尝试多个选择器
4. 如果所有方式都失败，保存页面 HTML 到 `debug/` 目录供调试

## 修改的文件

- `server/src/services/AccountService.ts`
  - 新增 `extractUserInfoViaAPI()` 方法
  - 更新 `extractUserInfo()` 方法，优先使用 API
  - 更新 `waitForLogin()` 方法，添加新平台的登录检测策略
  - 更新 `platformsNeedingNavigation` 配置
  - 更新各平台的 DOM 选择器
