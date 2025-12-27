/**
 * Landing页面环境配置
 * 智能环境检测：自动根据运行环境选择正确的配置
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// 智能环境检测函数
const detectEnvironment = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // 本地开发环境检测
  const isLocalDev = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') ||
                    hostname.startsWith('10.') ||
                    hostname.endsWith('.local');
  
  return {
    isLocalDev,
    isRemoteDev: !isProduction && !isLocalDev,
    isProduction
  };
};

const env = detectEnvironment();

// 配置映射
const configs = {
  // 本地开发环境配置
  local: {
    apiUrl: 'http://localhost:3000/api',
    clientUrl: 'http://localhost:5173',
    environment: 'local'
  },
  
  // 远程开发/测试环境配置
  remote: {
    apiUrl: 'http://43.143.163.6/api',
    clientUrl: 'http://43.143.163.6',
    environment: 'remote'
  },
  
  // 生产环境配置
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
  if (env.isProduction) {
    return configs.production;
  } else if (env.isLocalDev) {
    return configs.local;
  } else {
    return configs.remote;
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
  isRemoteDev: env.isRemoteDev,
  
  // 其他配置
  appName: 'GEO优化SaaS系统',
  version: '1.0.0',
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
