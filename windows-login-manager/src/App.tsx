import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import PlatformSelection from './pages/PlatformSelection';
import AccountList from './pages/AccountList';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { ipcBridge } from './services/ipc';
import { isAdmin } from './utils/auth';
import './App.css';

// 管理员路由保护组件
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  
  if (!isAdmin(user)) {
    console.log('[Auth] 非管理员用户尝试访问设置页面');
    return <Navigate to="/platforms" replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const { setUser } = useApp();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await ipcBridge.checkAuth();
      setIsAuthenticated(result.isAuthenticated);
      
      // 如果已认证，获取用户信息
      if (result.isAuthenticated && result.user) {
        setUser(result.user);
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (user: any) => {
    setIsAuthenticated(true);
    setUser(user);
  };

  const handleLogout = async () => {
    try {
      await ipcBridge.logout();
      setIsAuthenticated(false);
      setUser(null);
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
        <Routes>
          <Route path="/" element={<Navigate to="/platforms" replace />} />
          <Route path="/platforms" element={<PlatformSelection />} />
          <Route path="/accounts" element={<AccountList />} />
          <Route path="/settings" element={
            <AdminRoute>
              <Settings />
            </AdminRoute>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
