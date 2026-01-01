# Windows端自动登录方案

## 问题分析

### 当前流程
1. 用户打开Windows端应用
2. 需要先登录系统账号（输入用户名密码）
3. 登录后获取token
4. 才能添加平台账号

### 用户需求
- **桌面应用不应该需要系统登录**
- 用户应该能直接添加平台账号
- 其他普通用户也能使用

## 解决方案：自动登录机制

### 方案概述
在Windows端应用启动时，自动使用默认账号登录，无需用户手动输入。

### 实施步骤

#### 1. 创建默认系统账号
在数据库中创建一个专门用于Windows端的默认账号：
- 用户名：`windows-app-user`
- 密码：随机生成的强密码（存储在应用配置中）
- 角色：`user`（普通用户权限）

#### 2. 修改Windows端启动流程
在 `windows-login-manager/electron/main.ts` 中：
- 应用启动时检查是否有token
- 如果没有token，自动使用默认账号登录
- 登录成功后保存token
- 用户无感知，直接进入主界面

#### 3. 保持现有功能
- 平台账号仍然正常添加
- 多租户隔离仍然有效（所有Windows端用户共享同一个系统账号）
- 后端API认证正常工作

## 实施细节

### 1. 环境变量配置
在 `.env` 文件中添加：
```env
# Windows端默认登录账号
WINDOWS_APP_USERNAME=windows-app-user
WINDOWS_APP_PASSWORD=<随机生成的强密码>
```

### 2. 修改 main.ts
在应用初始化时添加自动登录逻辑：

```typescript
/**
 * 自动登录Windows端默认账号
 */
private async autoLogin(): Promise<boolean> {
  try {
    // 检查是否已有token
    const tokens = await storageManager.getTokens();
    if (tokens?.authToken) {
      logger.info('Token already exists, skipping auto-login');
      return true;
    }

    // 从环境变量获取默认账号
    const username = process.env.WINDOWS_APP_USERNAME || 'windows-app-user';
    const password = process.env.WINDOWS_APP_PASSWORD;

    if (!password) {
      logger.warn('No default password configured, skipping auto-login');
      return false;
    }

    logger.info('Attempting auto-login with default account...');

    // 调用API登录
    const loginResult = await apiClient.login(username, password);

    // 保存用户信息
    if (loginResult.user) {
      await storageManager.saveUser(loginResult.user);
    }

    logger.info('Auto-login successful');
    return true;
  } catch (error) {
    logger.error('Auto-login failed:', error);
    return false;
  }
}
```

### 3. 在initialize()中调用
```typescript
async initialize(): Promise<void> {
  // ... 现有初始化代码 ...

  // 注册IPC处理器
  await ipcHandler.registerHandlers();

  // 自动登录
  await this.autoLogin();

  // 创建主窗口
  this.createMainWindow();

  // ... 其余代码 ...
}
```

### 4. 创建默认账号脚本
创建 `scripts/setup-windows-app-user.js`：

```javascript
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const crypto = require('crypto');

async function setupWindowsAppUser() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'geo_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    // 生成随机密码
    const password = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (username) 
       DO UPDATE SET 
         password_hash = EXCLUDED.password_hash,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, username, role`,
      ['windows-app-user', passwordHash, 'windows-app@local.system', 'user']
    );

    console.log('✅ Windows端默认账号创建成功！');
    console.log('用户ID:', result.rows[0].id);
    console.log('用户名:', result.rows[0].username);
    console.log('\n请将以下内容添加到 .env 文件：');
    console.log(`WINDOWS_APP_USERNAME=windows-app-user`);
    console.log(`WINDOWS_APP_PASSWORD=${password}`);
  } catch (error) {
    console.error('❌ 创建失败:', error.message);
  } finally {
    await pool.end();
  }
}

setupWindowsAppUser();
```

## 优点

1. ✅ **用户体验好** - 打开应用即可使用，无需登录
2. ✅ **安全性** - 密码随机生成，存储在本地配置中
3. ✅ **兼容性** - 不影响现有功能和多租户隔离
4. ✅ **简单** - 只需修改启动流程，不需要改动其他代码

## 缺点

1. ⚠️ **所有Windows端用户共享数据** - 所有使用Windows端的人看到相同的平台账号
2. ⚠️ **无法区分不同Windows端用户** - 无法实现Windows端的多用户隔离

## 替代方案

如果需要Windows端也支持多用户，可以考虑：

### 方案B：首次启动时创建用户
1. 首次启动时弹出简单的用户名输入框
2. 自动生成密码并保存
3. 后续启动自动使用该账号登录

### 方案C：使用设备ID作为用户标识
1. 使用机器的唯一标识（MAC地址、机器ID等）
2. 自动创建对应的用户账号
3. 每台机器有独立的数据

## 推荐方案

**推荐使用方案A（自动登录默认账号）**，因为：
- 实施最简单
- 满足用户需求（无需登录即可使用）
- 对于个人使用或小团队使用足够

如果未来需要多用户支持，可以再升级到方案B或C。
