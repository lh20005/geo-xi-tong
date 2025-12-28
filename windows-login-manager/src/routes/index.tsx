import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';

// 懒加载页面组件
const Dashboard = lazy(() => import('../pages/Dashboard'));
const UserCenterPage = lazy(() => import('../pages/UserCenterPage'));
const UserManualPage = lazy(() => import('../pages/UserManualPage'));

// 内容管理
const DistillationPage = lazy(() => import('../pages/DistillationPage'));
const DistillationResultsPage = lazy(() => import('../pages/DistillationResultsPage'));
const TopicsPage = lazy(() => import('../pages/TopicsPage'));
const ArticlePage = lazy(() => import('../pages/ArticlePage'));
const ArticleListPage = lazy(() => import('../pages/ArticleListPage'));
const ArticleSettingsPage = lazy(() => import('../pages/ArticleSettingsPage'));
const ArticleGenerationPage = lazy(() => import('../pages/ArticleGenerationPage'));

// 媒体管理
const GalleryPage = lazy(() => import('../pages/GalleryPage'));
const AlbumDetailPage = lazy(() => import('../pages/AlbumDetailPage'));
const KnowledgeBasePage = lazy(() => import('../pages/KnowledgeBasePage'));
const KnowledgeBaseDetailPage = lazy(() => import('../pages/KnowledgeBaseDetailPage'));

// 平台管理
const PlatformManagementPage = lazy(() => import('../pages/PlatformManagementPage'));
const ConversionTargets = lazy(() => import('../pages/ConversionTargets'));
const PublishingTasksPage = lazy(() => import('../pages/PublishingTasksPage'));
const PublishingRecordsPage = lazy(() => import('../pages/PublishingRecordsPage'));

// 系统管理（管理员）
const ConfigPage = lazy(() => import('../pages/ConfigPage'));
const SecurityDashboardPage = lazy(() => import('../pages/SecurityDashboardPage'));
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage'));
const IPWhitelistPage = lazy(() => import('../pages/IPWhitelistPage'));
const PermissionsPage = lazy(() => import('../pages/PermissionsPage'));
const SecurityConfigPage = lazy(() => import('../pages/SecurityConfigPage'));
const ProductManagementPage = lazy(() => import('../pages/ProductManagementPage'));
const TokenDebugPage = lazy(() => import('../pages/TokenDebugPage'));
const OrderManagementPage = lazy(() => import('../pages/OrderManagementPage'));
const PaymentPage = lazy(() => import('../pages/PaymentPage'));

// 登录管理器原有页面
const PlatformSelection = lazy(() => import('../pages/PlatformSelection'));
const AccountList = lazy(() => import('../pages/AccountList'));
const Settings = lazy(() => import('../pages/Settings'));

// 加载组件
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

// 路由配置
export const routes = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <Dashboard />
      </Suspense>
    )
  },
  {
    path: '/user-center',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <UserCenterPage />
      </Suspense>
    )
  },
  {
    path: '/user-manual',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <UserManualPage />
      </Suspense>
    )
  },
  
  // 内容管理
  {
    path: '/distillation',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <DistillationPage />
      </Suspense>
    )
  },
  {
    path: '/distillation-results',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <DistillationResultsPage />
      </Suspense>
    )
  },
  {
    path: '/topics',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <TopicsPage />
      </Suspense>
    )
  },
  {
    path: '/article',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ArticlePage />
      </Suspense>
    )
  },
  {
    path: '/articles',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ArticleListPage />
      </Suspense>
    )
  },
  {
    path: '/article-settings',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ArticleSettingsPage />
      </Suspense>
    )
  },
  {
    path: '/article-generation',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ArticleGenerationPage />
      </Suspense>
    )
  },
  
  // 媒体管理
  {
    path: '/gallery',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <GalleryPage />
      </Suspense>
    )
  },
  {
    path: '/gallery/:albumId',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <AlbumDetailPage />
      </Suspense>
    )
  },
  {
    path: '/knowledge-base',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <KnowledgeBasePage />
      </Suspense>
    )
  },
  {
    path: '/knowledge-base/:id',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <KnowledgeBaseDetailPage />
      </Suspense>
    )
  },
  
  // 平台管理
  {
    path: '/platform-management',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PlatformManagementPage />
      </Suspense>
    )
  },
  {
    path: '/conversion-targets',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ConversionTargets />
      </Suspense>
    )
  },
  {
    path: '/publishing-tasks',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PublishingTasksPage />
      </Suspense>
    )
  },
  {
    path: '/publishing-records',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PublishingRecordsPage />
      </Suspense>
    )
  },
  
  // 系统管理（管理员）
  {
    path: '/config',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ConfigPage />
      </Suspense>
    )
  },
  {
    path: '/security/dashboard',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <SecurityDashboardPage />
      </Suspense>
    )
  },
  {
    path: '/security/audit-logs',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <AuditLogsPage />
      </Suspense>
    )
  },
  {
    path: '/security/ip-whitelist',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <IPWhitelistPage />
      </Suspense>
    )
  },
  {
    path: '/security/permissions',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PermissionsPage />
      </Suspense>
    )
  },
  {
    path: '/security/config',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <SecurityConfigPage />
      </Suspense>
    )
  },
  {
    path: '/products',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ProductManagementPage />
      </Suspense>
    )
  },
  {
    path: '/products/token-debug',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <TokenDebugPage />
      </Suspense>
    )
  },
  {
    path: '/admin/orders',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <OrderManagementPage />
      </Suspense>
    )
  },
  {
    path: '/payment',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PaymentPage />
      </Suspense>
    )
  },
  
  // 登录管理器原有页面
  {
    path: '/platforms',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PlatformSelection />
      </Suspense>
    )
  },
  {
    path: '/accounts',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <AccountList />
      </Suspense>
    )
  },
  {
    path: '/settings',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <Settings />
      </Suspense>
    )
  },
  
  // 404 页面
  {
    path: '*',
    element: (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <h1 style={{ fontSize: 72, margin: 0 }}>404</h1>
        <p style={{ fontSize: 24, color: '#666' }}>页面不存在</p>
        <a href="/" style={{ marginTop: 20 }}>返回首页</a>
      </div>
    )
  }
];
