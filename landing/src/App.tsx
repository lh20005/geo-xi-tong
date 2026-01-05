import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import CasesPage from './pages/CasesPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ProtectedRoute from './components/ProtectedRoute';
import { config } from './config/env';
import { useEffect } from 'react';

function App() {
  // 处理 /profile 路由重定向到主应用
  useEffect(() => {
    if (window.location.pathname === '/profile') {
      const token = localStorage.getItem('auth_token');
      const refreshToken = localStorage.getItem('refresh_token');
      const userInfo = localStorage.getItem('user_info');
      
      if (token && refreshToken && userInfo) {
        // 已登录，跳转到主应用的用户中心
        const params = new URLSearchParams({
          token,
          refresh_token: refreshToken,
          user_info: userInfo
        });
        window.location.href = `${config.clientUrl}/user-center?${params.toString()}`;
      } else {
        // 未登录，跳转到登录页
        window.location.href = '/login';
      }
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegistrationPage />} />
      <Route path="/cases" element={<CasesPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      {/* /profile 重定向到主应用用户中心 */}
      <Route path="/profile" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
