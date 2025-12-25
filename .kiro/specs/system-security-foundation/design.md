# Design Document

## Overview

本设计文档描述了GEO系统基础安全加固的技术实现方案。系统将实施多层安全防护,包括认证授权、审计日志、频率限制、异常检测等核心安全机制,以保护系统免受各类安全威胁。

### 设计目标

1. **纵深防御**: 实施多层安全控制,单点失效不会导致系统完全暴露
2. **最小权限**: 用户和进程只拥有完成任务所需的最小权限
3. **审计追踪**: 所有敏感操作都有完整的审计记录
4. **主动防御**: 系统能够检测异常行为并自动采取防护措施
5. **可恢复性**: 提供配置回滚和事件响应机制

### 技术栈

- **后端**: Node.js + TypeScript + Express
- **数据库**: PostgreSQL (主数据) + Redis (缓存和会话)
- **认证**: JWT + bcrypt
- **加密**: crypto (Node.js内置)
- **日志**: Winston
- **监控**: 自定义安全监控服务

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (Web Browser / API Client)                                  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Security Gateway                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Rate Limiter │  │ IP Whitelist │  │ CSRF Token   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Authentication Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ JWT Verify   │  │ Session Mgmt │  │ Permission   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ User Service │  │ Config Svc   │  │ Audit Svc    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ PostgreSQL   │  │ Redis Cache  │  │ Audit Logs   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```


### 安全层次

系统采用分层安全架构:

1. **网络层**: HTTPS, IP白名单, DDoS防护
2. **应用层**: 认证授权, 输入验证, CSRF保护
3. **业务层**: 权限控制, 操作审计, 频率限制
4. **数据层**: 加密存储, 参数化查询, 备份恢复

## Components and Interfaces

### 1. 审计日志服务 (AuditLogService)

负责记录和查询所有敏感操作的审计日志。

```typescript
interface AuditLogEntry {
  id: number;
  adminId: number;
  action: string;
  targetType: 'user' | 'config' | 'system';
  targetId: number | null;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

class AuditLogService {
  // 记录操作日志
  async logAction(
    adminId: number,
    action: string,
    targetType: string,
    targetId: number | null,
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string
  ): Promise<void>;
  
  // 查询日志
  async queryLogs(filters: {
    adminId?: number;
    action?: string;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }>;
  
  // 导出日志
  async exportLogs(filters: any, format: 'json' | 'csv'): Promise<string>;
}
```

### 2. 频率限制服务 (RateLimitService)

实现基于滑动窗口的频率限制。

```typescript
interface RateLimitConfig {
  windowMs: number;  // 时间窗口(毫秒)
  maxRequests: number;  // 最大请求数
}

class RateLimitService {
  // 检查是否超过频率限制
  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; retryAfter?: number }>;
  
  // 记录请求
  async recordRequest(key: string): Promise<void>;
  
  // 获取剩余配额
  async getRemainingQuota(key: string, config: RateLimitConfig): Promise<number>;
  
  // 重置限制
  async resetLimit(key: string): Promise<void>;
}
```

### 3. 确认令牌服务 (ConfirmationTokenService)

管理敏感操作的二次确认令牌。

```typescript
interface ConfirmationToken {
  token: string;
  userId: number;
  action: string;
  data: Record<string, any>;
  expiresAt: Date;
}

class ConfirmationTokenService {
  // 生成确认令牌
  async generateToken(
    userId: number,
    action: string,
    data: Record<string, any>
  ): Promise<string>;
  
  // 验证并消费令牌
  async validateAndConsumeToken(
    token: string,
    userId: number
  ): Promise<{ valid: boolean; data?: Record<string, any> }>;
  
  // 清理过期令牌
  async cleanupExpiredTokens(): Promise<number>;
}
```

### 4. 配置历史服务 (ConfigHistoryService)

管理配置变更历史和回滚。

```typescript
interface ConfigHistory {
  id: number;
  configKey: string;
  oldValue: string;
  newValue: string;
  changedBy: number;
  ipAddress: string;
  createdAt: Date;
}

class ConfigHistoryService {
  // 记录配置变更
  async recordChange(
    configKey: string,
    oldValue: any,
    newValue: any,
    changedBy: number,
    ipAddress: string
  ): Promise<void>;
  
  // 获取配置历史
  async getHistory(
    configKey: string,
    limit?: number
  ): Promise<ConfigHistory[]>;
  
  // 回滚配置
  async rollback(
    historyId: number,
    performedBy: number
  ): Promise<void>;
}
```

### 5. 通知服务 (NotificationService)

发送安全相关的通知。

```typescript
interface Notification {
  type: 'email' | 'webhook' | 'websocket';
  recipients: string[];
  subject: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

class NotificationService {
  // 发送通知
  async sendNotification(notification: Notification): Promise<void>;
  
  // 批量通知
  async batchNotify(notifications: Notification[]): Promise<void>;
  
  // 发送安全警报
  async sendSecurityAlert(
    alertType: string,
    details: Record<string, any>
  ): Promise<void>;
}
```


### 6. 权限服务 (PermissionService)

管理细粒度权限控制。

```typescript
interface Permission {
  code: string;
  name: string;
  description: string;
  category: string;
}

interface UserPermission {
  userId: number;
  permissionCode: string;
  grantedBy: number;
  grantedAt: Date;
}

class PermissionService {
  // 检查用户权限
  async hasPermission(userId: number, permissionCode: string): Promise<boolean>;
  
  // 授予权限
  async grantPermission(
    userId: number,
    permissionCode: string,
    grantedBy: number
  ): Promise<void>;
  
  // 撤销权限
  async revokePermission(
    userId: number,
    permissionCode: string,
    revokedBy: number
  ): Promise<void>;
  
  // 获取用户所有权限
  async getUserPermissions(userId: number): Promise<Permission[]>;
  
  // 获取所有可用权限
  async getAllPermissions(): Promise<Permission[]>;
}
```

### 7. 异常检测服务 (AnomalyDetectionService)

检测和响应异常行为。

```typescript
interface AnomalyEvent {
  type: 'suspicious_login' | 'high_frequency' | 'unusual_location' | 'privilege_escalation';
  userId: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  detectedAt: Date;
}

class AnomalyDetectionService {
  // 检测登录异常
  async detectLoginAnomaly(
    userId: number,
    ipAddress: string,
    userAgent: string
  ): Promise<AnomalyEvent | null>;
  
  // 检测操作频率异常
  async detectHighFrequency(
    userId: number,
    timeWindow: number
  ): Promise<AnomalyEvent | null>;
  
  // 检测权限滥用
  async detectPrivilegeAbuse(
    userId: number,
    action: string
  ): Promise<AnomalyEvent | null>;
  
  // 处理异常事件
  async handleAnomaly(event: AnomalyEvent): Promise<void>;
}
```

### 8. 会话管理服务 (SessionService)

管理用户会话和令牌。

```typescript
interface Session {
  userId: number;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}

class SessionService {
  // 创建会话
  async createSession(
    userId: number,
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void>;
  
  // 验证会话
  async validateSession(refreshToken: string): Promise<boolean>;
  
  // 获取用户所有会话
  async getUserSessions(userId: number): Promise<Session[]>;
  
  // 撤销会话
  async revokeSession(refreshToken: string): Promise<void>;
  
  // 撤销用户所有会话(除了当前)
  async revokeAllSessionsExcept(
    userId: number,
    currentToken: string
  ): Promise<number>;
  
  // 清理过期会话
  async cleanupExpiredSessions(): Promise<number>;
}
```

### 9. IP白名单服务 (IPWhitelistService)

管理IP访问控制。

```typescript
interface IPWhitelistEntry {
  id: number;
  ipAddress: string;
  description: string;
  addedBy: number;
  createdAt: Date;
}

class IPWhitelistService {
  // 检查IP是否在白名单
  async isWhitelisted(ipAddress: string): Promise<boolean>;
  
  // 添加IP到白名单
  async addIP(
    ipAddress: string,
    description: string,
    addedBy: number
  ): Promise<void>;
  
  // 从白名单移除IP
  async removeIP(ipAddress: string, removedBy: number): Promise<void>;
  
  // 获取白名单列表
  async getWhitelist(): Promise<IPWhitelistEntry[]>;
  
  // 验证IP格式
  validateIPFormat(ipAddress: string): boolean;
}
```

### 10. 安全监控服务 (SecurityMonitorService)

监控和报告安全事件。

```typescript
interface SecurityMetrics {
  failedLogins: number;
  blockedIPs: number;
  suspiciousActivities: number;
  activeAnomalies: number;
  lastIncident: Date | null;
}

interface SecurityEvent {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

class SecurityMonitorService {
  // 记录安全事件
  async logSecurityEvent(event: SecurityEvent): Promise<void>;
  
  // 获取安全指标
  async getSecurityMetrics(timeRange: number): Promise<SecurityMetrics>;
  
  // 获取安全事件
  async getSecurityEvents(filters: {
    severity?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<SecurityEvent[]>;
  
  // 生成安全报告
  async generateSecurityReport(period: 'daily' | 'weekly' | 'monthly'): Promise<string>;
}
```

## Data Models

### 数据库表设计

#### 1. audit_logs (审计日志表)

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_audit_admin_id (admin_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created_at (created_at),
  INDEX idx_audit_target (target_type, target_id)
);
```

#### 2. config_history (配置历史表)

```sql
CREATE TABLE config_history (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  ip_address VARCHAR(45) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_config_key (config_key),
  INDEX idx_config_changed_by (changed_by),
  INDEX idx_config_created_at (created_at)
);
```

#### 3. user_permissions (用户权限表)

```sql
CREATE TABLE user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_code VARCHAR(50) NOT NULL,
  granted_by INTEGER NOT NULL REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, permission_code),
  INDEX idx_perm_user_id (user_id),
  INDEX idx_perm_code (permission_code)
);
```

#### 4. permissions (权限定义表)

```sql
CREATE TABLE permissions (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. security_events (安全事件表)

```sql
CREATE TABLE security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  ip_address VARCHAR(45),
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_security_type (event_type),
  INDEX idx_security_severity (severity),
  INDEX idx_security_user_id (user_id),
  INDEX idx_security_created_at (created_at)
);
```


#### 6. ip_whitelist (IP白名单表)

```sql
CREATE TABLE ip_whitelist (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  description TEXT,
  added_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_ip_address (ip_address)
);
```

#### 7. refresh_tokens (刷新令牌表 - 已存在,需增强)

```sql
-- 增强现有表
ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(45);
ALTER TABLE refresh_tokens ADD COLUMN user_agent TEXT;
ALTER TABLE refresh_tokens ADD COLUMN last_used_at TIMESTAMP;

CREATE INDEX idx_refresh_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_expires_at ON refresh_tokens(expires_at);
```

#### 8. rate_limit_records (频率限制记录表 - Redis)

使用Redis存储,数据结构:

```
Key: rate_limit:{type}:{identifier}
Value: Sorted Set (timestamp as score)
TTL: 根据时间窗口设置
```

#### 9. confirmation_tokens (确认令牌表 - Redis)

使用Redis存储,数据结构:

```
Key: confirm_token:{token}
Value: JSON { userId, action, data, createdAt }
TTL: 300 seconds (5 minutes)
```

### 数据关系图

```
users
  ├─→ audit_logs (admin_id)
  ├─→ config_history (changed_by)
  ├─→ user_permissions (user_id)
  ├─→ security_events (user_id)
  ├─→ ip_whitelist (added_by)
  └─→ refresh_tokens (user_id)

permissions
  └─→ user_permissions (permission_code)
```

## Correctness Properties

*属性是一个特征或行为,应该在系统的所有有效执行中保持为真 - 本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### Property Reflection

在编写properties之前,我们需要识别和消除冗余:

**合并的Properties:**
- 1.1和1.2可以合并为一个property: "最后管理员保护"
- 2.1和2.2可以合并为: "所有敏感操作都被审计"
- 11.1-11.6可以合并为: "安全响应头完整性"
- 7.2和7.3可以合并为: "密码变更使会话失效"

**移除的Properties:**
- 2.5和2.6是2.3的子集(日志字段完整性已覆盖查询和显示)
- 3.4被2.1覆盖(所有敏感操作都被审计,包括rate limit事件)
- 4.5和4.6是examples,不是properties
- 5.5, 6.5, 10.5, 12.2, 14.3是配置或代码结构,不是runtime properties
- 15.3, 16.4, 18.1, 18.5, 19.1是examples或UI features

### Correctness Properties

Property 1: 最后管理员保护
*For any* user deletion or role change operation, if the target user is the last admin in the system, then the operation should be rejected and an audit log entry should be created.
**Validates: Requirements 1.1, 1.2, 1.4**

Property 2: 管理员计数准确性
*For any* database state, counting users with role='admin' should return the exact number of admin users in the system.
**Validates: Requirements 1.3**

Property 3: 敏感操作审计完整性
*For any* sensitive operation (user management, config changes, deletions), an audit log entry should be created containing admin ID, action type, target info, details, IP address, user agent, and timestamp.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 4: 审计日志持久化
*For any* audit log creation, the log entry should be immediately queryable from the database.
**Validates: Requirements 2.4**

Property 5: 频率限制执行
*For any* operation type with configured rate limit, when the limit is exceeded within the time window, subsequent requests should be rejected with 429 status code.
**Validates: Requirements 3.1, 3.2**

Property 6: 滑动窗口算法正确性
*For any* sequence of requests, the rate limit should count only requests within the sliding time window, not fixed time buckets.
**Validates: Requirements 3.3**

Property 7: 差异化频率限制
*For any* two different operation types, they should have independent rate limit counters and configurations.
**Validates: Requirements 3.5**

Property 8: 确认令牌生成和存储
*For any* sensitive operation initiation, a unique confirmation token should be generated and stored in Redis with 5-minute TTL.
**Validates: Requirements 4.1, 4.2**

Property 9: 确认令牌一次性使用
*For any* confirmation token, after it is successfully validated and used once, it should be deleted and subsequent attempts to use it should fail.
**Validates: Requirements 4.3, 4.4**

Property 10: 配置变更通知
*For any* critical configuration modification, email notifications should be sent to all admin users containing the change details (key, old value, new value, changed by, timestamp, IP).
**Validates: Requirements 5.1, 5.2**

Property 11: 通知失败重试
*For any* notification that fails to send, the system should retry up to 3 times and log each failure.
**Validates: Requirements 5.3**

Property 12: 通知批处理
*For any* set of configuration changes occurring within 5 minutes, they should be batched into a single notification rather than sending individual notifications.
**Validates: Requirements 5.4**

Property 13: 配置历史记录
*For any* configuration modification, the old value should be saved to config_history table before applying the new value.
**Validates: Requirements 6.1, 6.2**

Property 14: 配置回滚正确性
*For any* configuration value, after changing it and then rolling back to a previous version, the value should match the historical value.
**Validates: Requirements 6.3**

Property 15: 回滚操作审计
*For any* rollback operation, a new entry should be created in config_history recording the rollback as a configuration change.
**Validates: Requirements 6.4**

Property 16: 双令牌生成
*For any* successful login, the system should generate both an access token (1 hour expiry) and a refresh token (7 days expiry).
**Validates: Requirements 7.1**

Property 17: 密码变更使会话失效
*For any* password change (user-initiated or admin reset), all existing refresh tokens for that user should be invalidated, except the current session token for user-initiated changes.
**Validates: Requirements 7.2, 7.3**

Property 18: 刷新令牌数据库验证
*For any* refresh token usage, the token should be validated against the database before issuing a new access token.
**Validates: Requirements 7.4**

Property 19: 登出令牌清理
*For any* logout operation, the refresh token should be deleted from the database and subsequent attempts to use it should fail.
**Validates: Requirements 7.5**

Property 20: 并发会话限制
*For any* user, the number of active refresh tokens should not exceed the configured maximum (5 sessions).
**Validates: Requirements 7.6**

Property 21: 密码长度验证
*For any* password registration or change, passwords shorter than 8 characters should be rejected.
**Validates: Requirements 8.1**

Property 22: 密码复杂度验证
*For any* password, it should contain at least one uppercase letter, one lowercase letter, and one number, otherwise it should be rejected.
**Validates: Requirements 8.2**

Property 23: 账户锁定机制
*For any* user account, after 5 failed login attempts within 15 minutes, the account should be locked for 15 minutes.
**Validates: Requirements 8.3**

Property 24: 临时密码标记
*For any* admin password reset, the is_temp_password flag should be set to true and the user should be required to change password on next login.
**Validates: Requirements 8.4, 8.5**

Property 25: 密码重用防止
*For any* password change, if the new password matches any of the last 3 passwords, it should be rejected.
**Validates: Requirements 8.6**

Property 26: IP白名单执行
*For any* admin route request when IP whitelist is enabled and non-empty, requests from IPs not in the whitelist should be rejected with 403 status.
**Validates: Requirements 9.1, 9.2**

Property 27: IP白名单CRUD操作
*For any* IP whitelist management operation (add, remove, list), the operation should succeed and the whitelist should reflect the changes.
**Validates: Requirements 9.3**

Property 28: IP格式验证
*For any* IP address being added to whitelist, invalid IP formats should be rejected.
**Validates: Requirements 9.4**

Property 29: CIDR范围支持
*For any* IP address within a whitelisted CIDR range, access should be allowed.
**Validates: Requirements 9.5**

Property 30: 空白名单默认行为
*For any* request when IP whitelist is empty, access should be allowed from all IP addresses.
**Validates: Requirements 9.6**

Property 31: 新IP登录检测
*For any* login from an IP address not previously used by that user, a security event should be logged.
**Validates: Requirements 10.1**

Property 32: 高频操作检测
*For any* admin user performing more than 50 operations within 5 minutes, the activity should be flagged as suspicious and an alert should be sent.
**Validates: Requirements 10.2**

Property 33: 失败登录IP封禁
*For any* IP address with multiple failed login attempts exceeding the threshold, the IP should be temporarily blocked for 1 hour.
**Validates: Requirements 10.3**

Property 34: 账户妥协检测
*For any* user account showing signs of compromise (e.g., logins from multiple countries), the account should be locked and admins should be notified.
**Validates: Requirements 10.4**

Property 35: 安全响应头完整性
*For any* HTTP response, the following security headers should be present: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, X-XSS-Protection, and X-Powered-By should be absent.
**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**

Property 36: 输入类型和格式验证
*For any* user input, data types and formats should be validated before processing, and invalid inputs should be rejected.
**Validates: Requirements 12.1**

Property 37: HTML清理
*For any* user-generated content being rendered, HTML should be sanitized to remove potentially malicious scripts.
**Validates: Requirements 12.3**

Property 38: 文件上传验证
*For any* file upload, file type and size should be validated, and invalid files should be rejected.
**Validates: Requirements 12.4**

Property 39: 恶意输入模式拒绝
*For any* request containing known malicious input patterns (SQL injection, XSS), the request should be rejected.
**Validates: Requirements 12.5**

Property 40: CSRF令牌生成
*For any* form access, a unique CSRF token should be generated and included in the response.
**Validates: Requirements 13.1**

Property 41: CSRF令牌验证
*For any* state-changing request (POST, PUT, DELETE), the CSRF token should be validated, and requests with missing or invalid tokens should be rejected with 403 status.
**Validates: Requirements 13.2, 13.3**

Property 42: CSRF令牌一次性使用
*For any* CSRF token, after successful use, it should be marked as consumed and cannot be reused.
**Validates: Requirements 13.4**

Property 43: SameSite Cookie属性
*For any* cookie set by the system, the SameSite attribute should be set to Strict.
**Validates: Requirements 13.5**

Property 44: 密码哈希算法
*For any* password storage, bcrypt with cost factor 10 should be used for hashing.
**Validates: Requirements 14.1**

Property 45: 敏感配置加密
*For any* sensitive configuration value (API keys, secrets), AES-256 encryption should be used for storage.
**Validates: Requirements 14.2**

Property 46: 刷新令牌哈希存储
*For any* refresh token storage, the token should be hashed before storing in the database.
**Validates: Requirements 14.4**

Property 47: 安全随机数生成
*For any* token or secret generation, crypto.randomBytes should be used for secure randomness.
**Validates: Requirements 14.5**

Property 48: 权限检查执行
*For any* operation requiring specific permission, the system should verify the user has that permission before allowing the operation.
**Validates: Requirements 15.1, 15.2**

Property 49: 权限授予和撤销
*For any* permission grant or revoke operation, the change should be persisted and immediately reflected in permission checks.
**Validates: Requirements 15.4**

Property 50: 权限变更审计
*For any* permission change (grant or revoke), an audit log entry should be created with grantor, grantee, permission, and timestamp.
**Validates: Requirements 15.5**

Property 51: 安全事件日志分离
*For any* security-related event (authentication, authorization, suspicious activity), it should be logged to the security_events table with severity level.
**Validates: Requirements 16.1, 16.2**

Property 52: 关键事件即时告警
*For any* security event with critical severity, an immediate alert should be sent to all admins.
**Validates: Requirements 16.3**

Property 53: 安全日志导出
*For any* security log export request, logs should be exported in the requested format (JSON or CSV) with all required fields.
**Validates: Requirements 16.5**

Property 54: API认证要求
*For any* non-public API endpoint, requests without valid authentication should be rejected with 401 status.
**Validates: Requirements 17.1**

Property 55: API频率限制
*For any* API endpoint with configured rate limit, when exceeded, requests should be rejected with 429 status and Retry-After header.
**Validates: Requirements 17.2, 17.3**

Property 56: API负载验证
*For any* API request, the payload should be validated against the defined schema, and invalid payloads should be rejected.
**Validates: Requirements 17.4**

Property 57: API请求日志
*For any* API request, it should be logged with endpoint, method, user, IP, and response status.
**Validates: Requirements 17.5**

Property 58: 安全配置验证
*For any* security configuration modification, the new value should be validated before being applied, and invalid values should be rejected.
**Validates: Requirements 18.2**

Property 59: 安全配置历史
*For any* security configuration change, a version history entry should be created.
**Validates: Requirements 18.3**

Property 60: 安全配置导入导出
*For any* security configuration, exporting and then importing should result in identical configuration values.
**Validates: Requirements 18.4**

Property 61: 安全检查问题报告
*For any* security check that finds issues (old temp passwords, dormant accounts, integrity problems), a report should be generated and admins should be notified.
**Validates: Requirements 19.2, 19.3, 19.4, 19.5**

Property 62: 暴力攻击自动封禁
*For any* detected brute force attack pattern, the source IP should be automatically blocked for 1 hour.
**Validates: Requirements 20.1**

Property 63: 账户妥协自动锁定
*For any* detected account compromise, the account should be automatically locked and notifications should be sent to the user and admins.
**Validates: Requirements 20.2**

Property 64: 可疑活动重新认证
*For any* suspicious admin activity detection, subsequent sensitive operations should require re-authentication.
**Validates: Requirements 20.3**

Property 65: 紧急锁定模式
*For any* emergency lockdown activation, all non-admin access should be disabled until lockdown is lifted.
**Validates: Requirements 20.4**

Property 66: 事件响应日志
*For any* automated security response action (IP block, account lock, etc.), the action should be logged in the incident response log.
**Validates: Requirements 20.5**


## Error Handling

### 错误分类

系统将错误分为以下类别:

1. **认证错误** (401)
   - 令牌缺失或无效
   - 令牌过期
   - 会话失效

2. **授权错误** (403)
   - 权限不足
   - IP不在白名单
   - CSRF令牌无效
   - 账户被锁定

3. **频率限制错误** (429)
   - 操作频率超限
   - API调用超限
   - 包含Retry-After头

4. **验证错误** (400)
   - 输入格式无效
   - 密码强度不足
   - 必填字段缺失

5. **业务逻辑错误** (400)
   - 不能删除最后管理员
   - 密码重用
   - 确认令牌过期

6. **服务器错误** (500)
   - 数据库连接失败
   - 外部服务不可用
   - 未预期的异常

### 错误响应格式

所有错误响应遵循统一格式:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // 错误代码
    message: string;        // 用户友好的错误消息
    details?: any;          // 详细错误信息(开发环境)
    retryAfter?: number;    // 重试等待时间(秒)
    requestId?: string;     // 请求ID用于追踪
  };
}
```

### 错误处理策略

```typescript
// 全局错误处理中间件
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // 记录错误
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.userId,
    ip: req.ip
  });
  
  // 安全错误额外记录到安全日志
  if (isSecurityError(err)) {
    securityMonitor.logSecurityEvent({
      type: 'error',
      severity: 'warning',
      message: err.message,
      details: { path: req.path, userId: (req as any).user?.userId },
      timestamp: new Date()
    });
  }
  
  // 返回适当的错误响应
  const errorResponse = formatErrorResponse(err);
  res.status(errorResponse.status).json(errorResponse.body);
});
```

### 安全错误处理原则

1. **不泄露敏感信息**: 错误消息不应包含系统内部细节
2. **统一错误格式**: 所有错误使用相同的响应结构
3. **记录详细日志**: 服务器端记录完整错误信息用于调试
4. **区分错误类型**: 使用适当的HTTP状态码
5. **提供恢复指导**: 告诉用户如何解决问题

## Testing Strategy

### 测试方法

系统将采用双重测试策略:

1. **单元测试**: 验证具体示例、边界情况和错误条件
2. **属性测试**: 验证跨所有输入的通用属性

两者互补且都是必需的:
- 单元测试捕获具体的bug
- 属性测试验证通用正确性

### 属性测试配置

使用fast-check库进行属性测试:

```typescript
import fc from 'fast-check';

// 每个属性测试至少运行100次迭代
const testConfig = {
  numRuns: 100,
  verbose: true
};
```

### 测试标签格式

每个属性测试必须使用注释引用设计文档中的属性:

```typescript
/**
 * Feature: system-security-foundation
 * Property 1: 最后管理员保护
 * For any user deletion or role change operation, if the target user 
 * is the last admin, then the operation should be rejected.
 */
test('Property 1: Last admin protection', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        adminCount: fc.integer({ min: 1, max: 5 }),
        targetIsAdmin: fc.boolean(),
        operation: fc.constantFrom('delete', 'demote')
      }),
      async ({ adminCount, targetIsAdmin, operation }) => {
        // Test implementation
      }
    ),
    testConfig
  );
});
```

### 测试覆盖范围

#### 核心安全功能测试

1. **认证和授权**
   - Property 16-20: 会话管理
   - Property 48-50: 权限控制
   - Property 54: API认证

2. **审计和日志**
   - Property 3-4: 审计日志
   - Property 50: 权限变更审计
   - Property 51-53: 安全事件日志
   - Property 57: API请求日志

3. **频率限制**
   - Property 5-7: 操作频率限制
   - Property 55: API频率限制

4. **输入验证**
   - Property 21-22: 密码验证
   - Property 28: IP格式验证
   - Property 36-39: 输入验证和清理
   - Property 56: API负载验证

5. **攻击防护**
   - Property 23: 账户锁定
   - Property 33: IP封禁
   - Property 35: 安全响应头
   - Property 40-43: CSRF保护
   - Property 62-63: 自动防护

6. **数据保护**
   - Property 44-47: 加密和哈希
   - Property 13-15: 配置历史和回滚

### 单元测试示例

```typescript
describe('AuditLogService', () => {
  test('should log user deletion with all required fields', async () => {
    const adminId = 1;
    const targetUserId = 2;
    const ipAddress = '192.168.1.1';
    const userAgent = 'Mozilla/5.0...';
    
    await auditLogService.logAction(
      adminId,
      'DELETE_USER',
      'user',
      targetUserId,
      { username: 'testuser' },
      ipAddress,
      userAgent
    );
    
    const logs = await auditLogService.queryLogs({ adminId });
    expect(logs.logs).toHaveLength(1);
    expect(logs.logs[0]).toMatchObject({
      adminId,
      action: 'DELETE_USER',
      targetType: 'user',
      targetId: targetUserId,
      ipAddress,
      userAgent
    });
  });
  
  test('should reject deletion of last admin', async () => {
    // Setup: Create database with only one admin
    await setupSingleAdmin();
    
    // Attempt to delete the last admin
    await expect(
      userService.deleteUser(lastAdminId)
    ).rejects.toThrow('不能删除最后一个管理员');
    
    // Verify admin still exists
    const admin = await userService.getUserById(lastAdminId);
    expect(admin).not.toBeNull();
  });
});
```

### 属性测试示例

```typescript
/**
 * Feature: system-security-foundation
 * Property 5: 频率限制执行
 */
describe('Property 5: Rate limit enforcement', () => {
  test('should reject requests when rate limit is exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          windowMs: fc.integer({ min: 1000, max: 60000 }),
          maxRequests: fc.integer({ min: 1, max: 10 }),
          requestCount: fc.integer({ min: 1, max: 20 })
        }),
        async ({ windowMs, maxRequests, requestCount }) => {
          const config = { windowMs, maxRequests };
          const key = `test:${Date.now()}:${Math.random()}`;
          
          let allowedCount = 0;
          let rejectedCount = 0;
          
          for (let i = 0; i < requestCount; i++) {
            const result = await rateLimitService.checkLimit(key, config);
            if (result.allowed) {
              await rateLimitService.recordRequest(key);
              allowedCount++;
            } else {
              rejectedCount++;
            }
          }
          
          // Property: allowed count should not exceed maxRequests
          expect(allowedCount).toBeLessThanOrEqual(maxRequests);
          
          // Property: if requestCount > maxRequests, some should be rejected
          if (requestCount > maxRequests) {
            expect(rejectedCount).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 集成测试

测试完整的安全流程:

```typescript
describe('Security Integration Tests', () => {
  test('complete security flow: login -> operation -> audit', async () => {
    // 1. Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
    
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.data.token;
    
    // 2. Perform sensitive operation
    const deleteResponse = await request(app)
      .delete('/api/admin/users/2')
      .set('Authorization', `Bearer ${token}`);
    
    expect(deleteResponse.status).toBe(200);
    
    // 3. Verify audit log
    const logsResponse = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    
    expect(logsResponse.body.data.logs).toContainEqual(
      expect.objectContaining({
        action: 'DELETE_USER',
        targetId: 2
      })
    );
  });
});
```

### 测试数据生成器

为属性测试创建智能生成器:

```typescript
// 生成有效的用户数据
const validUserArb = fc.record({
  username: fc.string({ minLength: 3, maxLength: 20 })
    .filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
  password: fc.string({ minLength: 8, maxLength: 50 })
    .filter(s => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)),
  role: fc.constantFrom('admin', 'user')
});

// 生成有效的IP地址
const validIPArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// 生成CIDR范围
const cidrArb = fc.tuple(
  validIPArb,
  fc.integer({ min: 0, max: 32 })
).map(([ip, prefix]) => `${ip}/${prefix}`);
```

### 性能测试

验证安全机制不会显著影响性能:

```typescript
describe('Performance Tests', () => {
  test('rate limiter should handle 1000 requests in < 1 second', async () => {
    const start = Date.now();
    const promises = [];
    
    for (let i = 0; i < 1000; i++) {
      promises.push(
        rateLimitService.checkLimit(`test:${i}`, {
          windowMs: 60000,
          maxRequests: 100
        })
      );
    }
    
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });
});
```

### 测试环境

- **单元测试**: 使用内存数据库(SQLite)和Redis mock
- **集成测试**: 使用Docker容器运行真实PostgreSQL和Redis
- **属性测试**: 使用隔离的测试数据库,每次测试后清理

### CI/CD集成

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run property tests
        run: npm run test:property
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Generate coverage report
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Implementation Notes

### 实施优先级

**阶段1: 基础安全 (1-2周)**
- Property 1-4: 管理员保护和审计日志
- Property 16-20: 会话管理增强
- Property 21-25: 密码安全策略
- Property 5-7: 基础频率限制

**阶段2: 访问控制 (1周)**
- Property 26-30: IP白名单
- Property 48-50: 权限细粒度控制
- Property 54-57: API安全

**阶段3: 攻击防护 (1-2周)**
- Property 35: 安全响应头
- Property 36-39: 输入验证
- Property 40-43: CSRF保护
- Property 44-47: 数据加密

**阶段4: 监控和响应 (1周)**
- Property 31-34: 异常检测
- Property 51-53: 安全监控
- Property 61-66: 自动响应

**阶段5: 配置管理 (1周)**
- Property 8-15: 确认令牌和配置历史
- Property 58-60: 安全配置管理

### 技术依赖

```json
{
  "dependencies": {
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "express-rate-limit": "^6.7.0",
    "helmet": "^7.0.0",
    "validator": "^13.9.0",
    "dompurify": "^3.0.0",
    "winston": "^3.8.0"
  },
  "devDependencies": {
    "fast-check": "^3.8.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "supertest": "^6.3.0"
  }
}
```

### 配置管理

所有安全配置应该通过环境变量或配置文件管理:

```typescript
// config/security.ts
export const securityConfig = {
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: '1h',
    refreshTokenExpiry: '7d'
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    preventReuse: 3,
    bcryptCost: 10
  },
  rateLimit: {
    login: { windowMs: 15 * 60 * 1000, max: 5 },
    api: { windowMs: 15 * 60 * 1000, max: 100 },
    sensitiveOp: { windowMs: 60 * 60 * 1000, max: 20 }
  },
  session: {
    maxConcurrent: 5,
    inactivityTimeout: 30 * 60 * 1000
  },
  ipWhitelist: {
    enabled: process.env.IP_WHITELIST_ENABLED === 'true',
    ips: process.env.IP_WHITELIST?.split(',') || []
  }
};
```

### 监控和告警

实施全面的监控:

```typescript
// 关键指标
const securityMetrics = {
  failedLogins: new Counter('security_failed_logins_total'),
  blockedIPs: new Gauge('security_blocked_ips'),
  rateLimitHits: new Counter('security_rate_limit_hits_total'),
  suspiciousActivities: new Counter('security_suspicious_activities_total'),
  auditLogWrites: new Counter('security_audit_log_writes_total')
};
```

### 文档要求

每个安全功能必须包含:
1. 功能说明
2. 使用示例
3. 安全考虑
4. 故障排除指南
5. 测试覆盖报告
