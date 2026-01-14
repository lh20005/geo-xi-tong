import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Progress, Tag, Button, Table, Modal, message, Space, Statistic, Descriptions, Tabs, Input, Form, Avatar, Tooltip } from 'antd';
import { CrownOutlined, ReloadOutlined, RocketOutlined, HistoryOutlined, WarningOutlined, UserOutlined, KeyOutlined, SafetyOutlined, DatabaseOutlined, DollarOutlined, MailOutlined, CheckCircleOutlined, CloudSyncOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getUserWebSocketService } from '../services/UserWebSocketService';
import { StorageUsageCard } from '../components/Storage/StorageUsageCard';
import { StorageBreakdownChart } from '../components/Storage/StorageBreakdownChart';
import { getStorageUsage, getStorageBreakdown, StorageUsage as StorageUsageType, StorageBreakdown as StorageBreakdownType, formatStorageMB } from '../api/storage';
import { AgentCenterPage } from '../components/Agent';
import { Agent, getAgentStatus } from '../api/agent';
import { BoosterQuotaCard } from '../components/Booster';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

const { TabPane } = Tabs;

interface Subscription {
  id: number;
  plan_name: string;
  plan_code: string;
  start_date: string;
  end_date: string;
  status: string;
  auto_renew: boolean;
  plan?: {
    plan_code: string;
  };
}

interface UsageStats {
  feature_code: string;
  feature_name: string;
  used: number;
  limit: number;
  percentage: number;
  reset_period: string;
  reset_time?: string; // 下次重置时间（基于订阅周期）
}

interface Order {
  order_no: string;
  plan_name: string;
  amount: string | number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface UserProfile {
  id: number;
  username: string;
  email?: string;
  emailVerified?: boolean;
  role: string;
  invitationCode: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface InvitationStats {
  invitationCode: string;
  totalInvites: number;
  invitedUsers: {
    username: string;
    createdAt: string;
  }[];
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const UserCenterPage = () => {
  const location = useLocation();
  const { invalidateCacheByPrefix } = useCacheStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [invitationStats, setInvitationStats] = useState<InvitationStats | null>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('subscription');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // 存储相关状态
  const [storageUsage, setStorageUsage] = useState<StorageUsageType | null>(null);
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdownType | null>(null);

  // 代理商相关状态
  const [isAgent, setIsAgent] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);

  // 邮箱更换相关状态
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailForm] = Form.useForm();
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [emailStep, setEmailStep] = useState<'verify' | 'change'>('verify'); // 更换邮箱步骤

  // 数据获取函数
  const fetchSubscriptionData = useCallback(async () => {
    const response = await apiClient.get('/subscription/current');
    if (response.data.success) {
      return response.data.data;
    }
    return null;
  }, []);

  const fetchUsageStatsData = useCallback(async () => {
    const response = await apiClient.get('/subscription/usage-stats');
    if (response.data.success) {
      const features = response.data.data?.features;
      return Array.isArray(features) ? features : [];
    }
    return [];
  }, []);

  const fetchOrdersData = useCallback(async () => {
    const response = await apiClient.get('/orders');
    if (response.data.success) {
      const ordersData = response.data.data?.orders || response.data.data;
      return Array.isArray(ordersData) ? ordersData : [];
    }
    return [];
  }, []);

  const fetchUserProfileData = useCallback(async () => {
    const response = await apiClient.get('/users/profile');
    if (response.data.success) {
      return response.data.data;
    }
    return null;
  }, []);

  const fetchInvitationStatsData = useCallback(async () => {
    const response = await apiClient.get('/invitations/stats');
    if (response.data.success) {
      return response.data.data;
    }
    return null;
  }, []);

  const fetchStorageDataFn = useCallback(async () => {
    const [usage, breakdown] = await Promise.all([
      getStorageUsage(),
      getStorageBreakdown()
    ]);
    return { usage, breakdown };
  }, []);

  const fetchAgentStatusData = useCallback(async () => {
    return await getAgentStatus();
  }, []);

  // 使用缓存 Hook 获取订阅数据
  const {
    data: subscriptionData,
    loading: subscriptionLoading,
    refreshing: subscriptionRefreshing,
    refresh: refreshSubscription,
    isFromCache: subscriptionFromCache
  } = useCachedData<Subscription | null>(
    'userCenter:subscription',
    fetchSubscriptionData,
    { onError: (error) => console.error('获取订阅信息失败:', error) }
  );

  // 使用缓存 Hook 获取使用统计
  const {
    data: usageStatsData,
    refresh: refreshUsageStats,
    isFromCache: usageStatsFromCache,
    refreshing: usageStatsRefreshing
  } = useCachedData<UsageStats[]>(
    'userCenter:usageStats',
    fetchUsageStatsData,
    { onError: (error) => console.error('获取使用统计失败:', error) }
  );

  // 使用缓存 Hook 获取订单列表
  const {
    data: ordersData,
    loading: ordersLoading,
    refresh: refreshOrders,
    isFromCache: ordersFromCache,
    refreshing: ordersRefreshing
  } = useCachedData<Order[]>(
    'userCenter:orders',
    fetchOrdersData,
    { onError: (error) => console.error('获取订单列表失败:', error) }
  );

  // 使用缓存 Hook 获取用户资料
  const {
    data: userProfileData,
    refresh: refreshUserProfile
  } = useCachedData<UserProfile | null>(
    'userCenter:profile',
    fetchUserProfileData,
    { onError: (error) => console.error('获取用户资料失败:', error) }
  );

  // 使用缓存 Hook 获取邀请统计
  const {
    data: invitationStatsData,
    refresh: refreshInvitationStats
  } = useCachedData<InvitationStats | null>(
    'userCenter:invitationStats',
    fetchInvitationStatsData,
    { onError: (error) => console.error('获取邀请统计失败:', error) }
  );

  // 使用缓存 Hook 获取存储数据
  const {
    data: storageData,
    loading: storageLoading,
    refresh: refreshStorageData
  } = useCachedData<{ usage: StorageUsageType; breakdown: StorageBreakdownType } | null>(
    'userCenter:storage',
    fetchStorageDataFn,
    { onError: (error) => console.error('[UserCenter] 加载存储数据失败:', error) }
  );

  // 使用缓存 Hook 获取代理商状态
  const {
    data: agentStatusData,
    loading: agentLoading,
    refresh: refreshAgentStatus
  } = useCachedData<{ isAgent: boolean; agent: Agent | null } | null>(
    'userCenter:agentStatus',
    fetchAgentStatusData,
    { onError: (error) => console.error('[UserCenter] 获取代理商状态失败:', error) }
  );

  // 更新本地状态
  useEffect(() => {
    if (subscriptionData !== undefined) setSubscription(subscriptionData);
  }, [subscriptionData]);

  useEffect(() => {
    if (usageStatsData) setUsageStats(usageStatsData);
  }, [usageStatsData]);

  useEffect(() => {
    if (ordersData) setOrders(ordersData);
  }, [ordersData]);

  useEffect(() => {
    if (userProfileData !== undefined) setUserProfile(userProfileData);
  }, [userProfileData]);

  useEffect(() => {
    if (invitationStatsData !== undefined) setInvitationStats(invitationStatsData);
  }, [invitationStatsData]);

  useEffect(() => {
    if (storageData) {
      setStorageUsage(storageData.usage);
      setStorageBreakdown(storageData.breakdown);
    }
  }, [storageData]);

  useEffect(() => {
    if (agentStatusData) {
      setIsAgent(agentStatusData.isAgent);
      setAgent(agentStatusData.agent);
    }
  }, [agentStatusData]);

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('userCenter:');
    await Promise.all([
      refreshSubscription(true),
      refreshUsageStats(true),
      refreshOrders(true),
      refreshUserProfile(true),
      refreshInvitationStats(true),
      refreshStorageData(true),
      refreshAgentStatus(true)
    ]);
  }, [invalidateCacheByPrefix, refreshSubscription, refreshUsageStats, refreshOrders, refreshUserProfile, refreshInvitationStats, refreshStorageData, refreshAgentStatus]);

  // 兼容旧的函数名
  const fetchSubscription = useCallback(async () => {
    await refreshSubscription(true);
  }, [refreshSubscription]);

  const fetchUsageStats = useCallback(async () => {
    await refreshUsageStats(true);
  }, [refreshUsageStats]);

  const fetchOrders = useCallback(async () => {
    await refreshOrders(true);
  }, [refreshOrders]);

  const fetchUserProfile = useCallback(async () => {
    await refreshUserProfile(true);
  }, [refreshUserProfile]);

  const fetchInvitationStats = useCallback(async () => {
    await refreshInvitationStats(true);
  }, [refreshInvitationStats]);

  const fetchStorageData = useCallback(async () => {
    await refreshStorageData(true);
  }, [refreshStorageData]);

  const fetchAgentStatus = useCallback(async () => {
    await refreshAgentStatus(true);
  }, [refreshAgentStatus]);

  // 邮箱验证码倒计时
  useEffect(() => {
    if (emailCountdown > 0) {
      const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailCountdown]);

  // 从路由状态读取 activeTab
  useEffect(() => {
    const state = location.state as { activeTab?: string } | null;
    if (state?.activeTab) {
      setActiveTab(state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    const wsService = getUserWebSocketService();
    
    wsService.connect().catch((error) => {
      console.warn('[UserCenter] WebSocket 连接失败:', error);
    });

    const handleQuotaUpdate = (data: any) => {
      console.log('Quota updated:', data);
      message.info('配额已更新');
      refreshUsageStats(true);
    };

    const handleSubscriptionUpdate = (data: any) => {
      console.log('Subscription updated:', data);
      message.info('订阅信息已更新');
      refreshSubscription(true);
    };

    const handleOrderStatusChange = (data: any) => {
      console.log('Order status changed:', data);
      message.info('订单状态已更新');
      refreshOrders(true);
    };

    // 存储相关事件
    const handleStorageUpdate = (data: any) => {
      console.log('[UserCenter] 存储更新:', data);
      if (data.usage) setStorageUsage(data.usage);
      if (data.breakdown) setStorageBreakdown(data.breakdown);
    };

    const handleStorageAlert = (data: any) => {
      console.log('[UserCenter] 存储警报:', data);
      if (data.message) {
        if (data.alert?.alertType === 'depleted') {
          message.error(data.message, 10);
        } else if (data.alert?.alertType === 'critical') {
          message.warning(data.message, 8);
        } else {
          message.info(data.message, 5);
        }
      }
    };

    const handleStorageQuotaChange = (data: any) => {
      console.log('[UserCenter] 配额变更:', data);
      message.success('存储配额已更新');
      refreshStorageData(true);
    };

    wsService.on('quota_updated', handleQuotaUpdate);
    wsService.on('subscription_updated', handleSubscriptionUpdate);
    wsService.on('order_status_changed', handleOrderStatusChange);
    wsService.on('storage_updated', handleStorageUpdate);
    wsService.on('storage_alert', handleStorageAlert);
    wsService.on('storage_quota_changed', handleStorageQuotaChange);

    return () => {
      wsService.off('quota_updated', handleQuotaUpdate);
      wsService.off('subscription_updated', handleSubscriptionUpdate);
      wsService.off('order_status_changed', handleOrderStatusChange);
      wsService.off('storage_updated', handleStorageUpdate);
      wsService.off('storage_alert', handleStorageAlert);
      wsService.off('storage_quota_changed', handleStorageQuotaChange);
    };
  }, [refreshUsageStats, refreshSubscription, refreshOrders, refreshStorageData]);

  const handleAgentApplySuccess = (newAgent: Agent) => {
    setIsAgent(true);
    setAgent(newAgent);
  };

  const handleAgentUpdate = (updatedAgent: Agent) => {
    setAgent(updatedAgent);
  };

  // 跳转到落地页套餐购买页面
  const handleNavigateToPricing = () => {
    const landingUrl = import.meta.env.VITE_LANDING_URL || 'http://localhost:8080';
    window.open(`${landingUrl}/#pricing`, '_blank');
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#ff4d4f';
    if (percentage >= 70) return '#faad14';
    return '#52c41a';
  };

  const getDaysUntilExpiry = () => {
    if (!subscription) return 0;
    const endDate = new Date(subscription.end_date);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const formatPrice = (price: string | number): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return numPrice.toFixed(2);
  };

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no'
    },
    {
      title: '套餐',
      dataIndex: 'plan_name',
      key: 'plan_name'
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: string | number) => `¥${formatPrice(amount)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: any = {
          pending: { text: '待支付', color: 'orange' },
          paid: { text: '已支付', color: 'green' },
          closed: { text: '已关闭', color: 'default' },
          refunded: { text: '已退款', color: 'red' }
        };
        const s = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '支付时间',
      dataIndex: 'paid_at',
      key: 'paid_at',
      render: (date: string | null) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    }
  ];

  const daysUntilExpiry = getDaysUntilExpiry();
  const showExpiryWarning = daysUntilExpiry > 0 && daysUntilExpiry <= 7;

  const handlePasswordChange = async (values: PasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致');
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await apiClient.put('/users/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });

      if (response.data.success) {
        message.success('密码修改成功');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '密码修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  // 验证密码后发送邮箱验证码
  const handleSendEmailCode = async () => {
    try {
      // 如果已有邮箱，需要先验证密码
      if (userProfile?.email && emailStep === 'verify') {
        await emailForm.validateFields(['password']);
        const password = emailForm.getFieldValue('password');
        
        setEmailLoading(true);
        try {
          const response = await apiClient.post('/auth/change-email/verify-password', { password });

          if (response.data.success) {
            setEmailStep('change');
            message.success('密码验证成功，请输入新邮箱');
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '密码验证失败');
        } finally {
          setEmailLoading(false);
        }
        return;
      }

      // 验证新邮箱
      await emailForm.validateFields(['email']);
    } catch {
      return;
    }

    const email = emailForm.getFieldValue('email');
    setEmailLoading(true);

    try {
      const response = await apiClient.post('/auth/bind-email/send-code', { email });

      if (response.data.success) {
        message.success('验证码已发送到您的邮箱');
        setEmailCodeSent(true);
        setEmailCountdown(60);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '发送验证码失败');
    } finally {
      setEmailLoading(false);
    }
  };

  // 更换邮箱
  const handleBindEmail = async (values: { email: string; code: string }) => {
    setEmailLoading(true);

    try {
      const response = await apiClient.post('/auth/bind-email/verify', {
        email: values.email,
        code: values.code
      });

      if (response.data.success) {
        message.success('邮箱更换成功');
        setEmailModalVisible(false);
        emailForm.resetFields();
        setEmailCodeSent(false);
        setEmailStep('verify');
        // 刷新用户信息
        fetchUserProfile();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更换失败');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
        {/* 订阅管理标签页 */}
        <TabPane
          tab={
            <span>
              <CrownOutlined />
              订阅管理
            </span>
          }
          key="subscription"
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <CrownOutlined />
                    我的订阅
                    {subscriptionFromCache && !subscriptionRefreshing && (
                      <Tooltip title="数据来自缓存">
                        <Tag color="gold" style={{ marginLeft: 8 }}>缓存</Tag>
                      </Tooltip>
                    )}
                    {subscriptionRefreshing && (
                      <Tag icon={<CloudSyncOutlined spin />} color="processing" style={{ marginLeft: 8 }}>更新中</Tag>
                    )}
                  </Space>
                }
                loading={subscriptionLoading}
                extra={
                  subscription ? (
                    <Button type="primary" icon={<RocketOutlined />} onClick={handleNavigateToPricing}>
                      升级套餐
                    </Button>
                  ) : (
                    <Button type="primary" icon={<RocketOutlined />} onClick={handleNavigateToPricing}>
                      查看套餐
                    </Button>
                  )
                }
              >
                {subscription ? (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="当前套餐"
                        value={subscription.plan_name}
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<CrownOutlined />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="到期时间"
                        value={daysUntilExpiry > 36000 ? '永久有效' : new Date(subscription.end_date).toLocaleDateString('zh-CN')}
                        valueStyle={{ color: daysUntilExpiry > 36000 ? '#52c41a' : (showExpiryWarning ? '#ff4d4f' : '#3f8600') }}
                      />
                      {showExpiryWarning && daysUntilExpiry <= 36000 && (
                        <Tag color="warning" style={{ marginTop: 8 }}>
                          <WarningOutlined /> 还有 {daysUntilExpiry} 天到期
                        </Tag>
                      )}
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="订阅状态"
                        value={subscription.status === 'active' ? '正常' : '已过期'}
                        valueStyle={{ color: subscription.status === 'active' ? '#3f8600' : '#cf1322' }}
                      />
                    </Col>
                  </Row>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }}>
                      <CrownOutlined />
                    </div>
                    <p style={{ fontSize: 18, color: '#262626', marginBottom: 8, fontWeight: 500 }}>
                      您还没有订阅任何套餐
                    </p>
                    <p style={{ fontSize: 14, color: '#8c8c8c', marginBottom: 24 }}>
                      订阅套餐后即可使用完整功能，包括关键词蒸馏、AI内容生成、多平台发布等
                    </p>
                    <Space size="large">
                      <Button type="primary" size="large" icon={<RocketOutlined />} onClick={handleNavigateToPricing}>
                        立即订阅
                      </Button>
                      <Button size="large" onClick={handleNavigateToPricing}>
                        查看套餐详情
                      </Button>
                    </Space>
                  </div>
                )}
              </Card>
            </Col>

            <Col span={24}>
              <Card 
                title={
                  <Space>
                    使用统计
                    {usageStatsFromCache && !usageStatsRefreshing && (
                      <Tooltip title="数据来自缓存">
                        <Tag color="gold">缓存</Tag>
                      </Tooltip>
                    )}
                    {usageStatsRefreshing && (
                      <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>
                    )}
                  </Space>
                }
                extra={<Button icon={<ReloadOutlined />} onClick={fetchUsageStats}>刷新</Button>}
              >
                <Row gutter={[16, 16]}>
                  {usageStats.map(stat => (
                    <Col span={12} key={stat.feature_code}>
                      <Card size="small" variant="borderless" style={{ background: '#fafafa' }}>
                        <div style={{ marginBottom: 8 }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>{stat.feature_name}</span>
                            <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                              {stat.reset_period === 'daily' ? '每日重置' : 
                               stat.reset_period === 'monthly' ? (
                                 stat.reset_time 
                                   ? `下次重置: ${new Date(stat.reset_time).toLocaleDateString('zh-CN')}`
                                   : '每月重置'
                               ) : stat.reset_period === 'yearly' ? (
                                 stat.reset_time 
                                   ? `下次重置: ${new Date(stat.reset_time).toLocaleDateString('zh-CN')}`
                                   : '每年重置'
                               ) : '永久'}
                            </span>
                          </Space>
                        </div>
                        <Progress
                          percent={stat.percentage}
                          strokeColor={getProgressColor(stat.percentage)}
                          format={() => {
                            // 存储空间需要特殊处理，显示为容量格式（MB/GB）
                            if (stat.feature_code === 'storage_space') {
                              return `${formatStorageMB(stat.used)} / ${stat.limit === -1 ? '无限' : formatStorageMB(stat.limit)}`;
                            }
                            return `${stat.used} / ${stat.limit === -1 ? '∞' : stat.limit}`;
                          }}
                        />
                        {stat.percentage >= 90 && (
                          <div style={{ marginTop: 8 }}>
                            <Space>
                              <WarningOutlined style={{ color: '#ff4d4f' }} />
                              <span style={{ color: '#ff4d4f', fontSize: 12 }}>
                                配额即将用完
                              </span>
                              <Button 
                                type="link" 
                                size="small" 
                                onClick={handleNavigateToPricing}
                                style={{ padding: 0, height: 'auto' }}
                              >
                                立即升级
                              </Button>
                            </Space>
                          </div>
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>

            {/* 加量包配额卡片 */}
            <Col span={24}>
              <BoosterQuotaCard onPurchase={handleNavigateToPricing} />
            </Col>
          </Row>
        </TabPane>

        {/* 订单记录标签页 */}
        <TabPane
          tab={
            <span>
              <HistoryOutlined />
              订单记录
            </span>
          }
          key="orders"
        >
          <Card
            title={
              <Space>
                <HistoryOutlined />
                订单记录
                {ordersFromCache && !ordersRefreshing && (
                  <Tooltip title="数据来自缓存">
                    <Tag color="gold">缓存</Tag>
                  </Tooltip>
                )}
                {ordersRefreshing && (
                  <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>
                )}
              </Space>
            }
            extra={<Button icon={<ReloadOutlined />} onClick={fetchOrders}>刷新</Button>}
          >
            <Table
              columns={orderColumns}
              dataSource={Array.isArray(orders) ? orders : []}
              rowKey="order_no"
              loading={ordersLoading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        {/* 个人信息标签页 */}
        <TabPane
          tab={
            <span>
              <UserOutlined />
              个人信息
            </span>
          }
          key="profile"
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="基本信息">
                {userProfile ? (
                  <Descriptions column={2} bordered>
                    <Descriptions.Item label="用户名" span={2}>
                      <Space>
                        <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                        <span style={{ fontSize: 16, fontWeight: 500 }}>{userProfile.username}</span>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="角色">
                      <Tag color={userProfile.role === 'admin' ? 'purple' : 'blue'}>
                        {userProfile.role === 'admin' ? '管理员' : '普通用户'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="用户ID">
                      {userProfile.id}
                    </Descriptions.Item>
                    <Descriptions.Item label="注册时间">
                      {new Date(userProfile.createdAt).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后登录">
                      {userProfile.lastLoginAt 
                        ? new Date(userProfile.lastLoginAt).toLocaleString('zh-CN')
                        : '从未登录'}
                    </Descriptions.Item>
                  </Descriptions>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ color: '#8c8c8c' }}>加载中...</p>
                  </div>
                )}
              </Card>
            </Col>

            <Col span={24}>
              <Card 
                title={
                  <Space>
                    <SafetyOutlined />
                    账户安全
                  </Space>
                }
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* 邮箱管理 */}
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>更换邮箱</strong>
                      {userProfile?.emailVerified && (
                        <Tag color="success" style={{ marginLeft: 8 }}>
                          <CheckCircleOutlined /> 已验证
                        </Tag>
                      )}
                    </div>
                    <div style={{ color: '#8c8c8c', marginBottom: 16 }}>
                      {userProfile?.email 
                        ? `当前邮箱：${userProfile.email}`
                        : '尚未绑定邮箱'}
                    </div>
                    <Button 
                      icon={<MailOutlined />} 
                      onClick={() => setEmailModalVisible(true)}
                    >
                      更换邮箱
                    </Button>
                  </div>

                  {/* 修改密码 */}
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>密码</strong>
                    </div>
                    <div style={{ color: '#8c8c8c', marginBottom: 16 }}>
                      定期修改密码可以提高账户安全性
                    </div>
                    <Button 
                      icon={<KeyOutlined />} 
                      onClick={() => setPasswordModalVisible(true)}
                    >
                      修改密码
                    </Button>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* 代理商中心标签页 */}
        <TabPane
          tab={
            <span>
              <DollarOutlined />
              代理商中心
            </span>
          }
          key="agent"
        >
          {agentLoading ? (
            <Card loading={true} />
          ) : (
            <AgentCenterPage
              isAgent={isAgent}
              agent={agent}
              invitationStats={invitationStats}
              userProfile={userProfile}
              subscription={subscription}
              onAgentApplySuccess={handleAgentApplySuccess}
              onAgentUpdate={handleAgentUpdate}
              onRefreshInvitation={fetchInvitationStats}
            />
          )}
        </TabPane>

        {/* 存储空间标签页 */}
        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              存储空间
            </span>
          }
          key="storage"
        >
          {storageLoading ? (
            <Card loading={true} />
          ) : storageUsage && storageBreakdown ? (
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <StorageUsageCard 
                  usage={storageUsage} 
                  onUpgrade={handleNavigateToPricing}
                />
              </Col>
              <Col span={24}>
                <StorageBreakdownChart breakdown={storageBreakdown} />
              </Col>
            </Row>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>
                无法加载存储数据
              </div>
            </Card>
          )}
        </TabPane>
      </Tabs>

      {/* 修改密码对话框 */}
      <Modal
        title={
          <Space>
            <KeyOutlined />
            修改密码
          </Space>
        }
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            label="当前密码"
            name="currentPassword"
            rules={[
              { required: true, message: '请输入当前密码' }
            ]}
          >
            <Input.Password size="large" placeholder="请输入当前密码" />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码必须至少8个字符' },
              { pattern: /[A-Z]/, message: '密码必须包含至少一个大写字母' },
              { pattern: /[a-z]/, message: '密码必须包含至少一个小写字母' }
            ]}
          >
            <Input.Password size="large" placeholder="至少8位，包含大小写字母" />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password size="large" placeholder="请再次输入新密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setPasswordModalVisible(false);
                passwordForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={passwordLoading}>
                确认修改
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 更换邮箱 Modal */}
      <Modal
        title={
          <Space>
            <MailOutlined />
            更换邮箱
          </Space>
        }
        open={emailModalVisible}
        onCancel={() => {
          setEmailModalVisible(false);
          emailForm.resetFields();
          setEmailCodeSent(false);
          setEmailStep('verify');
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={emailForm}
          layout="vertical"
          onFinish={handleBindEmail}
        >
          {/* 步骤1：验证密码（仅当已有邮箱时） */}
          {userProfile?.email && emailStep === 'verify' && (
            <>
              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8 }}>
                <div style={{ color: '#8c8c8c', fontSize: 13 }}>当前邮箱</div>
                <div style={{ fontWeight: 500 }}>{userProfile.email}</div>
              </div>
              <Form.Item
                label="请输入登录密码验证身份"
                name="password"
                rules={[
                  { required: true, message: '请输入密码' }
                ]}
              >
                <Input.Password 
                  size="large" 
                  placeholder="请输入当前账户密码" 
                />
              </Form.Item>
            </>
          )}

          {/* 步骤2：输入新邮箱并验证 */}
          {(!userProfile?.email || emailStep === 'change') && (
            <>
              {userProfile?.email && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#e6f7ff', borderRadius: 8, borderLeft: '3px solid #1890ff' }}>
                  <div style={{ color: '#1890ff', fontSize: 13 }}>身份验证通过，请输入新邮箱</div>
                </div>
              )}
              <Form.Item
                label="新邮箱地址"
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱地址' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input 
                  size="large" 
                  placeholder="请输入新邮箱地址" 
                  prefix={<MailOutlined />}
                  disabled={emailCodeSent}
                />
              </Form.Item>

              {emailCodeSent && (
                <Form.Item
                  label="验证码"
                  name="code"
                  rules={[
                    { required: true, message: '请输入验证码' },
                    { len: 6, message: '验证码为6位数字' }
                  ]}
                >
                  <Input 
                    size="large" 
                    placeholder="请输入6位验证码" 
                    maxLength={6}
                  />
                </Form.Item>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setEmailModalVisible(false);
                emailForm.resetFields();
                setEmailCodeSent(false);
                setEmailStep('verify');
              }}>
                取消
              </Button>
              {/* 步骤1：验证密码 */}
              {userProfile?.email && emailStep === 'verify' && (
                <Button 
                  type="primary" 
                  onClick={handleSendEmailCode}
                  loading={emailLoading}
                >
                  验证身份
                </Button>
              )}
              {/* 步骤2：发送验证码或确认更换 */}
              {(!userProfile?.email || emailStep === 'change') && !emailCodeSent && (
                <Button 
                  type="primary" 
                  onClick={handleSendEmailCode}
                  loading={emailLoading}
                  disabled={emailCountdown > 0}
                >
                  {emailCountdown > 0 ? `${emailCountdown}秒后重试` : '发送验证码'}
                </Button>
              )}
              {(!userProfile?.email || emailStep === 'change') && emailCodeSent && (
                <>
                  <Button 
                    onClick={handleSendEmailCode}
                    loading={emailLoading}
                    disabled={emailCountdown > 0}
                  >
                    {emailCountdown > 0 ? `${emailCountdown}秒后重发` : '重新发送'}
                  </Button>
                  <Button type="primary" htmlType="submit" loading={emailLoading}>
                    确认更换
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserCenterPage;
