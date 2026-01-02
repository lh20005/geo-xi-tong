# 简书登录状态检查修复

## 问题描述

简书平台出现误判Cookie失效的问题：
- **现象**：发布失败后，系统自动判断用户Cookie失效，账号状态变为"已掉线"
- **原因**：登录状态检查过于严格，采用"严格模式"（检测不到登录标志就认为掉线）
- **影响**：即使Cookie有效，只要页面加载慢或元素未出现，就会被误判为掉线

## 根本原因分析

### 错误的检查逻辑（修复前）

```typescript
// ❌ 严格模式：检测不到任何登录标志就返回false
if (!avatarVisible && !userAreaVisible && !navUserImg && !writeButton) {
  await this.log('warning', '❌ 未检测到任何登录标志，Cookie可能已失效');
  return false; // 误判！
}
```

**问题**：
1. 页面加载慢 → 元素未出现 → 被判定为掉线 ❌
2. 网络延迟 → 元素加载超时 → 被判定为掉线 ❌
3. 页面结构变化 → 选择器失效 → 被判定为掉线 ❌

### 正确的检查逻辑（修复后）

```typescript
// ✅ 宽松模式：只有明确检测到"未登录"信号才返回false
if (currentUrl.includes('/sign_in') || loginButton) {
  return false; // 确实未登录
}

// 如果没有明确的"未登录"信号，假设已登录
return true; // 避免误判
```

**优势**：
1. 只在明确未登录时才判定掉线 ✅
2. 页面加载慢不影响判断 ✅
3. 元素未出现不影响判断 ✅

## 修复方案

### 核心原则

**宽松验证策略**：只有明确检测到"未登录"信号才返回false，否则默认返回true

### 检查顺序

#### 1. 关键检查（未登录的明确信号）

**优先级最高**，一旦检测到立即返回false：

```typescript
// 🔴 检查1：URL重定向（最可靠）
if (currentUrl.includes('/sign_in') || currentUrl.includes('/login')) {
  return false; // Cookie已失效
}

// 🔴 检查2：登录/注册按钮（明确信号）
if (loginButton.isVisible()) {
  return false; // Cookie已失效
}
```

#### 2. 积极信号检查（已登录的确认）

**次要优先级**，有任何一个就确认已登录：

```typescript
// ✅ 检查头像、用户区域、写文章按钮等
if (avatarVisible || userAreaVisible || writeButton) {
  return true; // 确认已登录
}
```

#### 3. 默认策略（宽松）

**最后兜底**，避免误判：

```typescript
// 🟢 没有明确的"未登录"信号，假设已登录
return true;
```

## 参考的成功经验

### 小红书适配器

```typescript
private async checkLoginStatus(page: Page): Promise<boolean> {
  // 检查URL重定向
  if (currentUrl.includes('/login')) {
    return false;
  }
  
  // 检查积极信号
  if (hasName || hasAvatar || hasPublishButton) {
    return true;
  }
  
  // 🟢 默认假设已登录（宽松策略）
  return true;
}
```

### 抖音适配器

```typescript
private async checkLoginStatus(page: Page): Promise<boolean> {
  // 检查URL重定向
  if (currentUrl.includes('/login') || currentUrl.includes('/passport')) {
    return false;
  }
  
  // 检查积极信号
  if (hasAvatar || hasName || hasPublishButton || hasAccount) {
    return true;
  }
  
  // 🟢 默认假设已登录（宽松策略）
  return true;
}
```

## 修复后的完整逻辑

```typescript
async checkLoginStatus(page: Page): Promise<boolean> {
  try {
    await this.log('info', '🔍 开始检查简书登录状态...');
    
    // 等待页面加载
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    
    const currentUrl = page.url();
    
    // 🔴 关键检查1：URL重定向（最可靠的未登录信号）
    if (currentUrl.includes('/sign_in') || currentUrl.includes('/sign_up') || currentUrl.includes('/login')) {
      await this.log('warning', '❌ 已被重定向到登录页面，Cookie已失效');
      return false;
    }
    
    // 🔴 关键检查2：登录/注册按钮（明确的未登录信号）
    const loginButton = await page.locator('a:has-text("登录"), button:has-text("登录"), a:has-text("注册")').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (loginButton) {
      await this.log('warning', '❌ 检测到登录/注册按钮，Cookie已失效');
      return false;
    }
    
    // ✅ 积极信号检查（有任何一个就确认已登录）
    const avatarVisible = await page.locator('.avatar>img').isVisible({ timeout: 3000 }).catch(() => false);
    if (avatarVisible) {
      await this.log('info', '✅ 检测到头像元素，登录状态正常');
      return true;
    }
    
    const userAreaVisible = await page.locator('.user').isVisible({ timeout: 2000 }).catch(() => false);
    if (userAreaVisible) {
      await this.log('info', '✅ 检测到用户区域，登录状态正常');
      return true;
    }
    
    const navUserImg = await page.locator('nav .user img, nav img.avatar').isVisible({ timeout: 2000 }).catch(() => false);
    if (navUserImg) {
      await this.log('info', '✅ 检测到导航栏用户图片，登录状态正常');
      return true;
    }
    
    const writeButton = await page.locator('a[href="/writer"], button:has-text("写文章")').isVisible({ timeout: 2000 }).catch(() => false);
    if (writeButton) {
      await this.log('info', '✅ 检测到写文章按钮，登录状态正常');
      return true;
    }
    
    // 🟢 宽松策略：如果没有明确的"未登录"信号，假设已登录
    await this.log('info', '✅ 未检测到登录页面，假设已登录');
    return true;
    
  } catch (error: any) {
    await this.log('error', '检查登录状态出错', { error: error.message });
    // 🟢 出错时也返回true（宽松策略，避免误判）
    return true;
  }
}
```

## 关键改进点

### 1. 检查顺序优化

- **先检查"未登录"信号**（URL重定向、登录按钮）
- **再检查"已登录"信号**（头像、用户区域等）
- **最后使用宽松策略**（默认假设已登录）

### 2. 超时时间调整

- 关键检查（URL、登录按钮）：3秒
- 积极信号检查（头像等）：2-3秒
- 避免过长等待导致性能问题

### 3. 错误处理改进

```typescript
// 修复前：出错返回false（严格）
catch (error) {
  return false; // ❌ 误判
}

// 修复后：出错返回true（宽松）
catch (error) {
  return true; // ✅ 避免误判
}
```

## 测试建议

### 1. 正常场景测试

- ✅ Cookie有效 → 应该返回true
- ✅ 页面加载慢 → 应该返回true（不误判）
- ✅ 网络延迟 → 应该返回true（不误判）

### 2. 异常场景测试

- ✅ Cookie失效 → 应该返回false（正确判断）
- ✅ 被重定向到登录页 → 应该返回false（正确判断）
- ✅ 出现登录按钮 → 应该返回false（正确判断）

### 3. 边界场景测试

- ✅ 页面结构变化 → 应该返回true（宽松策略）
- ✅ 选择器失效 → 应该返回true（宽松策略）
- ✅ 网络错误 → 应该返回true（宽松策略）

## 总结

### 修复前的问题

- 采用"严格模式"：检测不到登录标志就认为掉线
- 容易误判：页面加载慢、网络延迟都会被判定为掉线
- 用户体验差：频繁被标记为"已掉线"

### 修复后的优势

- 采用"宽松模式"：只有明确未登录才判定掉线
- 避免误判：页面加载慢、网络延迟不影响判断
- 用户体验好：只在真正掉线时才标记

### 核心理念

**"宁可漏判，不可误判"**

- 漏判：Cookie失效但未检测到 → 发布失败，用户重试即可
- 误判：Cookie有效但被判定失效 → 账号被标记掉线，用户困惑

误判的代价远大于漏判，因此采用宽松策略是正确的选择。
