/**
 * Windows端权限工具函数
 */

export interface UserInfo {
  id: number;
  username: string;
  email?: string;
  role: string;
}

/**
 * 检查用户是否是管理员
 * @param user 用户信息对象
 */
export function isAdmin(user: UserInfo | null | undefined): boolean {
  return user?.role === 'admin';
}

/**
 * 检查用户是否有特定权限
 * @param user 用户信息对象
 * @param permission 权限标识
 */
export function hasPermission(user: UserInfo | null | undefined, permission: string): boolean {
  if (!user) return false;
  
  // 管理员拥有所有权限
  if (user.role === 'admin') return true;
  
  // 根据权限类型判断
  switch (permission) {
    case 'system:settings':
      return user.role === 'admin';
    default:
      return true; // 其他权限默认允许
  }
}
