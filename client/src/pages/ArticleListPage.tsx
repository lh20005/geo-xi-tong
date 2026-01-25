import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Card, Button, Space, Tag, Modal, Typography, message, 
  Row, Col, Statistic, Select, Input, Checkbox, List, Drawer
} from 'antd';
import { 
  EyeOutlined, DeleteOutlined, CopyOutlined, EditOutlined,
  SearchOutlined, ReloadOutlined, FilterOutlined
} from '@ant-design/icons';
import { 
  getArticles, getArticleStats, batchDeleteArticles, deleteAllArticles,
  Article, ArticleStats, getKeywordStats, KeywordStats 
} from '../api/articles';
import { apiClient } from '../api/client';
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<ArticleStats>({ total: 0, published: 0, unpublished: 0 });
  const [keywords, setKeywords] = useState<KeywordStats[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    publishStatus: 'all',
    keyword: '',
    searchKeyword: ''
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [viewModal, setViewModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [editorVisible, setEditorVisible] = useState(false);

  // 监听窗口大小变化
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status') as 'all' | 'published' | 'unpublished' | null;
    const keyword = params.get('keyword');
    const search = params.get('search');
    const pageParam = params.get('page');

    setFilters({
      publishStatus: status || 'all',
      keyword: keyword || '',
      searchKeyword: search || ''
    });

    if (pageParam) {
      setPage(parseInt(pageParam));
    }
  }, [location.search]);

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

  useEffect(() => {
    loadArticles();
    loadStats();
  }, [filters, page]);

  useEffect(() => {
    loadKeywords();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const apiFilters: any = {
        publishStatus: filters.publishStatus
      };
      
      // 关键词筛选
      if (filters.keyword) {
        apiFilters.keyword = filters.keyword;
      }
      
      // 搜索关键词（模糊搜索）
      if (filters.searchKeyword && filters.searchKeyword.trim()) {
        apiFilters.keyword = filters.searchKeyword.trim();
      }
      
      const response = await getArticles(page, pageSize, apiFilters);
      setArticles(response.articles || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      message.error(error.message || '加载文章列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getArticleStats();
      setStats(statsData);
    } catch (error: any) {
      console.error('加载统计数据失败:', error);
    }
  };

  const loadKeywords = async () => {
    try {
      const response = await getKeywordStats();
      setKeywords(response.keywords || []);
    } catch (error: any) {
      console.error('加载关键词列表失败:', error);
    }
  };

  const handleView = async (id: number) => {
    try {
      const response = await apiClient.get(`/articles/${id}`);
      setViewModal(response.data);
    } catch (error: any) {
      message.error(error.message || '加载文章详情失败');
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await apiClient.get(`/articles/${id}`);
      setEditModal(response.data);
      setEditorVisible(true);
    } catch (error: any) {
      message.error(error.message || '加载文章详情失败');
    }
  };

  const handleEditorClose = () => {
    setEditorVisible(false);
    setEditModal(null);
  };

  const handleEditorSave = () => {
    loadArticles();
    loadStats();
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这篇文章吗？',
      onOk: async () => {
        try {
          await apiClient.delete(`/articles/${id}`);
          message.success('删除成功');
          loadArticles();
          loadStats();
        } catch (error: any) {
          message.error(error.message || '删除失败');
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
        try {
          await batchDeleteArticles(Array.from(selectedIds));
          message.success(`成功删除 ${selectedIds.size} 篇文章`);
          setSelectedIds(new Set());
          loadArticles();
          loadStats();
        } catch (error: any) {
          message.error(error.message || '批量删除失败');
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
        try {
          const result = await deleteAllArticles();
          message.success(`成功删除 ${result.deletedCount} 篇文章`);
          setSelectedIds(new Set());
          loadArticles();
          loadStats();
        } catch (error: any) {
          message.error(error.message || '删除所有失败');
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

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      publishStatus: 'all',
      keyword: '',
      searchKeyword: ''
    });
    setPage(1);
  };

  const handleStatsClick = (status: 'all' | 'published' | 'unpublished') => {
    handleFilterChange('publishStatus', status);
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
      render: (_: any, record: Article) => (
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

  // 移动端文章卡片渲染
  const renderMobileArticleCard = (article: Article) => (
    <Card 
      size="small" 
      style={{ marginBottom: 12 }}
      actions={[
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(article.id)}>查看</Button>,
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(article.id)}>编辑</Button>,
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(article.id)}>删除</Button>,
      ]}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Checkbox
          checked={selectedIds.has(article.id)}
          onChange={(e) => handleSelectOne(article.id, e.target.checked)}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: 500, 
            marginBottom: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {article.title || '无标题'}
          </div>
          <Space wrap size={[4, 4]}>
            <Tag color="blue">{article.keyword}</Tag>
            {article.isPublished ? (
              <Tag color="success">已发布</Tag>
            ) : (
              <Tag color="default">草稿</Tag>
            )}
          </Space>
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            {new Date(article.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>
    </Card>
  );

  // 筛选抽屉内容（移动端）
  const filterDrawerContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ marginBottom: 8, color: '#64748b', fontSize: 14 }}>发布状态</div>
        <Select 
          style={{ width: '100%' }} 
          value={filters.publishStatus} 
          onChange={(value) => handleFilterChange('publishStatus', value)}
        >
          <Option value="all">全部</Option>
          <Option value="published">已发布</Option>
          <Option value="unpublished">未发布</Option>
        </Select>
      </div>
      
      <div>
        <div style={{ marginBottom: 8, color: '#64748b', fontSize: 14 }}>关键词筛选</div>
        <Select 
          style={{ width: '100%' }} 
          placeholder="选择关键词" 
          allowClear 
          showSearch
          optionFilterProp="children"
          value={filters.keyword || undefined} 
          onChange={(value) => handleFilterChange('keyword', value || '')}
        >
          {keywords.map(k => (
            <Option key={k.keyword} value={k.keyword}>
              {k.keyword} ({k.count})
            </Option>
          ))}
        </Select>
      </div>
      
      <div>
        <div style={{ marginBottom: 8, color: '#64748b', fontSize: 14 }}>搜索内容</div>
        <Input 
          placeholder="输入关键词搜索" 
          value={filters.searchKeyword} 
          onChange={(e) => handleFilterChange('searchKeyword', e.target.value)}
          allowClear
        />
      </div>
      
      <Space style={{ marginTop: 8 }}>
        <Button onClick={handleClearFilters}>清除筛选</Button>
        <Button type="primary" onClick={() => { loadArticles(); setFilterDrawerVisible(false); }}>
          应用筛选
        </Button>
      </Space>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      {/* 统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Col xs={8} sm={8}>
          <Card size="small" hoverable onClick={() => handleStatsClick('all')} style={{ textAlign: 'center' }}>
            <Statistic 
              title={isMobile ? '总数' : '总文章数'} 
              value={stats.total} 
              valueStyle={{ color: '#1890ff', fontSize: isMobile ? 20 : 24 }} 
            />
          </Card>
        </Col>
        <Col xs={8} sm={8}>
          <Card size="small" hoverable onClick={() => handleStatsClick('published')} style={{ textAlign: 'center' }}>
            <Statistic 
              title="已发布" 
              value={stats.published} 
              valueStyle={{ color: '#52c41a', fontSize: isMobile ? 20 : 24 }} 
            />
          </Card>
        </Col>
        <Col xs={8} sm={8}>
          <Card size="small" hoverable onClick={() => handleStatsClick('unpublished')} style={{ textAlign: 'center' }}>
            <Statistic 
              title="未发布" 
              value={stats.unpublished} 
              valueStyle={{ color: '#faad14', fontSize: isMobile ? 20 : 24 }} 
            />
          </Card>
        </Col>
      </Row>

      {/* 移动端：筛选按钮和抽屉 */}
      {isMobile ? (
        <>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <Button 
              icon={<FilterOutlined />} 
              onClick={() => setFilterDrawerVisible(true)}
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadArticles}
              loading={loading}
            >
              刷新
            </Button>
          </div>
          <Drawer
            title="筛选条件"
            placement="bottom"
            open={filterDrawerVisible}
            onClose={() => setFilterDrawerVisible(false)}
            height="auto"
          >
            {filterDrawerContent}
          </Drawer>
        </>
      ) : (
        /* 桌面端：筛选工具栏 */
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={12} md={5}>
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
            
            <Col xs={12} sm={12} md={5}>
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
                {keywords.map(k => (
                  <Option key={k.keyword} value={k.keyword}>
                    {k.keyword} ({k.count})
                  </Option>
                ))}
              </Select>
            </Col>
            
            <Col xs={24} sm={24} md={7}>
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
                onChange={(e) => handleFilterChange('searchKeyword', e.target.value)}
                onPressEnter={() => setPage(1)}
                allowClear
                suffix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              />
            </Col>
            
            <Col xs={12} sm={12} md={3}>
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
            
            <Col xs={12} sm={12} md={4}>
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
      )}

      {/* 批量操作提示 */}
      {selectedIds.size > 0 && (
        <Card size="small" style={{ marginBottom: 12, backgroundColor: '#e6f7ff' }}>
          <Space wrap>
            <Text strong>已选中 {selectedIds.size} 篇</Text>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              删除选中
            </Button>
          </Space>
        </Card>
      )}

      {/* 文章列表 */}
      <Card 
        title={isMobile ? '文章列表' : '文章管理'} 
        variant="borderless" 
        extra={
          !isMobile && (
            <Space>
              <Button onClick={loadArticles} icon={<ReloadOutlined />}>刷新</Button>
              <Button danger disabled={total === 0} onClick={handleDeleteAll}>删除所有</Button>
            </Space>
          )
        }
        styles={{ body: { padding: isMobile ? 12 : 24 } }}
      >
        {isMobile ? (
          /* 移动端：卡片列表 */
          <>
            <div style={{ marginBottom: 12 }}>
              <Checkbox
                checked={isAllSelected}
                indeterminate={isSomeSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
              >
                全选当前页
              </Checkbox>
            </div>
            <List
              loading={loading}
              dataSource={articles}
              renderItem={renderMobileArticleCard}
              pagination={{
                current: page,
                pageSize,
                total,
                onChange: (newPage) => setPage(newPage),
                size: 'small',
                simple: true,
              }}
            />
          </>
        ) : (
          /* 桌面端：表格 */
          <ResizableTable<Article>
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
              onChange: (newPage, newPageSize) => {
                setPage(newPage);
                if (newPageSize && newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                  setPage(1);
                }
              }, 
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }} 
          />
        )}
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
          <Button key="copy" icon={<CopyOutlined />} onClick={() => handleCopy(viewModal.content, viewModal.imageUrl || viewModal.image_url)}>
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
                创建时间: {new Date(viewModal.createdAt || viewModal.created_at).toLocaleString('zh-CN')}
                {viewModal.updatedAt && viewModal.updatedAt !== viewModal.createdAt && (
                  <Text style={{ marginLeft: 16 }}>
                    更新时间: {new Date(viewModal.updatedAt || viewModal.updated_at).toLocaleString('zh-CN')}
                  </Text>
                )}
              </Paragraph>
            </Card>
            <ArticlePreview 
              content={viewModal.content} 
              title={viewModal.title}
              imageUrl={viewModal.imageUrl || viewModal.image_url}
            />
          </div>
        )}
      </Modal>

      <ArticleEditorModal visible={editorVisible} article={editModal} onClose={handleEditorClose} onSave={handleEditorSave} />
    </div>
  );
}
