# 技术栈与构建系统

## 语言与框架

### Windows 桌面客户端 (windows-login-manager/) ⭐ 当前使用
- **Electron** 桌面应用
- React 18 + TypeScript + Vite
- **Ant Design 5** UI 组件库
- **Tailwind CSS** 样式框架
- **React Router v6** 路由
- **Zustand** 状态管理
- **ECharts** 数据可视化
- **SQLite** 本地数据库
- **Playwright** 本地浏览器自动化
- 包含完整的用户界面和本地功能执行

### 后端 (server/)
- **Node.js** + Express
- **TypeScript**（编译为 CommonJS）
- **PostgreSQL** 主数据库
- **Redis** 缓存和会话
- 仅负责：用户认证、配额管理、订阅系统、AI 生成、数据同步

### 落地页 (landing/)
- React + TypeScript + Vite
- Tailwind CSS
- 运行端口：8080
- 营销页面，部署到服务器

### 🗄️ 归档的 Web 前端 (client-archived-web-frontend/)
- **已废弃，仅作备份参考**
- 不要在此目录开发
- 所有前端功能已迁移到 Windows 桌面客户端

## 关键依赖

- `playwright` - 浏览器自动化，用于多平台发布
- `wechatpay-axios-plugin` - 微信支付集成
- `jsonwebtoken` + `bcrypt` - 认证
- `zod` - Schema 验证
- `mammoth` + `pdf-parse` - 文档解析
- `helmet` + `express-rate-limit` - 安全防护

## 常用命令

```bash
# 开发
npm run server:dev       # 启动后端（端口 3000）
npm run landing:dev      # 启动落地页（端口 8080）

# Windows 桌面客户端开发
cd windows-login-manager
npm run dev              # 启动 Electron 应用（开发模式）

# 构建
npm run server:build     # 构建后端（tsc）
npm run landing:build    # 构建落地页

# Windows 桌面客户端构建
cd windows-login-manager
npm run build            # 构建 Electron 应用
npm run build:win        # 构建 Windows 安装包

# 数据库
cd server
npm run db:status        # 查看迁移状态
npm run db:migrate       # 执行待迁移
npm run db:rollback      # 回滚上次迁移
npm run db:create -- <名称>  # 创建新迁移

# 测试
cd server && npm test    # 运行 Jest 测试

# 工具
npm run install:all      # 安装所有依赖
npm run security:verify  # 验证安全配置
npm run status           # 检查服务状态
```

## TypeScript 配置

- **目标**：ES2020
- **严格模式**：已启用
- **前端**：ESNext 模块，bundler 解析
- **后端**：CommonJS 模块，node 解析

## 环境变量

通过各项目根目录的 `.env` 文件配置：
- 数据库：`DATABASE_URL`
- AI API：`DEEPSEEK_API_KEY`、`GEMINI_API_KEY`、`OLLAMA_BASE_URL`
- 认证：`JWT_SECRET`、`JWT_REFRESH_SECRET`
- 浏览器：`PUPPETEER_EXECUTABLE_PATH`、`BROWSER_HEADLESS`
- 支付：`WECHAT_PAY_*` 系列变量

## 端口分配

- 3000：后端 API
- 5174：Windows 桌面客户端（Electron Vite 开发服务器）
- 8080：落地页

**注意**：服务器不再部署 Web 前端，所有系统功能通过 Windows 桌面客户端访问。

## Windows 桌面客户端 API 配置规范（重要）

### 配置文件说明

Windows 桌面客户端的 API URL 配置：

1. **`windows-login-manager/.env`** - 环境变量
   ```bash
   # 开发环境
   VITE_API_URL=http://localhost:3000
   VITE_WS_URL=ws://localhost:3000/ws
   
   # 生产环境
   VITE_API_URL=https://www.jzgeo.cc
   VITE_WS_URL=wss://www.jzgeo.cc/ws
   ```

2. **`windows-login-manager/src/config/env.ts`** - 统一配置中心
   ```typescript
   // 自动在 VITE_API_URL 后面添加 /api
   apiUrl: import.meta.env.VITE_API_URL 
     ? `${import.meta.env.VITE_API_URL}/api`
     : 'http://localhost:3000/api',
   ```

3. **`windows-login-manager/src/api/client.ts`** - API 客户端
   ```typescript
   // 必须使用 API_BASE_URL，不要直接使用 VITE_API_URL
   import { API_BASE_URL } from '../config/env';
   export const apiClient = axios.create({
     baseURL: API_BASE_URL,  // 正确：使用统一配置
   });
   ```

### 常见错误

| 错误配置 | 结果 | 正确配置 |
|---------|------|---------|
| `VITE_API_URL=https://www.jzgeo.cc/api` | 请求变成 `/api/api/xxx` | `VITE_API_URL=https://www.jzgeo.cc` |
| `apiClient` 直接用 `VITE_API_URL` | 请求缺少 `/api` 前缀 | 使用 `API_BASE_URL` |

### 验证方法

构建后检查请求路径应该是：`https://www.jzgeo.cc/api/xxx`

---

## 🗄️ 归档的 Web 前端 API 配置（仅供参考）

**注意：此配置已废弃，仅作历史参考。**

<details>
<summary>点击查看归档的配置说明</summary>

### 配置文件说明

前端 API URL 配置涉及两个文件，必须保持一致：

1. **`client-archived-web-frontend/.env.production`** - 环境变量
   ```bash
   # 不要在 VITE_API_URL 后面加 /api，env.ts 会自动添加
   VITE_API_URL=https://www.jzgeo.cc
   VITE_WS_URL=wss://www.jzgeo.cc/ws
   VITE_LANDING_URL=https://www.jzgeo.cc
   ```

2. **`client-archived-web-frontend/src/config/env.ts`** - 统一配置中心
   ```typescript
   // 自动在 VITE_API_URL 后面添加 /api
   apiUrl: import.meta.env.VITE_API_URL 
     ? `${import.meta.env.VITE_API_URL}/api`
     : (isProduction ? '/api' : 'http://localhost:3000/api'),
   ```

3. **`client-archived-web-frontend/src/api/client.ts`** - API 客户端
   ```typescript
   // 必须使用 API_BASE_URL，不要直接使用 VITE_API_URL
   import { API_BASE_URL } from '../config/env';
   export const apiClient = axios.create({
     baseURL: API_BASE_URL,  // 正确：使用统一配置
     // baseURL: import.meta.env.VITE_API_URL,  // 错误：会缺少 /api
   });
   ```

</details>

## 部署规则（强制）

### 服务器目录结构

**重要：服务器上只部署后端 API 和落地页，不再部署 Web 前端！**

| 本地路径 | 服务器路径 | 说明 |
|---------|-----------|------|
| `server/dist/` | `/var/www/geo-system/server/` | 后端代码 |
| `server/dist/services/` | `/var/www/geo-system/server/services/` | 服务层 |
| `server/dist/routes/` | `/var/www/geo-system/server/routes/` | 路由层 |
| `landing/dist/` | `/var/www/geo-system/landing/` | **落地页（注意：不是 landing/dist/）** |
| `landing/dist/assets/` | `/var/www/geo-system/landing/assets/` | 落地页静态资源 |

**注意**：
- ❌ 服务器不再部署 `client/` 目录（已移除）
- ✅ 所有系统功能通过 Windows 桌面客户端访问
- ✅ 服务器只提供后端 API 和营销落地页

### 落地页部署步骤（重要）

**Nginx 的 root 指向 `/var/www/geo-system/landing/`（不是 `landing/dist/`），因此需要同步文件：**

1. **本地构建**：`npm run landing:build`
2. **上传并同步文件**：
   ```bash
   # 上传到 dist 目录
   scp -i "私钥路径" -r landing/dist/* ubuntu@124.221.247.107:/var/www/geo-system/landing/dist/
   
   # 同步到 Nginx root 目录（关键步骤！）
   ssh -i "私钥路径" ubuntu@124.221.247.107 "cp /var/www/geo-system/landing/dist/index.html /var/www/geo-system/landing/ && cp -r /var/www/geo-system/landing/dist/assets/* /var/www/geo-system/landing/assets/"
   ```

### 后端部署步骤

1. **本地编译**：`npm run server:build`
2. **上传文件**：将 `server/dist/` 下的文件上传到 `/var/www/geo-system/server/`
   ```bash
   # 示例：部署单个服务文件
   scp -i "私钥路径" server/dist/services/XXX.js ubuntu@124.221.247.107:/var/www/geo-system/server/services/
   
   # 示例：部署路由文件
   scp -i "私钥路径" server/dist/routes/XXX.js ubuntu@124.221.247.107:/var/www/geo-system/server/routes/
   ```
3. **重启服务**：`pm2 restart geo-server`

### 常见错误

- ❌ 错误：上传到 `/var/www/geo-system/server/dist/services/`
- ✅ 正确：上传到 `/var/www/geo-system/server/services/`

- ❌ 错误：落地页只上传到 `/var/www/geo-system/landing/dist/`
- ✅ 正确：落地页需要同步 `index.html` 和 `assets/` 到 `/var/www/geo-system/landing/`

- ❌ 错误：尝试部署 Web 前端到服务器
- ✅ 正确：Web 前端已废弃，使用 Windows 桌面客户端

### PM2 进程名称

- 服务器上的 PM2 进程名是 `geo-server`（不是 `geo-api`）
- 入口文件：`/var/www/geo-system/server/index.js`

### 部署验证

部署后必须验证：
1. `pm2 status` 确认服务在线
2. `curl http://localhost:3000/api/health` 确认健康检查通过

## Nginx 配置规范（重要）

### 服务器 Nginx 配置路径

- 配置文件：`/etc/nginx/sites-available/geo-system`
- 本地参考：`config/nginx/geo-system.conf`

### 关键路径映射

**注意：服务器不再部署 Web 前端（/app 路径已移除）！**

| Nginx location | alias/root 路径 | 说明 |
|----------------|-----------------|------|
| `/` | `/var/www/geo-system/landing` | 落地页（营销页面） |
| `/api` | `proxy_pass http://127.0.0.1:3000` | 后端 API |
| `/ws` | `proxy_pass http://127.0.0.1:3000` | WebSocket |
| `/uploads/` | `/var/www/geo-system/uploads/` | 上传文件 |

**已移除的路径**：
- ❌ `/app` - Web 前端应用（已废弃）
- ❌ `/app/assets/` - Web 前端静态资源（已废弃）

---

## 🗄️ 归档的 Web 前端部署说明（仅供参考）

**注意：以下内容已废弃，仅作历史参考。**

<details>
<summary>点击查看归档的部署说明</summary>

### 前端部署步骤（client）

```bash
# 1. 本地构建
npm run client:build

# 2. 上传静态资源到 /var/www/geo-system/client/assets/
scp -i "私钥路径" -r client/dist/assets/* ubuntu@124.221.247.107:/var/www/geo-system/client/assets/

# 3. 上传 index.html 到 /var/www/geo-system/client/
scp -i "私钥路径" client/dist/index.html ubuntu@124.221.247.107:/var/www/geo-system/client/
```

### 常见 Nginx 配置错误

| 错误 | 正确 |
|------|------|
| `alias /var/www/geo-system/client/dist;` | `alias /var/www/geo-system/client;` |
| `alias /var/www/geo-system/client/dist/assets/;` | `alias /var/www/geo-system/client/assets/;` |
| 上传到 `client/dist/` 目录 | 上传到 `client/` 目录（assets 和 index.html） |

### 当前服务器 Nginx 关键配置

```nginx
# 前端应用静态资源
location ^~ /app/assets/ {
    alias /var/www/geo-system/client/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# 前端应用
location /app {
    alias /var/www/geo-system/client;
    index index.html;
    try_files $uri $uri/ /app/index.html;
}

# 落地页
location / {
    root /var/www/geo-system/landing;
    try_files $uri $uri/ /index.html;
}
```

</details>

### 修改 Nginx 配置后

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx
```

## 部署后清理旧文件（强制）

每次部署前端或落地页后，删除旧的静态资源文件，只保留本次部署的文件。

### 清理方法

部署新文件后，根据 `index.html` 引用的文件名，删除 assets 目录中不再使用的旧文件：

```bash
# 前端：删除 /var/www/geo-system/client/assets/js/ 和 css/ 中的旧文件
# 落地页：删除 /var/www/geo-system/landing/assets/ 中的旧文件
```

保留当前 `index.html` 引用的文件，删除其他带 hash 的 js/css 文件即可。

---



#### 🟢 保留在服务器的功能

| 功能 | 说明 |
|------|------|
| 用户认证 | JWT 登录、注册、刷新 |
| 配额验证 | 验证用户是否有配额 |
| 配额预扣减 | 预扣减 + 确认/释放机制 |
| 订阅管理 | 套餐、订单、支付 |
| AI 生成 | DeepSeek/Gemini API 调用 |
| 用户管理 | 用户 CRUD |
| 代理商管理 | 代理商系统 |
| 安全审计 | 安全日志、审计 |
| 数据同步 | 云端数据同步 |
| 分析上报 | 发布统计、错误追踪 |
| 适配器版本 | 适配器热更新支持 |

#### 🔴 迁移到 Windows 端的功能

| 功能 | 说明 |
|------|------|
| 文章存储 | SQLite 本地存储 |
| 知识库存储 | 本地文件系统 |
| 图库存储 | 本地文件系统 |
| 平台账号存储 | Cookie 本地加密 |
| 浏览器自动化 | Playwright 本地执行 |
| 发布执行 | 发布任务本地执行 |
| 平台适配器 | 12+ 平台适配器 |
| 文档解析 | mammoth/pdf-parse |
| 图片处理 | 图片压缩/格式转换 |

---

## 数据库 ID 格式统一规范（强制）

### 问题背景

服务器（PostgreSQL）和 Windows 端（SQLite）使用不同数据库，ID 格式必须统一才能互相引用。

### 解决方案：统一使用 UUID v4 格式

| 场景 | 服务器（PostgreSQL） | Windows 端（SQLite） | 示例 |
|------|---------------------|---------------------|------|
| 配额预留 ID | `UUID` 类型 | `TEXT` 存储 | `550e8400-e29b-41d4-a716-446655440000` |
| 文章 ID | `SERIAL` (数字) | `TEXT` (UUID) | Windows 端生成 UUID |
| 任务 ID | - | `TEXT` (UUID) | Windows 端生成 UUID |
| 用户 ID | `SERIAL` (数字) | `INTEGER` | 服务器返回，Windows 端存储 |

### 关键规则

1. **服务器生成的 ID**（如 `reservationId`）
   - 服务器：UUID 类型
   - Windows 端：TEXT 存储
   - 示例：`reservationId: '550e8400-e29b-41d4-a716-446655440000'`

2. **Windows 端生成的 ID**（如文章、任务）
   - 使用 `uuid` 包生成 v4 UUID
   - 存储为 TEXT
   - 示例：`articleId: uuid.v4()`

3. **用户 ID**（特殊情况）
   - 服务器：SERIAL（数字，如 `123`）
   - Windows 端：INTEGER 存储
   - 从服务器 JWT token 中获取

### 代码示例

```typescript
// Windows 端生成 UUID
import { v4 as uuidv4 } from 'uuid';

// 创建文章
const articleId = uuidv4();  // '550e8400-e29b-41d4-a716-446655440000'
db.prepare('INSERT INTO articles (id, ...) VALUES (?, ...)').run(articleId, ...);

// 关联服务器的预留 ID
const { reservationId } = await apiClient.post('/api/quota/reserve', { ... });
db.prepare('UPDATE publishing_tasks SET reservation_id = ? WHERE id = ?')
  .run(reservationId, taskId);
```

### UUID 格式验证

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}
```

---

## 数据库迁移规则（强制）

### PostgreSQL 迁移文件规范

1. **文件命名**：`XXX_描述.sql`（XXX 为三位数字序号）
2. **必须包含 UP 和 DOWN 部分**
3. **必须添加索引和注释**

### 迁移文件模板

```sql
-- 迁移文件: XXX_功能描述.sql

-- ==================== UP ====================

CREATE TABLE IF NOT EXISTS table_name (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 其他字段...
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_table_name_user ON table_name(user_id);

-- 注释
COMMENT ON TABLE table_name IS '表说明';
COMMENT ON COLUMN table_name.column_name IS '字段说明';

-- ==================== DOWN ====================
DROP TABLE IF EXISTS table_name;
```

### SQLite 与 PostgreSQL 字段对照

| PostgreSQL | SQLite | 说明 |
|------------|--------|------|
| `SERIAL` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `UUID` | `TEXT` | UUID 存为字符串 |
| `BOOLEAN` | `INTEGER` | 0/1 代替 true/false |
| `TIMESTAMP` | `TEXT` | ISO 8601 格式字符串 |
| `JSONB` | `TEXT` | JSON 字符串 |
| `VARCHAR(n)` | `TEXT` | SQLite 无长度限制 |
| `DECIMAL(m,n)` | `REAL` | 浮点数 |

### 迁移必须完整

- ❌ 禁止：只创建表不创建索引
- ❌ 禁止：遗漏外键约束
- ❌ 禁止：缺少 DOWN 回滚语句
- ✅ 必须：包含所有相关表的完整迁移
- ✅ 必须：添加表和字段注释

---

## 配额预扣减机制（强制）

### 问题分析

原方案「先验证 → 执行 → 再扣减」存在竞态条件，可能导致配额超扣。

### 解决方案：预扣减模式

```
1. Windows 端发起预扣减请求
2. 服务器锁定配额，返回 reservationId
3. Windows 端本地执行任务
4a. 成功：调用确认接口，扣减配额
4b. 失败：调用释放接口，恢复配额
```

### API 规范

```typescript
// 1. 预扣减配额
POST /api/quota/reserve
Request: {
  quotaType: 'article_generation' | 'publish' | 'knowledge_upload' | 'image_upload',
  amount: number,
  clientId?: string,
  taskInfo?: object
}
Response: {
  success: true,
  reservationId: 'uuid-xxx',
  expiresAt: '2025-01-14T12:10:00Z',
  remainingQuota: 99
}

// 2. 确认消费
POST /api/quota/confirm
Request: { reservationId: 'uuid-xxx', result?: object }

// 3. 释放配额
POST /api/quota/release
Request: { reservationId: 'uuid-xxx', reason?: string }
```

### Windows 端调用模板

```typescript
async executeWithQuota<T>(
  quotaType: string,
  taskFn: () => Promise<T>,
  taskInfo?: object
): Promise<T> {
  // 1. 预扣减
  const { reservationId } = await this.reserve(quotaType, 1, taskInfo);
  
  try {
    // 2. 执行任务
    const result = await taskFn();
    
    // 3. 确认消费
    await this.confirm(reservationId, { status: 'success' });
    
    return result;
  } catch (error) {
    // 4. 释放配额
    await this.release(reservationId, error.message);
    throw error;
  }
}
```

---

## AI 生成确认机制（强制）

### 问题分析

AI 生成文章后，如果网络中断，用户可能丢失已生成的文章。

### 解决方案：服务器临时缓存

```
1. 服务器生成文章后缓存到 Redis（10 分钟）
2. 返回 generationId + 文章内容
3. Windows 端保存到本地后调用确认接口
4. 服务器删除缓存
5. 网络恢复后可通过 generationId 重新获取
```

### API 规范

```typescript
// 1. 生成文章
POST /api/article-generation/generate
Response: {
  generationId: 'gen-uuid-xxx',
  article: { title, content, ... },
  expiresAt: '2025-01-14T12:10:00Z'
}

// 2. 确认收到
POST /api/article-generation/confirm
Request: { generationId: 'gen-uuid-xxx' }

// 3. 重新获取（网络恢复后）
GET /api/article-generation/retrieve/:generationId
```

---

## 数据同步快照管理规则

### 快照限制

| 规则 | 说明 |
|------|------|
| 最大快照数 | 每用户最多 **3 个** |
| 自动清理 | 上传新快照时自动删除最旧的 |
| 过期清理 | 90 天未下载的快照自动删除 |
| 存储限制 | 单个快照最大 100MB |

### API 规范

```typescript
// 上传快照（自动清理旧快照）
POST /api/sync/upload
Response: {
  snapshotId: 'snap-xxx',
  deletedOldSnapshots: 1,
  remainingSnapshots: 3
}

// 获取快照列表
GET /api/sync/snapshots

// 下载快照（更新过期时间）
GET /api/sync/download/:snapshotId

// 删除快照
DELETE /api/sync/snapshots/:snapshotId
```

---

## Windows 端 SQLite 规范

### 数据库初始化

```typescript
// 启用外键约束
this.db.pragma('foreign_keys = ON');

// 启用 WAL 模式（提高并发性能）
this.db.pragma('journal_mode = WAL');
```

### 数据库存储位置

```typescript
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'geo-data.db');
```

### Cookie 加密存储

```typescript
// 基于机器码的加密
import { machineIdSync } from 'node-machine-id';
import CryptoJS from 'crypto-js';

const machineKey = machineIdSync();

function encrypt(data: string): string {
  return CryptoJS.AES.encrypt(data, machineKey).toString();
}

function decrypt(encrypted: string): string {
  return CryptoJS.AES.decrypt(encrypted, machineKey).toString(CryptoJS.enc.Utf8);
}
```

---

## IPC 通道命名规范

### 命名格式

`模块:操作`

### 标准通道列表

```typescript
// 文章
'article:create', 'article:findAll', 'article:findById', 'article:update', 'article:delete', 'article:search'

// 知识库
'knowledge:upload', 'knowledge:findAll', 'knowledge:findById', 'knowledge:delete', 'knowledge:parse'

// 图库
'gallery:createAlbum', 'gallery:findAlbums', 'gallery:uploadImage', 'gallery:findImages', 'gallery:deleteImage'

// 平台账号
'account:create', 'account:findAll', 'account:findById', 'account:update', 'account:delete', 'account:checkLogin'

// 发布任务
'task:create', 'task:execute', 'task:findAll', 'task:findById', 'task:cancel'

// 浏览器
'browser:launch', 'browser:close', 'browser:screenshot'

// 数据同步
'sync:backup', 'sync:restore', 'sync:getSnapshots'
```

---

## 分析上报规范

### 上报时机

- 发布成功/失败后立即上报
- 网络失败时保存到本地队列
- 定时重试上报

### 上报数据结构

```typescript
interface PublishReport {
  taskId: string;
  platform: string;
  status: 'success' | 'failed';
  duration: number;  // 毫秒
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    articleLength?: number;
    imageCount?: number;
    retryCount?: number;
  };
}
```

### 离线上报队列

```typescript
// 网络失败时保存到本地
this.pendingReports.push(report);
await this.savePendingReports();

// 定时重试
async flushPendingReports(): Promise<void> {
  if (this.pendingReports.length === 0) return;
  
  try {
    await apiClient.post('/api/analytics/publish-report/batch', {
      reports: this.pendingReports
    });
    this.pendingReports = [];
  } catch (error) {
    // 继续保留，下次重试
  }
}
```

---

## 禁止事项清单

### ❌ 绝对禁止

1. 在服务器端执行浏览器自动化（改造后）
2. 在服务器端存储用户文章/知识库/图片（改造后）
3. 在服务器端存储平台 Cookie
4. 使用不一致的 ID 格式
5. 跳过配额预扣减直接执行任务
6. 创建不完整的数据库迁移
7. 在 Windows 端明文存储敏感数据

### ✅ 必须遵守

1. 所有消耗配额的操作必须使用预扣减机制
2. AI 生成必须使用确认机制
3. 数据库迁移必须包含完整的 UP/DOWN
4. Windows 端 ID 必须使用 UUID v4
5. Cookie 必须加密存储
6. 分析数据必须上报（支持离线队列）