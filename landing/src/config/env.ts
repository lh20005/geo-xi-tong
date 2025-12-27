/**
 * Landing页面环境配置
 * 智能环境检测：自动根据运行环境选择正确的配置
 * 更新时间：2025-12-27 - 修复IP地址访问时的重定向问题
 */

// 配置版本号（用于强制更新缓存）
const CONFIG_VERSION = '1.0.2-20251227-app-path-fix';

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// 智能环境检测函数
const detectEnvironment = () => {
  const hostname = window.location.hostname;
  
  // 本地开发环境检测
  const isLocalDev = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') ||
                    hostname.startsWith('10.') ||
                    hostname.endsWith('.local');
  
  // 远程测试服务器检测（IP地址）
  const isRemoteTestServer = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  
  // 生产域名检测
  const isProductionDomain = !isLocalDev && !isRemoteTestServer && hostname.includes('.');
  
  return {
    isLocalDev,
    isRemoteTestServer,
    isProductionDomain
  };
};

const env = detectEnvironment();

// 配置映射
const configs = {
  // 本地开发环境配置
  local: {
    apiUrl: 'http://localhost:3000/api',
    clientUrl: 'http://localhost:5173',  // 本地开发时前端在5173端口
    environment: 'local'
  },
  
  // 远程测试服务器配置（IP访问）
  remoteTest: {
    apiUrl: `http://${window.location.hostname}/api`,
    clientUrl: `http://${window.location.hostname}/app`,  // 修改为 /app 路径
    environment: 'remote-test'
  },
  
  // 生产环境配置（域名访问）
  production: {
    apiUrl: 'https://your-domain.com/api',
    clientUrl: 'https://app.your-domain.com',
    environment: 'production'
  }
};

// 根据环境选择配置
const getConfig = () => {
  // 优先使用环境变量（如果设置了的话）
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_CLIENT_URL) {
    return {
      apiUrl: import.meta.env.VITE_API_URL,
      clientUrl: import.meta.env.VITE_CLIENT_URL,
      environment: 'custom'
    };
  }
  
  // 自动环境检测
  if (env.isLocalDev) {
    return configs.local;
  } else if (env.isRemoteTestServer) {
    return configs.remoteTest;
  } else if (env.isProductionDomain) {
    return configs.production;
  } else {
    // 默认使用远程测试配置
    return configs.remoteTest;
  }
};

const selectedConfig = getConfig();

export const config = {
  // 动态配置
  ...selectedConfig,
  
  // 环境标识
  isDevelopment,
  isProduction,
  isLocalDev: env.isLocalDev,
  isRemoteTestServer: env.isRemoteTestServer,
  isProductionDomain: env.isProductionDomain,
  
  // 其他配置
  appName: 'GEO优化SaaS系统',
  version: '1.0.0',
  configVersion: CONFIG_VERSION,
};

// 开发环境日志
if (isDevelopment) {
  console.log('[Landing Config] 🚀 智能环境检测结果:', {
    hostname: window.location.hostname,
    port: window.location.port,
    detectedEnv: env,
    selectedConfig: selectedConfig,
    finalConfig: config
  });
}

// 生产环境也输出配置信息（用于调试）
console.log('[Landing Config] 环境:', {
  configVersion: CONFIG_VERSION,
  hostname: window.location.hostname,
  isLocalDev: env.isLocalDev,
  isRemoteTestServer: env.isRemoteTestServer,
  isProductionDomain: env.isProductionDomain,
  clientUrl: selectedConfig.clientUrl
});
