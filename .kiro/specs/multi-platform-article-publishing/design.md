# Design Document - Multi-Platform Article Publishing System

## Overview

多平台文章自动发布系统是一个基于浏览器自动化技术的内容分发解决方案。系统采用模块化架构，将平台账号管理、发布任务调度、浏览器自动化执行、凭证加密存储等功能解耦，确保系统的可扩展性和可维护性。

核心设计理念：
- **安全第一**：所有敏感凭证使用AES-256加密存储
- **平台适配器模式**：每个平台独立实现发布逻辑，便于扩展和维护
- **异步任务队列**：支持立即发布和定时发布，避免阻塞主流程
- **容错机制**：完善的错误处理和重试逻辑，提高发布成功率

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Platform Management Page  │  Publishing Config  │  Records │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
├─────────────────────────────────────────────────────────────┤
│  /api/platforms  │  /api/accounts  │  /api/publishing-tasks │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Service Layer                          │
├─────────────────────────────────────────────────────────────┤
│  AccountService  │  PublishingService  │  EncryptionService │
│  TaskScheduler   │  BrowserAutomation  │  PlatformAdapters  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
├─────────────────────────────────────────────────────────────┤
│  platform_accounts  │  publishing_tasks  │  publishing_logs │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action → Frontend → API → Service → Database
                                  ↓
                          Browser Automation
                                  ↓
                          Platform Website
```

## Components and Interfaces

### 1. Frontend Components

#### PlatformManagementPage
- **职责**：展示所有支持的平台，管理账号绑定
- **主要功能**：
  - 卡片式布局展示平台（每行4个）
  - 区分已绑定/未绑定状态
  - 触发账号绑定/管理对话框

#### AccountBindingModal
- **职责**：处理平台账号的绑定流程
- **主要功能**：
  - 动态表单（根据平台类型显示不同字段）
  - 凭证格式验证
  - 提交账号信息到后端

#### AccountManagementModal
- **职责**：管理已绑定的账号
- **主要功能**：
  - 显示账号信息（隐藏敏感数据）
  - 编辑账号凭证
  - 删除账号绑定
  - 设置默认账号

#### PublishingConfigModal
- **职责**：配置文章发布参数
- **主要功能**：
  - 选择目标平台和账号
  - 配置标题、分类、标签
  - 设置发布时间（立即/定时）
  - 平台特定配置项

#### PublishingRecordsPage
- **职责**：展示发布历史和状态
- **主要功能**：
  - 列表展示所有发布任务
  - 实时状态更新
  - 查看详细日志
  - 重新发布失败任务

### 2. Backend Services

#### AccountService
```typescript
interface AccountService {
  // 创建平台账号绑定
  createAccount(platformId: string, credentials: object, userId: string): Promise<Account>
  
  // 获取用户的所有账号
  getAccountsByUser(userId: string): Promise<Account[]>
  
  // 获取特定平台的账号
  getAccountsByPlatform(platformId: string, userId: string): Promise<Account[]>
  
  // 更新账号凭证
  updateAccount(accountId: string, credentials: object): Promise<Account>
  
  // 删除账号
  deleteAccount(accountId: string): Promise<void>
  
  // 设置默认账号
  setDefaultAccount(platformId: string, accountId: string, userId: string): Promise<void>
}
```

#### EncryptionService
```typescript
interface EncryptionService {
  // 加密敏感数据
  encrypt(plaintext: string): string
  
  // 解密数据
  decrypt(ciphertext: string): string
  
  // 生成加密密钥
  generateKey(): string
  
  // 验证密钥有效性
  validateKey(key: string): boolean
}
```

#### PublishingService
```typescript
interface PublishingService {
  // 创建发布任务
  createTask(articleId: string, config: PublishingConfig): Promise<PublishingTask>
  
  // 执行发布任务
  executeTask(taskId: string): Promise<PublishingResult>
  
  // 获取任务状态
  getTaskStatus(taskId: string): Promise<TaskStatus>
  
  // 获取发布历史
  getPublishingHistory(filters: HistoryFilters): Promise<PublishingTask[]>
  
  // 重新发布
  retryTask(taskId: string, newConfig?: PublishingConfig): Promise<PublishingTask>
}
```

#### TaskScheduler
```typescript
interface TaskScheduler {
  // 调度任务
  scheduleTask(task: PublishingTask): Promise<void>
  
  // 取消调度
  cancelSchedule(taskId: string): Promise<void>
  
  // 检查待执行任务
  checkPendingTasks(): Promise<PublishingTask[]>
  
  // 执行到期任务
  executeDueTasks(): Promise<void>
}
```

#### BrowserAutomationService
```typescript
interface BrowserAutomationService {
  // 启动浏览器
  launchBrowser(options: BrowserOptions): Promise<Browser>
  
  // 执行登录
  login(platform: string, credentials: object): Promise<boolean>
  
  // 填充文章内容
  fillArticleContent(article: Article, config: PublishingConfig): Promise<void>
  
  // 上传图片
  uploadImages(images: string[]): Promise<string[]>
  
  // 提交发布
  submitPublish(): Promise<boolean>
  
  // 处理验证码
  handleCaptcha(captchaType: string): Promise<string>
  
  // 关闭浏览器
  closeBrowser(): Promise<void>
}
```

#### PlatformAdapter (Abstract)
```typescript
abstract class PlatformAdapter {
  abstract platformId: string
  abstract platformName: string
  
  // 获取登录页面URL
  abstract getLoginUrl(): string
  
  // 获取发布页面URL
  abstract getPublishUrl(): string
  
  // 定位登录表单元素
  abstract getLoginSelectors(): LoginSelectors
  
  // 定位发布表单元素
  abstract getPublishSelectors(): PublishSelectors
  
  // 执行登录流程
  abstract performLogin(page: Page, credentials: object): Promise<boolean>
  
  // 执行发布流程
  abstract performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean>
  
  // 验证发布成功
  abstract verifyPublishSuccess(page: Page): Promise<boolean>
  
  // 处理平台特定逻辑
  abstract handlePlatformSpecifics(page: Page, config: PublishingConfig): Promise<void>
}
```

### 3. Platform Adapters

每个平台实现独立的适配器：

- **WangyiAdapter** (网易号)
- **SouhuAdapter** (搜狐号)
- **BaijiahaoAdapter** (百家号)
- **ToutiaoAdapter** (头条号)
- **QieAdapter** (企鹅号)
- **ZhihuAdapter** (知乎)
- **WechatAdapter** (微信公众号)
- **XiaohongshuAdapter** (小红书)
- **DouyinAdapter** (抖音号)
- **BilibiliAdapter** (哔哩哔哩)
- **CSDNAdapter** (CSDN)
- **JianshuAdapter** (简书)

## Data Models

### platform_accounts

```sql
CREATE TABLE platform_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  platform_id VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  credentials TEXT NOT NULL,  -- 加密存储的JSON
  is_default BOOLEAN DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',  -- active, disabled, error
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_platform_accounts_user ON platform_accounts(user_id);
CREATE INDEX idx_platform_accounts_platform ON platform_accounts(platform_id);
```

### publishing_tasks

```sql
CREATE TABLE publishing_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  platform_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, running, success, failed, cancelled
  config TEXT NOT NULL,  -- JSON: 标题、分类、标签等配置
  scheduled_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES platform_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_publishing_tasks_article ON publishing_tasks(article_id);
CREATE INDEX idx_publishing_tasks_status ON publishing_tasks(status);
CREATE INDEX idx_publishing_tasks_scheduled ON publishing_tasks(scheduled_at);
```

### publishing_logs

```sql
CREATE TABLE publishing_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  level VARCHAR(20) NOT NULL,  -- info, warning, error
  message TEXT NOT NULL,
  details TEXT,  -- JSON: 额外的上下文信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES publishing_tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_publishing_logs_task ON publishing_logs(task_id);
CREATE INDEX idx_publishing_logs_level ON publishing_logs(level);
```

### encryption_keys

```sql
CREATE TABLE encryption_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_name VARCHAR(50) UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### platforms_config

```sql
CREATE TABLE platforms_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id VARCHAR(50) UNIQUE NOT NULL,
  platform_name VARCHAR(100) NOT NULL,
  icon_url VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN DEFAULT 1,
  adapter_class VARCHAR(100) NOT NULL,
  required_fields TEXT NOT NULL,  -- JSON: 账号绑定需要的字段
  config_schema TEXT,  -- JSON: 发布配置的schema
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Encryption round-trip consistency
*For any* credential string, encrypting then decrypting should return the original plaintext value.
**Validates: Requirements 3.2**

### Property 2: Credentials always encrypted in database
*For any* platform account stored in the database, directly querying the credentials field should return encrypted data, not plaintext.
**Validates: Requirements 3.4**

### Property 3: Account deletion removes all data
*For any* platform account, after deletion, querying the database for that account ID should return no results.
**Validates: Requirements 3.5**

### Property 4: Platform cards display all configured platforms
*For any* set of configured platforms, the platform management page should render a card for each platform.
**Validates: Requirements 1.2**

### Property 5: Platform cards layout consistency
*For any* number of platforms, the cards should be arranged with exactly 4 cards per row.
**Validates: Requirements 1.3**

### Property 6: Bound accounts show status indicator
*For any* platform with at least one bound account, the platform card should display a bound status indicator.
**Validates: Requirements 1.5**

### Property 7: Credential validation rejects invalid formats
*For any* invalid credential input (empty, malformed, missing required fields), the system should reject the submission and not create an account.
**Validates: Requirements 2.3**

### Property 8: Valid credentials are encrypted before storage
*For any* valid credential submission, the stored value in the database should be encrypted (not equal to the plaintext input).
**Validates: Requirements 2.4**

### Property 9: Sensitive data masked in UI
*For any* account displayed in the management dialog, password and token fields should be masked (e.g., "****") and not show plaintext.
**Validates: Requirements 4.2**

### Property 10: Only bound platforms shown in publishing config
*For any* user's publishing configuration dialog, only platforms with at least one bound account should appear in the platform selection list.
**Validates: Requirements 5.3**

### Property 11: Scheduled time must be in future
*For any* scheduled publishing task, the scheduled_at timestamp must be greater than the current time.
**Validates: Requirements 6.4**

### Property 12: Scheduled tasks execute at correct time
*For any* scheduled task, when the current time reaches or exceeds scheduled_at, the task should transition from 'pending' to 'running' status.
**Validates: Requirements 6.5**

### Property 13: Browser navigates to correct platform URL
*For any* platform adapter, the browser automation should navigate to the URL returned by that adapter's getLoginUrl() method.
**Validates: Requirements 7.2**

### Property 14: Login form filled with stored credentials
*For any* platform account, the browser automation should fill the login form fields with the decrypted credentials from the database.
**Validates: Requirements 7.3**

### Property 15: Article title filled in publish form
*For any* article being published, the title field in the platform's publish form should be filled with the article's title.
**Validates: Requirements 8.1**

### Property 16: Article content filled in editor
*For any* article being published, the content editor should be filled with the article's body content.
**Validates: Requirements 8.2**

### Property 17: Images uploaded for articles with images
*For any* article containing images, all image URLs should be processed and uploaded to the target platform.
**Validates: Requirements 8.3**

### Property 18: Retry limit enforced
*For any* failed task with retry enabled, the system should retry up to max_retries times, then mark as permanently failed.
**Validates: Requirements 9.4**

### Property 19: All tasks displayed in history
*For any* user's publishing tasks, the history page should display all tasks associated with that user's articles.
**Validates: Requirements 10.1**

### Property 20: Task records contain required fields
*For any* publishing task record, it should contain article_id, platform_id, status, and created_at fields.
**Validates: Requirements 10.2**

### Property 21: Failed tasks show error information
*For any* task with status 'failed', the error_message field should be non-empty and displayed in the UI.
**Validates: Requirements 10.4**

### Property 22: Failed tasks show retry button
*For any* task with status 'failed', the UI should display a "重新发布" button.
**Validates: Requirements 11.1**

### Property 23: Retry loads original configuration
*For any* task being retried, the system should load the original config JSON and populate the configuration dialog.
**Validates: Requirements 11.2**

### Property 24: Retry creates new task
*For any* retry operation, a new task record should be created (not modifying the original failed task).
**Validates: Requirements 11.4**

### Property 25: Multiple accounts per platform supported
*For any* platform, users should be able to create multiple account bindings with different credentials.
**Validates: Requirements 12.1**

### Property 26: Accounts have unique identifiers
*For any* set of accounts for the same platform, each should have a unique account_name that distinguishes it.
**Validates: Requirements 12.2**

### Property 27: Default account used when unspecified
*For any* publishing task where no account is explicitly selected, the system should use the account marked as is_default=1 for that platform.
**Validates: Requirements 12.4**

### Property 28: Default account setting persisted
*For any* account set as default, the database should reflect is_default=1 for that account and is_default=0 for other accounts of the same platform.
**Validates: Requirements 12.5**

### Property 29: Task execution creates logs
*For any* publishing task that executes, at least one log entry should be created in publishing_logs.
**Validates: Requirements 13.1**

### Property 30: Browser actions logged
*For any* browser automation operation (navigation, click, fill), a log entry should be created recording the action.
**Validates: Requirements 13.2**

### Property 31: Errors logged with stack trace
*For any* error during task execution, the log should contain the error message and stack trace in the details field.
**Validates: Requirements 13.3**

### Property 32: Account operations audited without credentials
*For any* account create/update/delete operation, a log entry should be created that does not contain the credentials field.
**Validates: Requirements 13.4**

### Property 33: Logs filterable by criteria
*For any* log query with filters (task_id, level, date range), only logs matching all specified criteria should be returned.
**Validates: Requirements 13.5**

### Property 34: Content length validated against platform limits
*For any* platform with a character limit, attempting to publish content exceeding that limit should fail validation and prompt the user.
**Validates: Requirements 14.3**

### Property 35: Cover image extracted or required
*For any* platform requiring a cover image, the system should either extract the first image from the article or prompt the user to specify one.
**Validates: Requirements 14.4**

## Error Handling

### Error Categories

1. **Authentication Errors**
   - Invalid credentials
   - Session expired
   - Account locked/disabled
   - Two-factor authentication required

2. **Validation Errors**
   - Invalid article format
   - Content too long/short
   - Missing required fields
   - Invalid scheduling time

3. **Network Errors**
   - Connection timeout
   - Platform unavailable
   - Rate limiting

4. **Automation Errors**
   - Element not found
   - Page load timeout
   - Unexpected page structure
   - Captcha failure

5. **System Errors**
   - Database errors
   - Encryption/decryption failures
   - Browser launch failures

### Error Handling Strategy

```typescript
interface ErrorHandler {
  // 分类错误
  categorizeError(error: Error): ErrorCategory
  
  // 判断是否可重试
  isRetryable(error: Error): boolean
  
  // 计算重试延迟
  getRetryDelay(attemptNumber: number): number
  
  // 记录错误
  logError(taskId: string, error: Error, context: object): Promise<void>
  
  // 通知用户
  notifyUser(taskId: string, error: Error): Promise<void>
}
```

### Retry Strategy

- **Exponential Backoff**: 重试延迟 = 2^attemptNumber * 1000ms
- **Max Retries**: 默认3次，可配置
- **Retryable Errors**: 网络错误、超时、临时平台错误
- **Non-Retryable Errors**: 认证失败、验证错误、账号被封禁

## Testing Strategy

### Unit Testing

**Framework**: Jest

**Coverage Areas**:
- EncryptionService: 加密/解密功能
- AccountService: CRUD操作
- PublishingService: 任务创建和状态管理
- TaskScheduler: 任务调度逻辑
- Platform Adapters: 各平台的选择器和URL配置

**Example Unit Tests**:
```typescript
describe('EncryptionService', () => {
  it('should encrypt plaintext to non-plaintext ciphertext', () => {
    const plaintext = 'myPassword123'
    const encrypted = encryptionService.encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
  })
  
  it('should handle empty credentials gracefully', () => {
    expect(() => accountService.createAccount('wangyi', {}, 1))
      .toThrow('Invalid credentials')
  })
})
```

### Property-Based Testing

**Framework**: fast-check (for TypeScript/JavaScript)

**Configuration**: Each property test should run a minimum of 100 iterations.

**Test Tagging**: Each property-based test must include a comment with the format:
`// Feature: multi-platform-article-publishing, Property {number}: {property_text}`

**Coverage Areas**:
- Encryption round-trip for random strings
- Account operations with random valid/invalid data
- Task scheduling with random timestamps
- Content validation with random article lengths
- Multi-account scenarios with random account counts

**Example Property Tests**:
```typescript
import fc from 'fast-check'

describe('Property Tests', () => {
  // Feature: multi-platform-article-publishing, Property 1: Encryption round-trip consistency
  it('should maintain data integrity through encrypt-decrypt cycle', () => {
    fc.assert(
      fc.property(fc.string(), (plaintext) => {
        const encrypted = encryptionService.encrypt(plaintext)
        const decrypted = encryptionService.decrypt(encrypted)
        return decrypted === plaintext
      }),
      { numRuns: 100 }
    )
  })
  
  // Feature: multi-platform-article-publishing, Property 11: Scheduled time must be in future
  it('should reject past scheduled times', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000000, max: -1 }), // Past timestamps
        (pastOffset) => {
          const pastTime = new Date(Date.now() + pastOffset)
          expect(() => publishingService.createTask(1, { scheduledAt: pastTime }))
            .toThrow('Scheduled time must be in the future')
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Integration Testing

**Scope**: End-to-end flows without actual browser automation

**Test Scenarios**:
- Complete account binding flow
- Task creation and scheduling
- Task execution simulation (mocked browser)
- Error handling and retry logic
- Multi-account selection

### Browser Automation Testing

**Approach**: Use mock platforms or test environments

**Considerations**:
- Real browser automation tests are slow and fragile
- Use mocked page objects for most tests
- Maintain a small suite of smoke tests against real platforms
- Run full automation tests in CI/CD pipeline only

## Security Considerations

### Credential Storage

- **Encryption Algorithm**: AES-256-GCM
- **Key Management**: Store encryption key in environment variable or secure key store
- **Key Rotation**: Support key rotation without data loss
- **Access Control**: Credentials only accessible to the owning user

### Browser Automation Security

- **Headless Mode**: Run browsers in headless mode to prevent UI exposure
- **Isolated Contexts**: Each task runs in isolated browser context
- **Cookie Management**: Clear cookies after each session
- **Screenshot Sanitization**: Redact sensitive information from debug screenshots

### API Security

- **Authentication**: All API endpoints require user authentication
- **Authorization**: Users can only access their own accounts and tasks
- **Rate Limiting**: Prevent abuse of publishing endpoints
- **Input Validation**: Sanitize all user inputs to prevent injection attacks

## Performance Considerations

### Concurrency

- **Task Queue**: Use job queue (e.g., Bull) for task management
- **Parallel Execution**: Support multiple concurrent publishing tasks
- **Resource Limits**: Limit concurrent browser instances to prevent resource exhaustion

### Optimization

- **Browser Reuse**: Reuse browser instances for multiple tasks when possible
- **Lazy Loading**: Load platform adapters on demand
- **Caching**: Cache platform configurations and selectors
- **Database Indexing**: Index frequently queried fields (user_id, platform_id, status)

### Monitoring

- **Task Metrics**: Track success rate, average duration, failure reasons
- **Resource Usage**: Monitor CPU, memory, browser instance count
- **Platform Health**: Track platform availability and response times
- **Alert Thresholds**: Alert on high failure rates or long queue times

## Deployment Considerations

### Dependencies

- **Puppeteer**: Browser automation library
- **Chromium**: Headless browser (bundled with Puppeteer)
- **Node.js**: Runtime environment (v18+)
- **SQLite**: Database (existing)

### Configuration

```typescript
interface PublishingConfig {
  // 浏览器配置
  browser: {
    headless: boolean
    timeout: number
    viewport: { width: number, height: number }
  }
  
  // 任务配置
  tasks: {
    maxRetries: number
    retryDelay: number
    concurrentLimit: number
  }
  
  // 验证码配置
  captcha: {
    enabled: boolean
    provider: string
    apiKey: string
  }
  
  // 加密配置
  encryption: {
    algorithm: string
    keyPath: string
  }
}
```

### Environment Variables

```bash
# 加密密钥
PUBLISHING_ENCRYPTION_KEY=<base64-encoded-key>

# 验证码服务
CAPTCHA_PROVIDER=2captcha
CAPTCHA_API_KEY=<api-key>

# 浏览器配置
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000

# 任务配置
MAX_CONCURRENT_TASKS=3
TASK_MAX_RETRIES=3
```

## Future Enhancements

1. **Batch Publishing**: 一次性发布到多个平台
2. **Content Templates**: 为不同平台定制内容模板
3. **Analytics Integration**: 追踪发布后的阅读量、互动数据
4. **AI Content Optimization**: 根据平台特点自动优化内容
5. **Webhook Support**: 发布完成后触发webhook通知
6. **Mobile App Support**: 移动端管理和发布
7. **Team Collaboration**: 多用户协作发布
8. **Content Calendar**: 可视化的发布日历
