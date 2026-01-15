/**
 * Cookie 规范化工具
 * 将各种格式的 Cookie 转换为 Playwright 兼容格式
 */

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * 规范化 Cookie 数组
 * 将各种格式的 Cookie 转换为 Playwright 兼容格式
 */
export function normalizeCookies(cookies: any[]): PlaywrightCookie[] {
  if (!Array.isArray(cookies)) {
    return [];
  }

  return cookies.map(cookie => {
    // 处理不同格式的 Cookie
    const normalized: PlaywrightCookie = {
      name: cookie.name || '',
      value: cookie.value || '',
      domain: cookie.domain || '',
      path: cookie.path || '/',
    };

    // 处理过期时间
    if (cookie.expires !== undefined) {
      // 如果是数字，直接使用
      if (typeof cookie.expires === 'number') {
        normalized.expires = cookie.expires;
      }
      // 如果是字符串，尝试解析
      else if (typeof cookie.expires === 'string') {
        const timestamp = Date.parse(cookie.expires);
        if (!isNaN(timestamp)) {
          normalized.expires = Math.floor(timestamp / 1000);
        }
      }
    } else if (cookie.expirationDate !== undefined) {
      // 某些格式使用 expirationDate
      normalized.expires = typeof cookie.expirationDate === 'number' 
        ? cookie.expirationDate 
        : Math.floor(Date.parse(cookie.expirationDate) / 1000);
    }

    // 处理 httpOnly
    if (cookie.httpOnly !== undefined) {
      normalized.httpOnly = Boolean(cookie.httpOnly);
    }

    // 处理 secure
    if (cookie.secure !== undefined) {
      normalized.secure = Boolean(cookie.secure);
    }

    // 处理 sameSite
    if (cookie.sameSite !== undefined) {
      const sameSite = String(cookie.sameSite).toLowerCase();
      if (sameSite === 'strict') {
        normalized.sameSite = 'Strict';
      } else if (sameSite === 'lax') {
        normalized.sameSite = 'Lax';
      } else if (sameSite === 'none') {
        normalized.sameSite = 'None';
      }
    }

    return normalized;
  }).filter(cookie => cookie.name && cookie.domain);
}

/**
 * 从字符串解析 Cookie
 * 支持 "name=value; name2=value2" 格式
 */
export function parseCookieString(cookieString: string, domain: string): PlaywrightCookie[] {
  if (!cookieString) {
    return [];
  }

  const cookies: PlaywrightCookie[] = [];
  const pairs = cookieString.split(';');

  for (const pair of pairs) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (name && valueParts.length > 0) {
      cookies.push({
        name: name.trim(),
        value: valueParts.join('=').trim(),
        domain,
        path: '/',
      });
    }
  }

  return cookies;
}
