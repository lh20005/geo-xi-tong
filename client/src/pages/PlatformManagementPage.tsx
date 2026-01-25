import { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, message, Space, Button, Popconfirm, Tag, Statistic, Typography } from 'antd';
import { DeleteOutlined, StarFilled, ReloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { getPlatforms, getAccounts, Platform, Account, deleteAccount } from '../api/publishing';
import ResizableTable from '../components/ResizableTable';

const { Text } = Typography;

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
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8} md={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="支持平台" 
              value={stats.totalPlatforms} 
              valueStyle={{ color: '#0ea5e9' }}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="账号总数" 
              value={stats.totalAccounts} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="活跃账号" 
              value={stats.activeAccounts} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 网页端功能建设中提示卡片 */}
      <Card 
        style={{ 
          marginBottom: 24, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: 12
        }}
        styles={{ body: { padding: '24px 32px' } }}
      >
        <Row gutter={24} align="middle">
          <Col flex="auto">
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                🚀 网页端平台功能正在建设中，请下载桌面端操作平台登录功能
              </Text>
            </div>
            
            {/* 下载按钮区域 - 横向排列 */}
            <Space size="middle" wrap>
              {/* Windows 版 */}
              <a
                href="https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases/latest/GEO优化系统-Windows.exe"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <Button
                  size="large"
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    borderRadius: 8,
                    height: 48,
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#0078D4">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                  </svg>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>Windows 版</span>
                </Button>
              </a>
              
              {/* Mac Apple Silicon 版 */}
              <a
                href="https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases/latest/GEO优化系统-Mac-Apple.dmg"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <Button
                  size="large"
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    borderRadius: 8,
                    height: 48,
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#555">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>Mac 版（Apple 芯片）</span>
                </Button>
              </a>
              
              {/* Mac Intel 版 */}
              <a
                href="https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases/latest/GEO优化系统-Mac-Intel.dmg"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <Button
                  size="large"
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    borderRadius: 8,
                    height: 48,
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#555">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>Mac 版（Intel 芯片）</span>
                </Button>
              </a>
            </Space>
            
            {/* 安装提示 */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  Mac 用户首次打开请右键点击应用，选择"打开"以允许运行
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <path d="M9 12l2 2 4-4"/>
                  <path d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  Windows 版若被360误报，请点击"信任"或添加白名单，软件安全无毒
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

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
