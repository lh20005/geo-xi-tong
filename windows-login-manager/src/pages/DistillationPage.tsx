import { useState, useEffect, useCallback } from 'react';
import { Card, Input, Button, message, Space, Typography, Tag, Modal, Empty, Tooltip } from 'antd';
import { ThunderboltOutlined, FileTextOutlined, EyeOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, CloudSyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { localDistillationApi } from '../api/localDistillationApi';
import ResizableTable from '../components/ResizableTable';
import { 
  saveResultToLocalStorage, 
  loadResultFromLocalStorage, 
  clearResultFromLocalStorage 
} from '../utils/distillationStorage';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

const { Title, Paragraph } = Typography;

export default function DistillationPage() {
  const navigate = useNavigate();
  const { invalidateCacheByPrefix } = useCacheStore();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);

  // 使用缓存加载历史记录（从本地数据库）
  const fetchHistory = useCallback(async () => {
    const result = await localDistillationApi.findAll({ page: 1, pageSize: 1000 });
    if (!result.success) {
      throw new Error(result.error || '加载历史记录失败');
    }
    return result.data?.items || result.data?.data || [];
  }, []);

  const {
    data: history,
    loading: historyLoading,
    refreshing,
    refresh: refreshHistory,
    isFromCache
  } = useCachedData('distillation:history', fetchHistory, {
    onError: (error) => console.error('加载历史失败:', error),
    forceRefresh: true, // 每次进入页面强制刷新
  });

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('distillation:');
    await refreshHistory(true);
  }, [invalidateCacheByPrefix, refreshHistory]);

  // 页面进入时主动刷新数据，确保数据最新
  useEffect(() => {
    // 组件挂载时强制刷新一次，确保数据同步
    refreshHistory(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 查看历史记录详情（从本地数据库）
  const handleViewHistory = async (record: any) => {
    setLoading(true);
    try {
      const result = await localDistillationApi.findById(record.id);
      if (!result.success || !result.data) {
        throw new Error(result.error || '加载历史记录失败');
      }
      
      // 从本地话题表获取话题列表
      const topicsResult = await window.electron.invoke('topic:local:getByDistillation', record.id);
      if (!topicsResult.success) {
        throw new Error(topicsResult.error || '加载话题列表失败');
      }
      
      const detailData = {
        distillationId: result.data.id,
        keyword: result.data.keyword,
        questions: topicsResult.data || [],
        count: topicsResult.data?.length || 0
      };
      setSelectedRecordId(record.id);
      saveResultToLocalStorage(detailData);
      message.success('已加载历史记录');
      navigate('/distillation-results');
    } catch (error: any) {
      message.error(error.message || '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除单条记录（从本地数据库）
  const handleDeleteRecord = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条蒸馏记录吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await localDistillationApi.delete(id);
          if (!result.success) {
            throw new Error(result.error || '删除失败');
          }
          message.success('删除成功');
          if (selectedRecordId === id) {
            setSelectedRecordId(null);
            clearResultFromLocalStorage();
          }
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      }
    });
  };

  // 编辑关键词（更新本地数据库）
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
          const result = await localDistillationApi.update(id, { keyword: newKeyword.trim() });
          if (!result.success) {
            throw new Error(result.error || '更新失败');
          }
          message.success('关键词更新成功');
          if (selectedRecordId === id) {
            const savedResult = loadResultFromLocalStorage();
            if (savedResult) {
              const updatedResult = { ...savedResult, keyword: newKeyword.trim() };
              saveResultToLocalStorage(updatedResult);
            }
          }
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.message || '更新失败');
          return Promise.reject();
        }
      }
    });
  };

  // 删除所有记录（从本地数据库）
  const handleDeleteAll = () => {
    Modal.confirm({
      title: '确认删除所有记录',
      content: '确定要删除所有蒸馏记录吗？此操作不可恢复！',
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          // 获取所有记录的 ID
          const allRecords = history || [];
          const ids = allRecords.map((record: any) => record.id);
          
          if (ids.length === 0) {
            message.info('没有记录可删除');
            return;
          }
          
          const result = await localDistillationApi.deleteBatch(ids);
          if (!result.success) {
            throw new Error(result.error || '删除失败');
          }
          message.success(`成功删除 ${result.data?.deletedCount || ids.length} 条记录`);
          setSelectedRecordId(null);
          clearResultFromLocalStorage();
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      }
    });
  };

  // 组件挂载时加载选中的记录
  useEffect(() => {
    const savedResult = loadResultFromLocalStorage();
    if (savedResult) {
      setSelectedRecordId(savedResult.distillationId);
    }
  }, []);

  const handleDistill = async () => {
    if (!keyword.trim()) {
      message.warning('请输入关键词');
      return;
    }

    setLoading(true);
    try {
      // 1. 调用服务器 API 执行蒸馏（调用 AI 生成话题）
      console.log('[蒸馏] 开始调用服务器 API');
      const response = await apiClient.post('/distillation', { keyword: keyword.trim() });
      
      const questions = response.data.questions || [];
      const count = questions.length;
      console.log('[蒸馏] 服务器返回话题数量:', count);
      
      // 2. 保存蒸馏记录到本地数据库
      console.log('[蒸馏] 开始保存蒸馏记录');
      const createResult = await localDistillationApi.create({
        keyword: keyword.trim(),
        topic_count: count,
        provider: response.data.provider || 'deepseek'
      });
      
      if (!createResult.success || !createResult.data) {
        throw new Error(createResult.error || '保存蒸馏记录失败');
      }
      
      const distillationId = createResult.data.id;
      console.log('[蒸馏] 蒸馏记录已保存, ID:', distillationId);
      
      // 3. 保存话题到本地数据库
      console.log('[蒸馏] 开始保存话题，数量:', questions.length);
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        console.log(`[蒸馏] 保存话题 ${i + 1}/${questions.length}:`, question.question || question);
        
        const topicResult = await window.electron.invoke('topic:local:create', {
          distillation_id: distillationId,
          keyword: keyword.trim(),
          question: question.question || question,
          category: question.category || '',
          priority: question.priority || 0
        });
        
        console.log(`[蒸馏] 话题 ${i + 1} 保存结果:`, topicResult);
        
        if (!topicResult.success) {
          console.error('[蒸馏] 保存话题失败:', topicResult.error);
          throw new Error(`保存话题失败: ${topicResult.error}`);
        }
      }
      console.log('[蒸馏] 所有话题保存完成');
      
      // 4. 保存结果到 LocalStorage（用于结果页面显示）
      const resultData = {
        distillationId,
        keyword: keyword.trim(),
        questions,
        count
      };
      saveResultToLocalStorage(resultData);
      setSelectedRecordId(distillationId);
      
      message.success(`成功生成 ${count} 个话题！`);
      setKeyword('');
      
      // 5. 刷新历史列表
      invalidateAndRefresh();
      invalidateCacheByPrefix('distillationResults:');
      
      // 6. 自动导航到结果页面
      navigate('/distillation-results');
    } catch (error: any) {
      console.error('[蒸馏] 蒸馏失败:', error);
      message.error(error.message || '蒸馏失败，请检查API配置');
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
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#0ea5e9' }} />
            <span>关键词蒸馏</span>
          </Space>
        }
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>输入关键词</Title>
          <Paragraph style={{ color: '#64748b' }}>
            输入您想要优化的关键词，AI将分析并生成真实用户可能提出的相关问题
          </Paragraph>
        </div>

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
      </Card>

      <Card
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0ea5e9' }} />
            <span>蒸馏历史</span>
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
            <Button onClick={() => refreshHistory(true)} icon={<ReloadOutlined />}>刷新</Button>
            {(history || []).length > 0 && (
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleDeleteAll}
              >
                全部删除
              </Button>
            )}
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <ResizableTable
          tableId="distillation-page-list"
          columns={columns}
          dataSource={history || []}
          rowKey="id"
          loading={historyLoading}
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
      </Card>
    </div>
  );
}
