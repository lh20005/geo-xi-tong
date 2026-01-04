import { useState, useEffect } from 'react';
import { Card, Row, Col, Progress, Tag, Button, Table, Modal, message, Space, Statistic, Descriptions } from 'antd';
import { CrownOutlined, ReloadOutlined, RocketOutlined, HistoryOutlined, WarningOutlined } from '@ant-design/icons';
import { apiClient } from '../api/client';
import { getUserWebSocketService } from '../services/UserWebSocketService';

interface Subscription {
  id: number;
  plan_name: string;
  plan_code: string;
  start_date: string;
  end_date: string;
  status: string;
  auto_renew: boolean;
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
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface Plan {
  id: number;
  plan_name: string;
  plan_code: string;
  price: number;
  billing_cycle: string;
  features: {
    feature_code: string;
    feature_name: string;
    feature_value: number;
  }[];
}

const UserCenterPage = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchUsageStats();
    fetchOrders();
    fetchPlans();

    // Setup WebSocket for real-time updates
    const wsService = getUserWebSocketService();
    
    // Connect to WebSocket
    wsService.connect().catch((error) => {
      console.error('WebSocket connection failed:', error);
    });

    // Subscribe to quota updates
    const handleQuotaUpdate = (data: any) => {
      console.log('Quota updated:', data);
      message.info('配额已更新');
      fetchUsageStats();
    };

    // Subscribe to subscription updates
    const handleSubscriptionUpdate = (data: any) => {
      console.log('Subscription updated:', data);
      message.info('订阅信息已更新');
      fetchSubscription();
    };

    // Subscribe to order status changes
    const handleOrderStatusChange = (data: any) => {
      console.log('Order status changed:', data);
      message.info('订单状态已更新');
      fetchOrders();
    };

    wsService.on('quota_updated', handleQuotaUpdate);
    wsService.on('subscription_updated', handleSubscriptionUpdate);
    wsService.on('order_status_changed', handleOrderStatusChange);

    // Cleanup on unmount
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
        setPlans(response.data.data);
      }
    } catch (error: any) {
      console.error('获取套餐列表失败:', error);
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
        setUsageStats(response.data.data.features);
      }
    } catch (error: any) {
      console.error('获取使用统计失败:', error);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await apiClient.get('/orders');

      if (response.data.success) {
        // 后端返回的数据结构是 { data: { orders: [...], pagination: {...} } }
        const ordersData = response.data.data?.orders || response.data.data;
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      }
    } catch (error: any) {
      console.error('获取订单列表失败:', error);
      setOrders([]); // 确保失败时也设置为空数组
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!subscription) return;

    try {
      const response = await apiClient.put(
        '/subscription/auto-renew',
        { auto_renew: !subscription.auto_renew }
      );

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
      const response = await apiClient.post(
        '/orders',
        { plan_id: planId }
      );

      if (response.data.success) {
        message.success('订单创建成功，正在跳转支付页面...');
        setUpgradeModalVisible(false);
        // 跳转到支付页面
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
      render: (amount: number) => `¥${amount.toFixed(2)}`
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

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        {/* 订阅信息卡片 */}
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
              subscription && (
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
                      还有 {daysUntilExpiry} 天到期
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
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: 16, color: '#8c8c8c', marginBottom: 16 }}>
                  您还没有订阅任何套餐
                </p>
                <Button type="primary" size="large">
                  立即订阅
                </Button>
              </div>
            )}
          </Card>
        </Col>

        {/* 使用统计卡片 */}
        <Col span={24}>
          <Card title="使用统计" extra={<Button icon={<ReloadOutlined />} onClick={fetchUsageStats}>刷新</Button>}>
            <Row gutter={[16, 16]}>
              {usageStats.map(stat => (
                <Col span={12} key={stat.feature_code}>
                  <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
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

        {/* 订单记录卡片 */}
        <Col span={24}>
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
              dataSource={orders}
              rowKey="order_no"
              loading={ordersLoading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 升级引导对话框 */}
      <Modal
        title="选择套餐"
        open={upgradeModalVisible}
        onCancel={() => setUpgradeModalVisible(false)}
        footer={null}
        width={800}
      >
        <Row gutter={[16, 16]}>
          {plans.map(plan => {
            const isCurrentPlan = subscription?.plan_code === plan.plan_code;
            const currentPlanPrice = plans.find(p => p.plan_code === subscription?.plan_code)?.price || 0;
            const isUpgrade = plan.price > currentPlanPrice;

            return (
              <Col span={8} key={plan.id}>
                <Card
                  hoverable={!isCurrentPlan}
                  style={{
                    border: isCurrentPlan ? '2px solid #1890ff' : '1px solid #d9d9d9',
                    height: '100%'
                  }}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                      <h3>{plan.plan_name}</h3>
                      {isCurrentPlan && <Tag color="blue">当前套餐</Tag>}
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                        ¥{plan.price.toFixed(2)}
                        <span style={{ fontSize: 14, color: '#8c8c8c' }}>/月</span>
                      </div>
                    </div>

                    <Descriptions column={1} size="small">
                      {plan.features.map(f => (
                        <Descriptions.Item key={f.feature_code} label={f.feature_name}>
                          {f.feature_value === -1 ? '无限制' : f.feature_value}
                        </Descriptions.Item>
                      ))}
                    </Descriptions>

                    {!isCurrentPlan && isUpgrade && (
                      <Button
                        type="primary"
                        block
                        onClick={() => handleUpgrade(plan.id)}
                        icon={<RocketOutlined />}
                      >
                        立即升级
                      </Button>
                    )}
                    {!isCurrentPlan && !isUpgrade && (
                      <Button block disabled>
                        不支持降级
                      </Button>
                    )}
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Modal>
    </div>
  );
};

export default UserCenterPage;
