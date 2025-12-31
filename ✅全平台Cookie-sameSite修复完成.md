# ✅ 全平台 Cookie sameSite 修复完成

## 问题描述

所有平台的发布任务在使用 Cookie 登录时可能遇到错误，无法弹出浏览器，显示发布失败。

### 错误信息
```
browserContext.addCookies: cookies[0].sameSite: expected one of (Strict|Lax|None)
```

## 问题原因

Playwright 对 Cookie 的 `sameSite` 属性有严格要求，必须是以下三个值之一：
- `Strict`
- `Lax`
- `None`

但从数据库中读取的 Cookie 可能包含其他值（如小写的 `lax`、`strict`，或者其他非标准值），导致 Playwright 拒绝设置 Cookie。

## 修复方案

### 1. 创建通用 Cookie 规范化工具

创建了 `server/src/utils/cookieNormalizer.ts` 工具类，提供：
- `normalizeCookies()` - 规范化 Cookie 数组
- `isValidCookie()` - 验证单个 Cookie
- `filterAndNormalizeCookies()` - 过滤并规范化

### 2. 统一使用 Playwright

✅ 确认系统已完全使用 Playwright（不再使用 Puppeteer）
✅ 所有平台都通过统一的 BrowserAutomationService 管理浏览器

### 3. 修复所有 Cookie 设置点

修复了两个关键位置：

#### 位置 1: PublishingExecutor.ts（发布任务执行）
```typescript
import { normalizeCookies } from '../utils/cookieNormalizer';

// 规范化 Cookie 的 sameSite 属性
const normalizedCookies = normalizeCookies(account.credentials.cookies);
await context.addCookies(normalizedCookies);
```

#### 位置 2: AccountService.ts（测试登录）
```typescript
import { normalizeCookies } from '../utils/cookieNormalizer';

// 规范化 Cookie 的 sameSite 属性
const normalizedCookies = normalizeCookies(account.credentials.cookies);
await context.addCookies(normalizedCookies);
```

## 修复效果

✅ Cookie 的 `sameSite` 属性会被自动规范化
✅ 支持小写转大写（lax → Lax, strict → Strict）
✅ 无效值自动转换为 Lax（默认值）
✅ sameSite=None 时自动设置 secure=true
✅ 所有平台的 Cookie 登录都受益于此修复

## 受益平台

所有使用 Cookie 登录的平台：
- ✅ 小红书
- ✅ 抖音号
- ✅ 头条号
- ✅ 企鹅号
- ✅ 知乎
- ✅ 微信公众号
- ✅ 哔哩哔哩
- ✅ CSDN
- ✅ 简书
- ✅ 百家号
- ✅ 网易号
- ✅ 搜狐号

## 技术细节

### sameSite 属性说明

- **Strict**: 最严格，Cookie 只在同站请求时发送
- **Lax**: 默认值，允许部分跨站请求携带 Cookie（如导航）
- **None**: 允许所有跨站请求携带 Cookie（需要 Secure 属性）

### 为什么选择 Lax 作为默认值

- `Lax` 是现代浏览器的默认值
- 兼容性好，适用于大多数场景
- 既保证了一定的安全性，又不会影响正常的登录流程

### TypeScript 类型安全

Cookie 接口使用严格的类型定义：
```typescript
export interface Cookie {
  name: string;
  value: string;
  sameSite?: 'Strict' | 'Lax' | 'None'; // 严格类型
  // ... 其他属性
}
```

## 相关文件

- `server/src/utils/cookieNormalizer.ts` - Cookie 规范化工具（新增）
- `server/src/services/PublishingExecutor.ts` - 发布任务执行器
- `server/src/services/AccountService.ts` - 账号服务
- `server/src/services/BrowserAutomationService.ts` - 浏览器自动化服务（Playwright）

## 测试步骤

1. 确保已有平台账号并保存了 Cookie
2. 创建一篇文章
3. 选择任意平台
4. 点击发布任务
5. 浏览器应该正常弹出并使用 Cookie 登录

## 完成时间

2025-12-31 20:10

---

**状态**: ✅ 已修复并测试
**影响范围**: 所有使用 Cookie 登录的平台（12个平台）
**优先级**: 高（阻塞发布功能）
**技术栈**: Playwright + TypeScript
