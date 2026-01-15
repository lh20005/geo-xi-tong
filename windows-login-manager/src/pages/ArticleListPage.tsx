import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Card, Button, Space, Tag, Modal, Typography, message, 
  Row, Col, Statistic, Select, Input, Checkbox, Tooltip
} from 'antd';
import { 
  EyeOutlined, DeleteOutlined, CopyOutlined, EditOutlined,
  SearchOutlined, ReloadOutlined, CloudSyncOutlined
} from '@ant-design/icons';
import { useArticleStore } from '../stores/articleStore';
import ArticlePreview from '../components/ArticlePreview';
import ArticleEditorModal from '../components/ArticleEditorModal';
import ResizableTable from '../components/ResizableTable';
import { processArticleContent } from '../utils/articleUtils';

const { Paragraph, Text } = Typography;
const { Option } = Select;

interface FilterState {
  publishStatus: 'all' | 'published' | 'unpublished';
  keyword: string;
  searchKeyword: string;
}

export default function ArticleListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 使用本地 Store
  const {
    articles,
    stats,
    keywordStats,
    total,
    page,
    pageSize,
    loading,
    error,
    fetchArticles,
    fetchArticle,
    fetchStats,
    fetchKeywordStats,
    deleteArticle,
    deleteBatch,
    deleteAll,
    searchArticles,
    clearError,
  } = useArticleStore();
  
  const [filters, setFilters] = useState<FilterState>({
    publishStatus: 'all',
    keyword: '',
    searchKeyword: ''
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewModal, setViewModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 初始加载
  useEffect(() => {
    loadData();
  }, []);

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  // URL 参数同步
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status') as 'all' | 'published' | 'unpublished' | null;
    const keyword = params.get('keyword');
    const search = params.get('search');
    const pageParam = params.get('page');

    const newFilters = {
      publishStatus: status || 'all',
      keyword: keyword || '',
      searchKeyword: search || ''
    };
    
    setFilters(newFilters);

    // 根据筛选条件加载数据
    const pageNum = pageParam ? parseInt(pageParam) : 1;
    loadArticlesWithFilters(newFilters, pageNum);
  }, [location.search]);

  // 更新 URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.publishStatus !== 'all') params.set('status', filters.publishStatus);
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.searchKeyword) params.set('search', filters.searchKeyword);
    if (page > 1) params.set('page', page.toString());

    const newSearch = params.toString();
    if (newSearch !== location.search.substring(1)) {
      navigate(`?${newSearch}`, { replace: true });
    }
  }, [filters, page]);

  // 清空选择
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  // 加载数据
  const loadData = async () => {
    await Promise.all([
      fetchStats(),
      fetchKeywordStats(),
    ]);
  };

  // 根据筛选条件加载文章
  const loadArticlesWithFilters = async (filterState: FilterState, pageNum: number = 1) => {
    const isPublished = filterState.publishStatus === 'all' 
      ? undefined 
      : filterState.publishStatus === 'published';
    
    if (filterState.keyword || filterState.searchKeyword) {
      await searchArticles({
        keyword: filterState.keyword || filterState.searchKeyword,
        isPublished,
        page: pageNum,
        pageSize,
      });
    } else {
      await fetchArticles({
        page: pageNum,
        pageSize,
        isPublished,
      });
    }
  };

  // 刷新所有数据
  const loadArticles = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadArticlesWithFilters(filters, page),
      fetchStats(),
      fetchKeywordStats(),
    ]);
    setRefreshing(false);
  }, [filters, page, pageSize]);

  const handleView = async (id: string) => {
    await fetchArticle(id);
    const { currentArticle } = useArticleStore.getState();
    if (currentArticle) {
      setViewModal(currentArticle);
    }
  };

  const handleEdit = async (id: string) => {
    await fetchArticle(id);
    const { currentArticle } = useArticleStore.getState();
    if (currentArticle) {
      setEditModal(currentArticle);
      setEditorVisible(true);
    }
  };

  const handleEditorClose = () => {
    setEditorVisible(false);
    setEditModal(null);
  };

  const handleEditorSave = () => {
    loadArticles();
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这篇文章吗？',
      onOk: async () => {
        const success = await deleteArticle(id);
        if (success) {
          message.success('删除成功');
          await fetchStats();
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedIds.size} 篇文章吗？`,
      onOk: async () => {
        const result = await deleteBatch(Array.from(selectedIds));
        if (result.success) {
          message.success(`成功删除 ${result.deletedCount} 篇文章`);
          setSelectedIds(new Set());
          await fetchStats();
        }
      },
    });
  };

  const handleDeleteAll = () => {
    Modal.confirm({
      title: '确认删除所有',
      content: `确定要删除所有 ${total} 篇文章吗？此操作不可恢复！`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        const result = await deleteAll();
        if (result.success) {
          message.success(`成功删除 ${result.deletedCount} 篇文章`);
          setSelectedIds(new Set());
        }
      },
    });
  };

  const handleCopy = (content: string, imageUrl?: string) => {
    const cleanContent = processArticleContent(content, imageUrl);
    navigator.clipboard.writeText(cleanContent);
    message.success('文章已复制到剪贴板');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentPageIds = articles.map(a => a.id);
      setSelectedIds(new Set([...selectedIds, ...currentPageIds]));
    } else {
      const currentPageIds = new Set(articles.map(a => a.id));
      setSelectedIds(new Set([...selectedIds].filter(id => !currentPageIds.has(id))));
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    loadArticlesWithFilters(newFilters, 1);
  };

  const handleClearFilters = () => {
    const newFilters = {
      publishStatus: 'all' as const,
      keyword: '',
      searchKeyword: ''
    };
    setFilters(newFilters);
    loadArticlesWithFilters(newFilters, 1);
  };

  const handleStatsClick = (status: 'all' | 'published' | 'unpublished') => {
    handleFilterChange('publishStatus', status);
  };

  const handlePageChange = (newPage: number, newPageSize?: number) => {
    const size = newPageSize || pageSize;
    loadArticlesWithFilters(filters, newPage);
  };

  const isAllSelected = articles.length > 0 && articles.every(a => selectedIds.has(a.id));
  const isSomeSelected = articles.some(a => selectedIds.has(a.id)) && !isAllSelected;

  const columns = [
    {
      title: (
        <Checkbox
          checked={isAllSelected}
          indeterminate={isSomeSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: 'checkbox',
      width: 50,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={selectedIds.has(record.id)}
          onChange={(e) => handleSelectOne(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '转化目标',
      dataIndex: 'conversionTargetName',
      key: 'conversionTargetName',
      width: 120,
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="orange">{text}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '文章设置',
      dataIndex: 'articleSettingName',
      key: 'articleSettingName',
      width: 120,
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="purple">{text}</Tag> : <span style={{ color: '#999' }}>-</span>,
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
      render: (text: string) => text ? <Tag color="green">{text}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '文章标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      align: 'center' as const,
      ellipsis: true,
      render: (text: string) => text ? <span>{text}</span> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '发布状态',
      dataIndex: 'isPublished',
      key: 'isPublished',
      width: 100,
      align: 'center' as const,
      render: (isPublished: boolean) => {
        if (isPublished) {
          return <Tag color="success">已发布</Tag>;
        }
        return <Tag color="default">草稿</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      align: 'center' as const,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>查看</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record.id)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small" hoverable onClick={() => handleStatsClick('all')} style={{ textAlign: 'center' }}>
            <Statistic title="总文章数" value={stats?.total ?? 0} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" hoverable onClick={() => handleStatsClick('published')} style={{ textAlign: 'center' }}>
            <Statistic title="已发布" value={stats?.published ?? 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" hoverable onClick={() => handleStatsClick('unpublished')} style={{ textAlign: 'center' }}>
            <Statistic title="未发布" value={stats?.unpublished ?? 0} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* 筛选工具栏 */}
      <div style={{ marginBottom: 16, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
        <Row gutter={16}>
          <Col span={5}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>
                <SearchOutlined /> 发布状态
              </span>
            </div>
            <Select 
              size="large"
              style={{ width: '100%' }} 
              value={filters.publishStatus} 
              onChange={(value) => handleFilterChange('publishStatus', value)}
            >
              <Option value="all">全部</Option>
              <Option value="published">已发布</Option>
              <Option value="unpublished">未发布</Option>
            </Select>
          </Col>
          
          <Col span={5}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>
                <SearchOutlined /> 关键词筛选
              </span>
            </div>
            <Select 
              size="large"
              style={{ width: '100%' }} 
              placeholder="选择关键词" 
              allowClear 
              showSearch
              optionFilterProp="children"
              value={filters.keyword || undefined} 
              onChange={(value) => handleFilterChange('keyword', value || '')}
            >
              {keywordStats.map(k => (
                <Option key={k.keyword} value={k.keyword}>
                  {k.keyword} ({k.count})
                </Option>
              ))}
            </Select>
          </Col>
          
          <Col span={7}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>
                <SearchOutlined /> 搜索内容
              </span>
            </div>
            <Input 
              size="large"
              style={{ width: '100%' }} 
              placeholder="输入关键词搜索" 
              value={filters.searchKeyword} 
              onChange={(e) => setFilters(prev => ({ ...prev, searchKeyword: e.target.value }))}
              onPressEnter={() => loadArticlesWithFilters(filters, 1)}
              allowClear
              suffix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            />
          </Col>
          
          <Col span={3}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'transparent', fontSize: 14 }}>.</span>
            </div>
            <Button 
              size="large"
              block
              icon={<ReloadOutlined />} 
              onClick={handleClearFilters}
              disabled={filters.publishStatus === 'all' && !filters.keyword && !filters.searchKeyword}
            >
              清除筛选
            </Button>
          </Col>
          
          <Col span={4}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'transparent', fontSize: 14 }}>.</span>
            </div>
            <Button 
              size="large"
              type="primary" 
              block
              icon={<ReloadOutlined />} 
              onClick={loadArticles}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </div>

      <Card style={{ marginBottom: 16, backgroundColor: '#e6f7ff' }}>
        <Space>
          {selectedIds.size > 0 ? (
            <>
              <Text strong>已选中 {selectedIds.size} 篇文章</Text>
              <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>删除选中</Button>
            </>
          ) : (
            <Text type="secondary">可以在下方表格中选择文章进行批量操作</Text>
          )}
        </Space>
      </Card>

      <Card title="文章管理" variant="borderless" extra={
        <Space>
          {refreshing && (
            <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>
          )}
          <Button onClick={loadArticles} icon={<ReloadOutlined />}>刷新</Button>
          <Button danger disabled={total === 0} onClick={handleDeleteAll}>删除所有</Button>
        </Space>
      }>
        <ResizableTable
          tableId="article-list"
          columns={columns} 
          dataSource={articles} 
          rowKey="id" 
          loading={loading} 
          scroll={{ x: 1200 }}
          pagination={{ 
            current: page, 
            pageSize, 
            total, 
            onChange: handlePageChange, 
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100']
          }} 
        />
      </Card>

      <Modal 
        title={
          <Space>
            <EyeOutlined />
            <span>文章预览</span>
            {viewModal && <Tag color="blue">{viewModal.keyword}</Tag>}
          </Space>
        } 
        open={!!viewModal} 
        onCancel={() => setViewModal(null)} 
        width={900} 
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => handleCopy(viewModal.content, viewModal.imageUrl)}>
            复制文章
          </Button>, 
          <Button key="close" type="primary" onClick={() => setViewModal(null)}>
            关闭
          </Button>
        ]}
      >
        {viewModal && (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Paragraph style={{ color: '#64748b', marginBottom: 0 }}>
                创建时间: {new Date(viewModal.createdAt).toLocaleString('zh-CN')}
                {viewModal.updatedAt && viewModal.updatedAt !== viewModal.createdAt && (
                  <Text style={{ marginLeft: 16 }}>
                    更新时间: {new Date(viewModal.updatedAt).toLocaleString('zh-CN')}
                  </Text>
                )}
              </Paragraph>
            </Card>
            <ArticlePreview 
              content={viewModal.content} 
              title={viewModal.title}
              imageUrl={viewModal.imageUrl}
            />
          </div>
        )}
      </Modal>

      <ArticleEditorModal visible={editorVisible} article={editModal} onClose={handleEditorClose} onSave={handleEditorSave} />
    </div>
  );
}
