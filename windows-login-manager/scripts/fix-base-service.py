#!/usr/bin/env python3
"""修复 BaseServicePostgres.ts 中的 jwt 问题"""

import re

# 读取文件
with open('windows-login-manager/electron/services/BaseServicePostgres.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 定义要替换的旧代码（从 getCurrentUserId 到 getStoredToken 方法结束）
old_code = r'''  /\*\*
   \* 从 JWT token 获取当前用户 ID
   \* 
   \* 这是唯一的 user_id 来源，保证数据完整性
   \* 替代原有的数据库外键约束：user_id → users\(id\)
   \* 
   \* @throws \{Error\} 如果用户未登录或 token 无效
   \*/
  protected getCurrentUserId\(\): number \{
    // 如果已经获取过，直接返回
    if \(this\.userId !== null\) \{
      return this\.userId;
    \}

    try \{
      // 从本地存储获取 token
      // 注意：在 Electron 主进程中，需要通过 IPC 从渲染进程获取
      // 这里假设已经通过某种方式设置了 userId
      const token = this\.getStoredToken\(\);
      
      if \(!token\) \{
        throw new Error\('用户未登录：未找到认证令牌'\);
      \}

      // 解码 JWT token（服务器签发，无法伪造）
      const decoded = jwt\.decode\(token\) as \{ userId: number \} \| null;
      
      if \(!decoded \|\| !decoded\.userId\) \{
        throw new Error\('无效的认证令牌：无法解析用户 ID'\);
      \}

      this\.userId = decoded\.userId;
      return this\.userId;
    \} catch \(error\) \{
      log\.error\(`\$\{this\.serviceName\}: 获取用户 ID 失败:`, error\);
      throw new Error\(`认证失败: \$\{error instanceof Error \? error\.message : '未知错误'\}`\);
    \}
  \}

  /\*\*
   \* 设置用户 ID（用于测试或特殊场景）
   \*/
  public setUserId\(userId: number\): void \{
    this\.userId = userId;
  \}

  /\*\*
   \* 获取存储的 token
   \* 
   \* 注意：这个方法需要根据实际的 token 存储方式实现
   \* 可能需要通过 IPC 从渲染进程获取
   \*/
  protected getStoredToken\(\): string \| null \{
    // TODO: 实现实际的 token 获取逻辑
    // 方案 1: 从文件系统读取
    // 方案 2: 通过 IPC 从渲染进程获取
    // 方案 3: 在服务初始化时传入
    
    // 临时实现：返回 null，子类可以覆盖
    return null;
  \}

  /\*\*
   \* 验证 user_id（所有操作前调用）
   \* 
   \* 替代原有的数据库外键约束检查
   \*/
  protected validateUserId\(\): void \{
    const userId = this\.getCurrentUserId\(\);'''

# 新代码
new_code = '''  /**
   * 获取当前用户 ID
   * 
   * 这是唯一的 user_id 来源，保证数据完整性
   * 替代原有的数据库外键约束：user_id → users(id)
   * 
   * @throws {Error} 如果用户未登录
   */
  protected getCurrentUserId(): number {
    if (this.userId !== null) {
      return this.userId;
    }
    throw new Error('用户未登录：未设置用户 ID');
  }

  /**
   * 设置当前用户 ID
   * 
   * 由 ServiceFactory 调用，从 storageManager 获取用户信息后设置
   * 
   * @param userId 用户 ID
   */
  public setUserId(userId: number): void {
    this.userId = userId;
  }

  /**
   * 验证用户 ID 是否已设置
   * 
   * 在所有需要 user_id 的操作前调用
   * 
   * @throws {Error} 如果用户未登录
   */
  protected validateUserId(): void {
    const userId = this.getCurrentUserId();'''

# 替换
content = re.sub(old_code, new_code, content, flags=re.DOTALL)

# 写回文件
with open('windows-login-manager/electron/services/BaseServicePostgres.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ BaseServicePostgres.ts 修复完成")
