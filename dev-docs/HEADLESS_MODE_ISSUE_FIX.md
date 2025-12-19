# 静默模式发布问题诊断与修复

## 问题描述

在静默模式下发布头条平台的定时任务时出现以下问题：

1. **第一个任务卡住**：日志显示"内容编辑器已激活"后没有继续
2. **第二个任务发布成功但状态不同步**：实际发布成功，但任务列表显示"等待状态"
3. **可视化模式正常**：打开浏览器窗口时发布成功

## 根本原因分析

### 1. 浏览器实例冲突

**问题**：`BrowserAutomationService` 使用单例模式，所有任务共享同一个浏览器实例。

```typescript
// BrowserAutomationService.ts
export class BrowserAutomationService {
  private browser: Browser | null = null;  // ❌ 单例，多任务冲突
  
  async launchBrowser(options?: BrowserOptions): Promise<Browser> {
    this.browser = await puppeteer.launch(launchOptions);  // ❌ 覆盖之前的实例
    return this.browser;
  }
}
```

**影响**：
- 第一个任务启动浏览器后，第二个任务调用 `launchBrowser` 会覆盖 `this.browser`
- 第一个任务的页面引用失效，导致操作失败
- 第二个任务可能复用第一个任务的浏览器状态

### 2. page.evaluate() 在静默模式下超时

**问题**：`page.evaluate()` 在静默模式下可能执行时间过长或阻塞。

```typescript
// ToutiaoAdapter.ts (修复前)
const setContentSuccess = await page.evaluate((text) => {
  const editor = document.querySelector('.ProseMirror');
  editor.innerHTML = html;  // ❌ 可能在静默模式下卡住
  return true;
}, textOnly);
```

**影响**：
- 静默模式下，DOM操作可能不会立即触发渲染
- 长文本处理可能导致超时
- 没有超时保护，导致任务永久卡住

### 3. 浏览器关闭时机不当

**问题**：浏览器关闭延迟30秒，导致多任务执行时资源冲突。

```typescript
// PublishingExecutor.ts (修复前)
private closeBrowserAsync(page: any, taskId: number): void {
  setTimeout(async () => {
    await new Promise(resolve => setTimeout(resolve, 30000));  // ❌ 延迟太长
    await browserAutomationService.closeBrowser();
  }, 0);
}
```

**影响**：
- 第一个任务完成后，浏览器30秒后才关闭
- 第二个任务在这期间启动，导致浏览器实例冲突
- 页面资源没有及时释放

### 4. 状态更新时机问题

**问题**：任务状态更新在 `finally` 块之前，但浏览器关闭是异步的。

```typescript
// PublishingExecutor.ts
try {
  // 执行发布
  await publishingService.updateTaskStatus(taskId, 'success');  // ✅ 状态已更新
} finally {
  this.closeBrowserAsync(page, taskId);  // ❌ 异步关闭，不等待
}
```

**影响**：
- 任务状态显示"成功"，但浏览器还在运行
- 下一个任务可能在浏览器未完全关闭时启动
- 导致状态不同步

## 修复方案

### 修复1：添加 page.evaluate() 超时保护

```typescript
// ToutiaoAdapter.ts (修复后)
let setContentSuccess = false;
try {
  // 设置5秒超时
  const evaluatePromise = page.evaluate((text) => {
    const editor = document.querySelector('.ProseMirror');
    if (editor) {
      const paragraphs = text.split('\n').filter(p => p.trim());
      const html = paragraphs.map(p => `<p>${p}</p>`).join('');
      editor.innerHTML = html;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }, textOnly);
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('evaluate超时')), 5000)
  );
  
  setContentSuccess = await Promise.race([evaluatePromise, timeoutPromise]) as boolean;
} catch (error: any) {
  console.log(`[头条号] ⚠️ evaluate方法失败或超时: ${error.message}`);
  setContentSuccess = false;
}

if (!setContentSuccess) {
  // 备用方案：分批使用keyboard.type
  const batchSize = 500;
  for (let i = 0; i < textOnly.length; i += batchSize) {
    const batch = textOnly.substring(i, Math.min(i + batchSize, textOnly.length));
    await page.keyboard.type(batch, { delay: 20 });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

**优点**：
- 添加5秒超时保护，避免永久卡住
- 提供备用方案（keyboard.type），确保内容能够输入
- 分批输入，避免一次性输入过多导致卡顿

### 修复2：优化浏览器关闭时机

```typescript
// PublishingExecutor.ts (修复后)
private closeBrowserAsync(page: any, taskId: number): void {
  setTimeout(async () => {
    try {
      // 立即关闭页面，释放资源
      if (page) {
        console.log(`🔄 [任务 #${taskId}] 立即关闭页面...`);
        await browserAutomationService.closePage(page);
        console.log(`✅ [任务 #${taskId}] 页面已关闭`);
      }
      
      // 延迟关闭浏览器（缩短到10秒）
      console.log(`⏳ [任务 #${taskId}] 等待10秒后关闭浏览器...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      await browserAutomationService.closeBrowser();
      console.log(`✅ [任务 #${taskId}] 浏览器已关闭`);
    } catch (error) {
      console.error(`❌ [任务 #${taskId}] 关闭浏览器失败:`, error);
    }
  }, 0);
}
```

**优点**：
- 立即关闭页面，释放资源
- 缩短浏览器关闭延迟（30秒 → 10秒）
- 减少多任务冲突的可能性

### 修复3：优化标题输入（兼容静默模式）

```typescript
// ToutiaoAdapter.ts (修复后)
await this.log('info', '💡 使用evaluate方法设置标题（兼容静默模式）');

const titleSetSuccess = await page.evaluate((el, val) => {
  try {
    (el as HTMLTextAreaElement).value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  } catch (e) {
    return false;
  }
}, titleInput, title);

if (!titleSetSuccess) {
  // 备用方案：使用keyboard.type
  await this.log('warning', '⚠️ evaluate方法失败，使用keyboard.type');
  await page.keyboard.type(title, { delay: 80 });
}
```

**优点**：
- 优先使用 `evaluate` 方法，兼容静默模式
- 触发所有必要的事件（input, change, blur）
- 提供备用方案，确保标题能够输入

## 长期解决方案

### 方案1：每个任务使用独立的浏览器实例

**实现**：
```typescript
export class BrowserAutomationService {
  private browsers: Map<string, Browser> = new Map();
  
  async launchBrowser(taskId: string, options?: BrowserOptions): Promise<Browser> {
    const browser = await puppeteer.launch(launchOptions);
    this.browsers.set(taskId, browser);
    return browser;
  }
  
  async closeBrowser(taskId: string): Promise<void> {
    const browser = this.browsers.get(taskId);
    if (browser) {
      await browser.close();
      this.browsers.delete(taskId);
    }
  }
}
```

**优点**：
- 完全隔离，避免任务间冲突
- 可以并行执行多个任务

**缺点**：
- 资源占用更多
- 需要修改较多代码

### 方案2：使用浏览器上下文（Browser Context）

**实现**：
```typescript
export class BrowserAutomationService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  
  async createContext(taskId: string): Promise<BrowserContext> {
    if (!this.browser) {
      await this.launchBrowser();
    }
    const context = await this.browser!.createIncognitoBrowserContext();
    this.contexts.set(taskId, context);
    return context;
  }
  
  async closeContext(taskId: string): Promise<void> {
    const context = this.contexts.get(taskId);
    if (context) {
      await context.close();
      this.contexts.delete(taskId);
    }
  }
}
```

**优点**：
- 共享浏览器实例，节省资源
- 每个任务有独立的上下文，避免冲突
- 可以并行执行多个任务

**缺点**：
- 需要修改代码以使用上下文而不是浏览器实例

## 测试验证

### 测试场景1：静默模式单任务

1. 创建一个发布任务
2. 选择静默模式
3. 验证任务能够正常完成
4. 检查日志是否有"evaluate超时"警告

### 测试场景2：静默模式批量任务

1. 创建3个发布任务（批次）
2. 设置发布间隔为1分钟
3. 选择静默模式
4. 验证所有任务按顺序执行
5. 检查任务状态是否正确同步

### 测试场景3：可视化模式验证

1. 创建一个发布任务
2. 选择可视化模式
3. 验证浏览器窗口显示
4. 验证任务能够正常完成

### 测试场景4：混合模式

1. 创建第一个任务（静默模式）
2. 等待第一个任务开始执行
3. 创建第二个任务（可视化模式）
4. 验证两个任务都能正常完成
5. 检查是否有浏览器实例冲突

## 监控指标

### 关键日志

1. **浏览器启动**：
   ```
   🚀 启动浏览器（静默模式）...
   ✅ 浏览器启动成功
   ```

2. **内容输入**：
   ```
   ⌨️  开始输入所有文字...
   💡 使用evaluate方法直接设置内容（兼容静默模式）
   ✅ 所有文字输入完成（evaluate方法）
   ```
   或
   ```
   ⚠️ evaluate方法失败或超时: evaluate超时
   🔄 使用keyboard.type备用方案
   ✅ 所有文字输入完成（keyboard方法）
   ```

3. **浏览器关闭**：
   ```
   🔄 [任务 #123] 立即关闭页面...
   ✅ [任务 #123] 页面已关闭
   ⏳ [任务 #123] 等待10秒后关闭浏览器...
   ✅ [任务 #123] 浏览器已关闭
   ```

### 性能指标

- **任务执行时间**：静默模式应该比可视化模式快10-20%
- **内存占用**：单个浏览器实例约200-300MB
- **CPU占用**：静默模式下CPU占用应该更低

## 已知限制

1. **单浏览器实例**：当前仍使用单浏览器实例，多任务并行执行可能有冲突
2. **超时时间固定**：`evaluate` 超时时间固定为5秒，可能需要根据内容长度调整
3. **备用方案性能**：`keyboard.type` 备用方案较慢，长文本输入可能需要较长时间

## 后续优化建议

1. **实现浏览器上下文隔离**：使用 `BrowserContext` 实现任务隔离
2. **动态超时时间**：根据内容长度动态调整 `evaluate` 超时时间
3. **并行任务支持**：支持多个任务并行执行（需要浏览器上下文隔离）
4. **错误重试机制**：对 `evaluate` 失败的情况增加重试机制
5. **性能监控**：添加详细的性能监控指标

## 修改文件清单

1. **server/src/services/adapters/ToutiaoAdapter.ts**
   - 添加 `page.evaluate()` 超时保护
   - 优化标题输入方法
   - 添加分批输入备用方案

2. **server/src/services/PublishingExecutor.ts**
   - 优化浏览器关闭时机
   - 立即关闭页面，延迟关闭浏览器
   - 缩短延迟时间（30秒 → 10秒）

## 总结

通过以上修复，解决了静默模式下的主要问题：

1. ✅ 添加超时保护，避免任务永久卡住
2. ✅ 提供备用方案，确保内容能够输入
3. ✅ 优化浏览器关闭时机，减少多任务冲突
4. ✅ 兼容静默模式和可视化模式

但仍需注意：
- ⚠️ 多任务并行执行可能仍有冲突（需要实现浏览器上下文隔离）
- ⚠️ 备用方案性能较低（需要优化）
- ⚠️ 需要持续监控和优化
