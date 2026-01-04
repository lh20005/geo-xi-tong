import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Progress, Tag, Button, Table, Modal, message, Space, Statistic, Descriptions, Tabs, Input, Form, Divider, Avatar, List } from 'antd';
import { CrownOutlined, ReloadOutlined, RocketOutlined, HistoryOutlined, WarningOutlined, UserOutlined, KeyOutlined, GiftOutlined, CopyOutlined, TeamOutlined, SafetyOutlined } from '@ant-design/icons';
import { apiClient } from '../api/client';
import { getUserWebSocketService } from '../services/UserWebSocketService';

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
}

interface Order {
  order_no: string;
  plan_name: string;
  amount: string | number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface Plan {
  id: number;
  plan_name: string;
  plan_code: string;
  price: string | number;
  billing_cycle: string;
  features: {
    feature_code: string;
    feature_name: string;
    feature_value: number;
  }[];
}

interface UserProfile {
  id: number;
  username: string;
  role: string;
  invitation_code: string;
  created_at: string;
  last_login_at: string | null;
}

interface InvitationStats {
  total_invites: number;
  invited_users: {
    username: string;
    created_at: string;
  }[];
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const UserCenterPage = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [invitationStats, setInvitationStats] = useState<InvitationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('subscription');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [invitationCodeCopied, setInvitationCodeCopied] = useState(false);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        await Promise.all([
          fetchSubscription(),
          fetchUsageStats(),
          fetchOrders(),
          fetchPlans(),
          fetchUserProfile(),
          fetchInvitationStats()
        ]);
      } catch (error) {
        console.error('[UserCenter] 加载数据失败:', error);
      }
    };

    loadAllData();

    const wsService = getUserWebSocketService();
    
    wsService.connect().catch((error) => {
      console.warn('[UserCenter] WebSocket 连接失败:', error);
    });

    const handleQuotaUpdate = (data: any) => {
      console.log('Quota updated:', data);
      message.info('配额已更新');
      fetchUsageStats();
    };

    const handleSubscriptionUpdate = (data: any) => {
      console.log('Subscription updated:', data);
      message.info('订阅信息已更新');
      fetchSubscription();
    };

    const handleOrderStatusChange = (data: any) => {
      console.log('Order status changed:', data);
      message.info('订单状态已更新');
      fetchOrders();
    };

    wsService.on('quota_updated', handleQuotaUpdate);
    wsService.on('subscription_updated', handleSubscriptionUpdate);
    wsService.on('order_status_changed', handleOrderStatusChange);

    return () => {
      wsService.off('quota_updated', handleQuotaUpdate);
      wsService.off('subscription_updated', handleSubscriptionUpdate);
      wsService.off('order_status_changed', handleOrderStatusChange);
    };
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await apiClient.get('/subscription/plans');
      if (response.data.success) {
        const plansData = response.data.data;
        setPlans(Array.isArray(plansData) ? plansData : []);
      } else {
        setPlans([]);
      }
    } catch (error: any) {
      console.error('获取套餐列表失败:', error);
      setPlans([]);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await apiClient.get('/users/profile');
      if (response.data.success) {
        setUserProfile(response.data.data);
      }
    } catch (error: any) {
      console.error('获取用户资料失败:', error);
    }
  };

  const fetchInvitationStats = async () => {
    try {
      const response = await apiClient.get('/invitations/stats');
      if (response.data.success) {
        setInvitationStats(response.data.data);
      }
    } catch (error: any) {
      console.error('获取邀请统计失败:', error);
    }
  };

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/subscription/current');
      if (response.data.success) {
        setSubscription(response.data.data);
      }
    } catch (error: any) {
      console.error('获取订阅信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageStats = async () => {
    try {
      const response = await apiClient.get('/subscription/usage-stats');
      if (response.data.success) {
        const features = response.data.data?.features;
        setUsageStats(Array.isArray(features) ? features : []);
      } else {
        setUsageStats([]);
      }
    } catch (error: any) {
      console.error('获取使用统计失败:', error);
      setUsageStats([]);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await apiClient.get('/orders');
      if (response.data.success) {
        const ordersData = response.data.data?.orders || response.data.data;
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      console.error('获取订单列表失败:', error);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!subscription) return;

    try {
      const response = await apiClient.put('/subscription/auto-renew', {
        auto_renew: !subscription.auto_renew
      });

      if (response.data.success) {
        message.success(response.data.message);
        fetchSubscription();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleShowUpgradeModal = () => {
    setUpgradeModalVisible(true);
  };

  const handleUpgrade = async (planId: number) => {
    try {
      const response = await apiClient.post('/orders', { plan_id: planId });

      if (response.data.success) {
        message.success('订单创建成功，正在跳转支付页面...');
        setUpgradeModalVisible(false);
        const orderNo = response.data.data.order_no;
        window.location.href = `/payment/${orderNo}`;
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建订单失败');
    }
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

  const handleCopyInvitationCode = () => {
    if (userProfile?.invitation_code) {
      navigator.clipboard.writeText(userProfile.invitation_code);
      setInvitationCodeCopied(true);
      message.success('邀请码已复制到剪贴板');
      setTimeout(() => setInvitationCodeCopied(false), 2000);
    }
  };

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
                  </Space>
                }
                loading={loading}
                extra={
                  subscription ? (
                    <Space>
                      <Button
                        type={subscription.auto_renew ? 'default' : 'primary'}
                        onClick={handleToggleAutoRenew}
                      >
                        {subscription.auto_renew ? '关闭自动续费' : '开启自动续费'}
                      </Button>
                      <Button type="primary" icon={<RocketOutlined />} onClick={handleShowUpgradeModal}>
                        升级套餐
                      </Button>
                    </Space>
                  ) : (
                    <Button type="primary" icon={<RocketOutlined />} onClick={handleShowUpgradeModal}>
                      查看套餐
                    </Button>
                  )
                }
              >
                {subscription ? (
                  <Row gutter={16}>
                    <Col span={6}>
                      <Statistic
                        title="当前套餐"
                        value={subscription.plan_name}
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<CrownOutlined />}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="到期时间"
                        value={new Date(subscription.end_date).toLocaleDateString('zh-CN')}
                        valueStyle={{ color: showExpiryWarning ? '#ff4d4f' : '#3f8600' }}
                      />
                      {showExpiryWarning && (
                        <Tag color="warning" style={{ marginTop: 8 }}>
                          <WarningOutlined /> 还有 {daysUntilExpiry} 天到期
                        </Tag>
                      )}
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="订阅状态"
                        value={subscription.status === 'active' ? '正常' : '已过期'}
                        valueStyle={{ color: subscription.status === 'active' ? '#3f8600' : '#cf1322' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="自动续费"
                        value={subscription.auto_renew ? '已开启' : '已关闭'}
                        valueStyle={{ color: subscription.auto_renew ? '#3f8600' : '#8c8c8c' }}
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
                      <Button type="primary" size="large" icon={<RocketOutlined />} onClick={handleShowUpgradeModal}>
                        立即订阅
                      </Button>
                      <Button size="large" onClick={handleShowUpgradeModal}>
                        查看套餐详情
                      </Button>
                    </Space>
                  </div>
                )}
              </Card>
            </Col>

            <Col span={24}>
              <Card title="使用统计" extra={<Button icon={<ReloadOutlined />} onClick={fetchUsageStats}>刷新</Button>}>
                <Row gutter={[16, 16]}>
                  {usageStats.map(stat => (
                    <Col span={12} key={stat.feature_code}>
                      <Card size="small" variant="borderless" style={{ background: '#fafafa' }}>
                        <div style={{ marginBottom: 8 }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>{stat.feature_name}</span>
                            <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                              {stat.reset_period === 'daily' ? '每日重置' : 
                               stat.reset_period === 'monthly' ? '每月重置' : '永久'}
                            </span>
                          </Space>
                        </div>
                        <Progress
                          percent={stat.percentage}
                          strokeColor={getProgressColor(stat.percentage)}
                          format={() => `${stat.used} / ${stat.limit === -1 ? '∞' : stat.limit}`}
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
                                onClick={handleShowUpgradeModal}
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
                      {new Date(userProfile.created_at).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后登录">
                      {userProfile.last_login_at 
                        ? new Date(userProfile.last_login_at).toLocaleString('zh-CN')
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

        {/* 邀请系统标签页 */}
        <TabPane
          tab={
            <span>
              <TeamOutlined />
              邀请系统
            </span>
          }
          key="invitation"
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <GiftOutlined />
                    我的邀请码
                  </Space>
                }
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
                styles={{ header: { color: 'white', borderBottom: '1px solid rgba(255,255,255,0.2)' } }}
              >
                {userProfile ? (
                  <div>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: 8, 
                      padding: 24,
                      marginBottom: 16
                    }}>
                      <Row align="middle" justify="space-between">
                        <Col>
                          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.9 }}>邀请码</div>
                          <div style={{ 
                            fontSize: 36, 
                            fontWeight: 'bold', 
                            letterSpacing: 4,
                            fontFamily: 'monospace'
                          }}>
                            {userProfile.invitation_code}
                          </div>
                        </Col>
                        <Col>
                          <Button
                            size="large"
                            icon={<CopyOutlined />}
                            onClick={handleCopyInvitationCode}
                            style={{ 
                              background: 'white', 
                              color: '#667eea',
                              border: 'none',
                              fontWeight: 500
                            }}
                          >
                            {invitationCodeCopied ? '已复制!' : '复制'}
                          </Button>
                        </Col>
                      </Row>
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.9 }}>
                      分享您的邀请码，邀请好友加入平台
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p>加载中...</p>
                  </div>
                )}
              </Card>
            </Col>

            <Col span={24}>
              <Card
                title={
                  <Space>
                    <TeamOutlined />
                    邀请统计
                  </Space>
                }
                extra={<Button icon={<ReloadOutlined />} onClick={fetchInvitationStats}>刷新</Button>}
              >
                {invitationStats ? (
                  <>
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                      <Col span={24}>
                        <Card 
                          style={{ 
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none'
                          }}
                        >
                          <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>累计邀请</span>}
                            value={invitationStats.total_invites}
                            valueStyle={{ color: 'white', fontSize: 48 }}
                            suffix={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 20 }}>人</span>}
                          />
                        </Card>
                      </Col>
                    </Row>

                    {invitationStats.invited_users && Array.isArray(invitationStats.invited_users) && invitationStats.invited_users.length > 0 ? (
                      <div>
                        <Divider orientation="left">受邀用户列表</Divider>
                        <List
                          dataSource={Array.isArray(invitationStats.invited_users) ? invitationStats.invited_users : []}
                          renderItem={(user) => (
                            <List.Item>
                              <List.Item.Meta
                                avatar={
                                  <Avatar 
                                    style={{ backgroundColor: '#1890ff' }}
                                    size="large"
                                  >
                                    {user.username.charAt(0).toUpperCase()}
                                  </Avatar>
                                }
                                title={<span style={{ fontSize: 16 }}>{user.username}</span>}
                                description={`加入时间: ${new Date(user.created_at).toLocaleString('zh-CN')}`}
                              />
                            </List.Item>
                          )}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <TeamOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
                        <p style={{ color: '#8c8c8c', fontSize: 16 }}>还没有邀请任何用户</p>
                        <p style={{ color: '#bfbfbf', fontSize: 14 }}>分享您的邀请码开始邀请好友吧</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ color: '#8c8c8c' }}>加载中...</p>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* 升级引导对话框 */}
      <Modal
        title="选择套餐"
        open={upgradeModalVisible}
        onCancel={() => setUpgradeModalVisible(false)}
        footer={null}
        width={900}
      >
        <Row gutter={[16, 16]}>
          {plans.map(plan => {
            const currentPlanCode = subscription?.plan?.plan_code;
            const isCurrentPlan = currentPlanCode === plan.plan_code;
            
            const planLevels: { [key: string]: number } = {
              'free': 1,
              'professional': 2,
              'enterprise': 3
            };
            
            const currentLevel = planLevels[currentPlanCode || ''] || 0;
            const planLevel = planLevels[plan.plan_code] || 0;
            
            const isUpgrade = planLevel > currentLevel;
            const isDowngrade = planLevel < currentLevel;
            const hasPurchased = subscription !== null;

            let cardStyle: React.CSSProperties = {
              height: '100%',
              transition: 'all 0.3s ease',
              border: '1px solid #d9d9d9'
            };

            if (isCurrentPlan) {
              cardStyle.border = '2px solid #1890ff';
              cardStyle.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.15)';
            }

            let buttonText = '立即购买';
            let buttonType: 'primary' | 'default' | 'dashed' = 'primary';
            let buttonDisabled = false;
            let buttonIcon = <RocketOutlined />;
            let tagColor = '';
            let tagText = '';

            if (isCurrentPlan) {
              tagColor = 'blue';
              tagText = '当前套餐';
              buttonText = '已购买';
              buttonType = 'default';
              buttonDisabled = true;
            } else if (hasPurchased) {
              if (isUpgrade) {
                tagColor = 'green';
                tagText = '推荐升级';
                buttonText = '立即升级';
                buttonType = 'primary';
                buttonIcon = <RocketOutlined />;
              } else if (isDowngrade) {
                tagColor = 'blue';
                tagText = '已购买';
                buttonText = '已购买';
                buttonType = 'default';
                buttonDisabled = true;
              } else {
                tagColor = 'blue';
                tagText = '已购买';
                buttonText = '已购买';
                buttonType = 'default';
                buttonDisabled = true;
              }
            } else {
              tagColor = 'purple';
              tagText = '推荐';
              buttonText = '立即购买';
              buttonType = 'primary';
            }

            return (
              <Col span={8} key={plan.id}>
                <Card
                  hoverable={!isCurrentPlan && !buttonDisabled}
                  style={cardStyle}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{plan.plan_name}</h3>
                      </div>
                      <Tag color={tagColor} style={{ marginBottom: 8 }}>
                        {tagText}
                      </Tag>
                      <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                        ¥{formatPrice(plan.price)}
                        <span style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 'normal' }}>/月</span>
                      </div>
                    </div>

                    <Divider style={{ margin: '8px 0' }} />

                    <div style={{ minHeight: 180 }}>
                      <Descriptions column={1} size="small" bordered>
                        {plan.features.map(f => (
                          <Descriptions.Item 
                            key={f.feature_code} 
                            label={<span style={{ fontSize: 12 }}>{f.feature_name}</span>}
                          >
                            <span style={{ fontWeight: 500 }}>
                              {f.feature_value === -1 ? '无限制' : f.feature_value}
                            </span>
                          </Descriptions.Item>
                        ))}
                      </Descriptions>
                    </div>

                    <Button
                      type={buttonType}
                      block
                      size="large"
                      onClick={() => !buttonDisabled && handleUpgrade(plan.id)}
                      icon={buttonIcon}
                      disabled={buttonDisabled}
                      style={{
                        marginTop: 8,
                        height: 44,
                        fontSize: 16,
                        fontWeight: 500
                      }}
                    >
                      {buttonText}
                    </Button>

                    <div style={{ 
                      textAlign: 'center', 
                      fontSize: 12,
                      marginTop: 8,
                      minHeight: 20
                    }}>
                      {isUpgrade && hasPurchased && (
                        <span style={{ color: '#52c41a' }}>
                          推荐升级 · 按剩余天数计算差价
                        </span>
                      )}
                      {(isCurrentPlan || (isDowngrade && hasPurchased)) && (
                        <span style={{ color: '#8c8c8c' }}>
                          已享受此套餐的所有功能
                        </span>
                      )}
                      {!hasPurchased && (
                        <span style={{ color: '#8c8c8c' }}>
                          &nbsp;
                        </span>
                      )}
                    </div>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Modal>

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
              { min: 6, message: '密码长度至少为6位' }
            ]}
          >
            <Input.Password size="large" placeholder="请输入新密码（至少6位）" />
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
    </div>
  );
};

export default UserCenterPage;
