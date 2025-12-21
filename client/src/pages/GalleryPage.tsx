import { useState, useEffect } from 'react';
import { Card, Button, message, Space, Modal, Input, Upload, Empty, Row, Col, Tag } from 'antd';
import { PictureOutlined, PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { UploadFile } from 'antd';

interface Album {
  id: number;
  name: string;
  image_count: number;
  cover_image: string | null;
  created_at: string;
}

export default function GalleryPage() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      const response = await axios.get('/api/gallery/albums');
      setAlbums(response.data.albums);
    } catch (error) {
      console.error('加载相册失败:', error);
      message.error('加载相册失败');
    }
  };

  const handleCreateAlbum = async () => {
    if (!albumName.trim()) {
      message.warning('请输入相册名称');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', albumName.trim());
      
      // 添加图片文件
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('images', file.originFileObj);
        }
      });

      await axios.post('/api/gallery/albums', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      message.success('相册创建成功！');
      setCreateModalVisible(false);
      setAlbumName('');
      setFileList([]);
      loadAlbums();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建相册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlbum = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个相册吗？相册中的所有图片也会被删除，此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`/api/gallery/albums/${id}`);
          message.success('相册删除成功');
          loadAlbums();
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除相册失败');
        }
      }
    });
  };

  const handleEditAlbum = (id: number, currentName: string) => {
    let newName = currentName;
    
    Modal.confirm({
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
        
        try {
          await axios.patch(`/api/gallery/albums/${id}`, { name: newName.trim() });
          message.success('相册名称更新成功');
          loadAlbums();
        } catch (error: any) {
          message.error(error.response?.data?.error || '更新失败');
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建相册
          </Button>
        }
        bordered={false}
      >
        {albums.length === 0 ? (
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
                    album.cover_image ? (
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
                          src={`/uploads/gallery/${album.cover_image}`}
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
                          <Tag color="blue">{album.image_count} 张图片</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {new Date(album.created_at).toLocaleString('zh-CN')}
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
        confirmLoading={loading}
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
