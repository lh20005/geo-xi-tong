/**
 * Landing页面环境配置
 * 智能环境检测：自动根据运行环境选择正确的配置
 * 更新时间：2026-01-11 - 完全运行时动态构建，避免任何静态内联
 */

// 配置版本号
const CONFIG_VERSION = '1.0.5-20260111-full-runtime';

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// 创建配置的工厂函数 - 每次访问时动态计算
const createConfig = () => {
  // 运行时获取当前位置信息
  const loc = window.location;
  const hostname = loc.hostname;
  const protocol = loc.protocol;
  const port = loc.port;
  
  // 环境检测
  const isNgrok = hostname.indexOf('ngrok') !== -1;
  const isLocalDev = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.indexOf('192.168.') === 0 ||
                    hostname.indexOf('10.') === 0 ||
                    hostname.indexOf('.local') !== -1;
  const isRemoteTestServer = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const isProductionDomain = !isLocalDev && !isRemoteTestServer && !isNgrok && hostname.indexOf('.') !== -1;
  
  // 动态构建 URL
  let apiUrl: string;
  let clientUrl: string;
  let environment: string;
  
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_CLIENT_URL) {
    // 环境变量优先
    apiUrl = import.meta.env.VITE_API_URL;
    clientUrl = import.meta.env.VITE_CLIENT_URL;
    environment = 'custom';
  } else if (isNgrok) {
    // ngrok: API 同域，客户端本地
    apiUrl = protocol + '//' + loc.host + '/api';
    clientUrl = protocol + '//' + hostname + ':5173';
    environment = 'ngrok';
  } else if (isLocalDev) {
    // 本地开发
    apiUrl = protocol + '//' + hostname + ':3000/api';
    clientUrl = protocol + '//' + hostname + ':5173';
    environment = 'local';
  } else {
    // 远程服务器（IP 或域名）- 统一使用 /app 路径
    apiUrl = protocol + '//' + hostname + (port ? ':' + port : '') + '/api';
    clientUrl = protocol + '//' + hostname + (port ? ':' + port : '') + '/app';
    environment = isRemoteTestServer ? 'remote-test' : 'production';
  }
  
  return {
    apiUrl,
    clientUrl,
    environment,
    isDevelopment,
    isProduction,
    isLocalDev,
    isRemoteTestServer,
    isProductionDomain,
    isNgrok,
    appName: 'GEO优化SaaS系统',
    version: '1.0.0',
    configVersion: CONFIG_VERSION,
  };
};

// 导出配置（运行时计算）
export const config = createConfig();

// 调试日志
console.log('[Landing Config]', {
  v: CONFIG_VERSION,
  env: config.environment,
  api: config.apiUrl,
  client: config.clientUrl
});
