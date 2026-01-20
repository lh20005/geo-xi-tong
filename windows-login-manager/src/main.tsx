import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

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
