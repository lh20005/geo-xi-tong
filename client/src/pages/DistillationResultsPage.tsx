import { useState, useEffect, useCallback } from 'react';
import { 
  Card, Button, message, Space, Table, Tag, Modal, Empty, 
  Select, Input, Row, Col, Statistic, Badge, Tooltip, Alert 
} from 'antd';
import { 
  FileTextOutlined, DeleteOutlined, ThunderboltOutlined, 
  SearchOutlined, FilterOutlined, ReloadOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { fetchResultsWithReferences, fetchAllKeywords, deleteTopics } from '../api/distillationResultsApi';
import { TopicWithReference, Statistics } from '../types/distillationResults';

const { Search } = Input;
const { Option } = Select;

export default function DistillationResultsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TopicWithReference[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalTopics: 0,
    totalKeywords: 0,
    totalReferences: 0
  });
  
  // 筛选状态
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState(''); // 用于输入框的即时值
  const [allKeywords, setAllKeywords] = useState<string[]>([]); // 所有关键词
  const [isSearchMode, setIsSearchMode] = useState(false); // 是否处于搜索模式

  // 独立加载所有关键词
  const loadAllKeywords = async () => {
    try {
      const result = await fetchAllKeywords();
      setAllKeywords(result.keywords);
    } catch (error: any) {
      console.error('加载关键词列表失败:', error);
      // 不阻止其他功能使用，只记录错误
    }
  };

  // 组件挂载时加载关键词列表
  useEffect(() => {
    loadAllKeywords();
  }, []);

  // 搜索防抖 - 300ms延迟
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim()) {
        setSearchText(searchInput);
        setFilterKeyword('');      // 清空关键词筛选
        setFilterProvider('');     // 清空模型筛选
        setIsSearchMode(true);     // 进入搜索模式
        setCurrentPage(1);         // 重置分页
      } else {
        setSearchText('');
        setIsSearchMode(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchResultsWithReferences({
        keyword: filterKeyword || undefined,
        provider: filterProvider || undefined,
        search: searchText || undefined,
        page: currentPage,
        pageSize
      });
      
      setData(result.data);
      setTotal(result.total);
      setStatistics(result.statistics);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据，以及当筛选条件改变时重新加载
  useEffect(() => {
    loadData();
  }, [currentPage, pageSize, filterKeyword, filterProvider, searchText]);

  // 处理关键词筛选改变
  const handleKeywordChange = (value: string) => {
    setFilterKeyword(value);
    setSearchInput('');      // 清空搜索框
    setSearchText('');       // 清空搜索文本
    setIsSearchMode(false);  // 退出搜索模式
    setCurrentPage(1);       // 重置分页
  };

  // 处理AI模型筛选改变
  const handleProviderChange = (value: string) => {
    setFilterProvider(value);
    setSearchInput('');      // 清空搜索框
    setSearchText('');       // 清空搜索文本
    setIsSearchMode(false);  // 退出搜索模式
    setCurrentPage(1);       // 重置分页
  };

  // 处理删除选中 - 使用useCallback优化性能
  const handleDeleteSelected = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的话题');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个话题吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          // 确保所有键都被正确转换为数字并验证
          const topicIds = selectedRowKeys
            .map(key => {
              const num = typeof key === 'string' ? parseInt(key, 10) : Number(key);
              return num;
            })
            .filter(id => Number.isInteger(id) && id > 0);

          // 验证转换是否成功
          if (topicIds.length !== selectedRowKeys.length) {
            console.error('ID转换失败 - 原始键:', selectedRowKeys, '转换后:', topicIds);
            message.error('部分选中的记录ID无效，请刷新页面后重试');
            return;
          }

          const result = await deleteTopics(topicIds);
          message.success(`成功删除 ${result.deletedCount} 个话题`);
          setSelectedRowKeys([]);
          loadData();
          loadAllKeywords(); // 删除后重新加载关键词列表
        } catch (error: any) {
          console.error('删除话题失败:', error);
          // 解析后端返回的详细错误信息
          if (error.response?.data) {
            const { error: errorMsg, details, invalidIds } = error.response.data;
            if (invalidIds && invalidIds.length > 0) {
              message.error(`${errorMsg}: ${invalidIds.join(', ')}`);
            } else if (details) {
              message.error(`${errorMsg}: ${details}`);
            } else {
              message.error(errorMsg || '删除失败');
            }
          } else {
            message.error(error.message || '删除失败');
          }
        }
      }
    });
  }, [selectedRowKeys, loadData, loadAllKeywords]);

  // 清除筛选 - 使用useCallback优化性能
  const handleClearFilters = useCallback(() => {
    setFilterKeyword('');
    setFilterProvider('');
    setSearchText('');
    setSearchInput('');
    setIsSearchMode(false);
    setCurrentPage(1);
  }, []);

  // 计算是否有活动的筛选条件
  const hasActiveFilters = filterKeyword || filterProvider || searchText;

  // 表格列定义
  const columns = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 150,
      sorter: (a: TopicWithReference, b: TopicWithReference) => 
        a.keyword.localeCompare(b.keyword),
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '蒸馏结果',
      dataIndex: 'question',
      key: 'question',
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      )
    },
    {
      title: '被引用次数',
      dataIndex: 'referenceCount',
      key: 'referenceCount',
      width: 120,
      sorter: (a: TopicWithReference, b: TopicWithReference) => 
        a.referenceCount - b.referenceCount,
      render: (count: number) => (
        <Badge 
          count={count} 
          showZero 
          style={{ 
            backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' 
          }}
        />
      )
    },
    {
      title: '蒸馏时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: (a: TopicWithReference, b: TopicWithReference) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    }
  ];
  
  return (
    <div style={{ padding: 24 }}>
      {loading && data.length === 0 ? (
        <Card>
          <Empty description="加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : data.length === 0 && !filterKeyword && !filterProvider && !searchText ? (
        <Card>
          <Empty
            description={
              <div>
                <p style={{ fontSize: 16, marginBottom: 8 }}>暂无蒸馏结果</p>
                <p style={{ color: '#64748b', marginBottom: 16 }}>
                  请前往"关键词蒸馏"页面执行蒸馏操作
                </p>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button 
              type="primary" 
              icon={<ThunderboltOutlined />}
              onClick={() => navigate('/distillation')}
            >
              前往关键词蒸馏
            </Button>
          </Empty>
        </Card>
      ) : (
        <Card
          title={
            <Space>
              <FileTextOutlined style={{ color: '#0ea5e9' }} />
              <span>蒸馏结果列表</span>
              <Tag color="blue">{total} 个话题</Tag>
            </Space>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadData();
                loadAllKeywords();
              }}
              loading={loading}
            >
              刷新
            </Button>
          }
        >
          {/* 搜索模式提示 */}
          {isSearchMode && searchText && (
            <Alert
              message={`搜索 "${searchText}" 的结果`}
              type="info"
              closable
              onClose={() => {
                setSearchInput('');
                setSearchText('');
                setIsSearchMode(false);
              }}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 统计卡片区域 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic 
                  title="总话题数" 
                  value={statistics.totalTopics} 
                  suffix="个"
                  valueStyle={{ color: '#0ea5e9' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic 
                  title="关键词数量" 
                  value={statistics.totalKeywords} 
                  suffix="个"
                  valueStyle={{ color: '#f59e0b' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic 
                  title="总被引用次数" 
                  value={statistics.totalReferences} 
                  suffix="次"
                  valueStyle={{ color: '#8b5cf6' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic 
                  title="当前显示" 
                  value={data.length} 
                  suffix="个"
                  valueStyle={{ color: '#10b981' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 筛选工具栏 */}
          <div style={{ marginBottom: 16, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#64748b', fontSize: 14 }}>
                    <FilterOutlined /> 按关键词筛选
                  </span>
                </div>
                <Select
                  size="large"
                  style={{ width: '100%' }}
                  value={filterKeyword}
                  onChange={handleKeywordChange}
                  placeholder="选择关键词"
                  allowClear
                >
                  {allKeywords.map(keyword => (
                    <Option key={keyword} value={keyword}>
                      {keyword}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={6}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#64748b', fontSize: 14 }}>
                    <FilterOutlined /> 按AI模型筛选
                  </span>
                </div>
                <Select
                  size="large"
                  style={{ width: '100%' }}
                  value={filterProvider}
                  onChange={handleProviderChange}
                  placeholder="选择AI模型"
                  allowClear
                >
                  <Option value="deepseek">DeepSeek</Option>
                  <Option value="gemini">Gemini</Option>
                  <Option value="ollama">Ollama</Option>
                </Select>
              </Col>
              <Col span={8}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#64748b', fontSize: 14 }}>
                    <SearchOutlined /> 搜索问题内容
                  </span>
                </div>
                <Search
                  placeholder="输入关键词搜索..."
                  allowClear
                  enterButton
                  size="large"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onSearch={(value) => setSearchInput(value)}
                />
              </Col>
              <Col span={4}>
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

          {/* 操作栏 */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              {selectedRowKeys.length > 0 && (
                <span style={{ color: '#64748b' }}>
                  已选择 {selectedRowKeys.length} 项
                </span>
              )}
            </Space>
            <Space>
              {selectedRowKeys.length > 0 && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteSelected}
                >
                  删除选中 ({selectedRowKeys.length})
                </Button>
              )}
            </Space>
          </div>

          {/* 数据表格 */}
          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys
            }}
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个话题`,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }
            }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    isSearchMode 
                      ? `没有找到包含 "${searchText}" 的话题` 
                      : "没有找到匹配的话题"
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button onClick={handleClearFilters}>
                    清除筛选
                  </Button>
                </Empty>
              )
            }}
          />
        </Card>
      )}
    </div>
  );
}
