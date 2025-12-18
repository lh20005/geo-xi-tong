# 抖音AI声明修复 - 立即执行指南

## 问题确认

✅ 你的分析完全正确！

**问题原因**:
1. 等待时间太短（3秒不够）
2. 选择器不够精确

**你提供的精确选择器**:
- AI选项: `body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-inner-wrap > div > div.semi-sidesheet-body > section > div > div:nth-child(3) > label`
- 确定按钮: `body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-inner-wrap > div > div.semi-sidesheet-body > footer > button.semi-button.semi-button-primary.btn-I78nOi`

## 修复方案

### 关键改进

1. **等待时间**: 3秒 → 8秒（侧滑页加载）
2. **选项点击后等待**: 1秒 → 3秒（确保选中）
3. **确定按钮点击后等待**: 1秒 → 5秒（确保侧滑页关闭）
4. **使用精确选择器**: 你提供的选择器 + XPath备用方案

## 手动修复步骤

### 步骤1: 打开文件

打开文件: `server/src/services/adapters/DouyinAdapter.ts`

### 步骤2: 找到修改位置

使用 `Ctrl+F` 查找: `等待侧边栏弹出`

应该在第436行左右

### 步骤3: 修改等待时间（已完成✅）

**原代码**:
```typescript
console.log('[抖音号] ⏳ 等待侧边栏弹出（3秒）...');
await new Promise(resolve => setTimeout(resolve, 3000));
console.log('[抖音号] ✅ 侧边栏应该已弹出');
```

**新代码**:
```typescript
console.log('[抖音号] ⏳ 等待侧滑页弹出和完全加载（8秒）...');
await new Promise(resolve => setTimeout(resolve, 8000));
console.log('[抖音号] ✅ 侧滑页应该已完全加载');
```

✅ **这一步已自动完成**

### 步骤4: 修改AI选项查找和点击

**查找**: `// 点击"内容由AI生成"选项`

**原代码** (约第448-483行):
```typescript
// 点击"内容由AI生成"选项 - 使用XPath精确查找
console.log('[抖音号] 🔍 查找"内容由AI生成"选项...');

// 获取所有元素，查找包含"内容由AI生成"的元素
const allElements = await page.$('*');
let aiElement = null;

for (const element of allElements) {
  const text = await page.evaluate(el => el.textContent?.trim(), element);
  if (text && text.includes('内容由AI生成')) {
    const isVisible = await page.evaluate(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             rect.width > 0 && 
             rect.height > 0;
    }, element);
    
    if (isVisible) {
      aiElement = element;
      console.log(`[抖音号] ✅ 找到"内容由AI生成"选项: "${text}"`);
      break;
    }
  }
}

if (aiElement) {
  console.log('[抖音号] 🖱️  点击"内容由AI生成"选项...');
  await aiElement.click();
  console.log('[抖音号] ⏳ 等待选项选中（1秒）...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('[抖音号] ✅ 选项应该已选中');
} else {
  throw new Error('未找到"内容由AI生成"选项');
}
```

**替换为** (复制 `抖音AI声明修复-精确选择器版本.ts` 文件中第24-107行的代码):

```typescript
// 使用用户提供的精确选择器点击"内容由AI生成"选项
console.log('[抖音号] 🔍 查找"内容由AI生成"选项...');

// 用户提供的精确选择器
const aiOptionSelector = 'body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-inner-wrap > div > div.semi-sidesheet-body > section > div > div:nth-child(3) > label';

console.log(`[抖音号] 使用精确选择器: ${aiOptionSelector.substring(0, 80)}...`);
console.log('[抖音号] ⏳ 等待"内容由AI生成"选项出现（10秒）...');

try {
  await page.waitForSelector(aiOptionSelector, { visible: true, timeout: 10000 });
  console.log('[抖音号] ✅ 找到"内容由AI生成"选项');
  
  // 获取元素信息用于调试
  const optionInfo = await page.$eval(aiOptionSelector, el => {
    const rect = el.getBoundingClientRect();
    return {
      text: el.textContent?.trim(),
      visible: rect.width > 0 && rect.height > 0,
      x: rect.x,
      y: rect.y
    };
  });
  console.log('[抖音号] 选项信息:', JSON.stringify(optionInfo, null, 2));
  
  console.log('[抖音号] 🖱️  点击"内容由AI生成"选项...');
  await page.click(aiOptionSelector);
  console.log('[抖音号] ✅ 已点击选项');
  
  // 关键修复：增加等待时间，确保选项选中后再继续
  console.log('[抖音号] ⏳ 等待选项选中状态更新（3秒）...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('[抖音号] ✅ 选项应该已选中');
  
} catch (error: any) {
  console.log('[抖音号] ⚠️ 精确选择器失败，尝试备用方案...');
  console.log('[抖音号] 错误信息:', error.message);
  
  // 备用方案：使用XPath查找
  const aiOptionXPath = "//*[contains(text(), '内容由AI生成')]";
  console.log(`[抖音号] 备用XPath: ${aiOptionXPath}`);
  
  try {
    await page.waitForXPath(aiOptionXPath, { visible: true, timeout: 5000 });
    const aiElements = await page.$x(aiOptionXPath);
    console.log(`[抖音号] 找到 ${aiElements.length} 个包含"内容由AI生成"的元素`);
    
    for (let i = 0; i < aiElements.length; i++) {
      const element = aiElements[i];
      const elementInfo = await page.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          text: el.textContent?.trim(),
          visible: style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  rect.width > 0 && 
                  rect.height > 0
        };
      }, element);
      
      console.log(`[抖音号] 元素 [${i}]:`, JSON.stringify(elementInfo, null, 2));
      
      if (elementInfo.visible) {
        console.log('[抖音号] ✅ 找到可见元素，正在点击...');
        await element.click();
        console.log('[抖音号] ⏳ 等待选项选中（3秒）...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        break;
      }
    }
  } catch (xpathError: any) {
    console.log('[抖音号] ❌ 备用方案也失败:', xpathError.message);
    throw new Error('所有方法都未能找到"内容由AI生成"选项');
  }
}

// 截图保存选中状态
try {
  await page.screenshot({ path: 'douyin-declaration-selected.png', fullPage: true });
  console.log('[抖音号] 📸 已保存选中状态截图到: douyin-declaration-selected.png');
} catch (e) {
  console.log('[抖音号] 截图失败:', e);
}
```

### 步骤5: 修改确定按钮点击

**查找**: `// 点击确定按钮`

**原代码** (约第485-497行):
```typescript
// 点击确定按钮
const confirmButton = '.semi-sidesheet-body > footer > button.semi-button-primary';
console.log(`[抖音号] 确定按钮选择器（简化）: ${confirmButton}`);
console.log('[抖音号] ⏳ 等待"确定"按钮出现（5秒）...');
await page.waitForSelector(confirmButton, { timeout: 5000 });
console.log('[抖音号] ✅ 找到"确定"按钮');

console.log('[抖音号] 🖱️  点击"确定"按钮...');
await page.click(confirmButton);
console.log('[抖音号] ⏳ 等待侧边栏关闭（1秒）...');
await new Promise(resolve => setTimeout(resolve, 1000));
console.log('[抖音号] ✅ 自主声明已添加');
```

**替换为** (复制 `抖音AI声明修复-精确选择器版本.ts` 文件中第109-177行的代码):

```typescript
// 使用用户提供的精确选择器点击确定按钮
console.log('[抖音号] 🔍 查找"确定"按钮...');

// 用户提供的精确选择器
const confirmButtonSelector = 'body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-inner-wrap > div > div.semi-sidesheet-body > footer > button.semi-button.semi-button-primary.btn-I78nOi';

console.log(`[抖音号] 使用精确选择器: ${confirmButtonSelector.substring(0, 80)}...`);
console.log('[抖音号] ⏳ 等待"确定"按钮出现（10秒）...');

try {
  await page.waitForSelector(confirmButtonSelector, { visible: true, timeout: 10000 });
  console.log('[抖音号] ✅ 找到"确定"按钮');
  
  // 获取按钮信息
  const buttonInfo = await page.$eval(confirmButtonSelector, el => {
    return {
      text: el.textContent?.trim(),
      enabled: !(el as HTMLButtonElement).disabled
    };
  });
  console.log('[抖音号] 按钮信息:', JSON.stringify(buttonInfo, null, 2));
  
  console.log('[抖音号] 🖱️  点击"确定"按钮...');
  await page.click(confirmButtonSelector);
  console.log('[抖音号] ✅ 已点击确定按钮');
  
} catch (error: any) {
  console.log('[抖音号] ⚠️ 精确选择器失败，尝试备用方案...');
  console.log('[抖音号] 错误信息:', error.message);
  
  // 备用方案：使用简化的选择器
  const fallbackSelectors = [
    '.semi-sidesheet-body > footer > button.semi-button-primary',
    'footer button.semi-button-primary',
    'button.semi-button-primary'
  ];
  
  let confirmClicked = false;
  
  for (const selector of fallbackSelectors) {
    try {
      console.log(`[抖音号] 尝试备用选择器: ${selector}`);
      await page.waitForSelector(selector, { visible: true, timeout: 3000 });
      
      const buttonText = await page.$eval(selector, el => el.textContent?.trim());
      console.log(`[抖音号] 找到按钮: "${buttonText}"`);
      
      if (buttonText === '确定' || buttonText === '确认') {
        await page.click(selector);
        confirmClicked = true;
        console.log('[抖音号] ✅ 已点击确定按钮（备用方案）');
        break;
      }
    } catch (e: any) {
      console.log(`[抖音号] 选择器 ${selector} 失败:`, e.message);
      continue;
    }
  }
  
  if (!confirmClicked) {
    console.log('[抖音号] ⚠️ 所有备用方案都失败，尝试XPath...');
    const confirmXPath = "//button[contains(text(), '确定') or contains(text(), '确认')]";
    try {
      await page.waitForXPath(confirmXPath, { visible: true, timeout: 5000 });
      const confirmButtons = await page.$x(confirmXPath);
      if (confirmButtons.length > 0) {
        await confirmButtons[0].click();
        console.log('[抖音号] ✅ 已点击确定按钮（XPath方案）');
      }
    } catch (xpathError: any) {
      console.log('[抖音号] ❌ XPath方案也失败:', xpathError.message);
    }
  }
}

// 关键修复：增加等待时间，确保侧滑页完全关闭
console.log('[抖音号] ⏳ 等待侧滑页关闭（5秒）...');
await new Promise(resolve => setTimeout(resolve, 5000));
console.log('[抖音号] ✅ 侧滑页应该已关闭，自主声明添加完成');
```

## 修复后重启服务

```bash
# 停止服务
Ctrl + C

# 重新启动
npm run dev
```

## 测试验证

### 1. 创建抖音发布任务

```bash
1. 打开浏览器: http://localhost:3000
2. 进入"发布任务"页面
3. 创建新的抖音发布任务
4. 选择文章
5. 点击"执行发布"
```

### 2. 观察日志输出

应该看到类似的日志：

```
[抖音号] 🖱️  点击"添加自主声明"按钮...
[抖音号] ⏳ 等待侧滑页弹出和完全加载（8秒）...
[抖音号] ✅ 侧滑页应该已完全加载
[抖音号] 📸 已保存侧边栏截图到: douyin-declaration-sidebar.png
[抖音号] 🔍 查找"内容由AI生成"选项...
[抖音号] 使用精确选择器: body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-...
[抖音号] ⏳ 等待"内容由AI生成"选项出现（10秒）...
[抖音号] ✅ 找到"内容由AI生成"选项
[抖音号] 选项信息: {"text":"内容由AI生成","visible":true,"x":1200,"y":300}
[抖音号] 🖱️  点击"内容由AI生成"选项...
[抖音号] ✅ 已点击选项
[抖音号] ⏳ 等待选项选中状态更新（3秒）...
[抖音号] ✅ 选项应该已选中
[抖音号] 📸 已保存选中状态截图到: douyin-declaration-selected.png
[抖音号] 🔍 查找"确定"按钮...
[抖音号] 使用精确选择器: body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-...
[抖音号] ⏳ 等待"确定"按钮出现（10秒）...
[抖音号] ✅ 找到"确定"按钮
[抖音号] 按钮信息: {"text":"确定","enabled":true}
[抖音号] 🖱️  点击"确定"按钮...
[抖音号] ✅ 已点击确定按钮
[抖音号] ⏳ 等待侧滑页关闭（5秒）...
[抖音号] ✅ 侧滑页应该已关闭，自主声明添加完成
```

### 3. 查看截图

检查生成的截图文件：
- `douyin-declaration-sidebar.png` - 侧滑页弹出状态
- `douyin-declaration-selected.png` - 选项选中状态

## 关键改进总结

| 项目 | 修改前 | 修改后 | 原因 |
|------|--------|--------|------|
| 侧滑页等待时间 | 3秒 | 8秒 | 侧滑页动画+内容加载需要更多时间 |
| AI选项查找方式 | 遍历所有元素 | 精确选择器+XPath备用 | 更快更可靠 |
| 选项点击后等待 | 1秒 | 3秒 | 确保选中状态更新 |
| 确定按钮查找 | 简化选择器 | 精确选择器+多种备用 | 更可靠 |
| 侧滑页关闭等待 | 1秒 | 5秒 | 确保完全关闭再继续 |

## 如果仍然失败

### 检查选择器是否变化

抖音页面可能更新，导致选择器变化。如果失败：

1. 查看截图 `douyin-declaration-sidebar.png`
2. 使用浏览器开发者工具检查元素
3. 更新选择器中的 `div:nth-child(26)` 数字
4. 可能需要改为 `div:nth-child(27)` 或其他数字

### 增加等待时间

如果网络慢，可以进一步增加等待时间：
- 侧滑页加载: 8秒 → 10秒
- 选项选中: 3秒 → 5秒
- 侧滑页关闭: 5秒 → 8秒

---

**现在就执行**: 按照步骤4和步骤5手动修改代码，然后重启服务测试！
