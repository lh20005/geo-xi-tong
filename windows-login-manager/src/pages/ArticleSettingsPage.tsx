import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Pagination, message, Space, Empty, Modal, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, CloudSyncOutlined } from '@ant-design/icons';
import ArticleSettingList from '../components/ArticleSettingList';
import ArticleSettingModal from '../components/ArticleSettingModal';
import type { ArticleSetting, ArticleSettingFormData } from '../types/articleSettings';
import {
  fetchArticleSettings,
  createArticleSetting,
  updateArticleSetting,
  deleteArticleSetting,
} from '../api/articleSettings';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

export default function ArticleSettingsPage() {
  const { invalidateCacheByPrefix } = useCacheStore();
  const [settings, setSettings] = useState<ArticleSetting[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedSetting, setSelectedSetting] = useState<ArticleSetting | null>(null);

  // 生成缓存 key
  const cacheKey = useMemo(() => 
    `articleSettings:list:${currentPage}:${pageSize}`,
    [currentPage, pageSize]
  );

  // 数据获取函数
  const fetchData = useCallback(async () => {
    const response = await fetchArticleSettings(currentPage, pageSize);
    return response;
  }, [currentPage, pageSize]);

  // 使用缓存 Hook
  const {
    data: cachedData,
    loading,
    refreshing,
    refresh: refreshSettings,
    isFromCache
  } = useCachedData(cacheKey, fetchData, {
    deps: [currentPage, pageSize],
    onError: (error) => message.error(error.message || '获取文章设置列表失败'),
  });

  // 处理缓存数据
  useEffect(() => {
    if (cachedData) {
      setSettings(cachedData.settings || []);
      setTotal(cachedData.total || 0);
    }
  }, [cachedData]);

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('articleSettings:');
    await refreshSettings(true);
  }, [invalidateCacheByPrefix, refreshSettings]);

  // 获取文章设置列表
  const loadSettings = useCallback(async (page: number = currentPage) => {
    if (page !== currentPage) {
      setCurrentPage(page);
    } else {
      await refreshSettings(true);
    }
  }, [currentPage, refreshSettings]);

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
            setCurrentPage(currentPage - 1);
          }
          invalidateAndRefresh();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      }
    });
  };

  // 处理提交
  const handleSubmit = async (data: ArticleSettingFormData) => {
    if (modalMode === 'create') {
      await createArticleSetting(data);
      message.success('创建成功');
      setCurrentPage(1);
      invalidateAndRefresh();
    } else if (modalMode === 'edit' && selectedSetting) {
      await updateArticleSetting(selectedSetting.id, data);
      message.success('更新成功');
      invalidateAndRefresh();
    }
    setModalVisible(false);
    setSelectedSetting(null);
  };

  // 处理取消
  const handleCancel = () => {
    setModalVisible(false);
    setSelectedSetting(null);
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <EditOutlined style={{ color: '#1890ff' }} />
            <span>文章设置</span>
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建文章设置
          </Button>
        }
        variant="borderless"
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
