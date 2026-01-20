import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Space, Modal, Input, Empty, Row, Col, Tag, App, Tooltip } from 'antd';
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, ReloadOutlined, CloudSyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeStore } from '../stores/knowledgeStore';

const { TextArea } = Input;

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  
  const {
    knowledgeBases,
    loading,
    error,
    fetchKnowledgeBases,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    clearError
  } = useKnowledgeStore();
  
  const [submitting, setSubmitting] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingKb, setEditingKb] = useState<{ id: string; name: string; description: string } | null>(null);
  const [kbName, setKbName] = useState('');
  const [kbDescription, setKbDescription] = useState('');

  // 初始加载
  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError, message]);

  // 刷新数据
  const loadKnowledgeBases = useCallback(async () => {
    await fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const handleCreateKnowledgeBase = async () => {
    if (!kbName.trim()) {
      message.warning('请输入知识库名称');
      return;
    }

    setSubmitting(true);
    try {
      const kb = await createKnowledgeBase({
        name: kbName.trim(),
        description: kbDescription.trim() || undefined
      });

      if (kb) {
        message.success('知识库创建成功！');
        setCreateModalVisible(false);
        setKbName('');
        setKbDescription('');
      }
    } catch (error: any) {
      message.error(error.message || '创建知识库失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKnowledgeBase = (id: string, name: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除知识库"${name}"吗？知识库中的所有文档也会被删除，此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        const success = await deleteKnowledgeBase(id);
        if (success) {
          message.success('知识库删除成功');
        }
      }
    });
  };

  const handleEditKnowledgeBase = (id: string, currentName: string, currentDesc: string) => {
    setEditingKb({ id, name: currentName, description: currentDesc || '' });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingKb) return;
    
    if (!editingKb.name || editingKb.name.trim() === '') {
      message.error('知识库名称不能为空');
      return;
    }
    
    setSubmitting(true);
    try {
      const success = await updateKnowledgeBase(editingKb.id, {
        name: editingKb.name.trim(),
        description: editingKb.description.trim() || undefined
      });
      if (success) {
        message.success('知识库更新成功');
        setEditModalVisible(false);
        setEditingKb(null);
      }
    } catch (error: any) {
      message.error(error.message || '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <BookOutlined style={{ color: '#1890ff' }} />
            <span>企业知识库</span>
            <Tag color="green">本地存储</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadKnowledgeBases}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              新建知识库
            </Button>
          </Space>
        }
        variant="borderless"
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
                          <Tag color="blue">{kb.document_count || 0} 个文档</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {kb.created_at || kb.createdAt ? new Date(kb.created_at || kb.createdAt || '').toLocaleString('zh-CN') : '-'}
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
                              handleEditKnowledgeBase(kb.id, kb.name, kb.description || '');
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
        confirmLoading={submitting}
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

      <Modal
        title="编辑知识库"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingKb(null);
        }}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>知识库名称 *</label>
            <Input
              placeholder="请输入知识库名称"
              value={editingKb?.name || ''}
              onChange={(e) => setEditingKb(prev => prev ? { ...prev, name: e.target.value } : null)}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <label>描述（可选）</label>
            <TextArea
              placeholder="请输入知识库描述"
              value={editingKb?.description || ''}
              onChange={(e) => setEditingKb(prev => prev ? { ...prev, description: e.target.value } : null)}
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
