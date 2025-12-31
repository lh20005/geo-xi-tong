/**
 * Cookie 规范化工具
 * 
 * 用于确保 Cookie 符合 Playwright 的要求
 */

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None'; // 严格类型定义
  url?: string;
  partitionKey?: string;
  [key: string]: any;
}

/**
 * 规范化 Cookie 的 sameSite 属性
 * 
 * Playwright 要求 sameSite 必须是以下值之一：
 * - Strict: 最严格，Cookie 只在同站请求时发送
 * - Lax: 默认值，允许部分跨站请求携带 Cookie（如导航）
 * - None: 允许所有跨站请求携带 Cookie（需要 Secure 属性）
 * 
 * @param cookies - 原始 Cookie 数组
 * @returns 规范化后的 Cookie 数组
 */
export function normalizeCookies(cookies: any[]): Cookie[] {
  if (!cookies || !Array.isArray(cookies)) {
    return [];
  }

  return cookies.map((cookie) => {
    const normalized: Cookie = { ...cookie };

    // 规范化 sameSite 属性
    if (cookie.sameSite) {
      const sameSite = cookie.sameSite;
      
      // 如果不是有效值，转换为有效值
      if (!['Strict', 'Lax', 'None'].includes(sameSite)) {
        // 尝试转换常见的小写形式
        const lowerCase = sameSite.toLowerCase();
        if (lowerCase === 'strict') {
          normalized.sameSite = 'Strict';
        } else if (lowerCase === 'lax') {
          normalized.sameSite = 'Lax';
        } else if (lowerCase === 'none') {
          normalized.sameSite = 'None';
        } else {
          // 其他情况使用默认值 Lax
          normalized.sameSite = 'Lax';
          console.warn(`[Cookie规范化] 未知的 sameSite 值 "${sameSite}"，已转换为 "Lax"`);
        }
      } else {
        normalized.sameSite = sameSite as 'Strict' | 'Lax' | 'None';
      }
    }

    // 如果 sameSite 是 None，确保 secure 为 true
    if (normalized.sameSite === 'None' && !normalized.secure) {
      console.warn(`[Cookie规范化] sameSite=None 需要 secure=true，已自动设置`);
      normalized.secure = true;
    }

    return normalized;
  });
}

/**
 * 验证 Cookie 是否有效
 * 
 * @param cookie - 要验证的 Cookie
 * @returns 是否有效
 */
export function isValidCookie(cookie: Cookie): boolean {
  if (!cookie || typeof cookie !== 'object') {
    return false;
  }

  // 必需字段
  if (!cookie.name || !cookie.value) {
    return false;
  }

  // sameSite 必须是有效值
  if (cookie.sameSite && !['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
    return false;
  }

  // sameSite=None 必须配合 secure=true
  if (cookie.sameSite === 'None' && !cookie.secure) {
    return false;
  }

  return true;
}

/**
 * 过滤并规范化 Cookie
 * 
 * @param cookies - 原始 Cookie 数组
 * @returns 有效且规范化的 Cookie 数组
 */
export function filterAndNormalizeCookies(cookies: Cookie[]): Cookie[] {
  const normalized = normalizeCookies(cookies);
  return normalized.filter((cookie) => {
    const valid = isValidCookie(cookie);
    if (!valid) {
      console.warn(`[Cookie规范化] 无效的 Cookie 已过滤:`, cookie.name);
    }
    return valid;
  });
}
