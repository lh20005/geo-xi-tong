import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import StorageWarningBanner from './components/StorageWarningBanner';
import Login from './pages/Login';
import { ipcBridge } from './services/ipc';
import { getUserWebSocketService } from './services/UserWebSocketService';
import { useCacheStore } from './stores/cacheStore';
import { apiClient } from './api/client';
import { localArticleApi } from './api/local';
import { getCurrentUserId, isElectron } from './api';
import { fetchTaskDetail, fetchTasks } from './api/articleGenerationApi';
import { routes } from './routes';
import './App.css';

function AppContent() {
  const { setUser } = useApp();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { invalidateCacheByPrefix } = useCacheStore();
  const syncedTaskArticlesRef = useMemo(() => new Map<number, Set<number>>(), []);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkAuth();
    
    // 监听来自 API 客户端的登出事件
    const handleAuthLogout = (event: any) => {
      console.log('[App] 收到 auth:logout 事件:', event.detail);
      handleLogout();
    };
    
    window.addEventListener('auth:logout', handleAuthLogout as EventListener);
    
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout as EventListener);
    };
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

  const syncGeneratedArticles = useCallback(async () => {
    if (!isElectron()) return;
    if (!isAuthenticated) return;

    try {
      const taskList = await fetchTasks(1, 100);
      const syncableTasks = taskList.tasks.filter(
        (task) => (task.status === 'completed' || task.status === 'running') && task.generatedCount > 0
      );
      if (syncableTasks.length === 0) {
        return;
      }

      const userId = await getCurrentUserId();
      if (!userId) return;

      let totalSyncedCount = 0;

      for (const task of syncableTasks) {
        const syncedArticles = syncedTaskArticlesRef.get(task.id);
        if (syncedArticles && syncedArticles.size >= task.generatedCount) {
          continue;
        }

        const detail = await fetchTaskDetail(task.id);
        const articles = detail.generatedArticles || [];
        if (articles.length === 0) continue;

        let allSynced = true;
        const syncedSet = syncedArticles ?? new Set<number>();
        syncedTaskArticlesRef.set(task.id, syncedSet);

        for (const article of articles) {
          try {
            if (syncedSet.has(article.id)) {
              continue;
            }
            const checkResult = await localArticleApi.checkArticleExists(task.id, article.title);
            if (checkResult.data?.exists) {
              syncedSet.add(article.id);
              continue;
            }

            const articleResponse = await apiClient.get(`/article-generation/articles/${article.id}`);
            const content = articleResponse.data?.content || '';

            const result = await localArticleApi.create({
              userId,
              title: article.title,
              keyword: detail.keyword,
              content,
              imageUrl: article.imageUrl || undefined,
              provider: detail.provider,
              distillationId: detail.distillationId ?? undefined,
              distillationKeywordSnapshot: detail.keyword,
              topicQuestionSnapshot: detail.distillationResult || undefined,
              taskId: detail.id,
              albumId: typeof detail.albumId === 'string' ? parseInt(detail.albumId) : detail.albumId,
              articleSettingId: detail.articleSettingId,
              articleSettingSnapshot: detail.articleSettingName || undefined,
              conversionTargetId: detail.conversionTargetId || undefined,
              conversionTargetSnapshot: detail.conversionTargetName || undefined,
              isPublished: false,
            });

            if (result && result.success) {
              syncedSet.add(article.id);
              totalSyncedCount++;
            } else {
              allSynced = false;
            }
          } catch {
            allSynced = false;
          }
        }

        if (allSynced && task.status === 'completed') {
          syncedTaskArticlesRef.set(task.id, new Set(articles.map((item) => item.id)));
        }
      }

      if (totalSyncedCount > 0) {
        invalidateCacheByPrefix('articles:');
        window.dispatchEvent(new CustomEvent('articles:updated'));
      }
    } catch {
      return;
    }
  }, [isAuthenticated, invalidateCacheByPrefix, syncedTaskArticlesRef]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const schedule = async () => {
      if (cancelled) return;
      await syncGeneratedArticles();

      if (cancelled) return;
      syncTimerRef.current = setTimeout(schedule, 3000);
    };

    schedule();

    return () => {
      cancelled = true;
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [isAuthenticated, syncGeneratedArticles]);

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
