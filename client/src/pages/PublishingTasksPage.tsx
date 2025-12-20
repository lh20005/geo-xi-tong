import { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Button, Space, Tag, message, 
  Checkbox, Statistic, Modal, Typography, Tooltip, Empty,
  DatePicker, Input, InputNumber, Switch
} from 'antd';
import {
  SendOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, SyncOutlined,
  EyeOutlined, DeleteOutlined, PlayCircleOutlined,
  FileTextOutlined, CloudUploadOutlined, HistoryOutlined,
  StopOutlined, ExclamationCircleOutlined, FieldTimeOutlined,
  EyeInvisibleOutlined, DownOutlined, RightOutlined
} from '@ant-design/icons';
import { 
  getArticles, getArticle, Article 
} from '../api/articles';
import { 
  getPlatforms, getAccounts, Platform, Account,
  createPublishingTask, getPublishingTasks, getTaskLogs,
  executeTask, cancelTask, terminateTask, deleteTask,
  batchDeleteTasks, deleteAllTasks, PublishingTask, PublishingLog,
  stopBatch, deleteBatch, getBatchInfo, BatchInfo,
  subscribeToTaskLogs
} from '../api/publishing';
import ArticlePreview from '../components/ArticlePreview';
import ResizableTable from '../components/ResizableTable';
import { processArticleContent as processArticleContentUtil } from '../utils/articleUtils';
import dayjs, { Dayjs } from 'dayjs';

const { Text, Paragraph } = Typography;

export default function PublishingTasksPage() {
  // 文章选择
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlePage, setArticlePage] = useState(1);
  const [articlePageSize, setArticlePageSize] = useState(10);
  const [articleTotal, setArticleTotal] = useState(0);

  // 平台选择
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [platformsLoading, setPlatformsLoading] = useState(false);

  // 任务管理
  const [tasks, setTasks] = useState<PublishingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [taskTotal, setTaskTotal] = useState(0);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());

  // 定时发布
  const [scheduledTime, setScheduledTime] = useState<Dayjs | null>(null);
  
  // 间隔发布（分钟）
  const [publishInterval, setPublishInterval] = useState<number>(5);

  // 静默发布模式（默认开启静默模式）
  const [headlessMode, setHeadlessMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('publishHeadlessMode');
    return saved !== null ? saved === 'true' : true;
  });

  // 日志查看
  const [logsModal, setLogsModal] = useState<{ 
    visible: boolean; 
    taskId: number | null; 
    logs: PublishingLog[] 
  }>({
    visible: false,
    taskId: null,
    logs: []
  });

  // 实时日志流
  const [logStream, setLogStream] = useState<{
    visible: boolean;
    taskId: number | null;
    logs: PublishingLog[];
    isLive: boolean;
  }>({
    visible: false,
    taskId: null,
    logs: [],
    isLive: false
  });

  // 文章预览
  const [previewModal, setPreviewModal] = useState<{
    visible: boolean;
    article: Article | null;
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

  useEffect(() => {
    loadDraftArticles();
    loadPlatformsAndAccounts();
    loadTasks();
  }, []);

  useEffect(() => {
    loadDraftArticles();
  }, [articlePage, articlePageSize]);

  useEffect(() => {
    loadTasks();
  }, []);

  // 自动刷新任务列表（每5秒刷新一次）
  useEffect(() => {
    const intervalId = setInterval(() => {
      // 只在有任务时自动刷新
      if (tasks.length > 0) {
        const hasRunningTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');
        if (hasRunningTasks) {
          console.log('🔄 自动刷新任务列表...');
          loadTasks();
        }
      }
    }, 5000); // 每5秒刷新一次

    return () => clearInterval(intervalId);
  }, [tasks]); // 依赖tasks，当tasks变化时重新设置定时器

  // 保存静默模式设置到 localStorage
  useEffect(() => {
    localStorage.setItem('publishHeadlessMode', headlessMode.toString());
  }, [headlessMode]);

  // 加载草稿文章
  const loadDraftArticles = async () => {
    setArticlesLoading(true);
    try {
      const response = await getArticles(articlePage, articlePageSize, { publishStatus: 'unpublished' });
      setArticles(response.articles || []);
      setArticleTotal(response.total || 0);
      setStats(prev => ({ ...prev, draftArticles: response.total || 0 }));
    } catch (error: any) {
      message.error('加载草稿文章失败');
      console.error(error);
    } finally {
      setArticlesLoading(false);
    }
  };

  // 加载平台和账号
  const loadPlatformsAndAccounts = async () => {
    setPlatformsLoading(true);
    try {
      const [platformsData, accountsData] = await Promise.all([
        getPlatforms(),
        getAccounts()
      ]);
      setPlatforms(platformsData);
      setAccounts(accountsData.filter(acc => acc.status === 'active'));
      
      const boundPlatforms = new Set(accountsData.map(acc => acc.platform_id)).size;
      setStats(prev => ({ ...prev, boundPlatforms }));
    } catch (error: any) {
      message.error('加载平台信息失败');
      console.error(error);
    } finally {
      setPlatformsLoading(false);
    }
  };

  // 加载任务列表
  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      // 加载所有任务用于批次分组显示
      const response = await getPublishingTasks(1, 1000);
      setTasks(response.tasks || []);
      setTaskTotal(response.total || 0);

      // 统计运行中的任务和今日发布数
      const runningTasks = (response.tasks || []).filter(
        (t: PublishingTask) => t.status === 'running' || t.status === 'pending'
      ).length;
      
      const today = new Date().toDateString();
      const todayPublished = (response.tasks || []).filter(
        (t: PublishingTask) => 
          t.status === 'success' && 
          new Date(t.executed_at || '').toDateString() === today
      ).length;

      setStats(prev => ({ ...prev, runningTasks, todayPublished }));
    } catch (error: any) {
      message.error('加载任务列表失败');
      console.error(error);
    } finally {
      setTasksLoading(false);
    }
  };

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

    const articleIds = Array.from(selectedArticleIds);
    const accountIds = Array.from(selectedAccounts);
    const totalTasks = articleIds.length * accountIds.length;
    
    // 计算总耗时
    const totalMinutes = (articleIds.length - 1) * publishInterval;
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
            ⚠️ 串行发布：第一篇文章发布完成后，等待 {publishInterval} 分钟，再发布第二篇，依此类推
          </p>
        </div>
      ),
      onOk: async () => {
        try {
          // 生成批次ID（使用时间戳 + 随机数）
          const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const tasks = [];
          let batchOrder = 0;
          
          // 为每篇文章创建任务
          // 所有任务都是 pending 状态，由批次执行器按顺序执行
          for (let i = 0; i < articleIds.length; i++) {
            const articleId = articleIds[i];
            
            for (const accountId of accountIds) {
              const account = accounts.find(a => a.id === accountId);
              if (account) {
                tasks.push(
                  createPublishingTask({
                    article_id: articleId,
                    platform_id: account.platform_id,
                    account_id: accountId,
                    scheduled_time: null, // 不使用定时，由批次执行器控制
                    batch_id: batchId,
                    batch_order: batchOrder,
                    interval_minutes: publishInterval,
                    config: {
                      headless: headlessMode
                    }
                  })
                );
              }
            }
            
            batchOrder++;
          }

          await Promise.all(tasks);
          message.success(`成功创建 ${tasks.length} 个发布任务，批次 ${batchId} 已开始执行`);
          
          // 清空选择
          setSelectedArticleIds(new Set());
          setSelectedAccounts(new Set());
          setPublishInterval(5); // 重置为默认值
          
          // 刷新任务列表
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '创建任务失败');
        }
      }
    });
  };

  // 查看任务日志（历史日志）
  const handleViewLogs = async (taskId: number) => {
    try {
      const logs = await getTaskLogs(taskId);
      setLogsModal({
        visible: true,
        taskId,
        logs
      });
    } catch (error: any) {
      message.error('加载日志失败');
    }
  };

  // 打开实时日志流
  const handleOpenLogStream = (taskId: number) => {
    setLogStream({
      visible: true,
      taskId,
      logs: [],
      isLive: true
    });
  };

  // 关闭实时日志流
  const handleCloseLogStream = () => {
    setLogStream({
      visible: false,
      taskId: null,
      logs: [],
      isLive: false
    });
  };

  // 订阅实时日志
  useEffect(() => {
    if (!logStream.visible || !logStream.taskId) {
      return;
    }

    const unsubscribe = subscribeToTaskLogs(
      logStream.taskId,
      (log) => {
        setLogStream(prev => ({
          ...prev,
          logs: [...prev.logs, log]
        }));
      },
      (error) => {
        message.error('日志流连接失败');
        setLogStream(prev => ({ ...prev, isLive: false }));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [logStream.visible, logStream.taskId]);



  // 预览文章
  const handlePreviewArticle = async (article: Article) => {
    try {
      // 先显示模态框，显示加载状态
      setPreviewModal({
        visible: true,
        article: article,
        loading: true
      });
      
      // 获取完整的文章详情（包含content）
      const fullArticle = await getArticle(article.id);
      
      // 更新模态框内容
      setPreviewModal({
        visible: true,
        article: fullArticle,
        loading: false
      });
    } catch (error: any) {
      message.error('加载文章详情失败');
      console.error(error);
      setPreviewModal({ visible: false, article: null, loading: false });
    }
  };

  // 立即执行任务
  const handleExecuteTask = async (taskId: number) => {
    Modal.confirm({
      title: '确认立即执行',
      content: '确定要立即执行这个发布任务吗？',
      onOk: async () => {
        try {
          await executeTask(taskId);
          message.success('任务已开始执行');
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '执行失败');
        }
      }
    });
  };

  // 取消任务
  const handleCancelTask = async (taskId: number) => {
    Modal.confirm({
      title: '确认取消任务',
      content: '确定要取消这个发布任务吗？',
      onOk: async () => {
        try {
          await cancelTask(taskId);
          message.success('任务已取消');
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '取消失败');
        }
      }
    });
  };

  // 终止任务
  const handleTerminateTask = async (taskId: number) => {
    Modal.confirm({
      title: '确认终止任务',
      content: '确定要强制终止这个正在执行的任务吗？任务将被标记为失败。',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认终止',
      okType: 'danger',
      onOk: async () => {
        try {
          await terminateTask(taskId);
          message.success('任务已终止');
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '终止失败');
        }
      }
    });
  };

  // 删除任务
  const handleDeleteTask = async (taskId: number) => {
    Modal.confirm({
      title: '确认删除任务',
      content: '确定要删除这个任务吗？此操作不可恢复。',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteTask(taskId);
          message.success('任务已删除');
          setSelectedTaskIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
          loadTasks();
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
          const result = await batchDeleteTasks(Array.from(selectedTaskIds));
          if (result.successCount > 0) {
            message.success(`成功删除 ${result.successCount} 个任务`);
          }
          if (result.failCount > 0) {
            message.warning(`${result.failCount} 个任务删除失败`);
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
          const result = await deleteAllTasks();
          message.success(`成功删除 ${result.deletedCount} 个任务`);
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
          const result = await stopBatch(batchId);
          const messages = [];
          if (result.cancelledCount > 0) {
            messages.push(`取消了 ${result.cancelledCount} 个待处理任务`);
          }
          if (result.terminatedCount > 0) {
            messages.push(`终止了 ${result.terminatedCount} 个运行中任务`);
          }
          message.success(`成功停止批次${messages.length > 0 ? '，' + messages.join('，') : ''}`);
          loadTasks();
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
          const result = await deleteBatch(batchId);
          message.success(`成功删除批次，删除了 ${result.deletedCount} 个任务`);
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '删除批次失败');
        }
      }
    });
  };

  // 任务选择处理
  const handleTaskSelect = (taskId: number, checked: boolean) => {
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
  const handleArticleSelect = (articleId: number, checked: boolean) => {
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
  const handleAccountSelect = (accountId: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; text: string }> = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
      running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取日志级别标签
  const getLevelTag = (level: string) => {
    const levelConfig: Record<string, string> = {
      info: 'blue',
      warning: 'orange',
      error: 'red'
    };
    return <Tag color={levelConfig[level] || 'default'}>{level.toUpperCase()}</Tag>;
  };

  // 根据平台ID获取平台名称
  const getPlatformName = (platformId: string) => {
    const platform = platforms.find(p => p.platform_id === platformId);
    return platform?.platform_name || platformId;
  };

  // 按批次分组任务
  const groupTasksByBatch = () => {
    const batches: { [key: string]: PublishingTask[] } = {};
    const noBatchTasks: PublishingTask[] = [];

    tasks.forEach(task => {
      if (task.batch_id) {
        if (!batches[task.batch_id]) {
          batches[task.batch_id] = [];
        }
        batches[task.batch_id].push(task);
      } else {
        noBatchTasks.push(task);
      }
    });

    // 按 batch_order 排序每个批次的任务
    Object.keys(batches).forEach(batchId => {
      batches[batchId].sort((a, b) => (a.batch_order || 0) - (b.batch_order || 0));
    });

    return { batches, noBatchTasks };
  };

  // 获取批次统计信息
  const getBatchStats = (batchTasks: PublishingTask[]) => {
    return {
      total: batchTasks.length,
      pending: batchTasks.filter(t => t.status === 'pending').length,
      running: batchTasks.filter(t => t.status === 'running').length,
      success: batchTasks.filter(t => t.status === 'success').length,
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
      render: (_: any, record: Article) => (
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
      width: 50,
      align: 'center' as const,
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
      dataIndex: 'topicQuestion',
      key: 'topicQuestion',
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
      render: (_: any, record: Article) => (
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
      render: (_: any, record: PublishingTask) => (
        <Checkbox
          checked={selectedTaskIds.has(record.id)}
          onChange={(e) => handleTaskSelect(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '平台',
      dataIndex: 'platform_id',
      key: 'platform_id',
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
      render: (text: string, record: PublishingTask) => (
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
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: PublishingTask) => (
        <Space size="small">
          <Tooltip title="查看历史日志">
            <Button 
              type="link" 
              size="small"
              icon={<EyeOutlined />} 
              onClick={() => handleViewLogs(record.id)}
            >
              历史
            </Button>
          </Tooltip>

          <Tooltip title="实时日志">
            <Button 
              type="link" 
              size="small"
              icon={<SyncOutlined />} 
              onClick={() => handleOpenLogStream(record.id)}
              style={{ color: '#52c41a' }}
            >
              实时
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

          {(record.status === 'success' || record.status === 'failed' || record.status === 'cancelled') && (
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
        bordered={false}
        style={{ marginBottom: 24 }}
      >
        {articles.length === 0 ? (
          <Empty description="暂无草稿文章" />
        ) : (
          <ResizableTable<Article>
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
            onClick={loadPlatformsAndAccounts}
          >
            刷新
          </Button>
        }
        bordered={false}
        style={{ marginBottom: 24 }}
      >
        {accounts.length === 0 ? (
          <Empty description="暂无已登录平台，请先到平台登录页面进行登录" />
        ) : (
          <Row gutter={[16, 16]}>
            {accounts.map(account => {
              const platform = platforms.find(p => p.platform_id === account.platform_id);
              const isSelected = selectedAccounts.has(account.id);
              
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={account.id}>
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
                      cursor: 'pointer'
                    }}
                    bodyStyle={{ padding: '20px 16px' }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8
                        }}
                      >
                        <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                      </div>
                    )}
                    
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        margin: '0 auto 12px',
                        borderRadius: 8,
                        background: isSelected ? '#52c41a' : '#1890ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: '#ffffff'
                      }}
                    >
                      {platform?.platform_name.charAt(0) || 'P'}
                    </div>
                    
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>
                      {platform?.platform_name || account.platform_id}
                    </div>
                    
                    <div style={{ fontSize: 12, color: '#64748b' }}>
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
          bodyStyle={{ padding: 20 }}
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
                  <InputNumber
                    min={1}
                    max={1440}
                    value={publishInterval}
                    onChange={(value) => setPublishInterval(value || 5)}
                    addonAfter="分钟"
                    style={{ width: 140 }}
                    placeholder="间隔时间"
                  />
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
                  disabled={selectedArticleIds.size === 0 || selectedAccounts.size === 0}
                  style={{
                    background: '#fff',
                    color: '#667eea',
                    border: 'none',
                    fontWeight: 600,
                    height: 44
                  }}
                >
                  创建发布任务
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
                    checked={!headlessMode}
                    onChange={(checked) => setHeadlessMode(!checked)}
                    checkedChildren="可视化发布"
                    unCheckedChildren="静默发布"
                    style={{ minWidth: 100 }}
                  />
                  <Tooltip 
                    title={
                      headlessMode 
                        ? "静默模式：浏览器在后台运行，不显示界面，速度更快" 
                        : "可视化模式：打开浏览器窗口，可以实时观看自动操作过程"
                    }
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                      {headlessMode ? '🔇 静默模式：后台运行，不显示浏览器' : '👁️ 可视化模式：打开浏览器窗口观看操作'}
                    </Text>
                  </Tooltip>
                </Space>
              </Col>
            </Row>
          </Space>
        </Card>
      )}

      {/* 实时日志显示窗口 */}
      {logStream.visible && logStream.taskId && (
        <Card
          title={
            <Space>
              <SyncOutlined spin={logStream.isLive} style={{ color: logStream.isLive ? '#52c41a' : '#999' }} />
              <span>发布日志 - 任务 #{logStream.taskId}</span>
              {logStream.isLive ? (
                <Tag color="success" icon={<SyncOutlined spin />}>实时更新中</Tag>
              ) : (
                <Tag color="default">已断开</Tag>
              )}
            </Space>
          }
          extra={
            <Space>
              <Button 
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  setLogStream(prev => ({ ...prev, logs: [] }));
                  handleOpenLogStream(logStream.taskId!);
                }}
              >
                重新连接
              </Button>
              <Button 
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={handleCloseLogStream}
              >
                关闭
              </Button>
            </Space>
          }
          style={{ 
            marginBottom: 24,
            border: '2px solid #52c41a',
            boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)'
          }}
          bodyStyle={{ 
            padding: 0,
            maxHeight: 400,
            overflow: 'auto',
            background: '#000',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace'
          }}
        >
          {logStream.logs.length === 0 ? (
            <div style={{ 
              padding: 40, 
              textAlign: 'center',
              color: '#52c41a'
            }}>
              <SyncOutlined spin style={{ fontSize: 32, marginBottom: 16 }} />
              <div>等待日志...</div>
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              {logStream.logs.map((log, index) => {
                const levelColors: Record<string, string> = {
                  info: '#52c41a',
                  warning: '#faad14',
                  error: '#ff4d4f'
                };
                const color = levelColors[log.level] || '#52c41a';
                
                return (
                  <div 
                    key={index}
                    style={{ 
                      marginBottom: 8,
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 4,
                      borderLeft: `3px solid ${color}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ 
                        color: '#666',
                        fontSize: 11,
                        fontFamily: 'monospace'
                      }}>
                        {new Date(log.timestamp || log.created_at).toLocaleTimeString('zh-CN')}
                      </span>
                      <span style={{ 
                        color,
                        fontSize: 11,
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        [{log.level}]
                      </span>
                    </div>
                    <div style={{ 
                      color: '#fff',
                      fontSize: 13,
                      lineHeight: 1.6
                    }}>
                      {log.message}
                    </div>
                    {log.details && (
                      <pre style={{ 
                        margin: '8px 0 0 0',
                        padding: 8,
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 4,
                        fontSize: 11,
                        color: '#999',
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* 任务列表 */}
      <Card 
        title={
          <Space>
            <HistoryOutlined style={{ color: '#722ed1' }} />
            <span>发布任务</span>
            {selectedTaskIds.size > 0 && (
              <Tag color="purple">已选 {selectedTaskIds.size} 个</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            {selectedTaskIds.size > 0 && (
              <>
                <Button 
                  danger
                  icon={<DeleteOutlined />} 
                  onClick={handleBatchDelete}
                >
                  批量删除 ({selectedTaskIds.size})
                </Button>
              </>
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
        bordered={false}
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
            const intervalMinutes = batchTasks[0]?.interval_minutes || 0;
            const createdAt = batchTasks[0]?.created_at || '';
            
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
              title: '批次信息',
              key: 'batchInfo',
              width: 280,
              render: (_: any, record: any) => (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12,
                    marginBottom: 8
                  }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {record.total}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 600, 
                        color: '#1e293b',
                        marginBottom: 4
                      }}>
                        批量发布任务
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <span>批次 #{record.shortId}</span>
                        <span>•</span>
                        <span>{record.intervalMinutes} 分钟间隔</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            },
            {
              title: '执行进度',
              key: 'progress',
              width: 450,
              render: (_: any, record: any) => {
                const completedCount = record.success + record.failed + record.cancelled;
                const progressPercent = Math.round((completedCount / record.total) * 100);
                
                return (
                  <div style={{ padding: '8px 0' }}>
                    {/* 进度条 */}
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
                          background: record.failed > 0 
                            ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)'
                            : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                          transition: 'width 0.3s ease',
                          borderRadius: 4
                        }} />
                      </div>
                    </div>
                    
                    {/* 状态标签 */}
                    <Space size={6} wrap>
                      {record.running > 0 && (
                        <Tag 
                          color="processing" 
                          icon={<SyncOutlined spin />}
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          执行中 {record.running}
                        </Tag>
                      )}
                      {record.pending > 0 && (
                        <Tag 
                          color="default"
                          icon={<ClockCircleOutlined />}
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          等待 {record.pending}
                        </Tag>
                      )}
                      {record.success > 0 && (
                        <Tag 
                          color="success"
                          icon={<CheckCircleOutlined />}
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          成功 {record.success}
                        </Tag>
                      )}
                      {record.failed > 0 && (
                        <Tag 
                          color="error"
                          icon={<CloseCircleOutlined />}
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          失败 {record.failed}
                        </Tag>
                      )}
                      {record.cancelled > 0 && (
                        <Tag 
                          color="warning"
                          icon={<StopOutlined />}
                          style={{ margin: 0, fontSize: 12 }}
                        >
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
              padding: '20px 24px',
              borderLeft: '4px solid #667eea',
              margin: '0 -16px',
              position: 'relative'
            }}>
              {/* 装饰线 */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '2px 0 8px rgba(102, 126, 234, 0.3)'
              }} />
              
              {/* 子任务标题 */}
              <div style={{ 
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '2px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 'bold'
                  }}>
                    {record.total}
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: 15, 
                      fontWeight: 600, 
                      color: '#1e293b',
                      marginBottom: 2
                    }}>
                      子任务列表
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      批次 #{record.shortId} 包含的所有发布任务
                    </div>
                  </div>
                </div>
                
                {/* 批次统计卡片 */}
                <div style={{ 
                  display: 'flex', 
                  gap: 12,
                  padding: '8px 16px',
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#667eea' }}>
                      {record.total}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      总任务
                    </div>
                  </div>
                  <div style={{ width: 1, background: '#e2e8f0' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
                      {record.success}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      成功
                    </div>
                  </div>
                  {record.failed > 0 && (
                    <>
                      <div style={{ width: 1, background: '#e2e8f0' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>
                          {record.failed}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          失败
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* 子任务表格 */}
              <div style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <ResizableTable<PublishingTask>
                  tableId={`publishing-tasks-batch-${record.key}`}
                  columns={taskColumns}
                  dataSource={record.tasks}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 800 }}
                  rowClassName={(task, index) => {
                    // 为不同状态的行添加不同的背景色
                    if (task.status === 'running') return 'task-row-running';
                    if (task.status === 'success') return 'task-row-success';
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
                  .task-row-running {
                    background: #e6f7ff !important;
                  }
                  .task-row-success {
                    background: #f6ffed !important;
                  }
                  .task-row-failed {
                    background: #fff1f0 !important;
                  }
                  .task-row-even {
                    background: #fafafa !important;
                  }
                  .task-row-odd {
                    background: #ffffff !important;
                  }
                  .batch-expand-icon {
                    transition: all 0.3s ease;
                  }
                  .batch-expand-icon:hover {
                    transform: translateX(4px);
                  }
                  .batch-row {
                    transition: all 0.2s ease;
                  }
                  .batch-row:hover {
                    background: #fafafa !important;
                  }
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
                        background: expanded 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : '#fff',
                        border: expanded ? 'none' : '1px solid #d1d5db',
                        color: expanded ? '#fff' : '#64748b',
                        boxShadow: expanded 
                          ? '0 2px 8px rgba(102, 126, 234, 0.3)'
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
        title={`任务日志 #${logsModal.taskId}`}
        open={logsModal.visible}
        onCancel={() => setLogsModal({ visible: false, taskId: null, logs: [] })}
        width={900}
        footer={[
          <Button 
            key="close" 
            type="primary" 
            onClick={() => setLogsModal({ visible: false, taskId: null, logs: [] })}
          >
            关闭
          </Button>
        ]}
      >
        <div style={{ maxHeight: 600, overflow: 'auto' }}>
          {logsModal.logs.length === 0 ? (
            <Empty description="暂无日志" />
          ) : (
            logsModal.logs.map((log, index) => (
              <Card 
                key={index} 
                size="small" 
                style={{ marginBottom: 8 }}
                bodyStyle={{ padding: 12 }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    {getLevelTag(log.level)}
                    <Text type="secondary">
                      {new Date(log.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </Space>
                  <Paragraph style={{ marginBottom: 0 }}>
                    {log.message}
                  </Paragraph>
                  {log.details && (
                    <pre style={{ 
                      background: '#f5f5f5', 
                      padding: 8, 
                      borderRadius: 4,
                      fontSize: 12,
                      marginBottom: 0,
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </Space>
              </Card>
            ))
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
              <Tag color="blue">ID: {previewModal.article.id}</Tag>
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
                  {previewModal.article.topicQuestion ? (
                    <Tag color="green">{previewModal.article.topicQuestion}</Tag>
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
