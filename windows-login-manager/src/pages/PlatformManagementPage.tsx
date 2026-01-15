import { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Spin, message, Space, Button, Popconfirm, Tag, Statistic, Badge } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, LoginOutlined, StarFilled, ReloadOutlined, CloudUploadOutlined, LockOutlined, CrownOutlined } from '@ant-design/icons';
import { useAccountStore } from '../stores/accountStore';
import { ipcBridge } from '../services/ipc';
import { apiClient } from '../api/client';
import ResizableTable from '../components/ResizableTable';
import { getWebSocketClient, initializeWebSocket } from '../services/websocket';

// 平台图标映射
const getPlatformIcon = (platformId: string): string => {
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
  return specialIcons[platformId] || `/platform-icons/${platformId}.png`;
};

interface Platform {
  platform_id: string;
  platform_name: string;
  login_url: string;
}

interface SubscriptionInfo {
  plan_code: string;
  plan_name: string;
  status: string;
}

const FREE_PLAN_ALLOWED_PLATFORMS = ['douyin'];
const isFreePlanUser = (planCode: string | undefined): boolean => !planCode || planCode === 'free' || planCode === 'trial';
const isPlatformAvailableForFree = (platformId: string): boolean => FREE_PLAN_ALLOWED_PLATFORMS.includes(platformId);

export default function PlatformManagementPage() {
  const { accounts, loading: accountsLoading, error, fetchAccounts, deleteAccount, clearError } = useAccountStore();
  
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformsLoading, setPlatformsLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  
  // 用于跟踪组件是否已卸载，避免 React StrictMode 双重渲染问题
  const isMountedRef = useRef(true);
  const wsInitializedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    fetchSubscription();
    
    // 延迟初始化 WebSocket，避免 StrictMode 双重渲染问题
    const wsTimer = setTimeout(() => {
      if (isMountedRef.current && !wsInitializedRef.current) {
        wsInitializedRef.current = true;
        initializeWebSocketConnection();
      }
    }, 100);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(wsTimer);
      // 只有在 WebSocket 已初始化时才断开
      if (wsInitializedRef.current) {
        try { getWebSocketClient().disconnect(); } catch (e) {}
        wsInitializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (error) { message.error(error); clearError(); }
  }, [error, clearError]);

  const loadData = async () => {
    setPlatformsLoading(true);
    try {
      const platformsData = await ipcBridge.getPlatforms();
      const platformOrder = ['douyin', 'toutiao', 'xiaohongshu', 'souhu', 'wangyi', 'zhihu', 'qie', 'baijiahao', 'wechat', 'bilibili', 'jianshu', 'csdn'];
      const sortedPlatforms = (platformsData || []).sort((a: Platform, b: Platform) => {
        const indexA = platformOrder.indexOf(a.platform_id);
        const indexB = platformOrder.indexOf(b.platform_id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
      setPlatforms(sortedPlatforms);
      await fetchAccounts();
    } catch (e: any) {
      message.error('加载数据失败');
    } finally {
      setPlatformsLoading(false);
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await apiClient.get('/subscription/current');
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setSubscription({
          plan_code: data.plan_code || data.plan?.plan_code || 'free',
          plan_name: data.plan_name || data.plan?.plan_name || '免费版',
          status: data.status || 'active'
        });
      } else {
        setSubscription({ plan_code: 'free', plan_name: '免费版', status: 'active' });
      }
    } catch (e) {
      setSubscription({ plan_code: 'free', plan_name: '免费版', status: 'active' });
    }
  };

  const initializeWebSocketConnection = () => {
    if (!isMountedRef.current) return;
    
    try {
      const wsFullUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3000/ws';
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const wsClient = initializeWebSocket(wsFullUrl);
      wsClient.on('connected', () => { if (isMountedRef.current) setWsConnected(true); });
      wsClient.on('disconnected', () => { if (isMountedRef.current) setWsConnected(false); });
      wsClient.on('authenticated', () => wsClient.subscribe(['accounts']));
      wsClient.on('account.created', () => { if (isMountedRef.current) { message.success('检测到新账号创建'); fetchAccounts(); } });
      wsClient.on('account.updated', () => { if (isMountedRef.current) { message.info('账号信息已更新'); fetchAccounts(); } });
      wsClient.on('account.deleted', () => { if (isMountedRef.current) { message.warning('账号已被删除'); fetchAccounts(); } });
      wsClient.connect(token);
    } catch (e) {}
  };

  const handlePlatformClick = async (platform: Platform) => {
    if (isFreePlanUser(subscription?.plan_code) && !isPlatformAvailableForFree(platform.platform_id)) {
      message.warning('免费版用户仅支持抖音平台，升级套餐后可使用全部平台');
      return;
    }
    try {
      message.loading({ content: '正在打开登录页面...', key: 'browser-login', duration: 0 });
      const result = await ipcBridge.loginPlatform(platform.platform_id);
      message.destroy('browser-login');
      if (result.success) { message.success('登录成功，Cookie已保存'); fetchAccounts(); }
      else { message.error(result.message || '登录失败'); }
    } catch (e: any) {
      message.destroy('browser-login');
      message.error(e.message || '登录失败');
    }
  };

  const handleNavigateToPricing = () => {
    window.open(`${import.meta.env.VITE_LANDING_URL || 'http://localhost:8080'}/#pricing`, '_blank');
  };

  const handleDeleteAccount = async (accountId: string) => {
    const success = await deleteAccount(accountId);
    if (success) {
      message.success('账号删除成功');
      const totalAccounts = accounts.length - 1;
      const totalPages = Math.ceil(totalAccounts / pageSize);
      if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
    }
  };

  const handleTestLogin = async (accountId: string) => {
    try {
      message.loading({ content: '正在打开测试页面...', key: 'test-login', duration: 0 });
      const result = await ipcBridge.testAccountLogin(Number(accountId));
      message.destroy('test-login');
      if (result.success) message.success(result.message || '已打开测试页面');
      else message.error(result.message || '打开测试页面失败');
    } catch (e: any) {
      message.destroy('test-login');
      message.error(e.message || '打开测试页面失败');
    }
  };

  const getPlatformAccounts = (platformId: string) => accounts.filter(acc => acc.platformId === platformId);
  const isPlatformBound = (platformId: string) => getPlatformAccounts(platformId).length > 0;

  const stats = {
    totalPlatforms: platforms.length,
    boundPlatforms: platforms.filter(p => isPlatformBound(p.platform_id)).length,
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter(a => a.status === 'active').length
  };

  const loading = platformsLoading || accountsLoading;

  if (loading && platforms.length === 0) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  const columns = [
    { title: '平台', dataIndex: 'platformId', key: 'platformId', width: 120, align: 'center' as const,
      render: (platformId: string) => <Tag color="blue">{platforms.find(p => p.platform_id === platformId)?.platform_name || platformId}</Tag> },
    { title: '用户名', dataIndex: 'realUsername', key: 'realUsername', width: 180, align: 'center' as const,
      render: (text: string, record: any) => <Space><span style={{ fontWeight: 500, color: '#1890ff' }}>{text || record.accountName || '未知'}</span>{record.isDefault && <StarFilled style={{ color: '#faad14' }} />}</Space> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' as const,
      render: (status: string) => status === 'expired' || status === 'error' ? <Tag color="error">已掉线</Tag> : <Tag color={status === 'active' ? 'success' : 'default'}>{status === 'active' ? '正常' : '未激活'}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, align: 'center' as const, render: (date: string) => new Date(date).toLocaleString('zh-CN') },
    { title: '最后使用', dataIndex: 'lastUsedAt', key: 'lastUsedAt', width: 170, align: 'center' as const, render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '未使用' },
    { title: '登录测试', key: 'test_login', width: 120, align: 'center' as const, render: (_: any, record: any) => <Button type="primary" size="small" icon={<LoginOutlined />} onClick={() => handleTestLogin(record.id)}>测试登录</Button> },
    { title: '操作', key: 'action', width: 100, align: 'center' as const, render: (_: any, record: any) => <Popconfirm title="确定要删除这个账号吗？" onConfirm={() => handleDeleteAccount(record.id)} okText="确定" cancelText="取消"><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card size="small" style={{ textAlign: 'center' }}><Statistic title="支持平台" value={stats.totalPlatforms} valueStyle={{ color: '#0ea5e9' }} prefix={<CloudUploadOutlined />} /></Card></Col>
        <Col span={6}><Card size="small" style={{ textAlign: 'center' }}><Statistic title="已配置平台" value={stats.boundPlatforms} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col span={6}><Card size="small" style={{ textAlign: 'center' }}><Statistic title="账号总数" value={stats.totalAccounts} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card size="small" style={{ textAlign: 'center' }}><Statistic title="活跃账号" value={stats.activeAccounts} valueStyle={{ color: '#faad14' }} /></Card></Col>
      </Row>

      <Card title={<Space><LoginOutlined style={{ color: '#0ea5e9' }} /><span>平台登录</span>{wsConnected && <Badge status="success" text="实时同步" />}</Space>} extra={<Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>} variant="borderless" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, color: '#64748b' }}>点击平台卡片打开浏览器进行登录，登录成功后Cookie将自动保存</div>
        <Row gutter={[12, 12]}>
          {platforms.map(platform => {
            const bound = isPlatformBound(platform.platform_id);
            const platformAccounts = getPlatformAccounts(platform.platform_id);
            const isLocked = isFreePlanUser(subscription?.plan_code) && !isPlatformAvailableForFree(platform.platform_id);
            return (
              <Col xs={12} sm={8} md={6} lg={4} xl={3} key={platform.platform_id}>
                <Card hoverable={!isLocked} onClick={() => !isLocked && handlePlatformClick(platform)} style={{ textAlign: 'center', position: 'relative', borderRadius: 8, border: bound ? '2px solid #52c41a' : '1px solid #e2e8f0', background: bound ? '#f6ffed' : '#fff', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.7 : 1 }} styles={{ body: { padding: '12px 8px' } }}>
                  {isLocked && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><LockOutlined style={{ fontSize: 24, color: '#fff', marginBottom: 8 }} /><Button type="primary" size="small" icon={<CrownOutlined />} onClick={(e) => { e.stopPropagation(); handleNavigateToPricing(); }} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', fontSize: 11 }}>升级套餐后可使用</Button></div>}
                  {bound && !isLocked && <div style={{ position: 'absolute', top: 4, right: 4 }}><CheckCircleOutlined style={{ fontSize: 14, color: '#52c41a' }} /></div>}
                  <div style={{ width: 48, height: 48, margin: '0 auto 8px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={getPlatformIcon(platform.platform_id)} alt={platform.platform_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; const p = t.parentElement; if (p) { p.style.background = bound ? '#52c41a' : '#0ea5e9'; p.innerHTML = `<span style="font-size:24px;font-weight:bold;color:#fff">${platform.platform_name.charAt(0)}</span>`; } }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{platform.platform_name}</div>
                  {bound && platformAccounts.length > 0 && <div style={{ fontSize: 11, color: '#52c41a' }}>{platformAccounts.length}个账号</div>}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      <Card title={<Space><StarFilled style={{ color: '#0ea5e9' }} /><span>账号管理</span></Space>} extra={<Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>} variant="borderless">
        <ResizableTable tableId="platform-accounts-list" columns={columns} dataSource={accounts} rowKey="id" scroll={{ x: 920 }} pagination={{ current: currentPage, pageSize, showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 个账号`, pageSizeOptions: ['10', '20', '50', '100'], onChange: (page, size) => { setCurrentPage(page); setPageSize(size); } }} />
      </Card>
    </div>
  );
}
