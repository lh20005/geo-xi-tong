import { useState, useEffect } from 'react';
import { Card, Button, message, Space, Modal, Upload, Empty, Table, Input, Tag, Tooltip } from 'antd';
import { BookOutlined, UploadOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import type { UploadFile } from 'antd';

interface KnowledgeDocument {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  content_preview: string;
  created_at: string;
}

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  document_count: number;
  documents: KnowledgeDocument[];
}

export default function KnowledgeBaseDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    if (id) {
      loadKnowledgeBase();
    }
  }, [id]);

  const loadKnowledgeBase = async () => {
    try {
      const response = await axios.get(`/api/knowledge-bases/${id}`);
      setKnowledgeBase(response.data);
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('加载知识库失败:', error);
      message.error('加载知识库失败');
    }
  };

  const handleUploadDocuments = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('files', file.originFileObj);
        }
      });

      const response = await axios.post(`/api/knowledge-bases/${id}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      message.success(`成功上传 ${response.data.uploadedCount} 个文档！`);
      if (response.data.errors && response.data.errors.length > 0) {
        response.data.errors.forEach((err: any) => {
          message.error(`${err.filename}: ${err.error}`);
        });
      }
      
      setUploadModalVisible(false);
      setFileList([]);
      loadKnowledgeBase();
    } catch (error: any) {
      message.error(error.response?.data?.error || '上传文档失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = (docId: number, filename: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文档"${filename}"吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`/api/knowledge-bases/documents/${docId}`);
          message.success('文档删除成功');
          loadKnowledgeBase();
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除文档失败');
        }
      }
    });
  };

  const handleViewDocument = async (docId: number) => {
    try {
      const response = await axios.get(`/api/knowledge-bases/documents/${docId}`);
      setSelectedDoc(response.data);
      setViewModalVisible(true);
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取文档详情失败');
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      loadKnowledgeBase();
      return;
    }

    try {
      const response = await axios.get(`/api/knowledge-bases/${id}/documents/search?q=${encodeURIComponent(searchKeyword)}`);
      setDocuments(response.data.documents);
    } catch (error: any) {
      message.error(error.response?.data?.error || '搜索失败');
    }
  };

  const beforeUpload = (file: File) => {
    const allowedTypes = ['.txt', '.md', '.pdf', '.doc', '.docx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      message.error(`不支持的文件格式！支持的格式: ${allowedTypes.join(', ')}`);
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过10MB！');
      return false;
    }
    
    return false; // 阻止自动上传
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string, record: KnowledgeDocument) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>{text}</span>
          <Tag color="blue">{record.file_type}</Tag>
        </Space>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '内容预览',
      dataIndex: 'content_preview',
      key: 'content_preview',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ color: '#666' }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: KnowledgeDocument) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDocument(record.id)}
          >
            查看
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteDocument(record.id, record.filename)}
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
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/knowledge-base')}
            />
            <BookOutlined style={{ color: '#1890ff' }} />
            <span>{knowledgeBase?.name || '知识库详情'}</span>
            {knowledgeBase?.description && (
              <span style={{ fontSize: 14, color: '#666', fontWeight: 'normal' }}>
                - {knowledgeBase.description}
              </span>
            )}
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="搜索文档"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 250 }}
              prefix={<SearchOutlined />}
            />
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传文档
            </Button>
          </Space>
        }
        bordered={false}
      >
        {documents.length === 0 ? (
          <Empty
            description="暂无文档"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <p style={{ color: '#64748b' }}>
              点击"上传文档"按钮来添加文档到知识库
            </p>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={documents}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个文档`,
            }}
          />
        )}
      </Card>

      <Modal
        title="上传文档"
        open={uploadModalVisible}
        onOk={handleUploadDocuments}
        onCancel={() => {
          setUploadModalVisible(false);
          setFileList([]);
        }}
        confirmLoading={loading}
        okText="上传"
        cancelText="取消"
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Upload
              multiple
              fileList={fileList}
              beforeUpload={beforeUpload}
              onChange={({ fileList }) => setFileList(fileList)}
              accept=".txt,.md,.pdf,.doc,.docx"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
              支持格式: .txt, .md, .pdf, .doc, .docx，单个文件不超过10MB
            </div>
          </div>
        </Space>
      </Modal>

      <Modal
        title="文档详情"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedDoc(null);
        }}
        footer={[
          <Button key="copy" onClick={() => {
            navigator.clipboard.writeText(selectedDoc?.content || '');
            message.success('内容已复制到剪贴板');
          }}>
            复制内容
          </Button>,
          <Button key="close" type="primary" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedDoc && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <strong>文件名:</strong> {selectedDoc.filename}
            </div>
            <div>
              <strong>文件类型:</strong> {selectedDoc.file_type}
            </div>
            <div>
              <strong>文件大小:</strong> {formatFileSize(selectedDoc.file_size)}
            </div>
            <div>
              <strong>上传时间:</strong> {new Date(selectedDoc.created_at).toLocaleString('zh-CN')}
            </div>
            <div>
              <strong>文档内容:</strong>
              <div style={{
                marginTop: 8,
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 4,
                maxHeight: 400,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {selectedDoc.content}
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
