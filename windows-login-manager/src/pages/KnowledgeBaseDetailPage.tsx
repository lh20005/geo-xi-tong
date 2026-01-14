import { useState, useCallback, useMemo } from 'react';
import { Card, Button, Space, Upload, Empty, Input, Tag, Tooltip, App, Modal } from 'antd';
import { BookOutlined, UploadOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ArrowLeftOutlined, FileTextOutlined, CloudSyncOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import ResizableTable from '../components/ResizableTable';
import { ipcBridge } from '../services/ipc';
import type { UploadFile } from 'antd';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

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
  const { message, modal } = App.useApp();
  const { invalidateCacheByPrefix } = useCacheStore();
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [uploading, setUploading] = useState(false);

  // 生成缓存 key
  const cacheKey = useMemo(() => `knowledgeBaseDetail:${id}`, [id]);

  // 数据获取函数
  const fetchKnowledgeBase = useCallback(async () => {
    if (!id) return null;
    const res = await ipcBridge.getKnowledgeBase(parseInt(id));
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error || '加载失败');
  }, [id]);

  // 使用缓存 Hook
  const {
    data: knowledgeBase,
    loading: _loading,
    refreshing,
    refresh,
    isFromCache
  } = useCachedData<KnowledgeBase | null>(cacheKey, fetchKnowledgeBase, {
    deps: [id],
    onError: (error) => message.error(error.message || '加载知识库失败'),
  });
  void _loading; // 保留以备将来使用

  const documents = knowledgeBase?.documents || [];

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('knowledgeBase');
    await refresh(true);
  }, [invalidateCacheByPrefix, refresh]);

  const handleUploadDocuments = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件');
      return;
    }

    setUploading(true);
    try {
      console.log('=== 开始上传文件 ===');
      console.log('文件数量:', fileList.length);
      
      // 使用文件路径传输（Electron 环境下 File 对象有 path 属性）
      const filesData = fileList.map((file) => {
        if (file.originFileObj) {
          const fileObj = file.originFileObj as any;
          console.log('文件信息:', {
            name: file.name,
            type: file.type,
            size: file.size,
            hasPath: !!fileObj.path
          });
          
          return {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            path: fileObj.path // Electron 提供的文件路径
          };
        }
        return null;
      }).filter(f => f !== null);

      console.log('准备上传的文件:', filesData);
      
      const res = await ipcBridge.uploadKnowledgeBaseDocuments(parseInt(id!), filesData);
      
      console.log('上传响应:', res);
      
      if (!res.success) throw new Error(res.error || '上传失败');

      message.success(`成功上传 ${res.data?.uploadedCount || 0} 个文档！`);
      if (res.data?.errors && res.data.errors.length > 0) {
        res.data.errors.forEach((err: any) => {
          message.error(`${err.filename}: ${err.error}`);
        });
      }
      
      setUploadModalVisible(false);
      setFileList([]);
      invalidateAndRefresh();
    } catch (error: any) {
      console.error('上传失败:', error);
      // 处理存储空间不足的错误
      if (error.message && (error.message.includes('存储空间') || error.message.includes('配额'))) {
        message.error({
          content: `${error.message}。请前往个人中心购买存储空间。`,
          duration: 5
        });
      } else {
        message.error(error.message || '上传文档失败');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = (docId: number, filename: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除文档"${filename}"吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await ipcBridge.deleteKnowledgeBaseDocument(docId);
          if (!res.success) throw new Error(res.error || '删除失败');
          message.success('文档删除成功');
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.message || '删除文档失败');
        }
      }
    });
  };

  const handleViewDocument = async (docId: number) => {
    try {
      const res = await ipcBridge.getKnowledgeBaseDocument(docId);
      if (res.success && res.data) {
        setSelectedDoc(res.data);
        setViewModalVisible(true);
      } else {
        throw new Error(res.error || '获取失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取文档详情失败');
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      refresh(true);
      return;
    }

    try {
      const res = await ipcBridge.searchKnowledgeBaseDocuments(parseInt(id!), searchKeyword);
      if (res.success && res.data) {
        // 搜索结果不缓存，直接更新显示
        // 注意：这里我们不更新缓存，因为搜索结果是临时的
      } else {
        throw new Error(res.error || '搜索失败');
      }
    } catch (error: any) {
      message.error(error.message || '搜索失败');
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
      width: 250,
      align: 'center' as const,
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
            {isFromCache && !refreshing && (
              <Tooltip title="数据来自缓存">
                <Tag color="gold">缓存</Tag>
              </Tooltip>
            )}
            {refreshing && <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>}
            <Tooltip title="刷新数据">
              <Button icon={<ReloadOutlined spin={refreshing} />} onClick={() => refresh(true)}>
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
          <ResizableTable<KnowledgeDocument>
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
