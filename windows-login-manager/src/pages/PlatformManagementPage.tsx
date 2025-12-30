import { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, message, Space, Button, Popconfirm, Tag, Statistic, Badge } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, LoginOutlined, StarFilled, ReloadOutlined, CloudUploadOutlined, WifiOutlined } from '@ant-design/icons';
import { getPlatforms, getAccounts, Platform, Account, loginWithBrowser, deleteAccount, testAccountLogin } from '../api/publishing';
import ResizableTable from '../components/ResizableTable';
import AccountBindingModal from '../components/Publishing/AccountBindingModal';
import AccountManagementModal from '../components/Publishing/AccountManagementModal';
import { getWebSocketClient, initializeWebSocket } from '../services/websocket';

// const { Title } = Typography;

// 平台图标映射 - 只使用本地图标
const getPlatformIcon = (platformId: string): string => {
  // 特殊平台使用指定路径
  const specialIcons: Record<string, string> = {
    'baijiahao': '/images/baijiahao.png',
    'baidu': '/images/baijiahao.png',
    'toutiao': '/images/toutiaohao.png',
    'toutiaohao': '/images/toutiaohao.png',
    'xiaohongshu': '/images/xiaohongshu.png',
    'xhs': '/images/xiaohongshu.png',
    'weixin': '/images/gongzhonghao.png',
    'gongzhonghao': '/images/gongzhonghao.png',
    'wechat': '/images/gongzhonghao.png',
    'douyin': '/images/douyin.jpeg',
    'sohu': '/images/souhu.jpeg',
    'souhu': '/images/souhu.jpeg',
    'wangyi': '/images/wangyi.png',
    'netease': '/images/wangyi.png',
    'bilibili': '/images/bili.png',
    'bili': '/images/bili.png',
    'qq': '/images/qie.png',
    'qie': '/images/qie.png',
    'penguin': '/images/qie.png',
    'zhihu': '/images/zhihu.png',
    'csdn': '/images/csdn.png',
    'jianshu': '/images/jianshu.png'
  };
  
  if (specialIcons[platformId]) {
    return specialIcons[platformId];
  }
  
  // 其他平台使用默认路径
  return `/platform-icons/${platformId}.png`;
};

export default function PlatformManagementPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindingModalVisible, setBindingModalVisible] = useState(false);
  const [managementModalVisible, setManagementModalVisible] = useState(false);
  const [selectedPlatform] = useState<Platform | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    loadData();
    initializeWebSocketConnection();

    return () => {
      // Cleanup WebSocket on unmount
      try {
        const wsClient = getWebSocketClient();
        wsClient.disconnect();
      } catch (error) {
        // WebSocket not initialized
      }
    };
  }, []);

  const initializeWebSocketConnection = () => {
    try {
      // Get WebSocket URL from environment or use default
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
      
      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.warn('[WebSocket] 没有auth token，无法连接WebSocket');
        return;
      }

      console.log('[WebSocket] 初始化WebSocket连接');
      const wsClient = initializeWebSocket(wsUrl);

      // Set up event listeners
      wsClient.on('connected', () => {
        console.log('[WebSocket] 连接成功');
        setWsConnected(true);
      });

      wsClient.on('disconnected', () => {
        console.log('[WebSocket] 连接断开');
        setWsConnected(false);
      });

      wsClient.on('authenticated', () => {
        console.log('[WebSocket] 认证成功');
        // Subscribe to account events
        wsClient.subscribe(['accounts']);
      });

      wsClient.on('account.created', (data) => {
        console.log('[WebSocket] 收到账号创建事件:', data);
        message.success('检测到新账号创建');
        loadData(); // Refresh account list
      });

      wsClient.on('account.updated', (data) => {
        console.log('[WebSocket] 收到账号更新事件:', data);
        message.info('账号信息已更新');
        loadData(); // Refresh account list
      });

      wsClient.on('account.deleted', (data) => {
        console.log('[WebSocket] 收到账号删除事件:', data);
        message.warning('账号已被删除');
        loadData(); // Refresh account list
      });

      wsClient.on('error', (error) => {
        console.error('[WebSocket] 错误:', error);
      });

      wsClient.on('server_error', (message) => {
        console.error('[WebSocket] 服务端错误:', message);
      });

      // Connect to WebSocket with token
      console.log('[WebSocket] 使用token连接');
      wsClient.connect(token);
    } catch (error) {
      console.error('[WebSocket] 初始化失败:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [platformsData, accountsData] = await Promise.all([
        getPlatforms(),
        getAccounts()
      ]);
      
      // 定义平台显示顺序
      const platformOrder = [
        'douyin',      // 抖音
        'toutiao',     // 头条号
        'xiaohongshu', // 小红书
        'souhu',       // 搜狐号
        'wangyi',      // 网易号
        'zhihu',       // 知乎
        'qie',         // 企鹅号
        'baijiahao',   // 百家号
        'wechat',      // 微信公众号
        'bilibili',    // 哔哩哔哩
        'jianshu',     // 简书
        'csdn'         // CSDN
      ];
      
      // 按照指定顺序排序平台
      const sortedPlatforms = platformsData.sort((a, b) => {
        const indexA = platformOrder.indexOf(a.platform_id);
        const indexB = platformOrder.indexOf(b.platform_id);
        
        // 如果平台不在排序列表中，放到最后
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });
      
      setPlatforms(sortedPlatforms);
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

  const handleTestLogin = async (accountId: number, accountName: string) => {
    try {
      console.log('[前端] 点击测试登录按钮:', accountId, accountName);
      message.loading({ content: '正在打开浏览器...', key: 'test-login', duration: 0 });
      
      console.log('[前端] 调用 testAccountLogin API...');
      const result = await testAccountLogin(accountId);
      console.log('[前端] API返回结果:', result);
      
      message.destroy('test-login');
      
      if (result.success) {
        message.success(result.message || '浏览器已打开，请查看登录状态');
      } else {
        message.error(result.message || '打开浏览器失败');
      }
    } catch (error: any) {
      message.destroy('test-login');
      console.error('[前端] 测试登录失败:', error);
      console.error('[前端] 错误详情:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      message.error(error.message || error.response?.data?.message || '打开浏览器失败');
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
      title: '用户名',
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
      title: '登录测试',
      key: 'test_login',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: Account) => (
        <Button 
          type="primary"
          size="small"
          icon={<LoginOutlined />}
          onClick={() => handleTestLogin(record.id, record.account_name)}
        >
          测试登录
        </Button>
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
            {wsConnected && (
              <Badge status="success" text="实时同步" />
            )}
          </Space>
        }
        extra={
          <Space>
            {wsConnected ? (
              <Tag icon={<WifiOutlined />} color="success">已连接</Tag>
            ) : (
              <Tag icon={<WifiOutlined />} color="default">未连接</Tag>
            )}
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData}
            >
              刷新
            </Button>
          </Space>
        }
        bordered={false}
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 16, color: '#64748b' }}>
          点击平台卡片打开浏览器进行登录，登录成功后Cookie将自动保存
        </div>
        
        <Row gutter={[12, 12]}>
          {platforms.map(platform => {
            const bound = isPlatformBound(platform.platform_id);
            const platformAccounts = getPlatformAccounts(platform.platform_id);
            
            return (
              <Col xs={12} sm={8} md={6} lg={4} xl={3} key={platform.platform_id}>
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
                    cursor: 'pointer',
                    height: '100%'
                  }}
                  styles={{ body: { padding: '12px 8px' } }}
                >
                  {bound && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4
                      }}
                    >
                      <CheckCircleOutlined style={{ fontSize: 14, color: '#52c41a' }} />
                    </div>
                  )}
                  
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      margin: '0 auto 8px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    <img 
                      src={getPlatformIcon(platform.platform_id)} 
                      alt={platform.platform_name}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        // 图标加载失败，显示首字母
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.style.background = bound ? '#52c41a' : '#0ea5e9';
                          parent.innerHTML = `<span style="font-size: 24px; font-weight: bold; color: #ffffff;">${platform.platform_name.charAt(0)}</span>`;
                        }
                      }}
                    />
                  </div>
                  
                  <div style={{ 
                    fontSize: 12, 
                    fontWeight: 500, 
                    marginBottom: 4, 
                    color: '#1e293b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {platform.platform_name}
                  </div>
                  
                  {bound && platformAccounts.length > 0 && (
                    <div style={{ fontSize: 11, color: '#52c41a' }}>
                      {platformAccounts.length}个账号
                    </div>
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
            scroll={{ x: 920 }}
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
