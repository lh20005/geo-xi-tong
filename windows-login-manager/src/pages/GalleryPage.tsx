import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Space, Modal, Input, Upload, Empty, Row, Col, Tag, App } from 'antd';
import { PictureOutlined, PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, ReloadOutlined, CloudSyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGalleryStore } from '../stores/galleryStore';
import type { UploadFile } from 'antd';

export default function GalleryPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { 
    albums, 
    loading, 
    uploading,
    error,
    fetchAlbums, 
    createAlbum, 
    updateAlbum,
    deleteAlbum,
    clearError 
  } = useGalleryStore();
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 初始加载
  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError, message]);

  // 刷新数据
  const loadAlbums = useCallback(async () => {
    await fetchAlbums();
  }, [fetchAlbums]);

  const handleCreateAlbum = async () => {
    if (!albumName.trim()) {
      message.warning('请输入相册名称');
      return;
    }

    setSubmitting(true);
    try {
      // 创建相册
      const album = await createAlbum({ name: albumName.trim() });
      
      if (album) {
        // 如果有图片，上传图片
        if (fileList.length > 0) {
          const { uploadImages } = useGalleryStore.getState();
          // 提取可序列化的文件数据（Electron 环境下 File 对象有 path 属性）
          const filesData: Array<{ name: string; type: string; size: number; path: string }> = [];
          for (const file of fileList) {
            if (file.originFileObj) {
              const fileObj = file.originFileObj as any;
              const filePath = fileObj.path;
              if (filePath) {
                filesData.push({
                  name: file.name || fileObj.name,
                  type: file.type || fileObj.type || 'image/jpeg',
                  size: file.size || fileObj.size || 0,
                  path: filePath
                });
              }
            }
          }
          if (filesData.length > 0) {
            await uploadImages(album.id, filesData);
          }
        }
        
        message.success('相册创建成功！');
        setCreateModalVisible(false);
        setAlbumName('');
        setFileList([]);
      }
    } catch (error: any) {
      message.error(error.message || '创建相册失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAlbum = (id: string) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这个相册吗？相册中的所有图片也会被删除，此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        const success = await deleteAlbum(id);
        if (success) {
          message.success('相册删除成功');
        }
      }
    });
  };

  const handleEditAlbum = (id: string, currentName: string) => {
    let newName = currentName;
    
    modal.confirm({
      title: '编辑相册名称',
      content: (
        <Input
          defaultValue={currentName}
          placeholder="请输入新的相册名称"
          onChange={(e) => { newName = e.target.value; }}
          onPressEnter={(e) => {
            newName = (e.target as HTMLInputElement).value;
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        if (!newName || newName.trim() === '') {
          message.error('相册名称不能为空');
          return Promise.reject();
        }
        
        const success = await updateAlbum(id, { name: newName.trim() });
        if (success) {
          message.success('相册名称更新成功');
        } else {
          return Promise.reject();
        }
      }
    });
  };

  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片大小不能超过5MB！');
      return false;
    }
    return false; // 阻止自动上传
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <PictureOutlined style={{ color: '#52c41a' }} />
            <span>企业图库</span>
          </Space>
        }
        extra={
          <Space>
            {uploading && (
              <Tag icon={<CloudSyncOutlined spin />} color="processing">上传中</Tag>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAlbums}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建相册
            </Button>
          </Space>
        }
        variant="borderless"
      >
        {!albums || albums.length === 0 ? (
          <Empty
            description="暂无相册"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <p style={{ color: '#64748b' }}>
              点击"创建相册"按钮来创建第一个相册
            </p>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {albums.map((album) => (
              <Col xs={24} sm={12} md={8} lg={6} key={album.id}>
                <Card
                  hoverable
                  cover={
                    album.coverImage ? (
                      <div
                        style={{
                          height: 200,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f5f5f5'
                        }}
                      >
                        <img
                          alt={album.name}
                          src={window.electronAPI?.utils?.getLocalFileUrl?.(album.coverImage) || album.coverImage}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 200,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f5f5f5'
                        }}
                      >
                        <PictureOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                      </div>
                    )
                  }
                  onClick={() => navigate(`/gallery/${album.id}`)}
                >
                  <Card.Meta
                    title={<div style={{ textAlign: 'center' }}>{album.name}</div>}
                    description={
                      <Space direction="vertical" style={{ width: '100%' }} align="center">
                        <div>
                          <Tag color="blue">{album.imageCount || 0} 张图片</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {(() => {
                            const dateStr = album.createdAt || album.created_at;
                            if (!dateStr) return '未知时间';
                            const date = new Date(dateStr);
                            return isNaN(date.getTime()) ? '未知时间' : date.toLocaleString('zh-CN');
                          })()}
                        </div>
                        <Space>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/gallery/${album.id}`);
                            }}
                          >
                            查看
                          </Button>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditAlbum(album.id, album.name);
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
                              handleDeleteAlbum(album.id);
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
        title="创建相册"
        open={createModalVisible}
        onOk={handleCreateAlbum}
        onCancel={() => {
          setCreateModalVisible(false);
          setAlbumName('');
          setFileList([]);
        }}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>相册名称</label>
            <Input
              placeholder="请输入相册名称"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <label>上传图片（可选）</label>
            <Upload
              listType="picture-card"
              fileList={fileList}
              beforeUpload={beforeUpload}
              onChange={({ fileList }) => setFileList(fileList)}
              multiple
              accept="image/*"
              style={{ marginTop: 8 }}
            >
              {fileList.length < 10 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
              支持JPEG、PNG、GIF、WebP格式，单张图片不超过5MB
            </div>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
