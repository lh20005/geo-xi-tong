# 数据库迁移指南

## 概述

本指南描述如何为用户管理增强功能执行数据库迁移。

## 前提条件

- PostgreSQL 数据库已安装并运行
- 已配置 `DATABASE_URL` 环境变量
- 有数据库管理员权限

## 迁移步骤

### 1. 备份现有数据库

**重要：在执行任何迁移之前，请先备份数据库！**

```bash
# 备份数据库
pg_dump -U your_username -d geo_system > backup_$(date +%Y%m%d_%H%M%S).sql

# 或使用 pg_dump 导出为自定义格式
pg_dump -U your_username -Fc -d geo_system > backup_$(date +%Y%m%d_%H%M%S).dump
```

### 2. 执行迁移脚本

#### 方式 A: 使用迁移脚本（推荐）

```bash
cd server
npm run migrate:user-management
```

#### 方式 B: 手动执行 SQL

```bash
psql -U your_username -d geo_system -f server/db/migrations/add_user_management_fields.sql
```

### 3. 迁移 SQL 脚本内容

创建文件 `server/db/migrations/add_user_management_fields.sql`：

```sql
-- ============================================
-- 用户管理增强功能数据库迁移
-- 版本: 1.0
-- 日期: 2024-12-24
-- ============================================

BEGIN;

-- 1. 添加邀请码字段到 users 表
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(6) UNIQUE,
ADD COLUMN IF NOT EXISTS invited_by_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT FALSE;

-- 2. 为现有用户生成邀请码
-- 注意：这个函数会为每个没有邀请码的用户生成一个唯一的6字符邀请码
CREATE OR REPLACE FUNCTION generate_invitation_code() 
RETURNS VARCHAR(6) AS $$
DECLARE
    chars VARCHAR(36) := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result VARCHAR(6) := '';
    i INTEGER;
    code_exists BOOLEAN;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * 36 + 1)::int, 1);
        END LOOP;
        
        -- 检查代码是否已存在
        SELECT EXISTS(SELECT 1 FROM users WHERE invitation_code = result) INTO code_exists;
        
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 为现有用户生成邀请码
UPDATE users 
SET invitation_code = generate_invitation_code() 
WHERE invitation_code IS NULL;

-- 3. 设置 invitation_code 为 NOT NULL（现在所有用户都有邀请码了）
ALTER TABLE users 
ALTER COLUMN invitation_code SET NOT NULL;

-- 4. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_invitation_code ON users(invitation_code);
CREATE INDEX IF NOT EXISTS idx_users_invited_by_code ON users(invited_by_code);

-- 5. 添加外键约束
ALTER TABLE users 
ADD CONSTRAINT fk_invited_by 
FOREIGN KEY (invited_by_code) 
REFERENCES users(invitation_code) 
ON DELETE SET NULL;

-- 6. 创建 login_attempts 表用于限流
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE
);

-- 7. 为 login_attempts 表创建索引
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- 8. 清理函数（删除临时函数）
DROP FUNCTION IF EXISTS generate_invitation_code();

COMMIT;

-- 验证迁移
SELECT 
    COUNT(*) as total_users,
    COUNT(invitation_code) as users_with_code,
    COUNT(invited_by_code) as users_with_inviter
FROM users;

SELECT 'Migration completed successfully!' as status;
```

### 4. 验证迁移

执行以下查询验证迁移是否成功：

```sql
-- 检查新字段是否存在
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('invitation_code', 'invited_by_code', 'is_temp_password');

-- 检查所有用户是否都有邀请码
SELECT COUNT(*) as users_without_code
FROM users
WHERE invitation_code IS NULL;
-- 应该返回 0

-- 检查 login_attempts 表是否创建
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'login_attempts'
);
-- 应该返回 true

-- 检查索引是否创建
SELECT indexname
FROM pg_indexes
WHERE tablename = 'users'
AND indexname IN ('idx_users_invitation_code', 'idx_users_invited_by_code');
```

### 5. 回滚迁移（如果需要）

如果迁移出现问题，可以使用以下脚本回滚：

创建文件 `server/db/migrations/rollback_user_management.sql`：

```sql
-- ============================================
-- 回滚用户管理增强功能迁移
-- ============================================

BEGIN;

-- 1. 删除外键约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_invited_by;

-- 2. 删除索引
DROP INDEX IF EXISTS idx_users_invitation_code;
DROP INDEX IF EXISTS idx_users_invited_by_code;
DROP INDEX IF EXISTS idx_login_attempts_username;
DROP INDEX IF EXISTS idx_login_attempts_ip;
DROP INDEX IF EXISTS idx_login_attempts_attempted_at;

-- 3. 删除 login_attempts 表
DROP TABLE IF EXISTS login_attempts;

-- 4. 删除新增的列
ALTER TABLE users DROP COLUMN IF EXISTS invitation_code;
ALTER TABLE users DROP COLUMN IF EXISTS invited_by_code;
ALTER TABLE users DROP COLUMN IF EXISTS is_temp_password;

COMMIT;

SELECT 'Rollback completed!' as status;
```

执行回滚：

```bash
psql -U your_username -d geo_system -f server/db/migrations/rollback_user_management.sql
```

### 6. 恢复备份（最后手段）

如果回滚脚本也出现问题，可以从备份恢复：

```bash
# 从 SQL 备份恢复
psql -U your_username -d geo_system < backup_20241224_100000.sql

# 从自定义格式备份恢复
pg_restore -U your_username -d geo_system backup_20241224_100000.dump
```

## 迁移后任务

### 1. 为现有用户生成邀请码

如果有现有用户，迁移脚本会自动为他们生成邀请码。你可以查看：

```sql
SELECT id, username, invitation_code
FROM users
ORDER BY id;
```

### 2. 测试邀请功能

```sql
-- 测试邀请关系
-- 假设用户1邀请了用户2
UPDATE users SET invited_by_code = (SELECT invitation_code FROM users WHERE id = 1) WHERE id = 2;

-- 查看邀请统计
SELECT 
    u1.username as inviter,
    u1.invitation_code,
    COUNT(u2.id) as invited_count
FROM users u1
LEFT JOIN users u2 ON u2.invited_by_code = u1.invitation_code
GROUP BY u1.id, u1.username, u1.invitation_code;
```

### 3. 测试限流功能

```sql
-- 插入测试登录尝试
INSERT INTO login_attempts (username, ip_address, success)
VALUES ('testuser', '192.168.1.100', false);

-- 查看登录尝试记录
SELECT * FROM login_attempts
WHERE username = 'testuser'
ORDER BY attempted_at DESC;
```

## 常见问题

### Q1: 迁移失败，提示 "column already exists"

**A:** 这意味着某些字段已经存在。可以安全地忽略这些错误，或者修改迁移脚本使用 `ADD COLUMN IF NOT EXISTS`。

### Q2: 外键约束创建失败

**A:** 检查是否有 `invited_by_code` 指向不存在的 `invitation_code`。清理无效数据：

```sql
UPDATE users 
SET invited_by_code = NULL 
WHERE invited_by_code NOT IN (SELECT invitation_code FROM users);
```

### Q3: 如何为特定用户设置邀请关系？

**A:** 使用以下 SQL：

```sql
-- 设置用户2被用户1邀请
UPDATE users 
SET invited_by_code = (SELECT invitation_code FROM users WHERE id = 1)
WHERE id = 2;
```

### Q4: 如何清理旧的登录尝试记录？

**A:** 系统会自动每小时清理一次。手动清理：

```sql
DELETE FROM login_attempts 
WHERE attempted_at < NOW() - INTERVAL '1 hour';
```

## 性能优化建议

1. **定期清理 login_attempts 表**
   - 系统已配置自动清理
   - 可以设置更短的保留期以节省空间

2. **监控索引使用情况**
   ```sql
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   WHERE tablename IN ('users', 'login_attempts')
   ORDER BY idx_scan DESC;
   ```

3. **分析表统计信息**
   ```sql
   ANALYZE users;
   ANALYZE login_attempts;
   ```

## 生产环境注意事项

1. **在维护窗口执行迁移**
   - 选择低流量时段
   - 通知用户系统维护

2. **监控迁移过程**
   - 记录迁移开始和结束时间
   - 监控数据库性能指标

3. **准备回滚计划**
   - 测试回滚脚本
   - 准备快速恢复方案

4. **迁移后验证**
   - 测试所有用户管理功能
   - 验证邀请系统工作正常
   - 确认限流功能生效

## 联系支持

如果遇到迁移问题，请查看：
- 数据库日志：`/var/log/postgresql/`
- 应用日志：`server/logs/`
- 或联系技术支持

---

**文档版本**: 1.0  
**最后更新**: 2024-12-24
