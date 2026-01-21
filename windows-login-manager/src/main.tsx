import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

/**
 * 安全清理：移除可能存在的敏感数据
 * 这个函数会在应用启动时执行，确保：
 * 1. 旧版本存储的密码被清除
 * 2. 首次安装时不会有任何残留的认证数据
 */
function cleanupSensitiveData() {
  // 检查是否是首次启动（通过检查 Electron 存储中的版本标记）
  // 如果 localStorage 中有 auth_token 但 Electron 存储中没有，说明是残留数据
  const hasLocalToken = localStorage.getItem('auth_token');
  
  // 始终清除可能存在的明文密码（安全措施）
  const hadPassword = localStorage.getItem('savedPassword');
  if (hadPassword) {
    console.log('[Security] ⚠️ 检测到旧版本存储的密码，正在清除...');
    localStorage.removeItem('savedPassword');
    localStorage.removeItem('rememberMe');
    console.log('[Security] ✅ 敏感数据已清除');
  }
  
  // 检查 Electron 存储中是否有有效的 token
  // 如果没有，说明用户未登录或是首次安装，需要清理 localStorage
  if (window.electron?.storage?.getTokens) {
    window.electron.storage.getTokens().then((tokens: { authToken: string; refreshToken: string } | null) => {
      if (!tokens?.authToken && hasLocalToken) {
        console.log('[Security] ⚠️ 检测到 localStorage 中有残留 token，但 Electron 存储中没有，正在清除...');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('rememberUsername');
        console.log('[Security] ✅ 残留认证数据已清除');
      }
    }).catch((err: Error) => {
      console.error('[Security] 检查 token 时出错:', err);
    });
  }
}

// 在应用启动时执行安全清理
cleanupSensitiveData();

// 设置全局 token 同步监听器
if (window.electron?.onTokensSaved) {
  window.electron.onTokensSaved((tokens: { authToken: string; refreshToken: string }) => {
    console.log('[Main] 🔄 收到 tokens-saved 事件，同步到 localStorage');
    localStorage.setItem('auth_token', tokens.authToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
    console.log('[Main] ✅ Tokens 已同步到 localStorage');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#0ea5e9',
          borderRadius: 8,
          fontSize: 14,
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
