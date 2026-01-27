/**
 * 套餐卡片组件
 * 在工作台展示付费套餐，便于用户快速购买
 * 移动端采用横向滑动卡片设计
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Button, Skeleton, Typography, Space, Modal, Spin, message } from 'antd';
import { 
  CrownOutlined, 
  CheckCircleOutlined,
  ShoppingCartOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ReloadOutlined
} from '@ant-design/icons';
import { apiClient } from '../../api/client';

const { Text, Title } = Typography;

interface PlanFeature {
  feature_code: string;
  feature_name: string;
  feature_value: number;
  feature_unit: string;
}

interface Plan {
  id: number;
  plan_name: string;
  plan_code: string;
  price: number;
  billing_cycle: string;
  description: string;
  features: PlanFeature[];
  is_active?: boolean;
  display_order?: number;
}

// 套餐标签配置 - 与营销页面保持一致
const getPlanBadge = (planCode: string) => {
  const badges: { [key: string]: { text: string; color: string } } = {
    'free': { text: '入门首选', color: '#faad14' },
    'professional': { text: '最受欢迎', color: '#faad14' },
    'enterprise': { text: '运营必备', color: '#faad14' },
    'qyb': { text: '高性价比', color: '#faad14' }
  };
  return badges[planCode] || { text: '随时加量', color: '#faad14' };
};


// 格式化功能值显示
const formatFeatureValue = (value: number, unit: string) => {
  if (value === -1) return '不限';
  if (unit === 'MB' && value >= 1024) {
    return `${(value / 1024).toFixed(0)}GB`;
  }
  return `${value}${unit}`;
};

// 格式化价格
const formatPrice = (price: number | string) => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice) || numPrice === 0) return '免费';
  return numPrice.toFixed(2);
};

// 格式化倒计时
const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const PlanCards: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // 支付弹窗状态
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | 'timeout'>('pending');
  const [countdown, setCountdown] = useState(600);
  const [pollingCount, setPollingCount] = useState(0);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/subscription/plans?plan_type=all');
      if (response.data.success && response.data.data?.length > 0) {
        const paidPlans = response.data.data.filter(
          (plan: Plan) => plan.plan_code !== 'free' && plan.is_active !== false
        );
        setPlans(paidPlans);
      }
    } catch (error) {
      console.error('获取套餐列表失败:', error);
    } finally {
      setLoading(false);
    }
  };


  // 创建订单
  const createOrder = async (planId: number) => {
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const response = await apiClient.post('/orders', {
        plan_id: planId,
        order_type: 'purchase'
      });
      if (response.data.success) {
        setQrCodeUrl(response.data.data.qr_code_url);
        setOrderNo(response.data.data.order_no);
      } else {
        setPaymentError(response.data.message || '创建订单失败');
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        setPaymentError('登录已过期，请重新登录');
      } else {
        setPaymentError(error.response?.data?.message || '创建订单失败，请稍后重试');
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  // 轮询订单状态
  const pollOrderStatus = async () => {
    if (!orderNo) return;
    try {
      const response = await apiClient.get(`/orders/${orderNo}/status`);
      if (response.data.success) {
        const status = response.data.data.status;
        if (status === 'paid') {
          setPaymentStatus('success');
          stopPolling();
          message.success('支付成功！');
        } else if (status === 'failed' || status === 'closed') {
          setPaymentStatus('failed');
          stopPolling();
        }
      }
      setPollingCount(prev => prev + 1);
    } catch (error) {
      console.error('查询订单状态失败:', error);
    }
  };

  // 停止轮询和倒计时
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };


  // 处理购买点击
  const handlePurchase = (plan: Plan) => {
    setSelectedPlan(plan);
    setPaymentModalOpen(true);
    setPaymentStatus('pending');
    setPaymentError('');
    setCountdown(600);
    setPollingCount(0);
    createOrder(plan.id);
  };

  // 关闭支付弹窗
  const handleClosePayment = () => {
    stopPolling();
    setPaymentModalOpen(false);
    setSelectedPlan(null);
    setQrCodeUrl('');
    setOrderNo('');
    setPaymentStatus('pending');
    setPaymentError('');
    setCountdown(600);
    setPollingCount(0);
  };

  // 重新支付
  const handleRetry = () => {
    if (selectedPlan) {
      setPaymentStatus('pending');
      setPaymentError('');
      setCountdown(600);
      setPollingCount(0);
      createOrder(selectedPlan.id);
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // 当 orderNo 变化时开始轮询
  useEffect(() => {
    if (orderNo && paymentStatus === 'pending') {
      pollOrderStatus();
      const interval = pollingCount < 15 ? 2000 : 5000;
      pollingIntervalRef.current = setInterval(pollOrderStatus, interval);
      
      // 倒计时
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setPaymentStatus('timeout');
            stopPolling();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => stopPolling();
  }, [orderNo]);

  if (loading) {
    return (
      <Card style={{ borderRadius: 12, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  if (plans.length === 0) return null;


  // 渲染单个套餐卡片
  const renderPlanCard = (plan: Plan) => {
    const badge = getPlanBadge(plan.plan_code);
    const price = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;

    return (
      <div
        key={plan.id}
        style={{
          background: '#fff',
          borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? '14px' : '20px',
          minWidth: isMobile ? 260 : 'auto',
          width: isMobile ? 260 : '100%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          transition: 'transform 0.3s, box-shadow 0.3s',
          overflow: 'hidden',
          scrollSnapAlign: 'center'
        }}
      >
        {/* 标签 */}
        <div style={{
          position: 'absolute',
          top: isMobile ? 10 : 12,
          right: isMobile ? -28 : -30,
          background: badge.color,
          color: '#000',
          padding: isMobile ? '3px 35px' : '4px 40px',
          fontSize: isMobile ? 10 : 12,
          fontWeight: 600,
          transform: 'rotate(45deg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          {badge.text}
        </div>

        {/* 套餐名称 */}
        <Title level={isMobile ? 5 : 4} style={{ margin: '0 0 6px', color: '#262626' }}>
          {plan.plan_name}
        </Title>
        
        {/* 描述 */}
        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13, marginBottom: isMobile ? 12 : 16 }}>
          {plan.description || '专业版套餐'}
        </Text>

        {/* 价格 */}
        <div style={{ marginBottom: isMobile ? 14 : 20 }}>
          <Text style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, color: '#1890ff' }}>
            ¥{formatPrice(price)}
          </Text>
          <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14, marginLeft: 4 }}>
            /{plan.billing_cycle === 'yearly' ? '年' : '月'}
          </Text>
        </div>

        {/* 功能列表 */}
        <div style={{ flex: 1, marginBottom: isMobile ? 14 : 20 }}>
          {plan.features?.map((feature) => (
            <div key={feature.feature_code} style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? 6 : 10 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: isMobile ? 12 : 14, marginRight: isMobile ? 6 : 8 }} />
              <Text style={{ fontSize: isMobile ? 11 : 13, color: '#595959' }}>
                {feature.feature_name}{' '}
                <Text strong style={{ color: '#262626' }}>{formatFeatureValue(feature.feature_value, feature.feature_unit)}</Text>
              </Text>
            </div>
          ))}
        </div>

        {/* 购买按钮 */}
        <Button
          type="primary"
          block
          size={isMobile ? 'middle' : 'large'}
          icon={<ShoppingCartOutlined />}
          onClick={() => handlePurchase(plan)}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            height: isMobile ? 38 : 44,
            borderRadius: isMobile ? 8 : 10,
            fontSize: isMobile ? 14 : 15,
            fontWeight: 600
          }}
        >
          立即购买
        </Button>
      </div>
    );
  };

  return (
    <>
      <Card
        style={{ 
          borderRadius: 12, 
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          marginBottom: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none'
        }}
        styles={{ body: { padding: isMobile ? '16px' : '24px' } }}
      >
        {/* 标题区域 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          marginBottom: isMobile ? 14 : 20
        }}>
          <CrownOutlined style={{ fontSize: isMobile ? 20 : 24, color: '#ffd700', marginRight: isMobile ? 8 : 12 }} />
          <Text strong style={{ fontSize: isMobile ? 15 : 18, color: '#fff' }}>
            升级套餐，解锁更多功能
          </Text>
        </div>

        {/* 移动端：横向滑动卡片 */}
        {isMobile ? (
          <>
            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 8,
                marginBottom: 8
              }}
            >
              {plans.map(renderPlanCard)}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                ← 左右滑动查看更多套餐 →
              </Text>
            </div>
          </>
        ) : (
          /* 桌面端：横向均匀分布 */
          <Row gutter={[20, 20]} justify="space-between">
            {plans.map((plan) => (
              <Col 
                xs={24} 
                sm={24} 
                md={plans.length <= 3 ? 24 / plans.length : 8} 
                lg={plans.length <= 3 ? 24 / plans.length : 8}
                key={plan.id}
                style={{ display: 'flex' }}
              >
                {renderPlanCard(plan)}
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* 支付弹窗 */}
      <Modal
        open={paymentModalOpen}
        onCancel={handleClosePayment}
        footer={null}
        width={isMobile ? '95%' : 480}
        centered
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: isMobile ? 16 : 24 }}>
          {/* 关闭按钮 */}
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleClosePayment}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
          />

          {/* 支付成功 */}
          {paymentStatus === 'success' && (
            <div style={{ textAlign: 'center', padding: isMobile ? '16px 0' : '20px 0' }}>
              <CheckCircleFilled style={{ fontSize: isMobile ? 60 : 80, color: '#52c41a', marginBottom: isMobile ? 16 : 24 }} />
              <Title level={isMobile ? 4 : 3} style={{ marginBottom: 8 }}>支付成功！</Title>
              <Text style={{ fontSize: isMobile ? 14 : 16, color: '#666' }}>
                您的 <Text strong style={{ color: '#1890ff' }}>{selectedPlan?.plan_name}</Text> 已开通
              </Text>
              <div style={{ 
                background: '#f6ffed', 
                border: '1px solid #b7eb8f', 
                borderRadius: 8, 
                padding: isMobile ? 12 : 16, 
                margin: isMobile ? '16px 0' : '24px 0' 
              }}>
                <Text style={{ color: '#52c41a', fontSize: isMobile ? 12 : 14 }}>订单号: {orderNo}</Text>
              </div>
              <Button 
                type="primary" 
                size={isMobile ? 'middle' : 'large'}
                block
                onClick={handleClosePayment}
                style={{ height: isMobile ? 40 : 44 }}
              >
                完成
              </Button>
            </div>
          )}

          {/* 支付失败 */}
          {paymentStatus === 'failed' && (
            <div style={{ textAlign: 'center', padding: isMobile ? '16px 0' : '20px 0' }}>
              <CloseCircleFilled style={{ fontSize: isMobile ? 60 : 80, color: '#ff4d4f', marginBottom: isMobile ? 16 : 24 }} />
              <Title level={isMobile ? 4 : 3} style={{ marginBottom: 8 }}>支付失败</Title>
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>订单号: {orderNo}</Text>
              <div style={{ 
                background: '#fff2f0', 
                border: '1px solid #ffccc7', 
                borderRadius: 8, 
                padding: isMobile ? 12 : 16, 
                margin: isMobile ? '16px 0' : '24px 0' 
              }}>
                <Text style={{ color: '#ff4d4f', fontSize: isMobile ? 12 : 14 }}>如果您已完成支付但显示失败，请联系客服处理</Text>
              </div>
              <Space style={{ width: '100%' }}>
                <Button size={isMobile ? 'middle' : 'large'} onClick={handleClosePayment} style={{ flex: 1 }}>
                  关闭
                </Button>
                <Button type="primary" size={isMobile ? 'middle' : 'large'} onClick={handleRetry} style={{ flex: 1 }}>
                  重新支付
                </Button>
              </Space>
            </div>
          )}

          {/* 支付超时 */}
          {paymentStatus === 'timeout' && (
            <div style={{ textAlign: 'center', padding: isMobile ? '16px 0' : '20px 0' }}>
              <ClockCircleOutlined style={{ fontSize: isMobile ? 60 : 80, color: '#faad14', marginBottom: isMobile ? 16 : 24 }} />
              <Title level={isMobile ? 4 : 3} style={{ marginBottom: 8 }}>支付超时</Title>
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>二维码已过期，请重新创建订单</Text>
              <div style={{ 
                background: '#fffbe6', 
                border: '1px solid #ffe58f', 
                borderRadius: 8, 
                padding: isMobile ? 12 : 16, 
                margin: isMobile ? '16px 0' : '24px 0' 
              }}>
                <Text style={{ color: '#d48806', fontSize: isMobile ? 12 : 14 }}>订单号: {orderNo}</Text>
              </div>
              <Space style={{ width: '100%' }}>
                <Button size={isMobile ? 'middle' : 'large'} onClick={handleClosePayment} style={{ flex: 1 }}>
                  关闭
                </Button>
                <Button type="primary" size={isMobile ? 'middle' : 'large'} icon={<ReloadOutlined />} onClick={handleRetry} style={{ flex: 1 }}>
                  重新支付
                </Button>
              </Space>
            </div>
          )}

          {/* 支付中 */}
          {paymentStatus === 'pending' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: isMobile ? 14 : 20 }}>
                <Title level={isMobile ? 5 : 4} style={{ marginBottom: 8 }}>微信扫码支付</Title>
                <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>请使用微信扫描下方二维码完成支付</Text>
                
                {/* 倒计时 */}
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  background: '#e6f7ff', 
                  border: '1px solid #91d5ff',
                  borderRadius: 8,
                  padding: isMobile ? '6px 12px' : '8px 16px',
                  marginTop: 12
                }}>
                  <ClockCircleOutlined style={{ color: '#1890ff', marginRight: 8, fontSize: isMobile ? 12 : 14 }} />
                  <Text style={{ color: '#1890ff', fontSize: isMobile ? 12 : 14 }}>
                    剩余时间: <Text strong>{formatCountdown(countdown)}</Text>
                  </Text>
                </div>
              </div>

              {/* 订单信息 */}
              <div style={{ 
                background: 'linear-gradient(135deg, #e6f7ff 0%, #f9f0ff 100%)', 
                borderRadius: 12, 
                padding: isMobile ? 12 : 16, 
                marginBottom: isMobile ? 14 : 20 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>套餐：</Text>
                  <Text strong style={{ fontSize: isMobile ? 12 : 14 }}>{selectedPlan?.plan_name}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>支付金额：</Text>
                  <Text style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#ff4d4f' }}>
                    ¥{selectedPlan ? formatPrice(selectedPlan.price) : '0.00'}
                  </Text>
                </div>
                {orderNo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #d9d9d9' }}>
                    <Text type="secondary" style={{ fontSize: isMobile ? 10 : 12 }}>订单号：</Text>
                    <Text style={{ fontSize: isMobile ? 10 : 12, fontFamily: 'monospace' }}>{orderNo}</Text>
                  </div>
                )}
              </div>

              {/* 二维码 */}
              {paymentLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: isMobile ? 180 : 240 }}>
                  <Spin size="large" tip="正在创建订单..." />
                </div>
              )}

              {paymentError && (
                <div style={{ 
                  background: '#fff2f0', 
                  border: '1px solid #ffccc7', 
                  borderRadius: 8, 
                  padding: isMobile ? 12 : 16, 
                  marginBottom: 16,
                  textAlign: 'center'
                }}>
                  <Text style={{ color: '#ff4d4f', fontSize: isMobile ? 12 : 14 }}>{paymentError}</Text>
                </div>
              )}

              {qrCodeUrl && !paymentLoading && !paymentError && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? 14 : 20 }}>
                    <div style={{ 
                      border: '4px solid #1890ff', 
                      borderRadius: 12, 
                      padding: isMobile ? 6 : 8,
                      background: '#fff'
                    }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=${isMobile ? '160x160' : '200x200'}&data=${encodeURIComponent(qrCodeUrl)}`}
                        alt="支付二维码"
                        style={{ width: isMobile ? 160 : 200, height: isMobile ? 160 : 200, display: 'block' }}
                      />
                    </div>
                  </div>

                  {/* 支付步骤 */}
                  <div style={{ background: '#fafafa', borderRadius: 8, padding: isMobile ? 12 : 16, marginBottom: isMobile ? 12 : 16 }}>
                    <Space direction="vertical" size={isMobile ? 6 : 8} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ 
                          width: isMobile ? 18 : 20, height: isMobile ? 18 : 20, 
                          background: '#1890ff', 
                          borderRadius: '50%', 
                          color: '#fff', 
                          fontSize: isMobile ? 10 : 12, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: 8,
                          flexShrink: 0
                        }}>1</div>
                        <Text style={{ fontSize: isMobile ? 12 : 13 }}>打开微信，点击右上角"+"</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ 
                          width: isMobile ? 18 : 20, height: isMobile ? 18 : 20, 
                          background: '#1890ff', 
                          borderRadius: '50%', 
                          color: '#fff', 
                          fontSize: isMobile ? 10 : 12, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: 8,
                          flexShrink: 0
                        }}>2</div>
                        <Text style={{ fontSize: isMobile ? 12 : 13 }}>选择"扫一扫"，扫描上方二维码</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ 
                          width: isMobile ? 18 : 20, height: isMobile ? 18 : 20, 
                          background: '#1890ff', 
                          borderRadius: '50%', 
                          color: '#fff', 
                          fontSize: isMobile ? 10 : 12, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: 8,
                          flexShrink: 0
                        }}>3</div>
                        <Text style={{ fontSize: isMobile ? 12 : 13 }}>确认金额后完成支付</Text>
                      </div>
                    </Space>
                  </div>

                  {/* 提示 */}
                  <div style={{ 
                    background: '#e6f7ff', 
                    border: '1px solid #91d5ff', 
                    borderRadius: 8, 
                    padding: isMobile ? 10 : 12 
                  }}>
                    <Text style={{ color: '#1890ff', fontSize: isMobile ? 11 : 13 }}>
                      💡 支付完成后页面将自动更新，请勿关闭此窗口
                    </Text>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default PlanCards;
