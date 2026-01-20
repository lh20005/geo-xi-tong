import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Input,
  Typography,
  Checkbox,
  Tooltip,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

const { Title } = Typography;
const { TextArea } = Input;

interface TopicItem {
  topicId: number;
  keyword: string;
  question: string;
  usageCount: number;
  lastUsedAt: string | null;
}

export default function TopicsPage() {
  const { distillationId } = useParams();
  const navigate = useNavigate();
  const { invalidateCacheByPrefix } = useCacheStore();
  const [editModal, setEditModal] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);

  // 缓存 key
  const cacheKey = `topics:distillation:${distillationId}`;

  // 使用缓存加载话题
  const fetchTopics = useCallback(async () => {
    if (!distillationId) return [];
    const result = await window.electron.topic.getByDistillation(Number(distillationId));
    if (!result.success) {
      throw new Error(result.error || '加载话题失败');
    }
    return (result.data || []).map((topic: any) => ({
      topicId: topic.id,
      keyword: topic.keyword,
      question: topic.question,
      usageCount: topic.usage_count ?? topic.usageCount ?? 0,
      lastUsedAt: topic.last_used_at ?? null
    }));
  }, [distillationId]);

  const {
    data: topics,
    loading,
    refreshing,
    refresh: refreshTopics,
    isFromCache
  } = useCachedData<TopicItem[]>(cacheKey, fetchTopics, {
    deps: [distillationId],
    onError: () => message.error('加载话题失败'),
  });

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('topics:');
    await refreshTopics(true);
  }, [invalidateCacheByPrefix, refreshTopics]);

  const handleEdit = (topic: any) => {
    setEditModal(topic);
    setEditValue(topic.question);
  };

  const handleSaveEdit = async () => {
    try {
      const result = await window.electron.topic.update(editModal.topicId, { question: editValue });
      if (!result.success) {
        throw new Error(result.error || '更新失败');
      }
      message.success('话题更新成功');
      setEditModal(null);
      invalidateAndRefresh();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (topicId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个话题吗？',
      onOk: async () => {
        try {
          const result = await window.electron.topic.delete(topicId);
          if (!result.success) {
            throw new Error(result.error || '删除失败');
          }
          message.success('删除成功');
          invalidateAndRefresh();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSelectTopic = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedTopics([...selectedTopics, id]);
    } else {
      setSelectedTopics(selectedTopics.filter((tid) => tid !== id));
    }
  };

  const handleGenerateArticle = () => {
    navigate(`/article/${distillationId}`, {
      state: { selectedTopics },
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/distillation')}
            />
            <span>话题管理</span>
            {(topics || []).length > 0 && (
              <Tag color="blue">{(topics || [])[0]?.keyword}</Tag>
            )}
          </Space>
        }
        variant="borderless"
        extra={
          <Space>
            {isFromCache && !refreshing && (
              <Tooltip title="数据来自缓存">
                <Tag color="gold">缓存</Tag>
              </Tooltip>
            )}
            {refreshing && (
              <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refreshTopics(true)}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleGenerateArticle}
              disabled={selectedTopics.length === 0}
            >
              生成文章 ({selectedTopics.length})
            </Button>
          </Space>
        }
      >
        <Title level={5} style={{ marginBottom: 16 }}>
          共 {(topics || []).length} 个话题
        </Title>

        <List
          loading={loading}
          dataSource={topics || []}
          renderItem={(topic) => (
            <List.Item
              style={{
                padding: '16px',
                background: '#f8fafc',
                marginBottom: 12,
                borderRadius: 8,
                border: selectedTopics.includes(topic.topicId)
                  ? '2px solid #0ea5e9'
                  : '1px solid #e2e8f0',
              }}
              actions={[
                <Button
                  key="edit"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(topic)}
                >
                  编辑
                </Button>,
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(topic.topicId)}
                >
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Checkbox
                    checked={selectedTopics.includes(topic.topicId)}
                    onChange={(e) =>
                      handleSelectTopic(topic.topicId, e.target.checked)
                    }
                  />
                }
                title={
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div style={{ fontSize: 15, color: '#1e293b' }}>
                      {topic.question}
                    </div>
                    <Space size={8}>
                      <Tag color={topic.usageCount === 0 ? 'default' : 'blue'}>
                        已使用 {topic.usageCount} 次
                      </Tag>
                      {topic.lastUsedAt && (
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          最后使用: {new Date(topic.lastUsedAt).toLocaleString('zh-CN')}
                        </span>
                      )}
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="编辑话题"
        open={!!editModal}
        onOk={handleSaveEdit}
        onCancel={() => setEditModal(null)}
        okText="保存"
        cancelText="取消"
      >
        <TextArea
          rows={4}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
        />
      </Modal>
    </div>
  );
}
