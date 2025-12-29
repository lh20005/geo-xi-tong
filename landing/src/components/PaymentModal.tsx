import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config/env';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: number;
  planName: string;
  price: number;
}

export default function PaymentModal({ isOpen, onClose, planId, planName, price }: PaymentModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [orderNo, setOrderNo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  // 创建订单并获取二维码
  useEffect(() => {
    if (isOpen && planId) {
      createOrder();
    }
  }, [isOpen, planId]);

  // 轮询订单状态
  useEffect(() => {
    if (!orderNo || paymentStatus !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(
          `${config.apiUrl}/orders/${orderNo}/status`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (response.data.success) {
          const status = response.data.data.status;
          if (status === 'paid') {
            setPaymentStatus('success');
            clearInterval(interval);
          } else if (status === 'failed' || status === 'closed') {
            setPaymentStatus('failed');
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
      }
    }, 2000); // 每2秒查询一次

    return () => clearInterval(interval);
  }, [orderNo, paymentStatus]);

  const createOrder = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setError('请先登录');
        return;
      }

      const response = await axios.post(
        `${config.apiUrl}/orders`,
        {
          plan_id: planId,
          order_type: 'purchase'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setQrCodeUrl(response.data.data.qr_code_url);
        setOrderNo(response.data.data.order_no);
      } else {
        setError(response.data.message || '创建订单失败');
      }
    } catch (error: any) {
      console.error('创建订单失败:', error);
      if (error.response?.status === 401) {
        setError('登录已过期，请重新登录');
      } else {
        setError(error.response?.data?.message || '创建订单失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQrCodeUrl('');
    setOrderNo('');
    setPaymentStatus('pending');
    setError('');
    onClose();
  };

  const handleSuccess = () => {
    handleClose();
    // 跳转到系统应用
    const token = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (token && refreshToken && userInfo) {
      const params = new URLSearchParams({
        token,
        refresh_token: refreshToken,
        user_info: userInfo
      });
      window.location.href = `${config.clientUrl}?${params.toString()}`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 支付成功 */}
        {paymentStatus === 'success' && (
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-20 h-20 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">支付成功！</h2>
            <p className="text-gray-600 mb-6">您的{planName}已开通</p>
            <button
              onClick={handleSuccess}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              进入系统
            </button>
          </div>
        )}

        {/* 支付失败 */}
        {paymentStatus === 'failed' && (
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-20 h-20 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">支付失败</h2>
            <p className="text-gray-600 mb-6">订单号: {orderNo}</p>
            <button
              onClick={handleClose}
              className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              关闭
            </button>
          </div>
        )}

        {/* 支付中 */}
        {paymentStatus === 'pending' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">微信扫码支付</h2>
              <p className="text-gray-600">请使用微信扫描下方二维码完成支付</p>
            </div>

            {/* 订单信息 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">套餐：</span>
                <span className="font-semibold text-gray-900">{planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">支付金额：</span>
                <span className="text-2xl font-bold text-red-600">¥{price}</span>
              </div>
            </div>

            {/* 二维码 */}
            {loading && (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-600 text-center">{error}</p>
                {error.includes('登录') && (
                  <button
                    onClick={() => window.location.href = '/login'}
                    className="mt-2 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    前往登录
                  </button>
                )}
              </div>
            )}

            {qrCodeUrl && !loading && !error && (
              <>
                <div className="flex justify-center mb-6">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`}
                    alt="支付二维码"
                    className="w-64 h-64 border-4 border-gray-200 rounded-lg"
                  />
                </div>

                {/* 提示信息 */}
                <div className="text-sm text-gray-500 text-center space-y-2">
                  <p className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    支付完成后，页面将自动跳转
                  </p>
                  <p>如长时间未跳转，请刷新页面或联系客服</p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
