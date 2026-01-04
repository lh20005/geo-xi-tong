import { useState, useEffect, useRef } from 'react';
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
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | 'timeout'>('pending');
  const [countdown, setCountdown] = useState(600); // 10分钟倒计时
  const [pollingCount, setPollingCount] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 创建订单并获取二维码
  useEffect(() => {
    if (isOpen && planId) {
      createOrder();
    }
    
    // 清理函数
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [isOpen, planId]);

  // 倒计时
  useEffect(() => {
    if (!orderNo || paymentStatus !== 'pending') return;

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setPaymentStatus('timeout');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [orderNo, paymentStatus]);

  // 渐进式轮询订单状态
  useEffect(() => {
    if (!orderNo || paymentStatus !== 'pending') return;

    const pollOrderStatus = async () => {
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
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
          } else if (status === 'failed' || status === 'closed') {
            setPaymentStatus('failed');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
          }
        }
        
        setPollingCount((prev) => prev + 1);
      } catch (error) {
        console.error('查询订单状态失败:', error);
      }
    };

    // 渐进式轮询策略：前30秒每2秒一次，之后每5秒一次
    const getPollingInterval = () => {
      return pollingCount < 15 ? 2000 : 5000;
    };

    // 立即执行第一次查询
    pollOrderStatus();

    // 设置定时轮询
    pollingIntervalRef.current = setInterval(pollOrderStatus, getPollingInterval());

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [orderNo, paymentStatus, pollingCount]);

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
    // 清理定时器
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    // 重置状态
    setQrCodeUrl('');
    setOrderNo('');
    setPaymentStatus('pending');
    setError('');
    setCountdown(600);
    setPollingCount(0);
    onClose();
  };

  const handleSuccess = () => {
    handleClose();
    // 延迟跳转，让用户看到成功提示
    setTimeout(() => {
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
    }, 1500);
  };

  // 格式化倒计时显示
  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
            <div className="mb-6 animate-bounce">
              <svg className="w-24 h-24 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">支付成功！</h2>
            <p className="text-lg text-gray-600 mb-2">您的 <span className="font-bold text-blue-600">{planName}</span> 已开通</p>
            <p className="text-sm text-gray-500 mb-6">正在为您跳转到系统...</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center text-green-700">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">订单号: {orderNo}</span>
              </div>
            </div>
            <button
              onClick={handleSuccess}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              立即进入系统
            </button>
          </div>
        )}

        {/* 支付失败 */}
        {paymentStatus === 'failed' && (
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-24 h-24 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">支付失败</h2>
            <p className="text-gray-600 mb-6">订单号: <span className="font-mono text-sm">{orderNo}</span></p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">
                如果您已完成支付但显示失败，请联系客服处理
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setPaymentStatus('pending');
                  setError('');
                  createOrder();
                }}
                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                重新支付
              </button>
            </div>
          </div>
        )}

        {/* 支付超时 */}
        {paymentStatus === 'timeout' && (
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-24 h-24 mx-auto text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">支付超时</h2>
            <p className="text-gray-600 mb-6">二维码已过期，请重新创建订单</p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-orange-700 text-sm">
                订单号: <span className="font-mono">{orderNo}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setPaymentStatus('pending');
                  setError('');
                  setCountdown(600);
                  setPollingCount(0);
                  createOrder();
                }}
                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                重新支付
              </button>
            </div>
          </div>
        )}

        {/* 支付中 */}
        {paymentStatus === 'pending' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">微信扫码支付</h2>
              <p className="text-gray-600">请使用微信扫描下方二维码完成支付</p>
              
              {/* 倒计时 */}
              <div className="mt-3 inline-flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-blue-700">
                  剩余时间: <span className="font-mono">{formatCountdown(countdown)}</span>
                </span>
              </div>
            </div>

            {/* 订单信息 */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 mb-6 border border-blue-100">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">套餐：</span>
                <span className="font-semibold text-gray-900">{planName}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">支付金额：</span>
                <span className="text-2xl font-bold text-red-600">¥{price}</span>
              </div>
              {orderNo && (
                <div className="flex justify-between pt-2 border-t border-blue-200">
                  <span className="text-xs text-gray-500">订单号：</span>
                  <span className="text-xs font-mono text-gray-700">{orderNo}</span>
                </div>
              )}
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
                <div className="flex justify-center mb-6 relative">
                  <div className="relative">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCodeUrl)}`}
                      alt="支付二维码"
                      className="w-64 h-64 border-4 border-blue-200 rounded-xl shadow-lg"
                    />
                    {/* 扫描动画 */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 animate-scan"></div>
                    </div>
                  </div>
                </div>

                {/* 支付步骤 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        1
                      </div>
                      <p className="text-sm text-gray-700">打开微信，点击右上角"+"</p>
                    </div>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        2
                      </div>
                      <p className="text-sm text-gray-700">选择"扫一扫"，扫描上方二维码</p>
                    </div>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        3
                      </div>
                      <p className="text-sm text-gray-700">确认金额后完成支付</p>
                    </div>
                  </div>
                </div>

                {/* 提示信息 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">支付完成后页面将自动跳转</p>
                      <p className="text-blue-600">正在检测支付状态，请勿关闭页面...</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
