import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Card, Tag, Button, Space, Modal, Typography, message, 
  Row, Col, Statistic, Select, Tooltip, Empty, Popconfirm 
} from 'antd';
import { 
  ReloadOutlined, EyeOutlined, CopyOutlined, DeleteOutlined,
  CheckCircleOutlined, CalendarOutlined, ExclamationCircleOutlined,
  CloudSyncOutlined
} from '@ant-design/icons';
import { 
  getPublishingRecords,
  getPublishingStats,
  getPlatforms,
  getPublishingRecordById,
  deletePublishingRecord,
  batchDeletePublishingRecords,
  PublishingRecord,
  PublishingStats,
  Platform
} from '../api/publishing';
import ArticlePreview from '../components/ArticlePreview';
import ResizableTable from '../components/ResizableTable';
import { processArticleContent } from '../utils/articleUtils';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

const { Text } = Typography;
const { Option } = Select;

export default function PublishingRecordsPage() {
  const { invalidateCacheByPrefix } = useCacheStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [viewModal, setViewModal] = useState<PublishingRecord | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  // 缓存 key
  const recordsCacheKey = useMemo(() => 
    `publishingRecords:list:${platformFilter}:${page}:${pageSize}`,
    [platformFilter, page, pageSize]
  );

  // 获取发布记录
  const fetchRecords = useCallback(async () => {
    const filters: any = {};
    if (platformFilter !== 'all') {
      filters.platform_id = platformFilter;
    }
    const response = await getPublishingRecords(page, pageSize, filters);
    setTotal(response.total || 0);
    return response.records || [];
  }, [page, pageSize, platformFilter]);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    return await getPublishingStats();
  }, []);

  // 获取平台列表
  const fetchPlatforms = useCallback(async () => {
    return await getPlatforms();
  }, []);

  // 使用缓存
  const {
    data: records,
    loading,
    refreshing,
    refresh: refreshRecords,
    isFromCache
  } = useCachedData<PublishingRecord[]>(recordsCacheKey, fetchRecords, {
    deps: [page, pageSize, platformFilter],
    onError: (error) => message.error(error.message || '加载发布记录失败'),
  });

  const { data: stats, refresh: refreshStats } = useCachedData<PublishingStats>(
    'publishingRecords:stats',
    fetchStats,
    { onError: (error) => console.error('加载统计数据失败:', error) }
  );

  const { data: platforms } = useCachedData<Platform[]>(
    'publishingRecords:platforms',
    fetchPlatforms,
    { onError: (error) => console.error('加载平台列表失败:', error) }
  );

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('publishingRecords:');
    await Promise.all([refreshRecords(true), refreshStats(true)]);
  }, [invalidateCacheByPrefix, refreshRecords, refreshStats]);

  const handleView = async (record: PublishingRecord) => {
    try {
      const detail = await getPublishingRecordById(record.id);
      setViewModal(detail);
    } catch (error: any) {
      message.error('加载详情失败');
    }
  };

  const handleCopy = (content: string, imageUrl?: string) => {
    const cleanContent = processArticleContent(content, imageUrl);
    navigator.clipboard.writeText(cleanContent);
    message.success('文章内容已复制到剪贴板');
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePublishingRecord(id);
      message.success('删除成功');
      invalidateAndRefresh();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }
    try {
      await batchDeletePublishingRecords(selectedRowKeys);
      message.success(`已删除 ${selectedRowKeys.length} 条记录`);
      setSelectedRowKeys([]);
      invalidateAndRefresh();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
    }
  };


  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      align: 'center' as const
    },
    {
      title: '平台',
      dataIndex: 'platform_name',
      key: 'platform_name',
      width: 100,
      align: 'center' as const,
      render: (text: string, record: PublishingRecord) => (
        <Tag color="blue">{text || record.platform_id}</Tag>
      )
    },
    {
      title: '账号',
      dataIndex: 'real_username',
      key: 'real_username',
      width: 120,
      align: 'center' as const,
      render: (text: string, record: PublishingRecord) => (
        <span style={{ fontSize: 14 }}>{text || record.account_name || '-'}</span>
      )
    },
    {
      title: '关键词',
      dataIndex: 'article_keyword',
      key: 'article_keyword',
      width: 100,
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '文章设置',
      dataIndex: 'article_setting_name',
      key: 'article_setting_name',
      width: 100,
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="purple">{text}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '蒸馏结果',
      dataIndex: 'topic_question',
      key: 'topic_question',
      width: 180,
      align: 'center' as const,
      ellipsis: true,
      render: (text: string) => text ? <Tag color="green">{text}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '标题',
      dataIndex: 'article_title',
      key: 'article_title',
      width: 220,
      align: 'center' as const,
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">无标题</Text>
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      key: 'published_at',
      width: 160,
      align: 'center' as const,
      render: (time: string) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: PublishingRecord) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
              查看
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定删除此发布记录？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as number[]),
  };


  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="总发布次数" value={stats?.total || 0} valueStyle={{ color: '#1890ff' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="今日发布" value={stats?.today || 0} valueStyle={{ color: '#52c41a' }} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="本周发布" value={stats?.week || 0} valueStyle={{ color: '#722ed1' }} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="本月发布" value={stats?.month || 0} valueStyle={{ color: '#faad14' }} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card 
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>发布记录</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>（文章发布成功后自动归档到此处）</Text>
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
        variant="borderless"
        extra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确定删除选中的 ${selectedRowKeys.length} 条记录？`}
                icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>批量删除 ({selectedRowKeys.length})</Button>
              </Popconfirm>
            )}
            <Select value={platformFilter} onChange={setPlatformFilter} style={{ width: 180 }} placeholder="筛选平台">
              <Option value="all">全部平台</Option>
              {(platforms || []).map(p => (<Option key={p.platform_id} value={p.platform_id}>{p.platform_name}</Option>))}
            </Select>
            <Button onClick={() => invalidateAndRefresh()} icon={<ReloadOutlined />}>刷新</Button>
          </Space>
        }
      >
        {(records || []).length === 0 && !loading ? (
          <Empty description="暂无发布记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <ResizableTable<PublishingRecord>
            tableId="publishing-records-list"
            columns={columns} 
            dataSource={records || []} 
            rowKey="id" 
            loading={loading}
            rowSelection={rowSelection}
            scroll={{ x: 1400 }}
            pagination={{ 
              current: page, pageSize, total, 
              onChange: (newPage, newPageSize) => {
                setPage(newPage);
                if (newPageSize && newPageSize !== pageSize) { setPageSize(newPageSize); setPage(1); }
              }, 
              showSizeChanger: true, showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条发布记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }} 
          />
        )}
      </Card>


      {/* 文章详情模态框 */}
      <Modal
        title={<Space><span>发布详情</span>{viewModal && <Tag color="blue">{viewModal.platform_name || viewModal.platform_id}</Tag>}</Space>}
        open={!!viewModal}
        onCancel={() => setViewModal(null)}
        width={900}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => viewModal?.article_content && handleCopy(viewModal.article_content, viewModal.article_image_url)} disabled={!viewModal?.article_content}>复制文章</Button>,
          <Button key="close" type="primary" onClick={() => setViewModal(null)}>关闭</Button>
        ]}
      >
        {viewModal && (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div><Text type="secondary">发布平台：</Text><Tag color="blue">{viewModal.platform_name || viewModal.platform_id}</Tag></div>
                <div><Text type="secondary">发布账号：</Text><Text>{viewModal.real_username || viewModal.account_name || '-'}</Text></div>
                <div><Text type="secondary">发布时间：</Text><Text>{new Date(viewModal.published_at).toLocaleString('zh-CN')}</Text></div>
                {viewModal.article_keyword && <div><Text type="secondary">关键词：</Text><Tag color="purple">{viewModal.article_keyword}</Tag></div>}
                {viewModal.article_setting_name && <div><Text type="secondary">文章设置：</Text><Tag color="cyan">{viewModal.article_setting_name}</Tag></div>}
                {viewModal.topic_question && <div><Text type="secondary">蒸馏结果：</Text><Tag color="green">{viewModal.topic_question}</Tag></div>}
              </Space>
            </Card>
            {viewModal.article_content ? (
              <ArticlePreview content={viewModal.article_content} title={viewModal.article_title} imageUrl={viewModal.article_image_url} />
            ) : (
              <Empty description="文章内容不可用（旧版记录）" />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
