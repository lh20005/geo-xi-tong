import { Table, Button, Space, Empty } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ArticleSetting } from '../types/articleSettings';

interface ArticleSettingListProps {
  settings: ArticleSetting[];
  loading: boolean;
  onEdit: (setting: ArticleSetting) => void;
  onView: (setting: ArticleSetting) => void;
  onDelete: (id: number) => void;
}

export default function ArticleSettingList({
  settings,
  loading,
  onEdit,
  onView,
  onDelete,
}: ArticleSettingListProps) {
  const columns: ColumnsType<ArticleSetting> = [
    {
      title: '设置名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '提示词预览',
      dataIndex: 'prompt',
      key: 'prompt',
      ellipsis: true,
      render: (text: string) => {
        const preview = text.length > 80 ? text.substring(0, 80) + '...' : text;
        return <span style={{ color: '#666' }}>{preview}</span>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
          >
            查看详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={settings}
      loading={loading}
      rowKey="id"
      pagination={false}
      locale={{
        emptyText: (
          <Empty
            description="暂无文章设置"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ),
      }}
    />
  );
}
