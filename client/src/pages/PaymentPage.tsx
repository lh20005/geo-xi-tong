import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, message, Result, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface OrderInfo {
  order_no: string;
  amount: number;
  plan_name: string;
  status: string;
  qr_code_url?: string;
}

export default function PaymentPage() {
  const { orderNo } = useParams<{ orderNo: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // 获取订单信息
  const fetchOrderInfo = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${API_BASE_URL}/api/orders/${orderNo}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const order = response.data.data;
        setOrderInfo(order);
        
        // 如果订单已支付，停止轮询
        if (order.status === 'paid') {
          setPaymentStatus('success');
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
        } else if (order.status === 'failed' || order.status === 'closed') {
          setPaymentStatus('failed');
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
        }
      }
    } catch (error: any) {
      console.error('获取订单信息失败:', error);
      message.error('获取订单信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 轮询订单状态
  useEffect(() => {
    fetchOrderInfo();

    // 每3秒轮询一次订单状态
    const interval = setInterval(() => {
      fetchOrderInfo();
    }, 3000);

    setPollingInterval(interval);

    // 清理定时器
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [orderNo]);

  // 支付成功页面
  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <Result
            status="success"
            title="支付成功！"
            subTitle={`订单号: ${orderNo}`}
            extra={[
              <Button type="primary" key="console" onClick={() => navigate('/user-center')}>
                返回个人中心
              </Button>,
              <Button key="orders" onClick={() => navigate('/user-center?tab=orders')}>
                查看订单
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  // 支付失败页面
  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <Result
            status="error"
            title="支付失败"
            subTitle={`订单号: ${orderNo}`}
            extra={[
              <Button type="primary" key="retry" onClick={() => navigate('/user-center')}>
                返回重试
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  // 加载中
  if (loading || !orderInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" tip="加载订单信息..." />
      </div>
    );
  }

  // 支付页面
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">微信扫码支付</h2>
          <p className="text-gray-500 mb-6">请使用微信扫描下方二维码完成支付</p>

          {/* 订单信息 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">套餐名称：</span>
              <span className="font-medium">{orderInfo.plan_name}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">订单号：</span>
              <span className="font-mono text-sm">{orderInfo.order_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">支付金额：</span>
              <span className="text-2xl font-bold text-red-600">¥{orderInfo.amount}</span>
            </div>
          </div>

          {/* 二维码 */}
          <div className="flex justify-center mb-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              {orderInfo.qr_code_url ? (
                <QRCodeSVG value={orderInfo.qr_code_url} size={200} />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded">
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
                </div>
              )}
            </div>
          </div>

          {/* 提示信息 */}
          <div className="text-sm text-gray-500 mb-4">
            <p className="mb-2">💡 支付完成后，页面将自动跳转</p>
            <p>如长时间未跳转，请刷新页面或联系客服</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <Button 
              block 
              onClick={() => navigate('/user-center')}
            >
              取消支付
            </Button>
            <Button 
              type="primary" 
              block 
              onClick={fetchOrderInfo}
            >
              刷新状态
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
