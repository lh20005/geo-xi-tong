import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import StorageWarningBanner from './components/StorageWarningBanner';
import Login from './pages/Login';
import { ipcBridge } from './services/ipc';
import { getUserWebSocketService } from './services/UserWebSocketService';
import { routes } from './routes';
import './App.css';

function AppContent() {
  const { setUser } = useApp();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // WebSocket 连接（用于存储警告等实时通知）- 必须在所有条件返回之前
  useEffect(() => {
    if (!isAuthenticated) return;

    const wsService = getUserWebSocketService();
    wsService.connect().catch((error) => {
      console.warn('[App] WebSocket connection failed - real-time updates will be unavailable');
    });

    return () => {
      wsService.disconnect();
    };
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const result = await ipcBridge.checkAuth();
      setIsAuthenticated(result.isAuthenticated);
      
      // 如果已认证，获取用户信息
      if (result.isAuthenticated && result.user) {
        console.log('[App] 认证成功，用户信息:', result.user);
        setUser(result.user);
        
        // 同步用户信息到 localStorage，供权限判断使用
        localStorage.setItem('user_info', JSON.stringify(result.user));
        console.log('[App] 用户信息已保存到 localStorage');
        
        // 触发自定义事件，通知其他组件用户信息已更新
        console.log('[App] 触发 userInfoUpdated 事件');
        window.dispatchEvent(new Event('userInfoUpdated'));
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (user: any) => {
    console.log('[App] 登录成功，用户信息:', user);
    setIsAuthenticated(true);
    setUser(user);
    
    // 同步用户信息到 localStorage，供权限判断使用
    if (user) {
      localStorage.setItem('user_info', JSON.stringify(user));
      console.log('[App] 用户信息已保存到 localStorage');
      
      // 触发自定义事件，通知其他组件用户信息已更新
      console.log('[App] 触发 userInfoUpdated 事件');
      window.dispatchEvent(new Event('userInfoUpdated'));
    }
  };

  const handleLogout = async () => {
    try {
      console.log('[App] 执行登出');
      await ipcBridge.logout();
      setIsAuthenticated(false);
      setUser(null);
      
      // 清除 localStorage 中的用户信息
      localStorage.removeItem('user_info');
      console.log('[App] 用户信息已从 localStorage 清除');
      
      // 触发自定义事件，通知其他组件用户信息已更新
      console.log('[App] 触发 userInfoUpdated 事件');
      window.dispatchEvent(new Event('userInfoUpdated'));
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        加载中...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Router>
      <Layout onLogout={handleLogout}>
        <StorageWarningBanner />
        <Routes>
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Layout>
    </Router>
  );
}

function App() {
  return (
    <AppProvider>
      <AntApp>
        <AppContent />
      </AntApp>
    </AppProvider>
  );
}

export default App;
