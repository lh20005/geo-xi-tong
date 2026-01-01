-- 修复平台账号隔离问题
-- 检查并修复 platform_accounts 表中的 user_id 归属

-- 1. 查看当前用户信息
SELECT id, username, email, created_at 
FROM users 
WHERE username IN ('lzc2005', 'testuser')
ORDER BY id;

-- 2. 查看所有平台账号及其归属
SELECT 
  pa.id,
  pa.platform_id,
  pa.account_name,
  pa.real_username,
  pa.user_id,
  u.username as owner_username,
  pa.created_at,
  pa.updated_at
FROM platform_accounts pa
LEFT JOIN users u ON pa.user_id = u.id
WHERE u.username IN ('lzc2005', 'testuser')
ORDER BY pa.user_id, pa.created_at DESC;

-- 3. 检查是否有重复的账号（相同平台、相同真实用户名但属于不同用户）
SELECT 
  pa1.id as account1_id,
  pa1.user_id as user1_id,
  u1.username as user1_name,
  pa2.id as account2_id,
  pa2.user_id as user2_id,
  u2.username as user2_name,
  pa1.platform_id,
  pa1.real_username
FROM platform_accounts pa1
JOIN platform_accounts pa2 ON 
  pa1.platform_id = pa2.platform_id 
  AND pa1.real_username = pa2.real_username
  AND pa1.id < pa2.id
LEFT JOIN users u1 ON pa1.user_id = u1.id
LEFT JOIN users u2 ON pa2.user_id = u2.id
WHERE u1.username IN ('lzc2005', 'testuser')
   OR u2.username IN ('lzc2005', 'testuser');

-- 4. 如果需要修复：将错误归属的账号移动到正确的用户下
-- 注意：执行前请先确认哪些账号需要移动！

-- 示例：将账号 ID 为 X 的账号移动到 lzc2005 用户下
-- UPDATE platform_accounts 
-- SET user_id = (SELECT id FROM users WHERE username = 'lzc2005')
-- WHERE id = X;

-- 示例：将账号 ID 为 Y 的账号移动到 testuser 用户下
-- UPDATE platform_accounts 
-- SET user_id = (SELECT id FROM users WHERE username = 'testuser')
-- WHERE id = Y;

-- 5. 删除重复的账号（如果确认是重复的）
-- DELETE FROM platform_accounts WHERE id = X;
