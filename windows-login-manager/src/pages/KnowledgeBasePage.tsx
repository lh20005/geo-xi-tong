import { useState, useEffect } from 'react';
import { Card, Button, message, Space, Modal, Input, Empty, Row, Col, Tag } from 'antd';
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ipcBridge } from '../services/ipc';

const { TextArea } = Input;

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [kbName, setKbName] = useState('');
  const [kbDescription, setKbDescription] = useState('');

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      const res = await ipcBridge.getKnowledgeBases();
      if (res.success && res.data) {
        setKnowledgeBases(res.data.knowledgeBases || []);
      } else {
        throw new Error(res.error || '加载失败');
      }
    } catch (error) {
      console.error('加载知识库失败:', error);
      message.error('加载知识库失败');
    }
  };

  const handleCreateKnowledgeBase = async () => {
    if (!kbName.trim()) {
      message.warning('请输入知识库名称');
      return;
    }

    setLoading(true);
    try {
      const res = await ipcBridge.createKnowledgeBase({
        name: kbName.trim(),
        description: kbDescription.trim() || undefined
      });

      if (!res.success) throw new Error(res.error || '创建失败');

      message.success('知识库创建成功！');
      setCreateModalVisible(false);
      setKbName('');
      setKbDescription('');
      loadKnowledgeBases();
    } catch (error: any) {
      message.error(error.message || '创建知识库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKnowledgeBase = (id: number, name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除知识库"${name}"吗？知识库中的所有文档也会被删除，此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await ipcBridge.deleteKnowledgeBase(id);
          if (!res.success) throw new Error(res.error || '删除失败');
          message.success('知识库删除成功');
          loadKnowledgeBases();
        } catch (error: any) {
          message.error(error.message || '删除知识库失败');
        }
      }
    });
  };

  const handleEditKnowledgeBase = (id: number, currentName: string, currentDesc: string) => {
    const formData = {
      name: currentName,
      description: currentDesc
    };
    
    Modal.confirm({
      title: '编辑知识库',
      width: 520,
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>知识库名称</label>
            <Input
              defaultValue={currentName}
              placeholder="请输入知识库名称"
              onChange={(e) => { formData.name = e.target.value; }}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <label>描述（可选）</label>
            <TextArea
              defaultValue={currentDesc}
              placeholder="请输入知识库描述"
              onChange={(e) => { formData.description = e.target.value; }}
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        if (!formData.name || formData.name.trim() === '') {
          message.error('知识库名称不能为空');
          return Promise.reject();
        }
        
        try {
          const res = await ipcBridge.updateKnowledgeBase(id, {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined
          });
          if (!res.success) throw new Error(res.error || '更新失败');
          message.success('知识库更新成功');
          loadKnowledgeBases();
        } catch (error: any) {
          message.error(error.message || '更新失败');
          return Promise.reject();
        }
      }
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <BookOutlined style={{ color: '#1890ff' }} />
            <span>企业知识库</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建知识库
          </Button>
        }
        bordered={false}
      >
        {knowledgeBases.length === 0 ? (
          <Empty
            description="暂无知识库"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <p style={{ color: '#64748b' }}>
              点击"新建知识库"按钮来创建第一个知识库
            </p>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {knowledgeBases.map((kb) => (
              <Col xs={24} sm={12} md={8} lg={6} key={kb.id}>
                <Card
                  hoverable
                  style={{ height: '100%' }}
                  onClick={() => navigate(`/knowledge-base/${kb.id}`)}
                >
                  <div style={{ marginBottom: 16, textAlign: 'center' }}>
                    <BookOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                  </div>
                  <Card.Meta
                    title={<div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center' }}>{kb.name}</div>}
                    description={
                      <Space direction="vertical" style={{ width: '100%' }} size="small" align="center">
                        {kb.description && (
                          <div style={{ 
                            color: '#666', 
                            fontSize: 13,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            textAlign: 'center'
                          }}>
                            {kb.description}
                          </div>
                        )}
                        <div>
                          <Tag color="blue">{kb.document_count} 个文档</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {new Date(kb.created_at).toLocaleString('zh-CN')}
                        </div>
                        <Space size="small">
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/knowledge-base/${kb.id}`);
                            }}
                          >
                            查看
                          </Button>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditKnowledgeBase(kb.id, kb.name, kb.description);
                            }}
                          >
                            编辑
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteKnowledgeBase(kb.id, kb.name);
                            }}
                          >
                            删除
                          </Button>
                        </Space>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Modal
        title="新建知识库"
        open={createModalVisible}
        onOk={handleCreateKnowledgeBase}
        onCancel={() => {
          setCreateModalVisible(false);
          setKbName('');
          setKbDescription('');
        }}
        confirmLoading={loading}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>知识库名称 *</label>
            <Input
              placeholder="请输入知识库名称"
              value={kbName}
              onChange={(e) => setKbName(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <label>描述（可选）</label>
            <TextArea
              placeholder="请输入知识库描述"
              value={kbDescription}
              onChange={(e) => setKbDescription(e.target.value)}
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
