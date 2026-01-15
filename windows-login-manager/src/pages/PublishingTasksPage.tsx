/**
 * 发布任务页面
 * 
 * 改造后：使用本地 Store 和 IPC 调用替代 HTTP API
 * - 文章数据：useArticleStore（本地 SQLite）
 * - 账号数据：useAccountStore（本地 SQLite）
 * - 任务数据：useTaskStore（本地 SQLite）
 * - 平台配置：ipcBridge.getPlatforms()
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Card, Row, Col, Button, Space, Tag, App,
  Checkbox, Statistic, Modal, Typography, Tooltip, Empty,
  InputNumber, Table, Switch
} from 'antd';
import {
  SendOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, SyncOutlined,
  EyeOutlined, DeleteOutlined, PlayCircleOutlined,
  FileTextOutlined, CloudUploadOutlined, HistoryOutlined,
  StopOutlined, ExclamationCircleOutlined, FieldTimeOutlined,
  EyeInvisibleOutlined, DownOutlined, RightOutlined
} from '@ant-design/icons';
// 改造：使用本地 Store 替代 HTTP API
import { useArticleStore } from '../stores/articleStore';
import { useAccountStore } from '../stores/accountStore';
import { useTaskStore } from '../stores/taskStore';
import { localArticleApi, localTaskApi, type LocalArticle } from '../api/local';
import { ipcBridge } from '../services/ipc';
import ArticlePreview from '../components/ArticlePreview';
import ResizableTable from '../components/ResizableTable';

// 平台配置类型
interface Platform {
  id: number;
  platform_id: string;
  platform_name: string;
  icon_url?: string;
  is_enabled: boolean;
}

const { Text } = Typography;

// 平台图标映射 - 与平台管理页面保持一致
const getPlatformIcon = (platformId: string): string => {
  const specialIcons: Record<string, string> = {
    'baijiahao': '/images/baijiahao.png',
    'baidu': '/images/baijiahao.png',
    'toutiao': '/images/toutiaohao.png',
    'toutiaohao': '/images/toutiaohao.png',
    'xiaohongshu': '/images/xiaohongshu.png',
    'xhs': '/images/xiaohongshu.png',
    'weixin': '/images/gongzhonghao.png',
    'gongzhonghao': '/images/gongzhonghao.png',
    'wechat': '/images/gongzhonghao.png',
    'douyin': '/images/douyin.jpeg',
    'sohu': '/images/souhu.jpeg',
    'souhu': '/images/souhu.jpeg',
    'wangyi': '/images/wangyi.png',
    'netease': '/images/wangyi.png',
    'bilibili': '/images/bili.png',
    'bili': '/images/bili.png',
    'qq': '/images/qie.png',
    'qie': '/images/qie.png',
    'penguin': '/images/qie.png',
    'zhihu': '/images/zhihu.png',
    'csdn': '/images/csdn.png',
    'jianshu': '/images/jianshu.png'
  };
  
  if (specialIcons[platformId]) {
    return specialIcons[platformId];
  }
  return `/platform-icons/${platformId}.png`;
};

// 本地账号类型（与 Store 中的类型兼容）
interface LocalAccountDisplay {
  id: string;
  platform_id: string;
  account_name: string;
  real_username?: string;
  status: string;
  is_default?: boolean;
}

// 本地任务显示类型（扩展状态以兼容服务器端状态名称）
interface LocalTaskDisplay {
  id: string;
  userId: number;
  articleId?: string;
  accountId: string;
  platformId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'success';
  config: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  batchId?: string;
  batchOrder?: number;
  intervalMinutes?: number;
  articleTitle?: string;
  articleContent?: string;
  articleKeyword?: string;
  articleImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  platform_name?: string;
  account_name?: string;
  real_username?: string;
}

// 任务日志类型
interface TaskLog {
  id: number;
  taskId: string;
  level: 'info' | 'warn' | 'warning' | 'error';
  message: string;
  details?: string;
  timestamp?: string;
  created_at?: string;
  createdAt?: string;
}

export default function PublishingTasksPage() {
  const { message } = App.useApp();
  
  // 使用本地 Store
  const { 
    articles, 
    total: articleTotal, 
    loading: articlesLoading,
    fetchArticles
  } = useArticleStore();
  
  const {
    accounts: storeAccounts,
    fetchAccounts
  } = useAccountStore();
  
  const {
    tasks: storeTasks,
    total: taskTotal,
    loading: tasksLoading,
    fetchTasks,
    createTask,
    cancelTask: cancelTaskStore,
    deleteTask: deleteTaskStore,
    deleteBatch: deleteBatchStore,
    stopBatch: stopBatchStore,
    executeSingle,
    fetchLogs,
    logs: taskLogs
  } = useTaskStore();
  
  // 平台配置（从 IPC 获取）
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  
  // 文章选择
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [articlePage, setArticlePage] = useState(1);
  const [articlePageSize, setArticlePageSize] = useState(10);

  // 平台选择
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  // 任务管理
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // 批次选择
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  
  // 间隔发布（分钟）
  const [publishInterval, setPublishInterval] = useState<number>(5);

  // 创建任务中（防止重复提交）
  const [creatingTasks, setCreatingTasks] = useState(false);

  // 静默发布模式（默认开启静默模式）
  const [headlessMode, setHeadlessMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('publishHeadlessMode');
    return saved !== null ? saved === 'true' : true;
  });

  // 日志查看
  const [logsModal, setLogsModal] = useState<{ 
    visible: boolean; 
    taskId: string | null; 
    logs: TaskLog[];
    isLive: boolean;
  }>({
    visible: false,
    taskId: null,
    logs: [],
    isLive: false
  });

  // 日志容器 ref
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // 文章预览
  const [previewModal, setPreviewModal] = useState<{
    visible: boolean;
    article: LocalArticle | null;
    loading: boolean;
  }>({
    visible: false,
    article: null,
    loading: false
  });

  // 统计数据
  const [stats, setStats] = useState({
    draftArticles: 0,
    boundPlatforms: 0,
    runningTasks: 0,
    todayPublished: 0
  });

  // 转换 Store 账号为显示格式
  const accounts: LocalAccountDisplay[] = useMemo(() => {
    return storeAccounts
      .filter(acc => acc.status === 'active')
      .map(acc => ({
        id: acc.id,
        platform_id: acc.platformId || acc.platform,
        account_name: acc.accountName || '',
        real_username: acc.realUsername,
        status: acc.status,
        is_default: acc.isDefault
      }));
  }, [storeAccounts]);

  // 转换 Store 任务为显示格式
  const tasks: LocalTaskDisplay[] = useMemo(() => {
    return storeTasks.map(task => {
      const platform = platforms.find(p => p.platform_id === task.platformId);
      const account = storeAccounts.find(a => a.id === task.accountId);
      // 将 completed 状态映射为 success（兼容显示）
      const displayStatus = task.status === 'completed' ? 'success' : task.status;
      return {
        ...task,
        status: displayStatus as LocalTaskDisplay['status'],
        platform_name: platform?.platform_name || task.platformId,
        account_name: account?.accountName || '',
        real_username: account?.realUsername
      };
    });
  }, [storeTasks, platforms, storeAccounts]);

  // 加载平台配置
  const loadPlatforms = useCallback(async () => {
    try {
      const platformsData = await ipcBridge.getPlatforms();
      const platformOrder = ['douyin', 'toutiao', 'xiaohongshu', 'souhu', 'wangyi', 'zhihu', 'qie', 'baijiahao', 'wechat', 'bilibili', 'jianshu', 'csdn'];
      const sortedPlatforms = (platformsData || []).sort((a: Platform, b: Platform) => {
        const indexA = platformOrder.indexOf(a.platform_id);
        const indexB = platformOrder.indexOf(b.platform_id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
      setPlatforms(sortedPlatforms);
    } catch (error: any) {
      message.error('加载平台配置失败');
      console.error(error);
    }
  }, [message]);

  // 加载草稿文章
  const loadDraftArticles = useCallback(async () => {
    await fetchArticles({ page: articlePage, pageSize: articlePageSize, isPublished: false });
  }, [fetchArticles, articlePage, articlePageSize]);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    await fetchTasks({ page: 1, pageSize: 100 });
  }, [fetchTasks]);

  // 初始化加载
  useEffect(() => {
    loadPlatforms();
    fetchAccounts();
    loadDraftArticles();
    loadTasks();
  }, []);

  // 文章分页变化时重新加载
  useEffect(() => {
    loadDraftArticles();
  }, [articlePage, articlePageSize]);

  // 更新统计数据
  useEffect(() => {
    setStats(prev => ({ ...prev, draftArticles: articleTotal || 0 }));
  }, [articleTotal]);

  useEffect(() => {
    const boundPlatforms = new Set(accounts.map(acc => acc.platform_id)).size;
    setStats(prev => ({ ...prev, boundPlatforms }));
  }, [accounts]);

  useEffect(() => {
    const runningTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;
    const today = new Date().toDateString();
    const todayPublished = tasks.filter(
      t => t.status === 'completed' && 
      new Date(t.completedAt || '').toDateString() === today
    ).length;
    setStats(prev => ({ ...prev, runningTasks, todayPublished }));
  }, [tasks]);

  // 自动刷新任务列表
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (tasks.length > 0) {
        const hasActiveTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');
        if (hasActiveTasks) {
          loadTasks();
        }
      }
    }, 15000);
    return () => clearInterval(intervalId);
  }, [tasks, loadTasks]);

  // 保存静默模式设置
  useEffect(() => {
    localStorage.setItem('publishHeadlessMode', headlessMode.toString());
  }, [headlessMode]);

  // 创建发布任务
  const handleCreateTasks = async () => {
    if (selectedArticleIds.size === 0) {
      message.warning('请选择要发布的文章');
      return;
    }
    if (selectedAccounts.size === 0) {
      message.warning('请选择发布平台');
      return;
    }
    
    if (creatingTasks) {
      message.warning('正在创建任务，请稍候...');
      return;
    }

    // 按照文章在表格中的显示顺序排序
    const articleIds = articles
      .filter(a => selectedArticleIds.has(a.id))
      .map(a => a.id);
    // 按照账号在列表中的显示顺序排序
    const accountIds = accounts
      .filter(a => selectedAccounts.has(a.id))
      .map(a => a.id);
    const totalTasks = articleIds.length * accountIds.length;
    
    // 计算总耗时
    const totalMinutes = (totalTasks - 1) * publishInterval;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeDesc = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;

    Modal.confirm({
      title: '确认创建发布任务',
      content: (
        <div>
          <p>将为 <strong>{articleIds.length}</strong> 篇文章创建 <strong>{totalTasks}</strong> 个发布任务</p>
          <p>发布间隔：<strong>{publishInterval}</strong> 分钟</p>
          <p>预计完成时间：约 <strong>{timeDesc}</strong></p>
          <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
            ⚠️ 串行发布：每个任务完成后，等待 {publishInterval} 分钟，再发布下一个任务
          </p>
        </div>
      ),
      onOk: async () => {
        setCreatingTasks(true);
        try {
          const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const taskPromises = [];
          let batchOrder = 0;
          
          // 获取用户ID（从 localStorage）
          const userStr = localStorage.getItem('user');
          const userId = userStr ? JSON.parse(userStr).id : 1;
          
          for (let i = 0; i < articleIds.length; i++) {
            const articleId = articleIds[i];
            const article = articles.find(a => a.id === articleId);
            
            for (const accountId of accountIds) {
              const account = accounts.find(a => a.id === accountId);
              if (account && article) {
                const isLastTask = (i === articleIds.length - 1) && (accountId === accountIds[accountIds.length - 1]);
                const intervalMinutes = isLastTask ? 0 : publishInterval;
                
                taskPromises.push(
                  createTask({
                    userId,
                    articleId,
                    accountId,
                    platformId: account.platform_id,
                    config: { headless: headlessMode },
                    batchId,
                    batchOrder,
                    intervalMinutes,
                    articleTitle: article.title,
                    articleContent: article.content,
                    articleKeyword: article.keyword,
                    articleImageUrl: article.imageUrl
                  })
                );
                batchOrder++;
              }
            }
          }

          await Promise.all(taskPromises);
          message.success(`成功创建 ${taskPromises.length} 个发布任务，批次已开始执行`);
          
          setSelectedArticleIds(new Set());
          setSelectedAccounts(new Set());
          setPublishInterval(5);
          
          loadTasks();
          loadDraftArticles();
        } catch (error: any) {
          message.error(error.message || '创建任务失败');
        } finally {
          setCreatingTasks(false);
        }
      }
    });
  };

  // 查看任务日志
  const handleViewLogs = async (taskId: string, taskStatus: string) => {
    try {
      await fetchLogs(taskId);
      const shouldLive = taskStatus === 'pending' || taskStatus === 'running';
      setLogsModal({
        visible: true,
        taskId,
        logs: taskLogs as TaskLog[],
        isLive: shouldLive
      });
    } catch (error: any) {
      message.error('加载日志失败');
    }
  };

  // 更新日志模态框中的日志
  useEffect(() => {
    if (logsModal.visible && logsModal.taskId) {
      setLogsModal(prev => ({ ...prev, logs: taskLogs as TaskLog[] }));
    }
  }, [taskLogs, logsModal.visible, logsModal.taskId]);

  // 自动滚动到日志底部
  useEffect(() => {
    if (logsModal.visible && logsModal.logs.length > 0 && logsContainerRef.current) {
      requestAnimationFrame(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
      });
    }
  }, [logsModal.logs.length, logsModal.visible]);

  // 预览文章
  const handlePreviewArticle = async (article: LocalArticle) => {
    try {
      setPreviewModal({ visible: true, article, loading: true });
      const result = await localArticleApi.findById(article.id);
      if (result.success) {
        setPreviewModal({ visible: true, article: result.data, loading: false });
      } else {
        message.error('加载文章详情失败');
        setPreviewModal({ visible: false, article: null, loading: false });
      }
    } catch (error: any) {
      message.error('加载文章详情失败');
      setPreviewModal({ visible: false, article: null, loading: false });
    }
  };

  // 立即执行任务
  const handleExecuteTask = async (taskId: string) => {
    Modal.confirm({
      title: '确认立即执行',
      content: '确定要立即执行这个发布任务吗？',
      onOk: async () => {
        try {
          const success = await executeSingle(taskId);
          if (success) {
            message.success('任务已开始执行');
            loadTasks();
          } else {
            message.error('执行失败');
          }
        } catch (error: any) {
          message.error(error.message || '执行失败');
        }
      }
    });
  };

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    Modal.confirm({
      title: '确认取消任务',
      content: '确定要取消这个发布任务吗？',
      onOk: async () => {
        try {
          const success = await cancelTaskStore(taskId);
          if (success) {
            message.success('任务已取消');
            loadTasks();
          } else {
            message.error('取消失败');
          }
        } catch (error: any) {
          message.error(error.message || '取消失败');
        }
      }
    });
  };

  // 终止任务（本地实现：直接取消）
  const handleTerminateTask = async (taskId: string) => {
    Modal.confirm({
      title: '确认终止任务',
      content: '确定要强制终止这个正在执行的任务吗？任务将被标记为失败。',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认终止',
      okType: 'danger',
      onOk: async () => {
        try {
          await localTaskApi.updateStatus(taskId, 'failed', '用户手动终止');
          message.success('任务已终止');
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '终止失败');
        }
      }
    });
  };

  // 删除任务
  const handleDeleteTask = async (taskId: string) => {
    Modal.confirm({
      title: '确认删除任务',
      content: '确定要删除这个任务吗？此操作不可恢复。',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          const success = await deleteTaskStore(taskId);
          if (success) {
            message.success('任务已删除');
            setSelectedTaskIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(taskId);
              return newSet;
            });
            loadTasks();
          } else {
            message.error('删除失败');
          }
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      }
    });
  };

  // 批量删除任务
  const handleBatchDelete = async () => {
    if (selectedTaskIds.size === 0) {
      message.warning('请选择要删除的任务');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedTaskIds.size} 个任务吗？此操作不可恢复。`,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          for (const taskId of selectedTaskIds) {
            const success = await deleteTaskStore(taskId);
            if (success) successCount++;
          }
          if (successCount > 0) {
            message.success(`成功删除 ${successCount} 个任务`);
          }
          setSelectedTaskIds(new Set());
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '批量删除失败');
        }
      }
    });
  };

  // 删除所有任务
  const handleDeleteAll = async () => {
    Modal.confirm({
      title: '确认删除所有任务',
      content: '确定要删除所有任务吗？此操作不可恢复，将删除所有状态的任务。',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认删除全部',
      okType: 'danger',
      onOk: async () => {
        try {
          let deletedCount = 0;
          for (const task of tasks) {
            const success = await deleteTaskStore(task.id);
            if (success) deletedCount++;
          }
          message.success(`成功删除 ${deletedCount} 个任务`);
          setSelectedTaskIds(new Set());
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      }
    });
  };

  // 停止批次
  const handleStopBatch = async (batchId: string) => {
    Modal.confirm({
      title: '确认停止批次',
      content: '确定要停止这个批次吗？所有待处理的任务将被取消，正在执行的任务将被强制终止。',
      icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
      okText: '确认停止',
      okType: 'danger',
      onOk: async () => {
        try {
          const success = await stopBatchStore(batchId);
          if (success) {
            message.success('成功停止批次');
            loadTasks();
          } else {
            message.error('停止批次失败');
          }
        } catch (error: any) {
          message.error(error.message || '停止批次失败');
        }
      }
    });
  };

  // 删除批次
  const handleDeleteBatch = async (batchId: string) => {
    Modal.confirm({
      title: '确认删除批次',
      content: '确定要删除这个批次吗？批次中的所有任务都将被删除，此操作不可恢复。',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await deleteBatchStore(batchId);
          if (result.success) {
            message.success(`成功删除批次，删除了 ${result.deletedCount} 个任务`);
            loadTasks();
          } else {
            message.error('删除批次失败');
          }
        } catch (error: any) {
          message.error(error.message || '删除批次失败');
        }
      }
    });
  };

  // 批次选择处理
  const handleBatchSelect = (batchId: string, checked: boolean) => {
    const newSelected = new Set(selectedBatchIds);
    if (checked) {
      newSelected.add(batchId);
    } else {
      newSelected.delete(batchId);
    }
    setSelectedBatchIds(newSelected);
  };

  const handleBatchSelectAll = (checked: boolean, batchIds: string[]) => {
    if (checked) {
      setSelectedBatchIds(new Set(batchIds));
    } else {
      setSelectedBatchIds(new Set());
    }
  };

  // 批量删除批次
  const handleBatchDeleteBatches = async () => {
    if (selectedBatchIds.size === 0) {
      message.warning('请选择要删除的批次');
      return;
    }

    Modal.confirm({
      title: '确认批量删除批次',
      content: `确定要删除选中的 ${selectedBatchIds.size} 个批次吗？批次中的所有任务都将被删除，此操作不可恢复。`,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          let totalDeleted = 0;
          for (const batchId of selectedBatchIds) {
            const result = await deleteBatchStore(batchId);
            if (result.success) {
              totalDeleted += result.deletedCount;
            }
          }
          message.success(`成功删除 ${selectedBatchIds.size} 个批次，共删除了 ${totalDeleted} 个任务`);
          setSelectedBatchIds(new Set());
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '批量删除批次失败');
        }
      }
    });
  };

  // 任务选择处理
  const handleTaskSelect = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTaskIds);
    if (checked) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTaskIds(newSelected);
  };

  const handleTaskSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(new Set(tasks.map(t => t.id)));
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  // 文章选择处理
  const handleArticleSelect = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticleIds);
    if (checked) {
      newSelected.add(articleId);
    } else {
      newSelected.delete(articleId);
    }
    setSelectedArticleIds(newSelected);
  };

  const handleArticleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArticleIds(new Set(articles.map(a => a.id)));
    } else {
      setSelectedArticleIds(new Set());
    }
  };

  // 平台选择处理
  const handleAccountSelect = (accountId: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  // 获取状态标签
  const getStatusTag = (status: string, errorMessage?: string) => {
    if (status === 'failed' && errorMessage) {
      if (errorMessage.includes('用户终止') || errorMessage.includes('用户手动终止')) {
        return (
          <Tag color="warning" icon={<StopOutlined />}>
            已终止
          </Tag>
        );
      }
    }
    
    const statusConfig: Record<string, { color: string; icon: any; text: string }> = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
      running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      cancelled: { color: 'default', icon: <StopOutlined />, text: '已取消' },
      timeout: { color: 'warning', icon: <ClockCircleOutlined />, text: '超时' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 根据平台ID获取平台名称
  const getPlatformName = (platformId: string) => {
    const platform = platforms.find(p => p.platform_id === platformId);
    return platform?.platform_name || platformId;
  };

  // 按批次分组任务
  const groupTasksByBatch = () => {
    const batches: { [key: string]: LocalTaskDisplay[] } = {};
    const noBatchTasks: LocalTaskDisplay[] = [];

    tasks.forEach(task => {
      if (task.batchId) {
        if (!batches[task.batchId]) {
          batches[task.batchId] = [];
        }
        batches[task.batchId].push(task);
      } else {
        noBatchTasks.push(task);
      }
    });

    // 按 batchOrder 排序每个批次的任务
    Object.keys(batches).forEach(batchId => {
      batches[batchId].sort((a, b) => (a.batchOrder || 0) - (b.batchOrder || 0));
    });

    return { batches, noBatchTasks };
  };

  // 获取批次统计信息
  const getBatchStats = (batchTasks: LocalTaskDisplay[]) => {
    return {
      total: batchTasks.length,
      pending: batchTasks.filter(t => t.status === 'pending').length,
      running: batchTasks.filter(t => t.status === 'running').length,
      success: batchTasks.filter(t => t.status === 'completed' || t.status === 'success').length,
      failed: batchTasks.filter(t => t.status === 'failed').length,
      cancelled: batchTasks.filter(t => t.status === 'cancelled').length,
    };
  };

  // 文章表格列
  const articleColumns = [
    {
      title: (
        <Checkbox
          checked={articles.length > 0 && selectedArticleIds.size === articles.length}
          indeterminate={selectedArticleIds.size > 0 && selectedArticleIds.size < articles.length}
          onChange={(e) => handleArticleSelectAll(e.target.checked)}
        />
      ),
      key: 'checkbox',
      width: 48,
      align: 'center' as const,
      render: (_: any, record: LocalArticle) => (
        <Checkbox
          checked={selectedArticleIds.has(record.id)}
          onChange={(e) => handleArticleSelect(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      align: 'center' as const,
      render: (id: string) => <span title={id}>{id.substring(0, 8)}...</span>,
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 120,
      align: 'center' as const,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '蒸馏结果',
      dataIndex: 'topicQuestionSnapshot',
      key: 'topicQuestionSnapshot',
      width: 200,
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="green">{text}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '文章标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      align: 'center' as const,
      ellipsis: true,
      render: (text: string) => text ? <span>{text}</span> : <Text type="secondary">-</Text>,
    },
    {
      title: '预览',
      key: 'preview',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: LocalArticle) => (
        <Tooltip title="预览文章">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewArticle(record)}
          >
            预览
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      align: 'center' as const,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
  ];

  // 任务表格列
  const taskColumns = [
    {
      title: (
        <Checkbox
          checked={tasks.length > 0 && selectedTaskIds.size === tasks.length}
          indeterminate={selectedTaskIds.size > 0 && selectedTaskIds.size < tasks.length}
          onChange={(e) => handleTaskSelectAll(e.target.checked)}
        />
      ),
      key: 'checkbox',
      width: 50,
      align: 'center' as const,
      render: (_: any, record: LocalTaskDisplay) => (
        <Checkbox
          checked={selectedTaskIds.has(record.id)}
          onChange={(e) => handleTaskSelect(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '平台',
      dataIndex: 'platformId',
      key: 'platformId',
      width: 120,
      align: 'center' as const,
      render: (platformId: string) => <Tag color="blue">{getPlatformName(platformId)}</Tag>,
    },
    {
      title: '账号名称',
      dataIndex: 'real_username',
      key: 'real_username',
      width: 150,
      align: 'center' as const,
      render: (text: string, record: LocalTaskDisplay) => (
        <span style={{ fontSize: 14 }}>
          {text || record.account_name || '-'}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (status: string, record: LocalTaskDisplay) => getStatusTag(status, record.errorMessage),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: LocalTaskDisplay) => (
        <Space size="small">
          <Tooltip title="查看日志">
            <Button 
              type="link" 
              size="small"
              icon={<EyeOutlined />} 
              onClick={() => handleViewLogs(record.id, record.status)}
            >
              日志
            </Button>
          </Tooltip>
          
          {record.status === 'pending' && (
            <>
              <Tooltip title="立即执行">
                <Button 
                  type="link" 
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleExecuteTask(record.id)}
                >
                  执行
                </Button>
              </Tooltip>
              <Tooltip title="取消任务">
                <Button 
                  type="link" 
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleCancelTask(record.id)}
                >
                  取消
                </Button>
              </Tooltip>
            </>
          )}

          {record.status === 'running' && (
            <Tooltip title="终止任务">
              <Button 
                type="link" 
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleTerminateTask(record.id)}
              >
                终止
              </Button>
            </Tooltip>
          )}

          {(record.status === 'completed' || record.status === 'success' || record.status === 'failed' || record.status === 'cancelled') && (
            <Tooltip title="删除任务">
              <Button 
                type="link" 
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteTask(record.id)}
              >
                删除
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="草稿文章" 
              value={stats.draftArticles} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="已配置平台" 
              value={stats.boundPlatforms} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="运行中任务" 
              value={stats.runningTasks} 
              valueStyle={{ color: '#faad14' }}
              prefix={<SyncOutlined spin={stats.runningTasks > 0} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="今日已发布" 
              value={stats.todayPublished} 
              valueStyle={{ color: '#722ed1' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 文章选择区 */}
      <Card 
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>选择文章</span>
            {selectedArticleIds.size > 0 && (
              <Tag color="blue">已选 {selectedArticleIds.size} 篇</Tag>
            )}
          </Space>
        }
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadDraftArticles}
          >
            刷新
          </Button>
        }
        variant="borderless"
        style={{ marginBottom: 24 }}
      >
        {articles.length === 0 ? (
          <Empty description="暂无草稿文章" />
        ) : (
          <ResizableTable<LocalArticle>
            tableId="publishing-article-select"
            columns={articleColumns}
            dataSource={articles}
            rowKey="id"
            loading={articlesLoading}
            scroll={{ x: 1000 }}
            pagination={{
              current: articlePage,
              pageSize: articlePageSize,
              total: articleTotal,
              onChange: (newPage, newPageSize) => {
                setArticlePage(newPage);
                if (newPageSize && newPageSize !== articlePageSize) {
                  setArticlePageSize(newPageSize);
                  setArticlePage(1);
                }
              },
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 篇文章`,
              pageSizeOptions: ['5', '10', '20', '50']
            }}
            size="small"
          />
        )}
      </Card>

      {/* 平台选择区 */}
      <Card 
        title={
          <Space>
            <CloudUploadOutlined style={{ color: '#52c41a' }} />
            <span>选择发布平台</span>
            {selectedAccounts.size > 0 && (
              <Tag color="green">已选 {selectedAccounts.size} 个平台</Tag>
            )}
          </Space>
        }
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => { loadPlatforms(); fetchAccounts(); }}
          >
            刷新
          </Button>
        }
        variant="borderless"
        style={{ marginBottom: 24 }}
      >
        {accounts.length === 0 ? (
          <Empty description="暂无已登录平台，请先到平台登录页面进行登录" />
        ) : (
          <Row gutter={[12, 12]}>
            {accounts.map(account => {
              const platform = platforms.find(p => p.platform_id === account.platform_id);
              const isSelected = selectedAccounts.has(account.id);
              
              return (
                <Col xs={12} sm={8} md={6} lg={4} xl={3} key={account.id}>
                  <Card
                    hoverable
                    onClick={() => handleAccountSelect(account.id)}
                    style={{
                      textAlign: 'center',
                      position: 'relative',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #52c41a' : '1px solid #e2e8f0',
                      background: isSelected ? '#f6ffed' : '#ffffff',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      height: '100%'
                    }}
                    styles={{ body: { padding: '12px 8px' } }}
                  >
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 4, right: 4 }}>
                        <CheckCircleOutlined style={{ fontSize: 14, color: '#52c41a' }} />
                      </div>
                    )}
                    
                    <div style={{
                      width: 48,
                      height: 48,
                      margin: '0 auto 8px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}>
                      <img 
                        src={getPlatformIcon(account.platform_id)} 
                        alt={platform?.platform_name || account.platform_id}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.style.background = isSelected ? '#52c41a' : '#0ea5e9';
                            parent.innerHTML = `<span style="font-size: 24px; font-weight: bold; color: #ffffff;">${(platform?.platform_name || account.platform_id).charAt(0)}</span>`;
                          }
                        }}
                      />
                    </div>
                    
                    <div style={{ 
                      fontSize: 12, 
                      fontWeight: 500, 
                      marginBottom: 4, 
                      color: '#1e293b',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {platform?.platform_name || account.platform_id}
                    </div>
                    
                    <div style={{ 
                      fontSize: 11, 
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {account.account_name}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      {/* 发布配置和操作 */}
      {(selectedArticleIds.size > 0 || selectedAccounts.size > 0) && (
        <Card 
          style={{ 
            marginBottom: 24, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none'
          }}
          styles={{ body: { padding: 20 } }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 统计信息 */}
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Space size="large">
                  <div>
                    <Text style={{ color: '#fff', fontSize: 16 }}>
                      已选择 <strong>{selectedArticleIds.size}</strong> 篇文章
                    </Text>
                  </div>
                  <div>
                    <Text style={{ color: '#fff', fontSize: 16 }}>
                      已选择 <strong>{selectedAccounts.size}</strong> 个平台
                    </Text>
                  </div>
                  <div>
                    <Text style={{ color: '#fff', fontSize: 16 }}>
                      将创建 <strong>{selectedArticleIds.size * selectedAccounts.size}</strong> 个任务
                    </Text>
                  </div>
                </Space>
              </Col>
            </Row>

            {/* 定时配置 */}
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Space size="middle" align="center">
                  <FieldTimeOutlined style={{ color: '#fff', fontSize: 20 }} />
                  <Text style={{ color: '#fff', fontSize: 14 }}>发布间隔：</Text>
                  <Space.Compact>
                    <InputNumber
                      min={1}
                      max={1440}
                      value={publishInterval}
                      onChange={(value) => setPublishInterval(value || 5)}
                      style={{ width: 100 }}
                      placeholder="间隔时间"
                    />
                    <Button disabled style={{ pointerEvents: 'none' }}>分钟</Button>
                  </Space.Compact>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                    第一篇立即发布，后续文章每隔 {publishInterval} 分钟发布一篇
                  </Text>
                </Space>
              </Col>
              <Col>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<SendOutlined />}
                  onClick={handleCreateTasks}
                  disabled={selectedArticleIds.size === 0 || selectedAccounts.size === 0 || creatingTasks}
                  loading={creatingTasks}
                  style={{
                    background: '#fff',
                    color: '#667eea',
                    border: 'none',
                    fontWeight: 600,
                    height: 44
                  }}
                >
                  {creatingTasks ? '创建中...' : '创建发布任务'}
                </Button>
              </Col>
            </Row>

            {/* 发布模式切换 */}
            <Row gutter={16} align="middle" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <Col flex="auto">
                <Space size="middle" align="center">
                  {headlessMode ? (
                    <EyeInvisibleOutlined style={{ color: '#fff', fontSize: 20 }} />
                  ) : (
                    <EyeOutlined style={{ color: '#fff', fontSize: 20 }} />
                  )}
                  <Text style={{ color: '#fff', fontSize: 14 }}>发布模式：</Text>
                  <Switch
                    checked={headlessMode}
                    onChange={(checked) => setHeadlessMode(checked)}
                    checkedChildren="静默发布"
                    unCheckedChildren="可视化"
                    style={{ 
                      backgroundColor: headlessMode ? '#1890ff' : '#52c41a',
                      minWidth: 90
                    }}
                  />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                    {headlessMode 
                      ? '🔇 静默模式：后台运行，不显示浏览器' 
                      : '👁️ 可视化模式：显示浏览器窗口，可观察发布过程'}
                  </Text>
                </Space>
              </Col>
            </Row>
          </Space>
        </Card>
      )}

      {/* 任务列表 */}
      <Card 
        title={
          <Space>
            <HistoryOutlined style={{ color: '#722ed1' }} />
            <span>发布任务</span>
            {selectedTaskIds.size > 0 && (
              <Tag color="purple">已选 {selectedTaskIds.size} 个任务</Tag>
            )}
            {selectedBatchIds.size > 0 && (
              <Tag color="blue">已选 {selectedBatchIds.size} 个批次</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            {selectedBatchIds.size > 0 && (
              <Button 
                danger
                icon={<DeleteOutlined />} 
                onClick={handleBatchDeleteBatches}
              >
                批量删除批次 ({selectedBatchIds.size})
              </Button>
            )}
            {selectedTaskIds.size > 0 && (
              <Button 
                danger
                icon={<DeleteOutlined />} 
                onClick={handleBatchDelete}
              >
                批量删除任务 ({selectedTaskIds.size})
              </Button>
            )}
            {taskTotal > 0 && (
              <Button 
                danger
                icon={<DeleteOutlined />} 
                onClick={handleDeleteAll}
              >
                删除全部
              </Button>
            )}
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadTasks}
            >
              刷新
            </Button>
          </Space>
        }
        variant="borderless"
      >
        {(() => {
          const { batches } = groupTasksByBatch();
          const batchIds = Object.keys(batches);
          
          if (tasks.length === 0 && !tasksLoading) {
            return <Empty description="暂无发布任务" />;
          }
          
          // 将批次数据转换为表格数据源
          const batchDataSource = batchIds.map(batchId => {
            const batchTasks = batches[batchId];
            const stats = getBatchStats(batchTasks);
            const shortId = batchId.split('_').pop()?.substring(0, 8) || batchId;
            const intervalMinutes = batchTasks[0]?.intervalMinutes || 0;
            const createdAt = batchTasks[0]?.createdAt || '';
            
            return {
              key: batchId,
              batchId,
              shortId,
              total: stats.total,
              pending: stats.pending,
              running: stats.running,
              success: stats.success,
              failed: stats.failed,
              cancelled: stats.cancelled,
              intervalMinutes,
              createdAt,
              tasks: batchTasks
            };
          });

          // 批次表格列定义
          const batchColumns = [
            {
              title: (
                <Checkbox
                  checked={batchDataSource.length > 0 && selectedBatchIds.size === batchDataSource.length}
                  indeterminate={selectedBatchIds.size > 0 && selectedBatchIds.size < batchDataSource.length}
                  onChange={(e) => handleBatchSelectAll(e.target.checked, batchDataSource.map(b => b.batchId))}
                />
              ),
              key: 'checkbox',
              width: 50,
              align: 'center' as const,
              render: (_: any, record: any) => (
                <Checkbox
                  checked={selectedBatchIds.has(record.batchId)}
                  onChange={(e) => handleBatchSelect(record.batchId, e.target.checked)}
                />
              ),
            },
            Table.EXPAND_COLUMN,
            {
              title: '执行进度',
              key: 'progress',
              width: 450,
              render: (_: any, record: any) => {
                const completedCount = record.success + record.failed + record.cancelled;
                const progressPercent = Math.round((completedCount / record.total) * 100);
                
                return (
                  <div style={{ padding: '8px 0' }}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        fontSize: 12,
                        color: '#64748b'
                      }}>
                        <span>完成进度</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                          {completedCount}/{record.total} ({progressPercent}%)
                        </span>
                      </div>
                      <div style={{
                        height: 8,
                        background: '#e2e8f0',
                        borderRadius: 4,
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${progressPercent}%`,
                          background: record.failed > 0 ? '#ff4d4f' : '#1890ff',
                          transition: 'width 0.3s ease',
                          borderRadius: 4
                        }} />
                      </div>
                    </div>
                    
                    <Space size={6} wrap>
                      {record.running > 0 && (
                        <Tag color="processing" icon={<SyncOutlined spin />} style={{ margin: 0, fontSize: 12 }}>
                          执行中 {record.running}
                        </Tag>
                      )}
                      {record.pending > 0 && (
                        <Tag color="default" icon={<ClockCircleOutlined />} style={{ margin: 0, fontSize: 12 }}>
                          等待 {record.pending}
                        </Tag>
                      )}
                      {record.success > 0 && (
                        <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 12 }}>
                          成功 {record.success}
                        </Tag>
                      )}
                      {record.failed > 0 && (
                        <Tag color="error" icon={<CloseCircleOutlined />} style={{ margin: 0, fontSize: 12 }}>
                          失败 {record.failed}
                        </Tag>
                      )}
                      {record.cancelled > 0 && (
                        <Tag color="warning" icon={<StopOutlined />} style={{ margin: 0, fontSize: 12 }}>
                          已取消 {record.cancelled}
                        </Tag>
                      )}
                    </Space>
                  </div>
                );
              }
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 170,
              align: 'center' as const,
              render: (time: string) => (
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {time ? new Date(time).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-'}
                </div>
              )
            },
            {
              title: '操作',
              key: 'action',
              width: 180,
              align: 'center' as const,
              render: (_: any, record: any) => (
                <Space size="small">
                  {(record.pending > 0 || record.running > 0) && (
                    <Tooltip title="停止批次执行">
                      <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopBatch(record.batchId);
                        }}
                      >
                        停止
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip title="删除整个批次">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBatch(record.batchId);
                      }}
                    >
                      删除
                    </Button>
                  </Tooltip>
                </Space>
              )
            }
          ];

          // 展开行渲染子任务
          const expandedRowRender = (record: any) => (
            <div style={{ 
              background: 'linear-gradient(to bottom, #f8fafc 0%, #ffffff 100%)',
              padding: '16px 24px',
              borderLeft: '4px solid #1890ff',
              margin: '0 -16px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: '#1890ff',
                boxShadow: '2px 0 8px rgba(24, 144, 255, 0.3)'
              }} />
              
              <div style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <ResizableTable<LocalTaskDisplay>
                  tableId={`publishing-tasks-batch-${record.key}`}
                  columns={taskColumns}
                  dataSource={record.tasks}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 800 }}
                  rowClassName={(task, index) => {
                    if (task.status === 'running') return 'task-row-running';
                    if (task.status === 'completed' || task.status === 'success') return 'task-row-success';
                    if (task.status === 'failed') return 'task-row-failed';
                    return index % 2 === 0 ? 'task-row-even' : 'task-row-odd';
                  }}
                />
              </div>
            </div>
          );
          
          return (
            <>
              <style>
                {`
                  .task-row-running { background: #e6f7ff !important; }
                  .task-row-success { background: #f6ffed !important; }
                  .task-row-failed { background: #fff1f0 !important; }
                  .task-row-even { background: #fafafa !important; }
                  .task-row-odd { background: #ffffff !important; }
                  .batch-expand-icon { transition: all 0.3s ease; }
                  .batch-expand-icon:hover { transform: translateX(4px); }
                  .batch-row { transition: all 0.2s ease; }
                  .batch-row:hover { background: #fafafa !important; }
                `}
              </style>
              <ResizableTable
                tableId="publishing-tasks-batches"
                columns={batchColumns}
                dataSource={batchDataSource}
                rowKey="key"
                loading={tasksLoading}
                rowClassName="batch-row"
                expandable={{
                  expandedRowRender,
                  rowExpandable: (record) => record.tasks && record.tasks.length > 0,
                  columnWidth: 140,
                  expandIcon: ({ expanded, onExpand, record }) => (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Button
                        type={expanded ? 'primary' : 'default'}
                        size="middle"
                        className="batch-expand-icon"
                        style={{ 
                          minWidth: 110,
                          height: 36,
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          background: expanded ? '#1890ff' : '#fff',
                          border: expanded ? 'none' : '1px solid #d1d5db',
                          color: expanded ? '#fff' : '#64748b',
                          boxShadow: expanded 
                            ? '0 2px 8px rgba(24, 144, 255, 0.3)'
                            : '0 1px 2px rgba(0,0,0,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                        icon={expanded ? <DownOutlined /> : <RightOutlined />}
                        onClick={(e) => onExpand(record, e)}
                      >
                        {expanded ? '收起子任务' : '查看子任务'}
                      </Button>
                    </div>
                  )
                }}
                pagination={{
                  current: taskPage,
                  pageSize: taskPageSize,
                  total: batchDataSource.length,
                  onChange: (newPage, newPageSize) => {
                    setTaskPage(newPage);
                    if (newPageSize && newPageSize !== taskPageSize) {
                      setTaskPageSize(newPageSize);
                      setTaskPage(1);
                    }
                  },
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 个批次`,
                  pageSizeOptions: ['10', '20', '50', '100']
                }}
              />
            </>
          );
        })()}
      </Card>

      {/* 日志查看模态框 */}
      <Modal
        title={
          <Space>
            <SyncOutlined spin={logsModal.isLive} style={{ color: logsModal.isLive ? '#52c41a' : '#999' }} />
            <span>任务日志 #{logsModal.taskId?.substring(0, 8)}</span>
            {logsModal.isLive ? (
              <Tag color="success" icon={<SyncOutlined spin />}>实时更新中</Tag>
            ) : (
              <Tag color="default">已完成</Tag>
            )}
          </Space>
        }
        open={logsModal.visible}
        onCancel={() => setLogsModal({ visible: false, taskId: null, logs: [], isLive: false })}
        width={900}
        footer={[
          <Button 
            key="refresh" 
            icon={<ReloadOutlined />}
            onClick={async () => {
              if (logsModal.taskId) {
                try {
                  await fetchLogs(logsModal.taskId);
                  requestAnimationFrame(() => {
                    if (logsContainerRef.current) {
                      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
                    }
                  });
                  message.success('日志已刷新');
                } catch (error: any) {
                  message.error('刷新失败');
                }
              }
            }}
          >
            刷新
          </Button>,
          <Button 
            key="close" 
            type="primary" 
            onClick={() => setLogsModal({ visible: false, taskId: null, logs: [], isLive: false })}
          >
            关闭
          </Button>
        ]}
      >
        <div 
          ref={logsContainerRef}
          style={{ 
            maxHeight: 600, 
            overflow: 'auto',
            background: '#fff',
            borderRadius: 8,
            padding: 16,
            border: '1px solid #e2e8f0'
          }}
        >
          {logsModal.logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <SyncOutlined spin={logsModal.isLive} style={{ fontSize: 32, marginBottom: 16 }} />
              <div>{logsModal.isLive ? '等待日志...' : '暂无日志'}</div>
            </div>
          ) : (
            logsModal.logs.map((log, index) => {
              const levelColors: Record<string, string> = {
                info: '#52c41a',
                warn: '#faad14',
                warning: '#faad14',
                error: '#ff4d4f'
              };
              const color = levelColors[log.level] || '#52c41a';
              
              return (
                <div 
                  key={index}
                  style={{ 
                    marginBottom: 8,
                    padding: '12px 16px',
                    background: '#fff',
                    borderRadius: 6,
                    borderTop: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0',
                    borderBottom: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${color}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>
                      {new Date(log.timestamp || log.created_at || log.createdAt || '').toLocaleString('zh-CN')}
                    </span>
                    <Tag 
                      color={log.level === 'info' ? 'success' : log.level === 'warn' || log.level === 'warning' ? 'warning' : 'error'}
                      style={{ margin: 0, fontSize: 11, fontWeight: 600 }}
                    >
                      {log.level.toUpperCase()}
                    </Tag>
                  </div>
                  <div style={{ color: '#1e293b', fontSize: 14, lineHeight: 1.6, fontWeight: 500 }}>
                    {log.message}
                  </div>
                  {log.details && (
                    <pre style={{ 
                      margin: '8px 0 0 0',
                      padding: 12,
                      background: '#fafafa',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#475569',
                      overflow: 'auto',
                      border: '1px solid #e2e8f0',
                      fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                    }}>
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* 文章预览模态框 */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: '#1890ff' }} />
            <span>文章预览</span>
            {previewModal.article && (
              <Tag color="blue">ID: {previewModal.article.id.substring(0, 8)}...</Tag>
            )}
          </Space>
        }
        open={previewModal.visible}
        onCancel={() => setPreviewModal({ visible: false, article: null, loading: false })}
        width={900}
        footer={[
          <Button 
            key="close" 
            type="primary" 
            onClick={() => setPreviewModal({ visible: false, article: null, loading: false })}
          >
            关闭
          </Button>
        ]}
        loading={previewModal.loading}
      >
        {previewModal.article && !previewModal.loading && (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            {/* 文章元信息 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text type="secondary">关键词：</Text>
                  <Tag color="blue">{previewModal.article.keyword}</Tag>
                </Col>
                <Col span={12}>
                  <Text type="secondary">蒸馏结果：</Text>
                  {previewModal.article.topicQuestionSnapshot ? (
                    <Tag color="green">{previewModal.article.topicQuestionSnapshot}</Tag>
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Col>
                <Col span={12}>
                  <Text type="secondary">创建时间：</Text>
                  <Text>{new Date(previewModal.article.createdAt).toLocaleString('zh-CN')}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">发布状态：</Text>
                  <Tag color={previewModal.article.isPublished ? 'success' : 'default'}>
                    {previewModal.article.isPublished ? '已发布' : '未发布'}
                  </Tag>
                </Col>
              </Row>
            </Card>

            {/* 使用统一的文章预览组件 */}
            <ArticlePreview 
              content={previewModal.article.content}
              title={previewModal.article.title}
              imageUrl={previewModal.article.imageUrl}
            />
          </div>
        )}
        {previewModal.loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <SyncOutlined spin style={{ fontSize: 32, color: '#1890ff' }} />
            <div style={{ marginTop: 16, color: '#666' }}>加载文章详情中...</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
