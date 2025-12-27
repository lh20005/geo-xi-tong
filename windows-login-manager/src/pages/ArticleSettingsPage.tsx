import { useState, useEffect } from 'react';
import { Button, Card, Pagination, message, Space, Empty, Modal } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import ArticleSettingList from '../components/ArticleSettingList';
import ArticleSettingModal from '../components/ArticleSettingModal';
import type { ArticleSetting, ArticleSettingFormData } from '../types/articleSettings';
import {
  fetchArticleSettings,
  createArticleSetting,
  updateArticleSetting,
  deleteArticleSetting,
} from '../api/articleSettings';

export default function ArticleSettingsPage() {
  const [settings, setSettings] = useState<ArticleSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedSetting, setSelectedSetting] = useState<ArticleSetting | null>(null);

  // 获取文章设置列表
  const loadSettings = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const response = await fetchArticleSettings(page, pageSize);
      setSettings(response.settings);
      setTotal(response.total);
      setCurrentPage(response.page);
    } catch (error: any) {
      message.error(error.message || '获取文章设置列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // 处理创建
  const handleCreate = () => {
    setModalMode('create');
    setSelectedSetting(null);
    setModalVisible(true);
  };

  // 处理编辑
  const handleEdit = (setting: ArticleSetting) => {
    setModalMode('edit');
    setSelectedSetting(setting);
    setModalVisible(true);
  };

  // 处理查看
  const handleView = (setting: ArticleSetting) => {
    setModalMode('view');
    setSelectedSetting(setting);
    setModalVisible(true);
  };

  // 处理删除
  const handleDelete = (id: number) => {
    const setting = settings.find(s => s.id === id);
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文章设置"${setting?.name}"吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteArticleSetting(id);
          message.success('删除成功');
          
          // 如果当前页没有数据了，返回上一页
          if (settings.length === 1 && currentPage > 1) {
            loadSettings(currentPage - 1);
          } else {
            loadSettings();
          }
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      }
    });
  };

  // 处理提交
  const handleSubmit = async (data: ArticleSettingFormData) => {
    try {
      if (modalMode === 'create') {
        await createArticleSetting(data);
        message.success('创建成功');
        // 创建后跳转到第一页
        setCurrentPage(1);
        loadSettings(1);
      } else if (modalMode === 'edit' && selectedSetting) {
        await updateArticleSetting(selectedSetting.id, data);
        message.success('更新成功');
        loadSettings();
      }
      setModalVisible(false);
      setSelectedSetting(null);
    } catch (error: any) {
      throw error; // 让Modal组件处理错误显示
    }
  };

  // 处理取消
  const handleCancel = () => {
    setModalVisible(false);
    setSelectedSetting(null);
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadSettings(page);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <EditOutlined style={{ color: '#1890ff' }} />
            <span>文章设置</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建文章设置
          </Button>
        }
        bordered={false}
      >
        {settings.length === 0 && !loading ? (
          <Empty
            description="暂无文章设置"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <p style={{ color: '#64748b' }}>
              点击"新建文章设置"按钮来创建第一个文章设置模板
            </p>
          </Empty>
        ) : (
          <>
            <ArticleSettingList
              settings={settings}
              loading={loading}
              onEdit={handleEdit}
              onView={handleView}
              onDelete={handleDelete}
            />

            {total > 0 && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={total}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  showTotal={(total) => `共 ${total} 条记录`}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <ArticleSettingModal
        visible={modalVisible}
        mode={modalMode}
        setting={selectedSetting}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
