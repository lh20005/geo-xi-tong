import { useState, useEffect, useCallback } from 'react';
import { Card, Button, message, Space, Modal, Upload, Empty, Image, Row, Col, Input, Tag } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useGalleryStore } from '../stores/galleryStore';
import type { UploadFile } from 'antd';

export default function AlbumDetailPage() {
  const navigate = useNavigate();
  const { albumId: albumIdParam } = useParams<{ albumId: string }>();
  const albumId = albumIdParam ? parseInt(albumIdParam, 10) : undefined;
  
  const {
    currentAlbum,
    images,
    loading,
    uploading,
    error,
    fetchAlbum,
    fetchImages,
    uploadImages,
    deleteImage,
    updateAlbum,
    deleteAlbum,
    clearError
  } = useGalleryStore();
  
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 初始加载
  useEffect(() => {
    if (albumId) {
      fetchAlbum(albumId);
      fetchImages(albumId);
    }
  }, [albumId, fetchAlbum, fetchImages]);

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    if (albumId) {
      await fetchAlbum(albumId);
      await fetchImages(albumId);
    }
  }, [albumId, fetchAlbum, fetchImages]);


  const handleUploadImages = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的图片');
      return;
    }

    try {
      // 使用文件路径传输（Electron 环境下 File 对象有 path 属性）
      // 注意：必须只传递可序列化的数据，不能传递 File 对象本身
      const filesData: Array<{ name: string; type: string; size: number; path: string }> = [];
      
      for (const file of fileList) {
        if (file.originFileObj) {
          const fileObj = file.originFileObj as any;
          // Electron 环境下，File 对象有 path 属性
          const filePath = fileObj.path;
          if (filePath) {
            filesData.push({
              name: file.name || fileObj.name,
              type: file.type || fileObj.type || 'image/jpeg',
              size: file.size || fileObj.size || 0,
              path: filePath
            });
          } else {
            console.warn('File does not have path property:', file.name);
          }
        }
      }

      if (filesData.length === 0) {
        message.error('无法获取文件路径，请确保在 Electron 环境中运行');
        return;
      }

      const success = await uploadImages(albumId!, filesData);
      
      if (success) {
        message.success(`成功上传 ${filesData.length} 张图片！`);
        setUploadModalVisible(false);
        setFileList([]);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      message.error(error.message || '上传图片失败');
    }
  };

  const handleDeleteImage = (imageId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这张图片吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        const success = await deleteImage(imageId);
        if (success) {
          message.success('图片删除成功');
        }
      }
    });
  };

  const handleEditAlbum = () => {
    if (!currentAlbum) return;
    
    let newName = currentAlbum.name;
    
    Modal.confirm({
      title: '编辑相册名称',
      content: (
        <Input
          defaultValue={currentAlbum.name}
          placeholder="请输入新的相册名称"
          onChange={(e) => { newName = e.target.value; }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        if (!newName || newName.trim() === '') {
          message.error('相册名称不能为空');
          return Promise.reject();
        }
        
        const success = await updateAlbum(albumId!, { name: newName.trim() });
        if (success) {
          message.success('相册名称更新成功');
        }
      }
    });
  };

  const handleDeleteAlbum = () => {
    Modal.confirm({
      title: '确认删除相册',
      content: '确定要删除这个相册吗？相册中的所有图片也会被删除，此操作不可恢复。',
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        const success = await deleteAlbum(albumId!);
        if (success) {
          message.success('相册删除成功');
          navigate('/gallery');
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
    return false;
  };

  // 获取本地图片路径
  const getImageSrc = (image: any) => {
    // 使用自定义协议安全加载本地图片
    if (image.filepath && window.electronAPI?.utils?.getLocalFileUrl) {
      return window.electronAPI.utils.getLocalFileUrl(image.filepath);
    }
    return '';
  };

  if (!currentAlbum && !loading) {
    return null;
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/gallery')}
            >
              返回
            </Button>
            <span>{currentAlbum?.name || '加载中...'}</span>
            <Tag color="green">本地存储</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传图片
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={handleEditAlbum}
            >
              编辑名称
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteAlbum}
            >
              删除相册
            </Button>
          </Space>
        }
        loading={loading}
        variant="borderless"
      >
        {images.length === 0 ? (
          <Empty
            description="相册中还没有图片"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传图片
            </Button>
          </Empty>
        ) : (
          <Image.PreviewGroup>
            <Row gutter={[16, 16]}>
              {images.map((image) => (
                <Col xs={12} sm={8} md={6} lg={4} key={image.id}>
                  <div style={{ position: 'relative' }}>
                    <Image
                      src={getImageSrc(image)}
                      alt={image.filename}
                      style={{
                        width: '100%',
                        height: 150,
                        objectFit: 'cover',
                        borderRadius: 8
                      }}
                    />
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8
                      }}
                      onClick={() => handleDeleteImage(image.id)}
                    >
                      删除
                    </Button>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#999',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {image.filename}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>
        )}
      </Card>

      <Modal
        title="上传图片"
        open={uploadModalVisible}
        onOk={handleUploadImages}
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
          <Upload
            listType="picture-card"
            fileList={fileList}
            beforeUpload={beforeUpload}
            onChange={({ fileList }) => setFileList(fileList)}
            multiple
            accept="image/*"
          >
            {fileList.length < 20 && (
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>选择图片</div>
              </div>
            )}
          </Upload>
          <div style={{ color: '#999', fontSize: 12 }}>
            支持JPEG、PNG、GIF、WebP格式，单张图片不超过5MB，最多一次上传20张
          </div>
        </Space>
      </Modal>
    </div>
  );
}
