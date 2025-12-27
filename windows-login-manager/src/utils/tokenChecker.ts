/**
 * Token 检查和自动清除工具
 */

/**
 * 检查 token 是否过期
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // 转换为毫秒
    const now = Date.now();
    return exp < now;
  } catch (error) {
    console.error('[TokenChecker] 解析 token 失败:', error);
    return true; // 解析失败视为过期
  }
}

/**
 * 检查并清除过期的 token
 * @returns true 如果清除了过期 token
 */
export function checkAndClearExpiredToken(): boolean {
  const token = localStorage.getItem('auth_token');
  const refreshToken = localStorage.getItem('refresh_token');
  
  // 如果没有 token，不需要清除
  if (!token && !refreshToken) {
    return false;
  }
  
  let shouldClear = false;
  
  // 检查 access token
  if (token) {
    if (isTokenExpired(token)) {
      console.log('[TokenChecker] Access token 已过期');
      shouldClear = true;
    }
  }
  
  // 检查 refresh token
  if (refreshToken && !shouldClear) {
    if (isTokenExpired(refreshToken)) {
      console.log('[TokenChecker] Refresh token 已过期');
      shouldClear = true;
    }
  }
  
  // 如果需要清除
  if (shouldClear) {
    console.log('[TokenChecker] 清除过期的认证信息');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    return true;
  }
  
  return false;
}

/**
 * 自动跳转到登录页（如果 token 过期）
 */
export function autoRedirectIfExpired(): void {
  if (checkAndClearExpiredToken()) {
    const landingUrl = import.meta.env.VITE_LANDING_URL || 'http://localhost:8080';
    const message = '登录已过期，请重新登录';
    
    console.log('[TokenChecker] 跳转到登录页');
    window.location.href = `${landingUrl}/login?expired=true&message=${encodeURIComponent(message)}`;
  }
}

/**
 * 在应用启动时初始化 token 检查
 */
export function initTokenChecker(): void {
  console.log('[TokenChecker] 初始化 token 检查器');
  
  // 立即检查一次
  autoRedirectIfExpired();
  
  // 每分钟检查一次
  setInterval(() => {
    autoRedirectIfExpired();
  }, 60000); // 60秒
}
