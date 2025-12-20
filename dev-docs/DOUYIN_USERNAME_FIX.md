# 抖音号真实用户名提取修复

## 问题描述

用户登录抖音号后，账号管理页面显示的是 `抖音号_1766159145791` 而不是真实用户名 `Ai来了`。

## 问题分析

### 根本原因

系统中有两个提取用户名的方法：

1. **DouyinAdapter.extractUsername()** 
   - 位置：`server/src/services/adapters/DouyinAdapter.ts`
   - 使用正确的选择器：`.name-_lSSDc`
   - 能够成功提取到 "Ai来了"
   - ❌ 但是这个方法只在 `performLogin` 中被调用并打印，没有被保存到数据库

2. **AccountService.extractUserInfo()**
   - 位置：`server/src/services/AccountService.ts`
   - 这是实际用于保存用户名到数据库的方法
   - ❌ 使用的抖音选择器不正确（`.semi-navigation-header-username`, `.username` 等）
   - ❌ 无法匹配到 `.name-_lSSDc` 元素

### 数据流程

```
用户登录 
  → AccountService.loginWithBrowser()
    → 打开浏览器，用户完成登录
    → AccountService.extractUserInfo() ← 这里提取用户名
      → 使用错误的选择器
      → 提取失败，返回空字符串
    → 生成账号名：`${platform.platform_name}_${Date.now()}`
      → 结果：`抖音号_1766159145791`
    → 保存到数据库
```

## 修复方案

将 DouyinAdapter 中正确的选择器添加到 AccountService 的 `extractUserInfo` 方法中。

### 修改文件

**文件：** `server/src/services/AccountService.ts`

**修改位置：** `extractUserInfo` 方法中的 `selectors` 对象

**修改内容：**

```typescript
'douyin': [
  // 主选择器：基于class名称（从HTML快照中提取）
  '.name-_lSSDc',
  // 备用选择器1：基于结构路径
  '.container-vEyGlK .content-fFY6HC .header-_F2uzl .left-zEzdJX .name-_lSSDc',
  // 备用选择器2：更宽泛的class匹配
  '[class*="name-"]',
  // 备用选择器3：基于父容器
  '.header-_F2uzl .name-_lSSDc',
  // 通用选择器（保留作为后备）
  '.semi-navigation-header-username',
  '.username',
  '.user-name',
  '[class*="username"]'
],
```

## 测试步骤

1. **清理旧账号**（可选）
   - 在账号管理页面删除旧的 `抖音号_1766159145791` 账号

2. **重新登录**
   - 访问账号管理页面
   - 点击"添加账号"
   - 选择"抖音号"平台
   - 点击"浏览器登录"
   - 在弹出的浏览器中完成登录

3. **验证结果**
   - 登录成功后，检查账号管理页面
   - 应该显示真实用户名 `Ai来了` 而不是 `抖音号_1766159145791`

## 预期结果

修复后的数据流程：

```
用户登录 
  → AccountService.loginWithBrowser()
    → 打开浏览器，用户完成登录
    → AccountService.extractUserInfo()
      → 使用正确的选择器 `.name-_lSSDc`
      → ✅ 成功提取到 "Ai来了"
    → 生成账号名：`Ai来了`
    → 保存到数据库
```

## 技术细节

### 选择器来源

正确的选择器来自保存的HTML快照：
- 文件：`server/debug/douyin_1766158698174.html`
- 元素：`<div class="name-_lSSDc">Ai来了</div>`

### 选择器优先级

1. `.name-_lSSDc` - 最精确的选择器
2. `.container-vEyGlK .content-fFY6HC .header-_F2uzl .left-zEzdJX .name-_lSSDc` - 完整路径
3. `[class*="name-"]` - 宽泛匹配
4. `.header-_F2uzl .name-_lSSDc` - 基于父容器
5. 通用选择器 - 作为后备方案

## 相关文件

- `server/src/services/AccountService.ts` - 修改了 extractUserInfo 方法
- `server/src/services/adapters/DouyinAdapter.ts` - 包含正确的选择器实现
- `server/debug/douyin_1766158698174.html` - HTML快照，包含用户名元素
- `.kiro/specs/douyin-username-extraction/requirements.md` - 需求文档

## 注意事项

1. **抖音页面结构可能变化**
   - 如果抖音更新页面结构，选择器可能失效
   - 建议定期检查和更新选择器

2. **多个选择器策略**
   - 使用多个选择器作为后备
   - 按优先级依次尝试
   - 提高提取成功率

3. **日志输出**
   - `extractUserInfo` 方法会输出详细日志
   - 可以通过日志查看选择器尝试过程
   - 便于调试和维护
