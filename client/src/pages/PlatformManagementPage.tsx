import { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, message, Typography, Space, Button, Popconfirm, Tag, Statistic } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, LoginOutlined, StarFilled, ReloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { getPlatforms, getAccounts, Platform, Account, loginWithBrowser, deleteAccount } from '../api/publishing';
import ResizableTable from '../components/ResizableTable';
import AccountBindingModal from '../components/Publishing/AccountBindingModal';
import AccountManagementModal from '../components/Publishing/AccountManagementModal';

const { Title } = Typography;

export default function PlatformManagementPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindingModalVisible, setBindingModalVisible] = useState(false);
  const [managementModalVisible, setManagementModalVisible] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

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

  const handlePlatformClick = async (platform: Platform) => {
    try {
      console.log('[前端] 点击平台卡片:', platform.platform_name, platform.platform_id);
      message.loading({ content: '正在打开浏览器登录页面...', key: 'browser-login', duration: 0 });
      
      console.log('[前端] 调用 loginWithBrowser API...');
      const result = await loginWithBrowser(platform.platform_id);
      console.log('[前端] API返回结果:', result);
      
      message.destroy('browser-login');
      
      if (result.success) {
        message.success('登录成功，Cookie已保存');
        loadData(); // 重新加载数据
      } else {
        message.error(result.message || '登录失败');
      }
    } catch (error: any) {
      message.destroy('browser-login');
      console.error('[前端] 浏览器登录失败:', error);
      console.error('[前端] 错误详情:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      message.error(error.message || error.response?.data?.message || '打开浏览器失败');
    }
  };

  const handleDeleteAccount = async (accountId: number) => {
    try {
      await deleteAccount(accountId);
      message.success('账号删除成功');
      loadData();
    } catch (error) {
      message.error('账号删除失败');
      console.error('账号删除失败:', error);
    }
  };

  const handleBindingSuccess = () => {
    setBindingModalVisible(false);
    loadData();
    message.success('账号绑定成功');
  };

  const handleManagementSuccess = () => {
    loadData();
  };

  const getPlatformAccounts = (platformId: string) => {
    return accounts.filter(acc => acc.platform_id === platformId);
  };

  const isPlatformBound = (platformId: string) => {
    return getPlatformAccounts(platformId).length > 0;
  };

  // 统计数据
  const stats = {
    totalPlatforms: platforms.length,
    boundPlatforms: platforms.filter(p => isPlatformBound(p.platform_id)).length,
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
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '正常' : '未激活'}
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
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="支持平台" 
              value={stats.totalPlatforms} 
              valueStyle={{ color: '#0ea5e9' }}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="已配置平台" 
              value={stats.boundPlatforms} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="账号总数" 
              value={stats.totalAccounts} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic 
              title="活跃账号" 
              value={stats.activeAccounts} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 平台登录卡片区域 */}
      <Card 
        title={
          <Space>
            <LoginOutlined style={{ color: '#0ea5e9' }} />
            <span>平台登录</span>
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
        bordered={false}
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 16, color: '#64748b' }}>
          点击平台卡片打开浏览器进行登录，登录成功后Cookie将自动保存
        </div>
        
        <Row gutter={[16, 16]}>
          {platforms.map(platform => {
            const bound = isPlatformBound(platform.platform_id);
            const platformAccounts = getPlatformAccounts(platform.platform_id);
            
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={platform.platform_id}>
                <Card
                  hoverable
                  onClick={() => handlePlatformClick(platform)}
                  style={{
                    textAlign: 'center',
                    position: 'relative',
                    borderRadius: 8,
                    border: bound ? '2px solid #52c41a' : '1px solid #e2e8f0',
                    background: bound ? '#f6ffed' : '#ffffff',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  bodyStyle={{ padding: '24px 16px' }}
                >
                  {bound && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8
                      }}
                    >
                      <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                    </div>
                  )}
                  
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      margin: '0 auto 12px',
                      borderRadius: 8,
                      background: bound ? '#52c41a' : '#0ea5e9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      fontWeight: 'bold',
                      color: '#ffffff'
                    }}
                  >
                    {platform.platform_name.charAt(0)}
                  </div>
                  
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: '#1e293b' }}>
                    {platform.platform_name}
                  </div>
                  
                  {bound ? (
                    <Tag color="success">已登录 {platformAccounts.length} 个账号</Tag>
                  ) : (
                    <Tag color="default">点击登录</Tag>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* 账号列表 - 与其他页面表格风格一致 */}
      {accounts.length > 0 && (
        <Card
          title={
            <Space>
              <StarFilled style={{ color: '#0ea5e9' }} />
              <span>账号管理</span>
            </Space>
          }
          bordered={false}
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
      )}

      {selectedPlatform && (
        <>
          <AccountBindingModal
            visible={bindingModalVisible}
            platform={selectedPlatform}
            onSuccess={handleBindingSuccess}
            onCancel={() => setBindingModalVisible(false)}
          />
          
          <AccountManagementModal
            visible={managementModalVisible}
            platform={selectedPlatform}
            accounts={getPlatformAccounts(selectedPlatform.platform_id)}
            onSuccess={handleManagementSuccess}
            onCancel={() => setManagementModalVisible(false)}
          />
        </>
      )}
    </div>
  );
}
