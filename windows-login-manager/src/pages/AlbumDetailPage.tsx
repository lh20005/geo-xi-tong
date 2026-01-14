import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, message, Space, Modal, Upload, Empty, Image, Row, Col, Input, Tag, Tooltip } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, EditOutlined, CloudSyncOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { API_BASE_URL } from '../config/env';
import type { UploadFile } from 'antd';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

interface ImageData {
  id: number;
  filename: string;
  filepath: string;
  mime_type: string;
  size: number;
  created_at: string;
}

interface AlbumDetail {
  id: number;
  name: string;
  created_at: string;
  images: ImageData[];
}

export default function AlbumDetailPage() {
  const navigate = useNavigate();
  const { albumId } = useParams<{ albumId: string }>();
  const { invalidateCacheByPrefix } = useCacheStore();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // 生成缓存 key
  const cacheKey = useMemo(() => 
    `albumDetail:${albumId}`,
    [albumId]
  );

  // 数据获取函数
  const fetchData = useCallback(async () => {
    if (!albumId) return null;
    const response = await apiClient.get(`/gallery/albums/${albumId}`);
    const albumData = response.data;
    
    // 确保images属性存在
    if (!albumData.images) {
      albumData.images = [];
    }
    
    return albumData;
  }, [albumId]);

  // 使用缓存 Hook
  const {
    data: cachedData,
    loading,
    refreshing,
    refresh: refreshAlbum,
    isFromCache
  } = useCachedData<AlbumDetail | null>(cacheKey, fetchData, {
    deps: [albumId],
    autoFetch: !!albumId,
    onError: (error) => {
      message.error(error.message || '加载相册失败');
      if (error.message?.includes('404') || error.message?.includes('不存在')) {
        navigate('/gallery');
      }
    },
  });

  // 处理缓存数据
  useEffect(() => {
    if (cachedData) {
      setAlbum(cachedData);
    }
  }, [cachedData]);

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('albumDetail:');
    invalidateCacheByPrefix('gallery:');
    await refreshAlbum(true);
  }, [invalidateCacheByPrefix, refreshAlbum]);

  const handleUploadImages = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的图片');
      return;
    }

    setUploading(true);
    try {
      // 计算总文件大小
      const totalSize = fileList.reduce((sum, file) => {
        return sum + (file.originFileObj?.size || 0);
      }, 0);

      // 检查配额
      try {
        const quotaCheck = await apiClient.post('/storage/check-quota', {
          fileSizeBytes: totalSize,
          resourceType: 'image'
        });

        if (!quotaCheck.data.success || !quotaCheck.data.data?.allowed) {
          const errorMsg = quotaCheck.data.data?.reason || '存储空间不足，无法上传图片';
          setUploading(false);
          Modal.error({
            title: '存储空间不足：请升级套餐',
            closable: true,
            content: (
              <div>
                <p>{errorMsg}</p>
                <p style={{ marginTop: 8 }}>请前往个人中心购买存储空间或升级套餐。</p>
              </div>
            ),
            okText: '前往个人中心',
            onOk: () => navigate('/user-center')
          });
          return;
        }
      } catch (quotaError: any) {
        // 处理配额检查失败（403 表示配额不足）
        if (quotaError.response?.status === 403) {
          const errorData = quotaError.response.data;
          setUploading(false);
          Modal.error({
            title: '存储空间不足：请升级套餐',
            closable: true,
            content: (
              <div>
                <p>存储空间不足，无法上传图片。</p>
                <p style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                  {errorData.message || errorData.data?.reason || '请升级套餐以获取更多存储空间'}
                </p>
              </div>
            ),
            okText: '前往个人中心',
            onOk: () => navigate('/user-center')
          });
          return;
        }
        throw quotaError;
      }

      const formData = new FormData();
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('images', file.originFileObj);
        }
      });

      await apiClient.post(`/gallery/albums/${albumId}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      message.success(`成功上传 ${fileList.length} 张图片！`);
      setUploadModalVisible(false);
      setFileList([]);
      invalidateAndRefresh();
    } catch (error: any) {
      // 处理存储空间不足的错误
      if (error.response?.status === 403 && error.response?.data?.needUpgrade) {
        const errorData = error.response.data;
        Modal.error({
          title: '存储空间不足',
          content: (
            <div>
              <p>{errorData.error}</p>
              <p style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                {errorData.reason}
              </p>
            </div>
          ),
          okText: '前往个人中心',
          onOk: () => navigate('/user-center')
        });
      } else {
        message.error(error.message || '上传图片失败');
      }
    } finally {
      setUploading(false);
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
        try {
          await apiClient.delete(`/gallery/images/${imageId}`);
          message.success('图片删除成功');
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.message || '删除图片失败');
        }
      }
    });
  };

  const handleEditAlbum = () => {
    if (!album) return;
    
    let newName = album.name;
    
    Modal.confirm({
      title: '编辑相册名称',
      content: (
        <Input
          defaultValue={album.name}
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
        
        try {
          await apiClient.patch(`/gallery/albums/${albumId}`, { name: newName.trim() });
          message.success('相册名称更新成功');
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.message || '更新失败');
          return Promise.reject();
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
        try {
          await apiClient.delete(`/gallery/albums/${albumId}`);
          message.success('相册删除成功');
          invalidateCacheByPrefix('gallery:');
          navigate('/gallery');
        } catch (error: any) {
          message.error(error.message || '删除相册失败');
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

  if (!album && !loading) {
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
            <span>{album?.name || '加载中...'}</span>
            {isFromCache && !refreshing && (
              <Tooltip title="数据来自缓存">
                <Tag color="gold">缓存</Tag>
              </Tooltip>
            )}
            {refreshing && (
              <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refreshAlbum(true)}
              loading={refreshing}
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
        {album && (!album.images || album.images.length === 0) ? (
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
              {(album?.images || []).map((image) => (
                <Col xs={12} sm={8} md={6} lg={4} key={image.id}>
                  <div style={{ position: 'relative' }}>
                    <Image
                      src={`${API_BASE_URL}/uploads/gallery/${image.filepath}`}
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
