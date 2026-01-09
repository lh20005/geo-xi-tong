import { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, message, Space, Button, Popconfirm, Tag, Statistic } from 'antd';
import { DeleteOutlined, StarFilled, ReloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { getPlatforms, getAccounts, Platform, Account, deleteAccount } from '../api/publishing';
import ResizableTable from '../components/ResizableTable';

// const { Title } = Typography;

export default function PlatformManagementPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [platformsData, accountsData] = await Promise.all([
        getPlatforms(),
        getAccounts()
      ]);
      setPlatforms(platformsData);
      setAccounts(accountsData);
    } catch (error) {
      message.error('加载数据失败');
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: number) => {
    try {
      console.log('[删除账号] 开始删除账号:', accountId);
      await deleteAccount(accountId);
      console.log('[删除账号] 删除成功，显示成功提示');
      message.success('账号删除成功');
      console.log('[删除账号] 开始刷新数据');
      await loadData();
      console.log('[删除账号] 数据刷新完成');
    } catch (error: any) {
      console.error('[删除账号] 删除失败:', error);
      const errorMessage = error?.message || '账号删除失败';
      message.error(errorMessage);
    }
  };

  // 统计数据
  const stats = {
    totalPlatforms: platforms.length,
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter(a => a.status === 'active').length
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  const columns = [
    {
      title: '平台',
      dataIndex: 'platform_name',
      key: 'platform_name',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: Account) => {
        const platform = platforms.find(p => p.platform_id === record.platform_id);
        return <Tag color="blue" style={{ fontSize: 14 }}>{platform?.platform_name || record.platform_id}</Tag>;
      }
    },
    {
      title: '真实用户名',
      dataIndex: 'real_username',
      key: 'real_username',
      width: 180,
      align: 'center' as const,
      render: (text: string, record: Account) => (
        <Space>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1890ff' }}>
            {text || record.account_name || '未知'}
          </span>
          {record.is_default && <StarFilled style={{ color: '#faad14' }} />}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => (
        <Tag color={
          status === 'active' ? 'success' : 
          status === 'expired' ? 'error' : 
          status === 'error' ? 'error' : 
          'default'
        }>
          {status === 'active' ? '正常' : 
           status === 'expired' ? '已掉线' : 
           status === 'error' ? '已掉线' : 
           '未激活'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      align: 'center' as const,
      render: (date: string) => (
        <span style={{ fontSize: 14 }}>{new Date(date).toLocaleString('zh-CN')}</span>
      )
    },
    {
      title: '最后使用',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      width: 170,
      align: 'center' as const,
      render: (date: string) => (
        <span style={{ fontSize: 14, color: date ? '#1e293b' : '#94a3b8' }}>
          {date ? new Date(date).toLocaleString('zh-CN') : '未使用'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: Account) => (
        <Popconfirm
          title="确定要删除这个账号吗？"
          description="删除后将无法恢复，且Cookie信息也会被清除"
          onConfirm={() => handleDeleteAccount(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 - 与文章列表页风格一致 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="支持平台" 
              value={stats.totalPlatforms} 
              valueStyle={{ color: '#0ea5e9' }}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="账号总数" 
              value={stats.totalAccounts} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="活跃账号" 
              value={stats.activeAccounts} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 账号列表 - 与其他页面表格风格一致 */}
      <Card
        title={
          <Space>
            <StarFilled style={{ color: '#0ea5e9' }} />
            <span>账号管理</span>
          </Space>
        }
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadData}
          >
            刷新
          </Button>
        }
        variant="borderless"
      >
        <ResizableTable<Account>
          tableId="platform-accounts-list"
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个账号`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
      </Card>
    </div>
  );
}
