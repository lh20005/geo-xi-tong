import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import ConfigPage from './pages/ConfigPage';
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

const { Content } = Layout;

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: 240 }}>
        <Header />
        <Content style={{ margin: '24px', background: '#fff', borderRadius: 8 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/conversion-targets" element={<ConversionTargetPage />} />
            <Route path="/config" element={<ConfigPage />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
