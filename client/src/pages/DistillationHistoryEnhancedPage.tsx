import { useState, useEffect } from 'react';
import { 
  Card, Button, message, Space, Tag, Modal, Empty, 
  Select, Row, Col, Statistic 
} from 'antd';
import { 
  FileTextOutlined, DeleteOutlined, ReloadOutlined, 
  FilterOutlined, EyeOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ResizableTable from '../components/ResizableTable';
import UsageCountBadge from '../components/UsageCountBadge';
import UsageHistoryModal from '../components/UsageHistoryModal';

const { Option } = Select;

interface DistillationWithUsage {
  id: number;
  keyword: string;
  provider: string;
  topicCount: number;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * 蒸馏历史增强页面
 * Task 8: 增强前端页面 - DistillationResultsPage
 * 
 * 功能：
 * - 显示蒸馏结果列表及使用统计
 * - 支持按使用次数排序
 * - 支持筛选（全部/已使用/未使用）
 * - 点击使用次数查看使用历史
 */
export default function DistillationHistoryEnhancedPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DistillationWithUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 排序和筛选状态
  const [sortBy, setSortBy] = useState<'created_at' | 'usage_count'>('usage_count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterUsage, setFilterUsage] = useState<'all' | 'used' | 'unused'>('all');
  
  // 使用历史弹窗状态
  const [usageHistoryVisible, setUsageHistoryVisible] = useState(false);
  const [selectedDistillationId, setSelectedDistillationId] = useState<number | null>(null);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/distillation/stats', {
        params: {
          page: currentPage,
          pageSize,
          sortBy,
          sortOrder,
          filterUsage
        }
      });
      
      setData(response.data.distillations || []);
      setTotal(response.data.total || 0);
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据，以及当筛选条件改变时重新加载
  useEffect(() => {
    loadData();
  }, [currentPage, pageSize, sortBy, sortOrder, filterUsage]);

  // 处理排序改变
  const handleSortChange = (field: 'created_at' | 'usage_count') => {
    if (sortBy === field) {
      // 如果点击同一字段，切换排序顺序
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果点击不同字段，设置新字段并重置为升序
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // 处理筛选改变
  const handleFilterChange = (value: 'all' | 'used' | 'unused') => {
    setFilterUsage(value);
    setCurrentPage(1);
  };

  // 显示使用历史
  const handleShowUsageHistory = (distillationId: number) => {
    setSelectedDistillationId(distillationId);
    setUsageHistoryVisible(true);
  };

  // 关闭使用历史弹窗
  const handleCloseUsageHistory = () => {
    setUsageHistoryVisible(false);
    setSelectedDistillationId(null);
  };

  // 查看蒸馏结果详情
  const handleViewDetail = async (record: DistillationWithUsage) => {
    try {
      await axios.get(`/api/distillation/${record.id}`);
      // 这里可以导航到详情页或显示详情弹窗
      message.success('加载详情成功');
      // navigate(`/distillation/${record.id}`);
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载详情失败');
    }
  };

  // 删除蒸馏结果
  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条蒸馏记录吗？此操作不可恢复，相关的使用记录也会被删除。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`/api/distillation/${id}`);
          message.success('删除成功');
          loadData();
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  // 计算统计信息
  const totalUsageCount = data.reduce((sum, item) => sum + item.usageCount, 0);
  const usedCount = data.filter(item => item.usageCount > 0).length;
  const unusedCount = data.filter(item => item.usageCount === 0).length;

  // 表格列定义
  const columns = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 150,
      align: 'center' as const,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'AI模型',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      align: 'center' as const,
      render: (provider: string) => {
        const colorMap: Record<string, string> = {
          deepseek: 'purple',
          gemini: 'orange',
          ollama: 'green'
        };
        return <Tag color={colorMap[provider] || 'default'}>{provider}</Tag>;
      }
    },
    {
      title: '话题数量',
      dataIndex: 'topicCount',
      key: 'topicCount',
      width: 100,
      align: 'center' as const,
      render: (count: number) => <span>{count}个</span>
    },
    {
      title: (
        <span 
          style={{ cursor: 'pointer' }}
          onClick={() => handleSortChange('usage_count')}
        >
          被引用次数 {sortBy === 'usage_count' && (sortOrder === 'asc' ? '↑' : '↓')}
        </span>
      ),
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 130,
      align: 'center' as const,
      render: (count: number, record: DistillationWithUsage) => (
        <UsageCountBadge
          count={count}
          onClick={() => handleShowUsageHistory(record.id)}
        />
      )
    },
    {
      title: '最近使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 180,
      align: 'center' as const,
      render: (date: string | null) => 
        date ? new Date(date).toLocaleString('zh-CN') : <span style={{ color: '#999' }}>未使用</span>
    },
    {
      title: (
        <span 
          style={{ cursor: 'pointer' }}
          onClick={() => handleSortChange('created_at')}
        >
          创建时间 {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
        </span>
      ),
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
      render: (_: any, record: DistillationWithUsage) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
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
            <span>蒸馏历史记录</span>
            <Tag color="blue">{total} 条记录</Tag>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {/* 统计卡片区域 - 移动端2x2布局 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic 
                title="总记录数" 
                value={total} 
                suffix="条"
                valueStyle={{ color: '#0ea5e9' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic 
                title="已使用" 
                value={usedCount} 
                suffix="条"
                valueStyle={{ color: '#10b981' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic 
                title="未使用" 
                value={unusedCount} 
                suffix="条"
                valueStyle={{ color: '#f59e0b' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic 
                title="总使用次数" 
                value={totalUsageCount} 
                suffix="次"
                valueStyle={{ color: '#8b5cf6' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 筛选工具栏 */}
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#64748b', fontSize: 14 }}>
                  <FilterOutlined /> 使用状态筛选
                </span>
              </div>
              <Select
                size="large"
                style={{ width: '100%' }}
                value={filterUsage}
                onChange={handleFilterChange}
              >
                <Option value="all">全部</Option>
                <Option value="used">已使用</Option>
                <Option value="unused">未使用</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={18}>
              <div style={{ color: '#64748b', fontSize: 14 }}>
                <span>点击列标题可以切换排序方式</span>
                <span style={{ marginLeft: 16 }}>
                  当前排序: {sortBy === 'usage_count' ? '被引用次数' : '创建时间'} 
                  ({sortOrder === 'asc' ? '升序' : '降序'})
                </span>
              </div>
            </Col>
          </Row>
        </div>

        {/* 数据表格 */}
        {data.length === 0 && !loading ? (
          <Empty
            description="暂无蒸馏记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button 
              type="primary" 
              onClick={() => navigate('/distillation')}
            >
              前往关键词蒸馏
            </Button>
          </Empty>
        ) : (
          <ResizableTable<DistillationWithUsage>
            tableId="distillation-history-list"
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            scroll={{ x: 900 }}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }
            }}
          />
        )}
      </Card>

      {/* 使用历史弹窗 */}
      <UsageHistoryModal
        visible={usageHistoryVisible}
        distillationId={selectedDistillationId}
        onClose={handleCloseUsageHistory}
      />
    </div>
  );
}
