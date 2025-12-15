import { useState, useEffect } from 'react';
import { Card, Button, Table, Tag, Progress, message, Space, Modal, Popconfirm, Tooltip } from 'antd';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FileTextOutlined, 
  DeleteOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import TaskConfigModal from '../components/TaskConfigModal';
import { 
  createTask, 
  fetchTasks, 
  deleteTask, 
  batchDeleteTasks, 
  deleteAllTasks 
} from '../api/articleGenerationApi';
import type { GenerationTask, TaskConfig } from '../types/articleGeneration';

export default function ArticleGenerationPage() {
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleting, setDeleting] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    loadTasks();
    // 每10秒刷新一次任务状态
    const interval = setInterval(() => {
      loadTasks(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [currentPage]);

  const loadTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchTasks(currentPage, pageSize);
      setTasks(data.tasks);
      setTotal(data.total);
    } catch (error: any) {
      if (!silent) {
        message.error('加载任务列表失败');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCreateTask = async (config: TaskConfig) => {
    await createTask(config);
    setModalVisible(false);
    loadTasks();
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '执行中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' }
    };
    const config = statusMap[status] || statusMap.pending;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 删除单个任务
  const handleDeleteTask = async (taskId: number, taskStatus: string) => {
    if (taskStatus === 'running') {
      message.warning('无法删除正在运行的任务');
      return;
    }

    try {
      setDeleting(true);
      await deleteTask(taskId);
      message.success('任务已删除');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== taskId));
      loadTasks();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除任务失败');
    } finally {
      setDeleting(false);
    }
  };

  // 批量删除选中的任务
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的任务');
      return;
    }

    // 检查是否有正在运行的任务
    const selectedTasks = tasks.filter(task => selectedRowKeys.includes(task.id));
    const runningTasks = selectedTasks.filter(task => task.status === 'running');

    if (runningTasks.length > 0) {
      message.warning(`无法删除正在运行的任务（任务ID: ${runningTasks.map(t => t.id).join(', ')}）`);
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除选中的 ${selectedRowKeys.length} 个任务吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setDeleting(true);
          const result = await batchDeleteTasks(selectedRowKeys as number[]);
          message.success(result.message);
          setSelectedRowKeys([]);
          loadTasks();
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
    if (tasks.length === 0) {
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
          loadTasks();
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
      width: 80
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '转化目标',
      dataIndex: 'conversionTargetName',
      key: 'conversionTargetName',
      width: 150,
      ellipsis: { showTitle: false },
      render: (text: string | null) => (
        <Tooltip title={text || '未设置'}>
          <span>{text || '-'}</span>
        </Tooltip>
      )
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 120,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '蒸馏结果',
      dataIndex: 'distillationResult',
      key: 'distillationResult',
      width: 150,
      ellipsis: { showTitle: false },
      render: (text: string | null) => (
        <Tooltip title={text || '已删除'}>
          {text ? (
            <Tag color="cyan">{text}</Tag>
          ) : (
            <Tag color="default">已删除</Tag>
          )}
        </Tooltip>
      )
    },
    {
      title: '进度',
      key: 'progress',
      width: 200,
      render: (_: any, record: GenerationTask) => (
        <div>
          <Progress
            percent={record.progress}
            size="small"
            status={record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'}
          />
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            {record.generatedCount} / {record.requestedCount} 篇
          </div>
        </div>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: GenerationTask) => (
        <Popconfirm
          title="确认删除"
          description={`确定要删除任务 #${record.id} 吗？`}
          onConfirm={() => handleDeleteTask(record.id, record.status)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          disabled={record.status === 'running'}
        >
          <Tooltip title={record.status === 'running' ? '正在运行的任务无法删除' : '删除任务'}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              disabled={record.status === 'running'}
              loading={deleting}
            >
              删除
            </Button>
          </Tooltip>
        </Popconfirm>
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
            <Tag color="blue">{total} 个任务</Tag>
            {selectedRowKeys.length > 0 && (
              <Tag color="cyan">已选择 {selectedRowKeys.length} 个</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadTasks()}
              loading={loading}
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
        {/* 批量操作工具栏 */}
        {(selectedRowKeys.length > 0 || tasks.length > 0) && (
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

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个任务`
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
