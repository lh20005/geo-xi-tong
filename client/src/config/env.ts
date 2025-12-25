/**
 * 环境配置
 * 根据环境自动选择API和WebSocket URL
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const config = {
  // API基础URL
  apiUrl: import.meta.env.VITE_API_URL || 
    (isProduction ? 'https://your-domain.com/api' : 'http://localhost:3000/api'),
  
  // WebSocket URL
  wsUrl: import.meta.env.VITE_WS_URL || 
    (isProduction ? 'wss://your-domain.com/ws' : 'ws://localhost:3000/ws'),
  
  // Landing页面URL（退出登录时跳转）
  landingUrl: import.meta.env.VITE_LANDING_URL || 
    (isProduction ? 'https://your-domain.com' : 'http://localhost:8080'),
  
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
