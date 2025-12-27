import { useState, useEffect } from 'react';
import { 
  Card, Tag, Button, Space, Modal, Typography, message, 
  Row, Col, Statistic, Select, Tooltip, Empty 
} from 'antd';
import { 
  ReloadOutlined, EyeOutlined, CopyOutlined, 
  CheckCircleOutlined,
  CalendarOutlined 
} from '@ant-design/icons';
import { 
  getPublishingRecords,
  getPublishingStats,
  getPlatforms,
  PublishingRecord,
  PublishingStats,
  Platform
} from '../api/publishing';
import { apiClient } from '../api/client';
import ArticlePreview from '../components/ArticlePreview';
import ResizableTable from '../components/ResizableTable';
import { processArticleContent } from '../utils/articleUtils';

const { Text } = Typography;
const { Option } = Select;

export default function PublishingRecordsPage() {
  const [records, setRecords] = useState<PublishingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [viewModal, setViewModal] = useState<any>(null);
  const [stats, setStats] = useState<PublishingStats>({
    total: 0,
    today: 0,
    week: 0,
    month: 0,
    byPlatform: []
  });

  useEffect(() => {
    loadRecords();
    loadStats();
  }, [page, pageSize, platformFilter]);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      
      if (platformFilter !== 'all') {
        filters.platform_id = platformFilter;
      }

      const response = await getPublishingRecords(page, pageSize, filters);
      setRecords(response.records || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      message.error(error.message || '加载发布记录失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getPublishingStats();
      setStats(statsData);
    } catch (error: any) {
      console.error('加载统计数据失败:', error);
    }
  };

  const loadPlatforms = async () => {
    try {
      const platformsData = await getPlatforms();
      setPlatforms(platformsData);
    } catch (error: any) {
      console.error('加载平台列表失败:', error);
    }
  };

  const handleView = async (record: PublishingRecord) => {
    try {
      // 获取文章详情
      const response = await apiClient.get(`/articles/${record.article_id}`);
      setViewModal({
        ...response.data,
        record
      });
    } catch (error: any) {
      message.error('加载文章详情失败');
    }
  };

  const handleCopy = (content: string, imageUrl?: string) => {
    const cleanContent = processArticleContent(content, imageUrl);
    navigator.clipboard.writeText(cleanContent);
    message.success('文章内容已复制到剪贴板');
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      align: 'center' as const
    },
    {
      title: '文章ID',
      dataIndex: 'article_id',
      key: 'article_id',
      width: 100,
      align: 'center' as const
    },
    {
      title: '平台',
      dataIndex: 'platform_name',
      key: 'platform_name',
      width: 120,
      align: 'center' as const,
      render: (text: string, record: PublishingRecord) => (
        <Tag color="blue">{text || record.platform_id}</Tag>
      )
    },
    {
      title: '账号名称',
      dataIndex: 'real_username',
      key: 'real_username',
      width: 150,
      align: 'center' as const,
      render: (text: string, record: PublishingRecord) => (
        <span style={{ fontSize: 14 }}>
          {text || record.account_name || '-'}
        </span>
      )
    },
    {
      title: '关键词',
      dataIndex: 'article_keyword',
      key: 'article_keyword',
      width: 120,
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="purple">{text}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '蒸馏结果',
      dataIndex: 'topic_question',
      key: 'topic_question',
      width: 200,
      align: 'center' as const,
      ellipsis: true,
      render: (text: string) => text ? <Tag color="green">{text}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '标题',
      dataIndex: 'article_title',
      key: 'article_title',
      width: 250,
      align: 'center' as const,
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">无标题</Text>
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      key: 'published_at',
      width: 180,
      align: 'center' as const,
      render: (time: string) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: PublishingRecord) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              type="link" 
              size="small"
              icon={<EyeOutlined />} 
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="总发布次数" 
              value={stats.total} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="今日发布" 
              value={stats.today} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="本周发布" 
              value={stats.week} 
              valueStyle={{ color: '#722ed1' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="本月发布" 
              value={stats.month} 
              valueStyle={{ color: '#faad14' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>发布记录</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
              （文章在各平台的发布情况）
            </Text>
          </Space>
        }
        bordered={false}
        extra={
          <Space>
            <Select 
              value={platformFilter} 
              onChange={setPlatformFilter}
              style={{ width: 200 }}
              placeholder="筛选平台"
              showSearch
              optionFilterProp="children"
            >
              <Option value="all">全部平台</Option>
              {platforms.map(p => (
                <Option key={p.platform_id} value={p.platform_id}>
                  {p.platform_name}
                </Option>
              ))}
            </Select>
            <Button 
              onClick={loadRecords} 
              icon={<ReloadOutlined />}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {records.length === 0 && !loading ? (
          <Empty 
            description="暂无发布记录" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <ResizableTable<PublishingRecord>
            tableId="publishing-records-list"
            columns={columns} 
            dataSource={records} 
            rowKey="id" 
            loading={loading}
            scroll={{ x: 1600 }}
            pagination={{ 
              current: page, 
              pageSize, 
              total, 
              onChange: (newPage, newPageSize) => {
                setPage(newPage);
                if (newPageSize && newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                  setPage(1);
                }
              }, 
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条发布记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }} 
          />
        )}
      </Card>

      {/* 文章详情模态框 */}
      <Modal
        title={
          <Space>
            <span>发布详情</span>
            {viewModal?.record && (
              <Tag color="blue">{viewModal.record.platform_name || viewModal.record.platform_id}</Tag>
            )}
          </Space>
        }
        open={!!viewModal}
        onCancel={() => setViewModal(null)}
        width={900}
        footer={[
          <Button 
            key="copy" 
            icon={<CopyOutlined />} 
            onClick={() => viewModal && handleCopy(viewModal.content, viewModal.imageUrl)}
          >
            复制文章
          </Button>,
          <Button 
            key="close" 
            type="primary" 
            onClick={() => setViewModal(null)}
          >
            关闭
          </Button>
        ]}
      >
        {viewModal && (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div>
                  <Text type="secondary">发布平台：</Text>
                  <Tag color="blue">
                    {viewModal.record?.platform_name || viewModal.record?.platform_id}
                  </Tag>
                </div>
                <div>
                  <Text type="secondary">发布账号：</Text>
                  <Text>{viewModal.record?.account_name || '-'}</Text>
                </div>
                <div>
                  <Text type="secondary">发布时间：</Text>
                  <Text>
                    {viewModal.record?.published_at 
                      ? new Date(viewModal.record.published_at).toLocaleString('zh-CN')
                      : '-'
                    }
                  </Text>
                </div>
                <div>
                  <Text type="secondary">文章创建时间：</Text>
                  <Text>{new Date(viewModal.createdAt).toLocaleString('zh-CN')}</Text>
                </div>
                {viewModal.keyword && (
                  <div>
                    <Text type="secondary">关键词：</Text>
                    <Tag color="purple">{viewModal.keyword}</Tag>
                  </div>
                )}
                {viewModal.topicQuestion && (
                  <div>
                    <Text type="secondary">蒸馏结果：</Text>
                    <Tag color="green">{viewModal.topicQuestion}</Tag>
                  </div>
                )}
              </Space>
            </Card>
            
            <ArticlePreview 
              content={viewModal.content} 
              title={viewModal.title}
              imageUrl={viewModal.imageUrl} 
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
