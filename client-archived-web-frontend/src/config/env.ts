/**
 * 环境配置
 * 根据环境自动选择API和WebSocket URL
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// 获取当前页面的协议和主机
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

const getWsProtocol = () => {
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  }
  return 'ws:';
};

const getWsUrl = () => {
  if (typeof window !== 'undefined') {
    return `${getWsProtocol()}//${window.location.host}/ws`;
  }
  return 'ws://localhost:3000/ws';
};

export const config = {
  // API基础URL - 生产环境使用相对路径，开发环境使用localhost
  apiUrl: import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api`
    : (isProduction ? '/api' : 'http://localhost:3000/api'),
  
  // WebSocket URL - 生产环境动态获取，开发环境使用localhost
  wsUrl: import.meta.env.VITE_WS_URL || 
    (isProduction ? getWsUrl() : 'ws://localhost:3000/ws'),
  
  // Landing页面URL（退出登录时跳转）- 生产环境使用当前域名
  landingUrl: import.meta.env.VITE_LANDING_URL || 
    (isProduction ? getBaseUrl() : 'http://localhost:8080'),
  
  // 环境标识
  isDevelopment,
  isProduction,
  
  // 其他配置
  appName: 'GEO优化系统',
  version: '1.0.0',
};

// 导出常用的URL常量（向后兼容）
export const API_BASE_URL = config.apiUrl;
export const WS_URL = config.wsUrl;

// 开发环境日志
if (isDevelopment) {
  console.log('[Config] 环境配置:', config);
}
