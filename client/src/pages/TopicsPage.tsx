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
} from '@ant-design/icons';
import axios from 'axios';

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
  }, [distillationId]);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/topics/${distillationId}`);
      setTopics(response.data);
    } catch (error) {
      message.error('加载话题失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (topic: any) => {
    setEditModal(topic);
    setEditValue(topic.question);
  };

  const handleSaveEdit = async () => {
    try {
      await axios.put(`/api/topics/${editModal.id}`, {
        question: editValue,
      });
      message.success('话题更新成功');
      setEditModal(null);
      loadTopics();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个话题吗？',
      onOk: async () => {
        try {
          await axios.delete(`/api/topics/${id}`);
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
                border: selectedTopics.includes(topic.id)
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
                  onClick={() => handleDelete(topic.id)}
                >
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Checkbox
                    checked={selectedTopics.includes(topic.id)}
                    onChange={(e) =>
                      handleSelectTopic(topic.id, e.target.checked)
                    }
                  />
                }
                title={
                  <div style={{ fontSize: 15, color: '#1e293b' }}>
                    {topic.question}
                  </div>
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
