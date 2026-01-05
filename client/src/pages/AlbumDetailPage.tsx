import { useState, useEffect } from 'react';
import { Card, Button, Space, Modal, Upload, Empty, Image, Row, Col, Input, App } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { UploadFile } from 'antd';

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
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { albumId } = useParams<{ albumId: string }>();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (albumId) {
      loadAlbumDetail(parseInt(albumId));
    }
  }, [albumId]);

  const loadAlbumDetail = async (id: number) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/gallery/albums/${id}`);
      setAlbum(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载相册失败');
      if (error.response?.status === 404) {
        navigate('/gallery');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImages = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的图片');
      return;
    }

    setLoading(true);
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
          setLoading(false);
          modal.error({
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
        console.log('[AlbumDetail] 配额检查错误:', quotaError);
        console.log('[AlbumDetail] 错误状态:', quotaError.response?.status);
        console.log('[AlbumDetail] 错误数据:', quotaError.response?.data);
        
        if (quotaError.response?.status === 403) {
          const errorData = quotaError.response.data;
          setLoading(false);
          modal.error({
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
      loadAlbumDetail(parseInt(albumId!));
    } catch (error: any) {
      // 处理存储空间不足的错误
      if (error.response?.status === 403 && error.response?.data?.needUpgrade) {
        const errorData = error.response.data;
        modal.error({
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
        message.error(error.response?.data?.error || '上传图片失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = (imageId: number) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这张图片吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/gallery/images/${imageId}`);
          message.success('图片删除成功');
          loadAlbumDetail(parseInt(albumId!));
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除图片失败');
        }
      }
    });
  };

  const handleEditAlbum = () => {
    if (!album) return;
    
    let newName = album.name;
    
    modal.confirm({
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
          loadAlbumDetail(parseInt(albumId!));
        } catch (error: any) {
          message.error(error.response?.data?.error || '更新失败');
          return Promise.reject();
        }
      }
    });
  };

  const handleDeleteAlbum = () => {
    modal.confirm({
      title: '确认删除相册',
      content: '确定要删除这个相册吗？相册中的所有图片也会被删除，此操作不可恢复。',
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/gallery/albums/${albumId}`);
          message.success('相册删除成功');
          navigate('/gallery');
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除相册失败');
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
          </Space>
        }
        extra={
          <Space>
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
        {album && album.images.length === 0 ? (
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
              {album?.images.map((image) => (
                <Col xs={12} sm={8} md={6} lg={4} key={image.id}>
                  <div style={{ position: 'relative' }}>
                    <Image
                      src={`/uploads/gallery/${image.filepath}`}
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
        confirmLoading={loading}
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
