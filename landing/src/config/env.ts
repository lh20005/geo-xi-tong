/**
 * Landing页面环境配置
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const config = {
  // API基础URL
  apiUrl: import.meta.env.VITE_API_URL || 
    (isProduction ? 'https://your-domain.com/api' : 'http://localhost:3000/api'),
  
  // Client应用URL（登录成功后跳转）
  clientUrl: import.meta.env.VITE_CLIENT_URL || 
    (isProduction ? 'https://app.your-domain.com' : 'http://localhost:5173'),
  
  // 环境标识
  isDevelopment,
  isProduction,
  
  // 其他配置
  appName: 'GEO优化SaaS系统',
  version: '1.0.0',
};

// 开发环境日志
if (isDevelopment) {
  console.log('[Landing Config] 环境配置:', config);
}
