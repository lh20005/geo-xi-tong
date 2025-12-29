import { useState, useEffect } from 'react';
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
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { apiClient } from '../api/client';

const { Title } = Typography;
const { TextArea } = Input;

export default function TopicsPage() {
  const { distillationId } = useParams();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);

  useEffect(() => {
    loadTopics();
    
    // 每10秒自动刷新一次，以同步最新的使用计数
    const interval = setInterval(() => {
      loadTopics();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [distillationId]);

  const loadTopics = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await apiClient.get(`/topics/distillation/${distillationId}/stats`);
      setTopics(response.data.topics);
    } catch (error) {
      if (!silent) {
        message.error('加载话题失败');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleEdit = (topic: any) => {
    setEditModal(topic);
    setEditValue(topic.question);
  };

  const handleSaveEdit = async () => {
    try {
      await apiClient.put(`/topics/${editModal.topicId}`, {
        question: editValue,
      });
      message.success('话题更新成功');
      setEditModal(null);
      loadTopics();
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
          await apiClient.delete(`/topics/${topicId}`);
          message.success('删除成功');
          loadTopics();
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
            {topics.length > 0 && (
              <Tag color="blue">{topics[0]?.keyword}</Tag>
            )}
          </Space>
        }
        bordered={false}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadTopics()}
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
          共 {topics.length} 个话题
        </Title>

        <List
          loading={loading}
          dataSource={topics}
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
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(topic)}
                >
                  编辑
                </Button>,
                <Button
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
