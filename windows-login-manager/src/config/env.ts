/**
 * 环境配置
 * 根据环境自动选择API和WebSocket URL
 * Electron 桌面应用版本
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// 在 Electron 环境中，使用环境变量或默认值
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// 构建 WebSocket URL，确保包含 /ws 路径
let wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace('http', 'ws');
if (!wsBaseUrl.endsWith('/ws')) {
  wsBaseUrl = wsBaseUrl.replace(/\/$/, '') + '/ws';
}

export const config = {
  // API基础URL（包含 /api 路径）
  apiUrl: `${API_BASE_URL}/api`,
  
  // WebSocket URL（确保包含 /ws 路径）
  wsUrl: wsBaseUrl,
  
  // Landing页面URL（退出登录时跳转）- Electron 中不需要
  landingUrl: import.meta.env.VITE_LANDING_URL || 'http://localhost:8080',
  
  // 环境标识
  isDevelopment,
  isProduction,
  
  // 其他配置
  appName: 'GEO优化系统 - 桌面版',
  version: '1.0.0',
};

// 导出常用的URL常量（向后兼容）
export { API_BASE_URL };
export const WS_URL = config.wsUrl;

// 开发环境日志
if (isDevelopment) {
  console.log('[Config] 环境配置:', config);
}
