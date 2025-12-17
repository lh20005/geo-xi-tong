import { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Table, Button, Space, Tag, message, 
  Checkbox, Statistic, Modal, Typography, Tooltip, Empty,
  DatePicker, Input
} from 'antd';
import {
  SendOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, SyncOutlined,
  EyeOutlined, DeleteOutlined, PlayCircleOutlined,
  FileTextOutlined, CloudUploadOutlined, HistoryOutlined,
  StopOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { 
  getArticles, getArticle, Article 
} from '../api/articles';
import { 
  getPlatforms, getAccounts, Platform, Account,
  createPublishingTask, getPublishingTasks, getTaskLogs,
  executeTask, cancelTask, terminateTask, deleteTask,
  batchDeleteTasks, deleteAllTasks, PublishingTask, PublishingLog
} from '../api/publishing';
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
  }, [taskPage, taskPageSize]);

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
      const response = await getPublishingTasks(taskPage, taskPageSize);
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

    Modal.confirm({
      title: '确认创建发布任务',
      content: `将为 ${selectedArticleIds.size} 篇文章创建 ${selectedArticleIds.size * selectedAccounts.size} 个发布任务`,
      onOk: async () => {
        try {
          const tasks = [];
          for (const articleId of selectedArticleIds) {
            for (const accountId of selectedAccounts) {
              const account = accounts.find(a => a.id === accountId);
              if (account) {
                tasks.push(
                  createPublishingTask({
                    article_id: articleId,
                    platform_id: account.platform_id,
                    account_id: accountId,
                    scheduled_time: scheduledTime ? scheduledTime.toISOString() : null
                  })
                );
              }
            }
          }

          await Promise.all(tasks);
          message.success(`成功创建 ${tasks.length} 个发布任务`);
          
          // 清空选择
          setSelectedArticleIds(new Set());
          setSelectedAccounts(new Set());
          setScheduledTime(null);
          
          // 刷新任务列表
          loadTasks();
        } catch (error: any) {
          message.error(error.message || '创建任务失败');
        }
      }
    });
  };

  // 查看任务日志
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

  // 处理文章内容，移除占位符和Markdown标记
  const processArticleContent = (content: string, imageUrl?: string): string => {
    if (!content) return '';
    
    let processedContent = content;
    
    // 移除 [IMAGE_PLACEHOLDER] 占位符
    processedContent = processedContent.replace(/\[IMAGE_PLACEHOLDER\]/gi, '');
    
    // 处理 Markdown 图片标记 ![alt](url)
    // 如果有实际图片URL，替换为提示文字；否则直接移除
    if (imageUrl) {
      processedContent = processedContent.replace(
        /!\[([^\]]*)\]\([^)]+\)/g,
        '【此处显示文章配图】'
      );
    } else {
      processedContent = processedContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    }
    
    // 移除多余的空行（超过2个连续换行）
    processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
    
    // 移除首尾空白
    processedContent = processedContent.trim();
    
    return processedContent;
  };

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
      width: 50,
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
      width: 80,
      align: 'center' as const,
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      align: 'center' as const,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '蒸馏结果',
      dataIndex: 'topicQuestion',
      key: 'topicQuestion',
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="green">{text}</Tag> : <Text type="secondary">-</Text>,
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
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '文章ID',
      dataIndex: 'article_id',
      key: 'article_id',
      width: 100,
      align: 'center' as const,
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
      title: '账号',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 150,
      align: 'center' as const,
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
      title: '计划时间',
      dataIndex: 'scheduled_time',
      key: 'scheduled_time',
      width: 180,
      align: 'center' as const,
      render: (time: string | null) => 
        time ? new Date(time).toLocaleString('zh-CN') : <Text type="secondary">立即执行</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      align: 'center' as const,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: PublishingTask) => (
        <Space size="small">
          <Tooltip title="查看日志">
            <Button 
              type="link" 
              size="small"
              icon={<EyeOutlined />} 
              onClick={() => handleViewLogs(record.id)}
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
          <Table
            columns={articleColumns}
            dataSource={articles}
            rowKey="id"
            loading={articlesLoading}
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
            <Col>
              <Space>
                <DatePicker
                  showTime
                  placeholder="选择定时发布时间（可选）"
                  value={scheduledTime}
                  onChange={setScheduledTime}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  style={{ width: 220 }}
                />
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
                    fontWeight: 600
                  }}
                >
                  创建发布任务
                </Button>
              </Space>
            </Col>
          </Row>
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
        <Table
          columns={taskColumns}
          dataSource={tasks}
          rowKey="id"
          loading={tasksLoading}
          scroll={{ x: 1500 }}
          pagination={{
            current: taskPage,
            pageSize: taskPageSize,
            total: taskTotal,
            onChange: (newPage, newPageSize) => {
              setTaskPage(newPage);
              if (newPageSize && newPageSize !== taskPageSize) {
                setTaskPageSize(newPageSize);
                setTaskPage(1);
              }
            },
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个任务`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
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

            {/* 文章标题 */}
            {previewModal.article.title && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 18 }}>
                  {previewModal.article.title}
                </Text>
              </Card>
            )}

            {/* 文章图片 */}
            {previewModal.article.imageUrl && (
              <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
                <img 
                  src={previewModal.article.imageUrl} 
                  alt="文章配图" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: 400,
                    borderRadius: 8,
                    objectFit: 'contain'
                  }} 
                />
              </Card>
            )}

            {/* 文章内容 */}
            <Card 
              size="small" 
              title={<Text strong>文章内容</Text>}
            >
              {previewModal.article.content ? (
                <div 
                  style={{ 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.8,
                    fontSize: 14,
                    color: '#333'
                  }}
                >
                  {processArticleContent(previewModal.article.content, previewModal.article.imageUrl)}
                </div>
              ) : (
                <Empty 
                  description="暂无文章内容" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
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
