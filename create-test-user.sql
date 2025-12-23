-- 创建测试用户 SQL 脚本
-- 用于添加普通用户账号进行权限测试

-- 删除已存在的测试用户（如果有）
DELETE FROM users WHERE username = 'testuser';

-- 创建普通用户
-- 用户名: testuser
-- 密码: test123
-- 角色: user (普通用户)
INSERT INTO users (username, password_hash, email, role) 
VALUES (
  'testuser', 
  '$2b$10$zAorZMYyuWbC/rvVl9k1HOlzTGCr3QmECk2OljPYqPLWrA7/pgeNK',  -- test123 的 bcrypt hash
  'testuser@example.com',
  'user'
);

-- 验证用户创建成功
SELECT 
  id,
  username,
  email,
  role,
  created_at
FROM users 
WHERE username IN ('admin', 'testuser')
ORDER BY role DESC, username;

-- 显示结果说明
\echo ''
\echo '✅ 测试用户创建成功！'
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📋 可用账号：'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo '1. 管理员账号（可以看到所有功能）：'
\echo '   用户名：admin'
\echo '   密码：  admin123'
\echo '   角色：  admin'
\echo ''
\echo '2. 普通用户账号（看不到系统设置和设置模块）：'
\echo '   用户名：testuser'
\echo '   密码：  test123'
\echo '   角色：  user'
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
