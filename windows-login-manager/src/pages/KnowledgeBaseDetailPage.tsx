import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Space, Upload, Empty, Input, Tag, Tooltip, App, Modal } from 'antd';
import { BookOutlined, UploadOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ArrowLeftOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import ResizableTable from '../components/ResizableTable';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import type { UploadFile } from 'antd';

export default function KnowledgeBaseDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { message, modal } = App.useApp();
  
  const {
    currentKnowledgeBase,
    documents,
    currentDocument,
    loading,
    uploading,
    error,
    fetchKnowledgeBase,
    fetchDocuments,
    fetchDocument,
    uploadDocuments,
    deleteDocument,
    searchDocuments,
    clearError
  } = useKnowledgeStore();
  
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 初始加载
  useEffect(() => {
    if (id) {
      fetchKnowledgeBase(id);
      fetchDocuments(id);
    }
  }, [id, fetchKnowledgeBase, fetchDocuments]);

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError, message]);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    if (id) {
      await fetchKnowledgeBase(id);
      await fetchDocuments(id);
    }
  }, [id, fetchKnowledgeBase, fetchDocuments]);

  const handleUploadDocuments = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件');
      return;
    }

    try {
      // 使用文件路径传输（Electron 环境下 File 对象有 path 属性）
      const filesData = fileList.map((file) => {
        if (file.originFileObj) {
          const fileObj = file.originFileObj as any;
          return {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            path: fileObj.path // Electron 提供的文件路径
          };
        }
        return null;
      }).filter(f => f !== null);

      const success = await uploadDocuments(id!, filesData);
      
      if (success) {
        message.success('文档上传成功！');
        setUploadModalVisible(false);
        setFileList([]);
      }
    } catch (error: any) {
      message.error(error.message || '上传文档失败');
    }
  };

  const handleDeleteDocument = (docId: string, filename: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除文档"${filename}"吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        const success = await deleteDocument(docId);
        if (success) {
          message.success('文档删除成功');
        }
      }
    });
  };

  const handleViewDocument = async (docId: string) => {
    await fetchDocument(docId);
    setViewModalVisible(true);
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      if (id) {
        await fetchDocuments(id);
      }
      return;
    }

    if (id) {
      await searchDocuments(id, searchKeyword);
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

  // 获取文件扩展名显示
  const getFileExtension = (filename: string, fileType: string) => {
    // 优先从文件名获取扩展名
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    if (ext && ext !== filename) {
      return ext;
    }
    // 从 MIME 类型推断
    if (fileType.includes('wordprocessingml') || fileType.includes('msword')) return '.docx';
    if (fileType.includes('pdf')) return '.pdf';
    if (fileType.includes('text/plain')) return '.txt';
    if (fileType.includes('markdown')) return '.md';
    return fileType.split('/').pop()?.substring(0, 10) || '未知';
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      width: 250,
      align: 'center' as const,
      render: (text: string, record: any) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>{text}</span>
          <Tag color="blue">{getFileExtension(text, record.file_type)}</Tag>
        </Space>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      align: 'center' as const,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '内容预览',
      dataIndex: 'content_preview',
      key: 'content_preview',
      width: 300,
      align: 'center' as const,
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
      align: 'center' as const,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: any) => (
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
            <span>{currentKnowledgeBase?.name || '知识库详情'}</span>
            <Tag color="green">本地存储</Tag>
            {currentKnowledgeBase?.description && (
              <span style={{ fontSize: 14, color: '#666', fontWeight: 'normal' }}>
                - {currentKnowledgeBase.description}
              </span>
            )}
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="刷新数据">
              <Button icon={<ReloadOutlined spin={loading} />} onClick={handleRefresh} loading={loading}>
                刷新
              </Button>
            </Tooltip>
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
        variant="borderless"
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
          <ResizableTable
            tableId="knowledge-base-documents"
            columns={columns}
            dataSource={documents}
            rowKey="id"
            scroll={{ x: 800 }}
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
        confirmLoading={uploading}
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
        }}
        footer={[
          <Button key="copy" onClick={() => {
            navigator.clipboard.writeText(currentDocument?.content || '');
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
        {currentDocument && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <strong>文件名:</strong> {currentDocument.filename}
            </div>
            <div>
              <strong>文件类型:</strong> {currentDocument.file_type}
            </div>
            <div>
              <strong>文件大小:</strong> {formatFileSize(currentDocument.file_size)}
            </div>
            <div>
              <strong>上传时间:</strong> {new Date(currentDocument.created_at).toLocaleString('zh-CN')}
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
                {currentDocument.content}
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
