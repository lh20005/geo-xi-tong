# 🔧 Playwright 录制"保存失败"问题解决方案

## 问题描述

使用 `npx playwright codegen` 录制时，总是弹出"保存失败"提示。

---

## 原因分析

Playwright Inspector 默认会尝试保存录制的脚本到文件，但可能遇到：
1. 没有指定保存路径
2. 没有写入权限
3. 路径不存在

---

## ✅ 解决方案

### 方案 1：指定输出文件（推荐）

```bash
# 保存到指定文件
npx playwright codegen --target=javascript -o recorded-script.js https://mp.toutiao.com
```

参数说明：
- `--target=javascript` - 生成 JavaScript 代码
- `-o recorded-script.js` - 输出到指定文件
- 也可以使用 `--target=typescript` 生成 TypeScript 代码

### 方案 2：只录制不保存（最简单）

```bash
# 不保存文件，只在 Inspector 中查看和复制代码
npx playwright codegen https://mp.toutiao.com
```

**使用方法：**
1. 在浏览器中操作
2. 在 Inspector 中查看生成的代码
3. 手动复制代码（不要点击保存按钮）
4. 粘贴到你的适配器中

### 方案 3：保存到项目目录

```bash
# 在项目根目录创建 scripts 目录
mkdir -p playwright-recordings

# 保存到该目录
npx playwright codegen -o playwright-recordings/toutiao-publish.js https://mp.toutiao.com
```

### 方案 4：使用 TypeScript 格式

```bash
# 生成 TypeScript 代码
npx playwright codegen --target=typescript -o recorded-script.ts https://mp.toutiao.com
```

---

## 🎯 推荐工作流程

### 步骤 1：录制（不保存文件）

```bash
npx playwright codegen https://mp.toutiao.com
```

### 步骤 2：在浏览器中操作

- 登录
- 发布文章
- 填写表单
- 等等...

### 步骤 3：从 Inspector 复制代码

在 Playwright Inspector 窗口中：
1. 查看生成的代码
2. 选中所有代码（Cmd+A）
3. 复制（Cmd+C）
4. **不要点击保存按钮**

### 步骤 4：粘贴到适配器

```typescript
// server/src/services/adapters/ToutiaoAdapter.ts
async performPublish(page: Page, article: any, config: any): Promise<boolean> {
  try {
    // 粘贴从 Inspector 复制的代码
    await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish');
    await page.getByPlaceholder('请输入文章标题').fill(article.title);
    await page.locator('.editor').fill(article.content);
    await page.getByRole('button', { name: '发布' }).click();
    
    return true;
  } catch (error: any) {
    await this.log('error', '发布失败', { error: error.message });
    return false;
  }
}
```

---

## 💡 最佳实践

### 1. 不依赖自动保存

**推荐做法：**
- ✅ 手动从 Inspector 复制代码
- ✅ 粘贴到适配器中
- ✅ 手动优化和调整

**不推荐：**
- ❌ 依赖 Inspector 的保存功能
- ❌ 保存到临时文件再复制

### 2. 录制时的注意事项

```bash
# 简单录制命令
npx playwright codegen https://mp.toutiao.com

# 在 Inspector 中：
# 1. 观察生成的代码
# 2. 手动复制（Cmd+A, Cmd+C）
# 3. 关闭窗口
# 4. 粘贴到代码编辑器
```

### 3. 如果确实需要保存文件

```bash
# 创建录制目录
mkdir -p playwright-recordings

# 录制并保存
npx playwright codegen \
  --target=typescript \
  -o playwright-recordings/$(date +%Y%m%d-%H%M%S)-recording.ts \
  https://mp.toutiao.com
```

---

## 🔍 调试保存问题

如果仍然遇到保存问题，检查以下内容：

### 1. 检查当前目录权限

```bash
# 查看当前目录权限
ls -la

# 确保有写入权限
chmod u+w .
```

### 2. 指定绝对路径

```bash
# 使用绝对路径
npx playwright codegen -o ~/Desktop/recorded-script.js https://mp.toutiao.com
```

### 3. 检查磁盘空间

```bash
# 查看磁盘空间
df -h
```

---

## 📋 快速命令参考

```bash
# 1. 最简单：只录制不保存
npx playwright codegen https://mp.toutiao.com

# 2. 保存到当前目录
npx playwright codegen -o script.js https://mp.toutiao.com

# 3. 保存 TypeScript 格式
npx playwright codegen --target=typescript -o script.ts https://mp.toutiao.com

# 4. 保存到指定目录
npx playwright codegen -o ~/Desktop/script.js https://mp.toutiao.com

# 5. 使用已保存的登录状态
npx playwright codegen --load-storage=auth.json https://mp.toutiao.com
```

---

## 🎯 实际使用示例

### 录制头条号发布流程

```bash
# 1. 启动录制（不保存）
npx playwright codegen https://mp.toutiao.com

# 2. 在浏览器中操作：
#    - 登录
#    - 点击"发布文章"
#    - 填写标题和内容
#    - 点击"发布"

# 3. 从 Inspector 复制代码（Cmd+A, Cmd+C）

# 4. 粘贴到适配器文件
```

生成的代码示例：
```typescript
await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish');
await page.getByPlaceholder('请输入文章标题').click();
await page.getByPlaceholder('请输入文章标题').fill('测试标题');
await page.locator('.ProseMirror').click();
await page.locator('.ProseMirror').fill('测试内容');
await page.getByRole('button', { name: '发布' }).click();
```

---

## ✅ 总结

### 推荐方案（最简单）

1. **运行录制命令：**
   ```bash
   npx playwright codegen https://mp.toutiao.com
   ```

2. **在浏览器中操作**

3. **从 Inspector 手动复制代码**
   - 不要点击保存按钮
   - 直接 Cmd+A, Cmd+C 复制

4. **粘贴到适配器中使用**

### 为什么推荐这种方式？

- ✅ 不依赖文件保存功能
- ✅ 避免权限问题
- ✅ 可以立即使用代码
- ✅ 更灵活，可以边录制边调整

---

## 🚀 现在开始

试试这个命令：

```bash
npx playwright codegen https://mp.toutiao.com
```

**记住：**
- 在 Inspector 中查看代码
- 手动复制（不要点保存）
- 粘贴到你的适配器中

就这么简单！🎉
