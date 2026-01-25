import { useState, useEffect } from 'react';
import { Card, Input, Button, message, Space, Typography, Tag, Modal, Empty } from 'antd';
import { ThunderboltOutlined, FileTextOutlined, EyeOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import ResizableTable from '../components/ResizableTable';
import { 
  saveResultToLocalStorage, 
  loadResultFromLocalStorage, 
  clearResultFromLocalStorage 
} from '../utils/distillationStorage';

const { Title, Paragraph } = Typography;

export default function DistillationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);

  // 监听窗口大小变化
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 加载历史记录
  const loadHistory = async () => {
    try {
      const response = await apiClient.get('/distillation/history');
      setHistory(response.data.data || response.data);
    } catch (error) {
      console.error('加载历史失败:', error);
    }
  };

  // 查看历史记录详情
  const handleViewHistory = async (record: any) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/distillation/${record.id}`);
      const detailData = {
        distillationId: response.data.id,
        keyword: response.data.keyword,
        questions: response.data.questions,
        count: response.data.questions.length
      };
      setSelectedRecordId(record.id);
      saveResultToLocalStorage(detailData);
      message.success('已加载历史记录');
      navigate('/distillation-results');
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除单条记录
  const handleDeleteRecord = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条蒸馏记录吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/distillation/${id}`);
          message.success('删除成功');
          if (selectedRecordId === id) {
            setSelectedRecordId(null);
            clearResultFromLocalStorage();
          }
          loadHistory();
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  // 编辑关键词
  const handleEditKeyword = (id: number, currentKeyword: string) => {
    let newKeyword = currentKeyword;
    
    Modal.confirm({
      title: '编辑关键词',
      content: (
        <Input
          defaultValue={currentKeyword}
          placeholder="请输入新的关键词"
          onChange={(e) => { newKeyword = e.target.value; }}
          onPressEnter={(e) => {
            newKeyword = (e.target as HTMLInputElement).value;
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        if (!newKeyword || newKeyword.trim() === '') {
          message.error('关键词不能为空');
          return Promise.reject();
        }
        
        try {
          await apiClient.patch(`/distillation/${id}`, { keyword: newKeyword.trim() });
          message.success('关键词更新成功');
          if (selectedRecordId === id) {
            const savedResult = loadResultFromLocalStorage();
            if (savedResult) {
              const updatedResult = { ...savedResult, keyword: newKeyword.trim() };
              saveResultToLocalStorage(updatedResult);
            }
          }
          loadHistory();
        } catch (error: any) {
          message.error(error.response?.data?.error || '更新失败');
          return Promise.reject();
        }
      }
    });
  };

  // 删除所有记录
  const handleDeleteAll = () => {
    Modal.confirm({
      title: '确认删除所有记录',
      content: '确定要删除所有蒸馏记录吗？此操作不可恢复！',
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await apiClient.delete('/distillation/all/records');
          message.success(`成功删除 ${response.data.deletedCount} 条记录`);
          setHistory([]);
          setSelectedRecordId(null);
          clearResultFromLocalStorage();
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  // 组件挂载时和每次导航到此页面时加载历史记录
  // 使用 location.key 作为依赖，每次导航都会生成新的 key
  useEffect(() => {
    console.log('[DistillationPage] 页面加载/导航，刷新历史列表');
    loadHistory();
    const savedResult = loadResultFromLocalStorage();
    if (savedResult) {
      setSelectedRecordId(savedResult.distillationId);
    }
  }, [location.key]);

  const handleDistill = async () => {
    if (!keyword.trim()) {
      message.warning('请输入关键词');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/distillation', { keyword });
      
      // 保存结果到LocalStorage
      const resultData = {
        distillationId: response.data.distillationId,
        keyword: response.data.keyword,
        questions: response.data.questions,
        count: response.data.count
      };
      saveResultToLocalStorage(resultData);
      setSelectedRecordId(response.data.distillationId);
      
      message.success(`成功生成 ${response.data.count} 个话题！`);
      setKeyword('');
      
      // 刷新历史列表
      loadHistory();
      
      // 自动导航到结果页面，传递刷新标记
      navigate('/distillation-results', { state: { refresh: Date.now() } });
    } catch (error: any) {
      message.error(error.response?.data?.error || '蒸馏失败，请检查API配置');
    } finally {
      setLoading(false);
    }
  };

  // 历史表格列定义
  const columns = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 200,
      align: 'center' as const,
      render: (text: string) => <Tag color="blue" style={{ fontSize: 14 }}>{text}</Tag>,
    },
    {
      title: '话题数量',
      dataIndex: 'topic_count',
      key: 'topic_count',
      width: 120,
      align: 'center' as const,
      render: (count: number) => (
        <span style={{ fontSize: 14, fontWeight: 500, color: '#0ea5e9' }}>{count}</span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: 14 }}>{new Date(text).toLocaleString('zh-CN')}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            查看详情
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEditKeyword(record.id, record.keyword)}
          >
            编辑
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRecord(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#0ea5e9' }} />
            <span>关键词蒸馏</span>
          </Space>
        }
        styles={{ body: { padding: isMobile ? 12 : 24 } }}
      >
        <div style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Title level={isMobile ? 5 : 4}>输入关键词</Title>
          <Paragraph style={{ color: '#64748b', fontSize: isMobile ? 13 : 14 }}>
            输入您想要优化的关键词，AI将分析并生成真实用户可能提出的相关问题
          </Paragraph>
        </div>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input
              size="large"
              placeholder="例如：英国留学、Python培训等"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleDistill}
            />
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={loading}
              onClick={handleDistill}
              block
            >
              开始蒸馏
            </Button>
          </div>
        ) : (
          <Space.Compact style={{ width: '100%', maxWidth: 600 }}>
            <Input
              size="large"
              placeholder="例如：英国留学、Python培训、品牌营销等"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleDistill}
            />
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={loading}
              onClick={handleDistill}
            >
              开始蒸馏
            </Button>
          </Space.Compact>
        )}
      </Card>

      <Card
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0ea5e9' }} />
            <span>蒸馏历史</span>
          </Space>
        }
        extra={
          <Space size={isMobile ? 'small' : 'middle'}>
            <Button onClick={loadHistory} size={isMobile ? 'small' : 'middle'}>刷新</Button>
            {history.length > 0 && (
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleDeleteAll}
                size={isMobile ? 'small' : 'middle'}
              >
                {isMobile ? '全删' : '全部删除'}
              </Button>
            )}
          </Space>
        }
        style={{ marginTop: isMobile ? 16 : 24 }}
        styles={{ body: { padding: isMobile ? 12 : 24 } }}
      >
        {isMobile ? (
          /* 移动端卡片列表 */
          history.length === 0 ? (
            <Empty
              description="暂无蒸馏记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <p style={{ color: '#64748b', fontSize: 13 }}>
                输入关键词并点击"开始蒸馏"创建第一条记录
              </p>
            </Empty>
          ) : (
            <div>
              {history.map((record: any) => (
                <Card 
                  key={record.id} 
                  size="small" 
                  style={{ 
                    marginBottom: 8,
                    border: record.id === selectedRecordId ? '2px solid #0ea5e9' : '1px solid #e8e8e8'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Tag color="blue" style={{ fontSize: 14 }}>{record.keyword}</Tag>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#0ea5e9' }}>{record.topic_count} 个话题</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                    {new Date(record.created_at).toLocaleString('zh-CN')}
                  </div>
                  <Space size="small" wrap>
                    <Button
                      type="primary"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewHistory(record)}
                    >
                      查看
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditKeyword(record.id, record.keyword)}
                    >
                      编辑
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteRecord(record.id)}
                    >
                      删除
                    </Button>
                  </Space>
                </Card>
              ))}
            </div>
          )
        ) : (
          /* 桌面端表格 */
          <ResizableTable
            tableId="distillation-page-list"
            columns={columns}
            dataSource={history}
            rowKey="id"
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无蒸馏记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <p style={{ color: '#64748b' }}>
                    输入关键词并点击"开始蒸馏"创建第一条记录
                  </p>
                </Empty>
              )
            }}
            rowClassName={(record: any) => 
              record.id === selectedRecordId ? 'ant-table-row-selected' : ''
            }
          />
        )}
      </Card>
    </div>
  );
}
