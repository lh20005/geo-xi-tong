// 备份时间: 2026-01-22
// 原路径: client/src/components/Publishing/PublishingConfigModal.tsx
// 删除原因: Web 端发布功能已废弃，所有发布任务统一通过 Electron 桌面应用的 PublishingTasksPage 完成

import { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Space, message, Alert, Tag, Table, Checkbox, Typography } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { 
  getPlatforms, 
  getAccounts, 
  createPublishingTask,
  Platform, 
  Account 
} from '../../api/publishing';
import { getArticles, Article } from '../../api/articles';

const { Option } = Select;
const { Text } = Typography;

interface PublishingConfigModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PublishingConfigModal({
  visible,
  onSuccess,
  onCancel
}: PublishingConfigModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [boundPlatforms, setBoundPlatforms] = useState<Platform[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [platformAccounts, setPlatformAccounts] = useState<Account[]>([]);
  const [publishType, setPublishType] = useState<'immediate' | 'scheduled'>('immediate');
  
  // 文章列表相关状态
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());
  const [articlePage, setArticlePage] = useState(1);
  const [articlePageSize, setArticlePageSize] = useState(5);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleLoading, setArticleLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
      loadArticles();
    } else {
      // 关闭时重置状态
      setSelectedArticleIds(new Set());
      setArticlePage(1);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      loadArticles();
    }
  }, [articlePage, articlePageSize, visible]);

  useEffect(() => {
    if (selectedPlatform) {
      const filtered = accounts.filter(acc => acc.platform_id === selectedPlatform);
      setPlatformAccounts(filtered);
      
      // 自动选择默认账号
      const defaultAccount = filtered.find(acc => acc.is_default);
      if (defaultAccount) {
        form.setFieldsValue({ account_id: defaultAccount.id });
      }
    } else {
      setPlatformAccounts([]);
    }
  }, [selectedPlatform, accounts]);

  const loadData = async () => {
    try {
      const [platformsData, accountsData] = await Promise.all([
        getPlatforms(),
        getAccounts()
      ]);
      
      setAccounts(accountsData);
      
      // 筛选已绑定账号的平台
      const boundPlatformIds = new Set(accountsData.map(acc => acc.platform_id));
      const bound = platformsData.filter(p => boundPlatformIds.has(p.platform_id));
      setBoundPlatforms(bound);
      
    } catch (error) {
      message.error('加载数据失败');
      console.error('加载数据失败:', error);
    }
  };

  const loadArticles = async () => {
    setArticleLoading(true);
    try {
      const response = await getArticles(articlePage, articlePageSize, {});
      setArticles(response.articles || []);
      setArticleTotal(response.total || 0);
    } catch (error: any) {
      message.error(error.message || '加载文章列表失败');
    } finally {
      setArticleLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (selectedArticleIds.size === 0) {
        message.warning('请先选择要发布的文章');
        return;
      }

      const values = await form.validateFields();
      setLoading(true);

      // 为每篇文章创建发布任务
      const tasks = Array.from(selectedArticleIds).map(articleId => ({
        article_id: articleId,
        platform_id: values.platform_id,
        account_id: values.account_id,
        scheduled_time: publishType === 'scheduled' && values.scheduled_time 
          ? values.scheduled_time.toISOString() 
          : null,
        config: {
          title: values.custom_title || undefined,
          category: values.category || undefined,
          tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()) : undefined,
        }
      }));

      // 批量创建任务
      await Promise.all(tasks.map(task => createPublishingTask(task)));

      message.success(`成功创建 ${tasks.length} 个发布任务`);
      form.resetFields();
      setSelectedArticleIds(new Set());
      onSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.message || '创建发布任务失败');
      console.error('创建发布任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedPlatform(null);
    setPublishType('immediate');
    setSelectedArticleIds(new Set());
    setArticlePage(1);
    onCancel();
  };

  const handleSelectAllArticles = (checked: boolean) => {
    if (checked) {
      const currentPageIds = articles.map(a => a.id);
      setSelectedArticleIds(new Set([...selectedArticleIds, ...currentPageIds]));
    } else {
      const currentPageIds = new Set(articles.map(a => a.id));
      setSelectedArticleIds(new Set([...selectedArticleIds].filter(id => !currentPageIds.has(id))));
    }
  };

  const handleSelectOneArticle = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedArticleIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedArticleIds(newSelected);
  };

  const disabledDate = (current: Dayjs) => {
    // 不能选择过去的日期
    return current && current < dayjs().startOf('day');
  };

  const disabledTime = (current: Dayjs | null) => {
    if (!current) return {};
    
    const now = dayjs();
    if (current.isSame(now, 'day')) {
      // 如果是今天，禁用已过去的时间
      return {
        disabledHours: () => Array.from({ length: now.hour() }, (_, i) => i),
        disabledMinutes: (selectedHour: number) => {
          if (selectedHour === now.hour()) {
            return Array.from({ length: now.minute() + 1 }, (_, i) => i);
          }
          return [];
        },
      };
    }
    return {};
  };

  const isAllSelected = articles.length > 0 && articles.every(a => selectedArticleIds.has(a.id));
  const isSomeSelected = articles.some(a => selectedArticleIds.has(a.id)) && !isAllSelected;

  const articleColumns = [
    {
      title: (
        <Checkbox
          checked={isAllSelected}
          indeterminate={isSomeSelected}
          onChange={(e) => handleSelectAllArticles(e.target.checked)}
        />
      ),
      key: 'checkbox',
      width: 50,
      align: 'center' as const,
      render: (_: any, record: Article) => (
        <Checkbox
          checked={selectedArticleIds.has(record.id)}
          onChange={(e) => handleSelectOneArticle(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '转化目标',
      dataIndex: 'conversionTargetName',
      key: 'conversionTargetName',
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="orange">{text}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '文章设置',
      dataIndex: 'articleSettingName',
      key: 'articleSettingName',
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="purple">{text}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      align: 'center' as const,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '蒸馏结果',
      dataIndex: 'topicQuestion',
      key: 'topicQuestion',
      align: 'center' as const,
      render: (text: string) => text ? <Tag color="green">{text}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '发布状态',
      dataIndex: 'isPublished',
      key: 'isPublished',
      align: 'center' as const,
      render: (isPublished: boolean) => {
        if (isPublished) {
          return <Tag color="success">已发布</Tag>;
        }
        return <Tag color="default">草稿</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center' as const,
      render: (text: string) => new Date(text).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
    },
  ];

  return (
    <Modal
      title="发布文章到平台"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={1200}
      destroyOnClose
      okText={`创建发布任务 ${selectedArticleIds.size > 0 ? `(${selectedArticleIds.size} 篇)` : ''}`}
      cancelText="取消"
      okButtonProps={{ disabled: selectedArticleIds.size === 0 }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          background: '#f8fafc', 
          padding: 16, 
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Text strong style={{ fontSize: 16 }}>
            选择要发布的文章
          </Text>
          <Text type="secondary">
            已选择 <Text strong style={{ color: '#1890ff' }}>{selectedArticleIds.size}</Text> 篇文章
          </Text>
        </div>

        <div style={{ overflow: 'visible' }}>
          <Table
            columns={articleColumns}
            dataSource={articles}
            rowKey="id"
            loading={articleLoading}
            pagination={{
              current: articlePage,
              pageSize: articlePageSize,
              total: articleTotal,
              onChange: (newPage, newPageSize) => {
                setArticlePage(newPage);
                if (newPageSize && newPageSize !== articlePageSize) {
                  setArticlePageSize(newPageSize);
                  setArticlePage(1);
                }
              },
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 篇文章`,
              pageSizeOptions: ['5', '10', '20'],
              size: 'default',
              position: ['bottomCenter']
            }}
            size="small"
          />
        </div>
      </div>

      {boundPlatforms.length === 0 && (
        <Alert
          message="暂无可用平台"
          description="请先在【平台登录管理】页面绑定至少一个平台账号"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <div style={{ 
        background: '#f8fafc', 
        padding: 16, 
        borderRadius: 8,
        marginBottom: 16
      }}>
        <Text strong style={{ fontSize: 16 }}>发布配置</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          label="选择平台"
          name="platform_id"
          rules={[{ required: true, message: '请选择发布平台' }]}
        >
          <Select
            placeholder="请选择发布平台"
            onChange={setSelectedPlatform}
            disabled={boundPlatforms.length === 0}
          >
            {boundPlatforms.map(platform => (
              <Option key={platform.platform_id} value={platform.platform_id}>
                {platform.platform_name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {selectedPlatform && (
          <Form.Item
            label="选择账号"
            name="account_id"
            rules={[{ required: true, message: '请选择发布账号' }]}
          >
            <Select placeholder="请选择发布账号">
              {platformAccounts.map(account => (
                <Option key={account.id} value={account.id}>
                  <Space>
                    {account.account_name}
                    {account.is_default && <Tag color="gold">默认</Tag>}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item label="发布时间">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              value={publishType}
              onChange={setPublishType}
              style={{ width: '100%' }}
            >
              <Option value="immediate">
                <Space>
                  <ThunderboltOutlined />
                  立即发布
                </Space>
              </Option>
              <Option value="scheduled">
                <Space>
                  <ClockCircleOutlined />
                  定时发布
                </Space>
              </Option>
            </Select>

            {publishType === 'scheduled' && (
              <Form.Item
                name="scheduled_time"
                rules={[{ required: true, message: '请选择发布时间' }]}
                style={{ marginBottom: 0 }}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  placeholder="选择发布时间"
                  style={{ width: '100%' }}
                  disabledDate={disabledDate}
                  disabledTime={disabledTime}
                />
              </Form.Item>
            )}
          </Space>
        </Form.Item>

        <Form.Item
          label="自定义标题（可选）"
          name="custom_title"
          extra="留空则使用文章原标题"
        >
          <Input placeholder="输入自定义标题" maxLength={100} />
        </Form.Item>

        <Form.Item
          label="分类（可选）"
          name="category"
          extra="根据平台要求填写"
        >
          <Input placeholder="例如：科技、生活、教育等" maxLength={50} />
        </Form.Item>

        <Form.Item
          label="标签（可选）"
          name="tags"
          extra="多个标签用逗号分隔"
        >
          <Input placeholder="例如：人工智能,机器学习,深度学习" maxLength={200} />
        </Form.Item>

        <Alert
          message="发布说明"
          description={
            <div>
              <div>• 系统将自动使用浏览器模拟登录并发布文章</div>
              <div>• 定时发布任务将在指定时间自动执行</div>
              <div>• 发布过程和结果可在"发布记录"页面查看</div>
              <div>• 如果发布失败，系统会自动重试最多3次</div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Form>
    </Modal>
  );
}
