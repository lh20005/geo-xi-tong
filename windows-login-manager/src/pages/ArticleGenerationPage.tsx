import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Card, Button, Tag, Progress, message, Space, Modal, Popconfirm, 
  Tooltip, Select, Input, Row, Col, Statistic, Alert 
} from 'antd';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FileTextOutlined, 
  DeleteOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloudSyncOutlined
} from '@ant-design/icons';
import TaskConfigModal from '../components/TaskConfigModal';
import ResizableTable from '../components/ResizableTable';
import { 
  createTask, 
  fetchTasks, 
  deleteTask, 
  batchDeleteTasks, 
  deleteAllTasks,
  cancelTask
} from '../api/articleGenerationApi';
import type { GenerationTask, TaskConfig } from '../types/articleGeneration';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

const { Search } = Input;
const { Option } = Select;

// 统计数据接口
interface TaskStatistics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalArticles: number;
  completedArticles: number;
}

export default function ArticleGenerationPage() {
  const { invalidateCacheByPrefix } = useCacheStore();
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  
  // 筛选和搜索状态
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const [filterConversionTarget, setFilterConversionTarget] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  // 统计数据
  const [statistics, setStatistics] = useState<TaskStatistics>({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    totalArticles: 0,
    completedArticles: 0
  });
  
  // 可用的关键词和转化目标列表
  const [availableKeywords, setAvailableKeywords] = useState<string[]>([]);
  const [availableConversionTargets, setAvailableConversionTargets] = useState<string[]>([]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim()) {
        setSearchText(searchInput);
        setCurrentPage(1);
      } else {
        setSearchText('');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 生成缓存 key
  const cacheKey = useMemo(() => 
    `articleGeneration:list:${currentPage}:${pageSize}:${filterStatus}:${filterKeyword}:${filterConversionTarget}:${searchText}`,
    [currentPage, pageSize, filterStatus, filterKeyword, filterConversionTarget, searchText]
  );

  // 数据获取函数
  const fetchData = useCallback(async () => {
    // 如果有筛选条件，获取所有数据进行前端筛选
    const hasFilters = filterStatus || filterKeyword || filterConversionTarget || searchText;
    const data = hasFilters 
      ? await fetchTasks(1, 1000) // 有筛选时获取所有数据
      : await fetchTasks(currentPage, pageSize);
    
    return { data, hasFilters };
  }, [currentPage, pageSize, filterStatus, filterKeyword, filterConversionTarget, searchText]);

  // 使用缓存 Hook
  const {
    data: cachedData,
    loading,
    refreshing,
    refresh: refreshTasks,
    isFromCache
  } = useCachedData(cacheKey, fetchData, {
    deps: [currentPage, pageSize, filterStatus, filterKeyword, filterConversionTarget, searchText],
    onError: () => message.error('加载任务列表失败'),
  });

  // 处理缓存数据
  useEffect(() => {
    if (cachedData) {
      const { data, hasFilters } = cachedData;
      let filteredTasks = data.tasks;
      
      // 应用筛选
      if (filterStatus) {
        filteredTasks = filteredTasks.filter(task => task.status === filterStatus);
      }
      if (filterKeyword) {
        filteredTasks = filteredTasks.filter(task => task.keyword === filterKeyword);
      }
      if (filterConversionTarget) {
        filteredTasks = filteredTasks.filter(task => 
          task.conversionTargetName === filterConversionTarget
        );
      }
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
          task.keyword.toLowerCase().includes(searchLower) ||
          (task.distillationResult && task.distillationResult.toLowerCase().includes(searchLower)) ||
          (task.conversionTargetName && task.conversionTargetName.toLowerCase().includes(searchLower))
        );
      }
      
      // 如果有筛选条件，在前端进行分页
      if (hasFilters) {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        setTotal(filteredTasks.length);
        setTasks(filteredTasks.slice(startIndex, endIndex));
      } else {
        // 没有筛选条件时，使用后端返回的 total
        setTasks(filteredTasks);
        setTotal(data.total);
      }
      
      // 计算统计数据
      const stats: TaskStatistics = {
        total: data.tasks.length,
        pending: data.tasks.filter(t => t.status === 'pending').length,
        running: data.tasks.filter(t => t.status === 'running').length,
        completed: data.tasks.filter(t => t.status === 'completed').length,
        failed: data.tasks.filter(t => t.status === 'failed').length,
        totalArticles: data.tasks.reduce((sum, t) => sum + t.requestedCount, 0),
        completedArticles: data.tasks.reduce((sum, t) => sum + t.generatedCount, 0)
      };
      setStatistics(stats);
      
      // 提取可用的关键词和转化目标
      const keywords = Array.from(new Set(data.tasks.map(t => t.keyword).filter(Boolean)));
      const targets = Array.from(new Set(
        data.tasks.map(t => t.conversionTargetName).filter(Boolean)
      )) as string[];
      setAvailableKeywords(keywords);
      setAvailableConversionTargets(targets);
    }
  }, [cachedData, currentPage, pageSize, filterStatus, filterKeyword, filterConversionTarget, searchText]);

  // 每10秒刷新一次任务状态
  useEffect(() => {
    const interval = setInterval(() => {
      refreshTasks(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshTasks]);

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('articleGeneration:');
    await refreshTasks(true);
  }, [invalidateCacheByPrefix, refreshTasks]);

  const loadTasks = useCallback(async () => {
    await refreshTasks(true);
  }, [refreshTasks]);

  const handleCreateTask = async (config: TaskConfig) => {
    await createTask(config);
    setModalVisible(false);
    handleClearFilters(); // 清除筛选以显示新任务
    invalidateAndRefresh();
  };

  // 清除所有筛选
  const handleClearFilters = () => {
    setFilterStatus('');
    setFilterKeyword('');
    setFilterConversionTarget('');
    setSearchText('');
    setSearchInput('');
    setCurrentPage(1);
  };

  // 计算是否有活动的筛选条件
  const hasActiveFilters = filterStatus || filterKeyword || filterConversionTarget || searchText;

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '执行中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '已终止' }
    };
    const config = statusMap[status];
    if (!config) return <Tag>{status}</Tag>;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 终止任务
  const handleCancelTask = async (taskId: number) => {
    try {
      setDeleting(true);
      await cancelTask(taskId);
      message.success('任务已终止');
      invalidateAndRefresh();
    } catch (error: any) {
      message.error(error.response?.data?.error || '终止任务失败');
    } finally {
      setDeleting(false);
    }
  };

  // 删除单个任务（包括运行中的任务）
  const handleDeleteTask = async (taskId: number, _taskStatus: string) => {
    try {
      setDeleting(true);
      // 如果是运行中的任务，会先终止再删除
      await deleteTask(taskId);
      message.success('任务已删除');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== taskId));
      invalidateAndRefresh();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除任务失败');
    } finally {
      setDeleting(false);
    }
  };

  // 批量删除选中的任务
  const handleBatchDelete = () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的任务');
      return;
    }

    // 检查是否有正在运行的任务
    const selectedTasks = tasks.filter(task => selectedRowKeys.includes(task.id));
    const runningTasks = selectedTasks.filter(task => task.status === 'running');

    const warningMessage = runningTasks.length > 0 
      ? `选中的任务中有 ${runningTasks.length} 个正在运行，将被终止并删除。确定要继续吗？`
      : `确定要删除选中的 ${selectedRowKeys.length} 个任务吗？此操作不可恢复。`;

    Modal.confirm({
      title: '确认批量删除',
      icon: <ExclamationCircleOutlined />,
      content: warningMessage,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setDeleting(true);
          const result = await batchDeleteTasks(selectedRowKeys as number[]);
          message.success(result.message);
          setSelectedRowKeys([]);
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.response?.data?.error || '批量删除失败');
        } finally {
          setDeleting(false);
        }
      }
    });
  };

  // 删除所有任务
  const handleDeleteAll = () => {
    if (!tasks || tasks.length === 0) {
      message.info('没有可删除的任务');
      return;
    }

    const runningTasks = tasks.filter(task => task.status === 'running');
    const canDeleteCount = tasks.length - runningTasks.length;

    if (canDeleteCount === 0) {
      message.warning('所有任务都在运行中，无法删除');
      return;
    }

    Modal.confirm({
      title: '确认删除所有任务',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>确定要删除所有任务吗？此操作不可恢复。</p>
          {runningTasks.length > 0 && (
            <p style={{ color: '#faad14', marginTop: 8 }}>
              注意：{runningTasks.length} 个正在运行的任务将被保留，其余 {canDeleteCount} 个任务将被删除。
            </p>
          )}
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setDeleting(true);
          const result = await deleteAllTasks();
          message.success(result.message);
          setSelectedRowKeys([]);
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除所有任务失败');
        } finally {
          setDeleting(false);
        }
      }
    });
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: GenerationTask) => ({
      disabled: record.status === 'running', // 正在运行的任务不能选择
      name: record.id.toString(),
    }),
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      align: 'center' as const
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '转化目标',
      dataIndex: 'conversionTargetName',
      key: 'conversionTargetName',
      width: 150,
      align: 'center' as const,
      ellipsis: { showTitle: false },
      render: (text: string | null) => (
        <Tooltip title={text || '未设置'}>
          <span>{text || '-'}</span>
        </Tooltip>
      )
    },
    {
      title: '文章设置',
      dataIndex: 'articleSettingName',
      key: 'articleSettingName',
      width: 120,
      align: 'center' as const,
      ellipsis: { showTitle: false },
      render: (text: string | null) => (
        <Tooltip title={text || '未设置'}>
          <span>{text ? <Tag color="purple">{text}</Tag> : '-'}</span>
        </Tooltip>
      )
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 120,
      align: 'center' as const,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '蒸馏结果',
      dataIndex: 'distillationResult',
      key: 'distillationResult',
      width: 200,
      align: 'center' as const,
      render: (text: string | null) => {
        if (!text) {
          return <Tag color="default">待生成</Tag>;
        }
        
        // 使用新的分隔符|||来分割每篇文章的话题
        const topics = text.split('|||').map(t => t.trim()).filter(t => t.length > 0);
        
        if (topics.length === 0) {
          return <Tag color="default">待生成</Tag>;
        }
        
        // 单个话题：直接显示
        if (topics.length === 1) {
          return (
            <div style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
              <Tag color="cyan" style={{ marginBottom: 4 }}>{topics[0]}</Tag>
            </div>
          );
        }
        
        // 多个话题：每行一个，显示文章序号
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {topics.map((topic, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#999', minWidth: 20 }}>
                  {index + 1}.
                </span>
                <Tag 
                  color="cyan"
                  style={{ 
                    marginBottom: 0,
                    wordBreak: 'break-word',
                    whiteSpace: 'normal',
                    display: 'inline-block',
                    flex: 1
                  }}
                >
                  {topic}
                </Tag>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      title: '进度',
      key: 'progress',
      width: 200,
      align: 'center' as const,
      render: (_: any, record: GenerationTask) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Progress
            percent={record.progress}
            size="small"
            style={{ flex: 1, minWidth: 0 }}
            status={record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'}
          />
          <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
            {record.generatedCount}/{record.requestedCount}
          </span>
        </div>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      align: 'center' as const,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: GenerationTask) => (
        <Space size="small">
          {(record.status === 'running' || record.status === 'pending') && (
            <Popconfirm
              title="确认终止"
              description={`确定要终止任务 #${record.id} 吗？`}
              onConfirm={() => handleCancelTask(record.id)}
              okText="终止"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="终止任务">
                <Button
                  type="text"
                  danger
                  icon={<ExclamationCircleOutlined />}
                  size="small"
                  loading={deleting}
                >
                  终止
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm
            title="确认删除"
            description={`确定要删除任务 #${record.id} 吗？${record.status === 'running' ? ' 任务将被终止并删除。' : ''}`}
            onConfirm={() => handleDeleteTask(record.id, record.status)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除任务">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={deleting}
              >
                删除
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0ea5e9' }} />
            <span>文章生成任务</span>
            <Tag color="blue">{statistics.total} 个任务</Tag>
            {selectedRowKeys.length > 0 && (
              <Tag color="cyan">已选择 {selectedRowKeys.length} 个</Tag>
            )}
            {isFromCache && !refreshing && (
              <Tooltip title="数据来自缓存">
                <Tag color="gold">缓存</Tag>
              </Tooltip>
            )}
            {refreshing && (
              <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadTasks()}
              loading={loading || refreshing}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
            >
              新建任务
            </Button>
          </Space>
        }
      >
        {/* 搜索模式提示 */}
        {searchText && (
          <Alert
            message={`搜索 "${searchText}" 的结果`}
            type="info"
            closable
            onClose={() => {
              setSearchInput('');
              setSearchText('');
            }}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 统计卡片区域 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic 
                title="总任务数" 
                value={statistics.total} 
                suffix="个"
                valueStyle={{ color: '#0ea5e9' }}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic 
                title="已完成" 
                value={statistics.completed} 
                suffix="个"
                valueStyle={{ color: '#10b981' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic 
                title="执行中" 
                value={statistics.running} 
                suffix="个"
                valueStyle={{ color: '#f59e0b' }}
                prefix={<SyncOutlined spin={statistics.running > 0} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic 
                title="文章进度" 
                value={statistics.completedArticles} 
                suffix={`/ ${statistics.totalArticles}`}
                valueStyle={{ color: '#8b5cf6', fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 筛选工具栏 */}
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
          <Row gutter={16}>
            <Col span={5}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#64748b', fontSize: 14 }}>
                  <FilterOutlined /> 按状态筛选
                </span>
              </div>
              <Select
                size="large"
                style={{ width: '100%' }}
                value={filterStatus}
                onChange={(value) => {
                  setFilterStatus(value);
                  setSearchInput('');
                  setSearchText('');
                  setCurrentPage(1);
                }}
                placeholder="选择状态"
                allowClear
              >
                <Option value="running">执行中</Option>
                <Option value="completed">已完成</Option>
              </Select>
            </Col>
            <Col span={5}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#64748b', fontSize: 14 }}>
                  <FilterOutlined /> 按关键词筛选
                </span>
              </div>
              <Select
                size="large"
                style={{ width: '100%' }}
                value={filterKeyword}
                onChange={(value) => {
                  setFilterKeyword(value);
                  setSearchInput('');
                  setSearchText('');
                  setCurrentPage(1);
                }}
                placeholder="选择关键词"
                allowClear
              >
                {availableKeywords.map(keyword => (
                  <Option key={keyword} value={keyword}>
                    {keyword}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={5}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#64748b', fontSize: 14 }}>
                  <FilterOutlined /> 按转化目标筛选
                </span>
              </div>
              <Select
                size="large"
                style={{ width: '100%' }}
                value={filterConversionTarget}
                onChange={(value) => {
                  setFilterConversionTarget(value);
                  setSearchInput('');
                  setSearchText('');
                  setCurrentPage(1);
                }}
                placeholder="选择转化目标"
                allowClear
              >
                {availableConversionTargets.map(target => (
                  <Option key={target} value={target}>
                    {target}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#64748b', fontSize: 14 }}>
                  <SearchOutlined /> 搜索内容
                </span>
              </div>
              <Search
                placeholder="搜索关键词、蒸馏结果..."
                allowClear
                enterButton
                size="large"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onSearch={(value) => setSearchInput(value)}
              />
            </Col>
            <Col span={3}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'transparent', fontSize: 14 }}>.</span>
              </div>
              <Button
                size="large"
                block
                icon={<FilterOutlined />}
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
              >
                清除筛选
              </Button>
            </Col>
          </Row>
        </div>
        {/* 批量操作工具栏 */}
        {((selectedRowKeys?.length || 0) > 0 || (tasks?.length || 0) > 0) && (
          <div style={{ 
            marginBottom: 16, 
            padding: '12px 16px', 
            background: '#f5f5f5', 
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Space>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
                disabled={selectedRowKeys.length === 0}
                loading={deleting}
              >
                批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
              </Button>
              {selectedRowKeys.length > 0 && (
                <Button
                  type="link"
                  onClick={() => setSelectedRowKeys([])}
                  size="small"
                >
                  取消选择
                </Button>
              )}
            </Space>
            <Button
              danger
              type="dashed"
              icon={<DeleteOutlined />}
              onClick={handleDeleteAll}
              disabled={tasks.length === 0}
              loading={deleting}
            >
              删除所有任务
            </Button>
          </div>
        )}

        <ResizableTable<GenerationTask>
          tableId="article-generation-list"
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          scroll={{ x: 1030 }}
        />
      </Card>

      <TaskConfigModal
        visible={modalVisible}
        onSubmit={handleCreateTask}
        onCancel={() => setModalVisible(false)}
      />
    </div>
  );
}
