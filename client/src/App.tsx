import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, message, App as AntApp } from 'antd';
import { useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import StorageWarningBanner from './components/StorageWarningBanner';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { getUserWebSocketService } from './services/UserWebSocketService';
import { getCurrentUser } from './utils/auth';
import { initTokenChecker } from './utils/tokenChecker';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ConfigPage from './pages/ConfigPage';
import UserManualPage from './pages/UserManualPage';
import DistillationPage from './pages/DistillationPage';
import DistillationResultsPage from './pages/DistillationResultsPage';
import TopicsPage from './pages/TopicsPage';
import ArticlePage from './pages/ArticlePage';
import ArticleListPage from './pages/ArticleListPage';
import GalleryPage from './pages/GalleryPage';
import AlbumDetailPage from './pages/AlbumDetailPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import KnowledgeBaseDetailPage from './pages/KnowledgeBaseDetailPage';
import ConversionTargetPage from './pages/ConversionTargetPage';
import ArticleSettingsPage from './pages/ArticleSettingsPage';
import ArticleGenerationPage from './pages/ArticleGenerationPage';
import PlatformManagementPage from './pages/PlatformManagementPage';
import PublishingTasksPage from './pages/PublishingTasksPage';
import PublishingRecordsPage from './pages/PublishingRecordsPage';
import SecurityDashboardPage from './pages/SecurityDashboardPage';
import AuditLogsPage from './pages/AuditLogsPage';
import IPWhitelistPage from './pages/IPWhitelistPage';
import PermissionsPage from './pages/PermissionsPage';
import SecurityConfigPage from './pages/SecurityConfigPage';
import ProductManagementPage from './pages/ProductManagementPage';
import OrderManagementPage from './pages/OrderManagementPage';
import UserManagementPage from './pages/UserManagementPage';
import UserCenterPage from './pages/UserCenterPage';
import PaymentPage from './pages/PaymentPage';
import AgentManagementPage from './pages/AgentManagementPage';

const { Content } = Layout;

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // 初始化 token 检查器（自动检测并清除过期 token）
  useEffect(() => {
    initTokenChecker();
  }, []);

  // 处理从 Landing 跳转过来的 token
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const refreshToken = params.get('refresh_token');
    const userInfo = params.get('user_info');

    if (token && refreshToken && userInfo) {
      console.log('[Client] 从 URL 参数接收到 token，保存到 localStorage');
      
      // 保存 token 到 localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_info', userInfo);
      
      // 清除 URL 参数，但保持在当前路径
      // 如果当前在 /user-center，就留在 /user-center
      // 如果在其他路径，也保持在该路径
      const currentPath = location.pathname;
      navigate(currentPath, { replace: true });
    }
  }, [location, navigate]);

  // Initialize WebSocket for user management events
  useEffect(() => {
    // Skip WebSocket on login page and payment page
    if (location.pathname === '/login' || location.pathname.startsWith('/payment/')) {
      return;
    }

    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      console.log('[Client] No user logged in, skipping WebSocket initialization');
      return;
    }

    const wsService = getUserWebSocketService();

    // Connect to WebSocket (with graceful error handling)
    wsService.connect().catch((error) => {
      // Silently handle connection errors - WebSocket is not critical for basic functionality
      console.warn('[Client] WebSocket connection failed - real-time updates will be unavailable');
    });

    // Handle user:updated event
    const handleUserUpdated = (data: any) => {
      console.log('[Client] User updated:', data);
      
      if (data.userId === currentUser.id) {
        // Update local user info
        const updatedUser = {
          ...currentUser,
          username: data.username,
          role: data.role
        };
        localStorage.setItem('user_info', JSON.stringify(updatedUser));
        
        message.info('您的账户信息已更新');
        
        // Refresh the page to reflect changes
        window.location.reload();
      }
    };

    // Handle user:deleted event
    const handleUserDeleted = (data: any) => {
      console.log('[Client] User deleted:', data);
      
      if (data.userId === currentUser.id) {
        message.error('您的账户已被删除，即将退出登录');
        
        // Clear local storage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        
        // Disconnect WebSocket
        wsService.disconnect();
        
        // Redirect to login page
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    // Handle user:password-changed event
    const handlePasswordChanged = (data: any) => {
      console.log('[Client] Password changed:', data);
      
      if (data.userId === currentUser.id) {
        message.warning('您的密码已被修改，请重新登录');
        
        // Clear local storage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        
        // Disconnect WebSocket
        wsService.disconnect();
        
        // Redirect to login page
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    // Subscribe to events
    wsService.on('user:updated', handleUserUpdated);
    wsService.on('user:deleted', handleUserDeleted);
    wsService.on('user:password-changed', handlePasswordChanged);

    // Cleanup on unmount
    return () => {
      wsService.off('user:updated', handleUserUpdated);
      wsService.off('user:deleted', handleUserDeleted);
      wsService.off('user:password-changed', handlePasswordChanged);
      wsService.disconnect();
    };
  }, [navigate]);

  return (
    <AntApp>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/payment/:orderNo" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
      
      {/* 受保护的路由 */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout style={{ minHeight: '100vh' }}>
              <Sidebar />
              <Layout style={{ marginLeft: 240 }}>
                <Header />
                <StorageWarningBanner />
                <Content style={{ margin: '24px', background: '#fff', borderRadius: 8 }}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/conversion-targets" element={<ConversionTargetPage />} />
                    <Route path="/config" element={<AdminRoute><ConfigPage /></AdminRoute>} />
                    <Route path="/user-manual" element={<UserManualPage />} />
                    <Route path="/distillation" element={<DistillationPage />} />
                    <Route path="/distillation-results" element={<DistillationResultsPage />} />
                    <Route path="/topics/:distillationId" element={<TopicsPage />} />
                    <Route path="/article/:distillationId" element={<ArticlePage />} />
                    <Route path="/articles" element={<ArticleListPage />} />
                    <Route path="/platform-management" element={<PlatformManagementPage />} />
                    <Route path="/publishing-tasks" element={<PublishingTasksPage />} />
                    <Route path="/publishing-records" element={<PublishingRecordsPage />} />
                    <Route path="/gallery" element={<GalleryPage />} />
                    <Route path="/gallery/:albumId" element={<AlbumDetailPage />} />
                    <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                    <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />
                    <Route path="/article-settings" element={<ArticleSettingsPage />} />
                    <Route path="/article-generation" element={<ArticleGenerationPage />} />
                    <Route path="/security/dashboard" element={<AdminRoute><SecurityDashboardPage /></AdminRoute>} />
                    <Route path="/security/audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
                    <Route path="/security/ip-whitelist" element={<AdminRoute><IPWhitelistPage /></AdminRoute>} />
                    <Route path="/security/permissions" element={<AdminRoute><PermissionsPage /></AdminRoute>} />
                    <Route path="/security/config" element={<AdminRoute><SecurityConfigPage /></AdminRoute>} />
                    <Route path="/products" element={<AdminRoute><ProductManagementPage /></AdminRoute>} />
                    <Route path="/admin/orders" element={<AdminRoute><OrderManagementPage /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
                    <Route path="/admin/agents" element={<AdminRoute><AgentManagementPage /></AdminRoute>} />
                    <Route path="/user-center" element={<UserCenterPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Content>
              </Layout>
            </Layout>
          </ProtectedRoute>
        }
      />
      </Routes>
    </AntApp>
  );
}

export default App;
