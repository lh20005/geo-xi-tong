/**
 * 权限工具函数
 */

export interface UserInfo {
  id: number;
  username: string;
  email?: string;
  role: string;
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser(): UserInfo | null {
  try {
    const userInfoStr = localStorage.getItem('user_info');
    console.log('[Auth] localStorage user_info:', userInfoStr);
    if (!userInfoStr) return null;
    const user = JSON.parse(userInfoStr);
    console.log('[Auth] 解析后的用户信息:', user);
    return user;
  } catch (error) {
    console.error('[Auth] 解析用户信息失败:', error);
    return null;
  }
}

/**
 * 检查用户是否是管理员
 */
export function isAdmin(): boolean {
  const user = getCurrentUser();
  const result = user?.role === 'admin';
  console.log('[Auth] isAdmin 检查:', { user, result });
  return result;
}

/**
 * 检查用户是否有特定权限
 */
export function hasPermission(permission: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  
  // 管理员拥有所有权限
  if (user.role === 'admin') return true;
  
  // 根据权限类型判断
  switch (permission) {
    case 'system:config':
      return user.role === 'admin';
    case 'system:settings':
      return user.role === 'admin';
    default:
      return true; // 其他权限默认允许
  }
}
