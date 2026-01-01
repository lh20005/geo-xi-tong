# Playwright 迁移完整方案

## 🎯 目标

将系统从 Puppeteer 迁移到 Playwright，并使用发现的脚本中的选择器更新所有平台适配器。

## ⚠️ 重要说明

发现的脚本（`~/Downloads/geo/resources/app-extracted/src/api/script/`）是 **Electron IPC 注入脚本**，不能直接使用，但可以提取：
1. ✅ **选择器**（最有价值）
2. ✅ **登录检测逻辑**
3. ✅ **数据提取方式**

## 📋 迁移步骤

### 阶段 1：准备工作（1-2小时）

#### 1.1 复制参考脚本
```bash
# 复制到项目中作为参考
mkdir -p reference-scripts
cp -r ~/Downloads/geo/resources/app-extracted/src/api/script/ reference-scripts/electron-scripts/
```

#### 1.2 安装 Playwright
```bash
cd server
npm uninstall puppeteer
npm install playwright
npx playwright install chromium
```

#### 1.3 备份现有代码
```bash
git checkout -b backup-before-playwright-migration
git add .
git commit -m "备份：迁移到 Playwright 之前"
```

### 阶段 2：核心服务迁移（2-3小时）

#### 2.1 更新 BrowserAutomationService
```typescript
// server/src/services/BrowserAutomationService.ts
// 从 Puppeteer 改成 Playwright
import { chromium, Browser, Page, BrowserContext } from 'playwright';

export class BrowserAutomationService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launchBrowser(options?: any): Promise<Browser> {
    this.browser = await chromium.launch({
      headless: options?.headless ?? true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0...'
    });
    
    return this.browser;
  }

  async createPage(): Promise<Page> {
    if (!this.context) {
      await this.launchBrowser();
    }
    return await this.context!.newPage();
  }
}
```

#### 2.2 更新 AccountService
```typescript
// server/src/services/AccountService.ts
// 替换 Puppeteer 导入
import { Page } from 'playwright';
```

### 阶段 3：平台适配器迁移（主要工作量）

#### 3.1 创建选择器提取工具

```bash
# 创建工具脚本
cat > scripts/extract-selectors.js << 'EOF'
const fs = require('fs');
const path = require('path');

// 从 Electron 脚本中提取选择器
function extractSelectors(scriptPath) {
  const content = fs.readFileSync(scriptPath, 'utf-8');
  
  // 提取 querySelector 和 querySelectorAll
  const selectorRegex = /document\.querySelector(?:All)?\(['"]([^'"]+)['"]\)/g;
  const selectors = [];
  
  let match;
  while ((match = selectorRegex.exec(content)) !== null) {
    selectors.push(match[1]);
  }
  
  return [...new Set(selectors)]; // 去重
}

// 处理所有脚本
const scriptsDir = path.join(__dirname, '../reference-scripts/electron-scripts');
const files = fs.readdirSync(scriptsDir);

const result = {};
files.forEach(file => {
  if (file.endsWith('.js')) {
    const platform = file.replace('.js', '');
    const scriptPath = path.join(scriptsDir, file);
    result[platform] = extractSelectors(scriptPath);
  }
});

console.log(JSON.stringify(result, null, 2));
fs.writeFileSync('extracted-selectors.json', JSON.stringify(result, null, 2));
EOF

node scripts/extract-selectors.js
```

#### 3.2 平台适配器迁移模板

**Puppeteer → Playwright API 对照表**：

| Puppeteer | Playwright |
|-----------|------------|
| `page.waitForSelector(selector)` | `page.locator(selector).waitFor()` |
| `page.$(selector)` | `page.locator(selector)` |
| `page.$$(selector)` | `page.locator(selector).all()` |
| `page.type(selector, text)` | `page.locator(selector).fill(text)` |
| `page.click(selector)` | `page.locator(selector).click()` |
| `page.evaluate(fn)` | `page.evaluate(fn)` ✅ 相同 |
| `page.waitForNavigation()` | `page.waitForLoadState('networkidle')` |
| `page.cookies()` | `context.cookies()` |
| `page.setCookie()` | `context.addCookies()` |

### 阶段 4：逐个平台迁移

#### 优先级排序

**第一批（核心平台）**：
1. 头条号 (tt.js) - 使用最多
2. 小红书 (xhs.js) - 重要平台
3. 微信公众号 (wxgzh.js) - 重要平台

**第二批（常用平台）**：
4. B站 (bili.js)
5. 知乎 (zh.js)
6. 简书 (sh.js)

**第三批（其他平台）**：
7-13. 其他平台

#### 4.1 头条号迁移示例

```typescript
// server/src/services/adapters/ToutiaoAdapter.ts
import { Page } from 'playwright';
import { PlatformAdapter } from './PlatformAdapter';

export class ToutiaoAdapter extends PlatformAdapter {
  async checkLogin(page: Page): Promise<boolean> {
    try {
      // 从 tt.js 提取的选择器
      const nameElement = await page.locator('.auth-avator-name').first();
      return await nameElement.isVisible();
    } catch {
      return false;
    }
  }

  async login(page: Page, credentials: any): Promise<any> {
    await page.goto('https://mp.toutiao.com');
    
    // 等待登录（扫码或账号密码）
    await page.locator('.auth-avator-name').waitFor({ timeout: 60000 });
    
    // 提取用户信息（从 tt.js 提取的逻辑）
    const name = await page.locator('.auth-avator-name').textContent();
    const avatar = await page.locator('.auth-avator-img').getAttribute('src');
    const followerCount = await page.locator('.data-board-item-primary').textContent();
    
    // 获取 cookies
    const cookies = await page.context().cookies();
    
    return {
      name,
      avatar,
      follower_count: followerCount,
      cookies: JSON.stringify(cookies)
    };
  }

  async publish(page: Page, article: any): Promise<void> {
    // 发布逻辑
    await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish');
    
    // 填写标题
    await page.locator('input[placeholder*="标题"]').fill(article.title);
    
    // 填写内容
    await page.locator('.ql-editor').fill(article.content);
    
    // 点击发布
    await page.locator('button:has-text("发布")').click();
  }
}
```

### 阶段 5：测试和验证

#### 5.1 创建测试脚本

```bash
cat > scripts/test-playwright-adapter.ts << 'EOF'
import { chromium } from 'playwright';
import { ToutiaoAdapter } from '../server/src/services/adapters/ToutiaoAdapter';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const adapter = new ToutiaoAdapter();
  
  console.log('测试登录检测...');
  const isLoggedIn = await adapter.checkLogin(page);
  console.log('登录状态:', isLoggedIn);
  
  if (!isLoggedIn) {
    console.log('开始登录...');
    const result = await adapter.login(page, {});
    console.log('登录结果:', result);
  }
  
  await browser.close();
}

test();
EOF

npx ts-node scripts/test-playwright-adapter.ts
```

## 📊 工作量估算

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 准备工作 | 1-2 小时 |
| 2 | 核心服务迁移 | 2-3 小时 |
| 3 | 第一批平台（3个） | 6-9 小时 |
| 4 | 第二批平台（3个） | 4-6 小时 |
| 5 | 第三批平台（7个） | 7-10 小时 |
| 6 | 测试和修复 | 5-8 小时 |
| **总计** | | **25-38 小时** |

## 🚀 快速开始

### 方案 A：完整迁移（推荐）
```bash
# 1. 执行准备工作
./scripts/prepare-playwright-migration.sh

# 2. 迁移核心服务
./scripts/migrate-core-services.sh

# 3. 逐个迁移平台
./scripts/migrate-platform.sh toutiao
./scripts/migrate-platform.sh xiaohongshu
# ...
```

### 方案 B：渐进式迁移（保险）
```bash
# 1. 保持 Puppeteer，只更新选择器
./scripts/update-selectors-only.sh

# 2. 新平台用 Playwright
# 3. 老平台逐步迁移
```

## 📝 注意事项

1. **Cookie 格式不同**
   - Puppeteer: `page.cookies()`
   - Playwright: `context.cookies()`
   - 需要转换格式

2. **等待机制不同**
   - Playwright 有自动等待
   - 可以减少很多 `waitForSelector`

3. **选择器更强大**
   - Playwright 支持 `text=`, `has-text`, `>>` 等
   - 可以简化很多选择器

4. **Context 概念**
   - Playwright 有 Browser → Context → Page 三层
   - 需要管理 Context

## 🎯 下一步

需要我开始实施吗？我可以：

1. ✅ 创建所有迁移脚本
2. ✅ 迁移第一个平台（头条号）作为示例
3. ✅ 提供详细的测试方案
4. ✅ 创建回滚方案

请确认是否开始？
