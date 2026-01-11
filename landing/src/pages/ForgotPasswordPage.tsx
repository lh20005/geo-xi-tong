import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { config } from '../config/env';

type Step = 'request' | 'verify' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  // 表单数据
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${config.apiUrl}/auth/forgot-password`, {
        username,
        email
      });

      if (response.data.success) {
        setStep('verify');
        setCountdown(60);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${config.apiUrl}/auth/verify-reset-code`, {
        email,
        code
      });

      if (response.data.success) {
        setResetToken(response.data.data.resetToken);
        setStep('reset');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '验证码验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (newPassword.length < 8) {
      setError('密码必须至少8个字符');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${config.apiUrl}/auth/reset-password`, {
        resetToken,
        newPassword
      });

      if (response.data.success) {
        setStep('success');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '重置密码失败');
    } finally {
      setLoading(false);
    }
  };

  // 重新发送验证码
  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setError('');
    setLoading(true);

    try {
      await axios.post(`${config.apiUrl}/auth/forgot-password`, {
        username,
        email
      });
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/images/logo.png" alt="Logo" className="w-10 h-10 rounded-lg" />
              <span className="text-2xl font-bold text-gray-900">GEO优化SaaS系统</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              {step === 'success' ? '密码重置成功' : '找回密码'}
            </h1>
            <p className="text-gray-600">
              {step === 'request' && '请输入您的用户名和绑定的邮箱'}
              {step === 'verify' && '请输入邮箱收到的验证码'}
              {step === 'reset' && '请设置新密码'}
              {step === 'success' && '您可以使用新密码登录了'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* 步骤指示器 */}
            {step !== 'success' && (
              <div className="flex items-center justify-center mb-8">
                {['request', 'verify', 'reset'].map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === s ? 'bg-blue-600 text-white' :
                      ['request', 'verify', 'reset'].indexOf(step) > i ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {['request', 'verify', 'reset'].indexOf(step) > i ? '✓' : i + 1}
                    </div>
                    {i < 2 && <div className={`w-12 h-1 ${
                      ['request', 'verify', 'reset'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'
                    }`} />}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* 步骤1：输入用户名和邮箱 */}
            {step === 'request' && (
              <form onSubmit={handleSendCode} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="请输入用户名"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">绑定的邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="请输入绑定的邮箱"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? '发送中...' : '发送验证码'}
                </button>
              </form>
            )}

            {/* 步骤2：输入验证码 */}
            {step === 'verify' && (
              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">验证码</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    验证码已发送至 {email}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? '验证中...' : '验证'}
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 0 || loading}
                  className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送验证码'}
                </button>
              </form>
            )}

            {/* 步骤3：设置新密码 */}
            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="至少8位，包含大小写字母"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPassword ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="再次输入新密码"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? '重置中...' : '重置密码'}
                </button>
              </form>
            )}

            {/* 成功页面 */}
            {step === 'success' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-6">您的密码已成功重置</p>
                <Link
                  to="/login"
                  className="inline-block w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-center"
                >
                  去登录
                </Link>
              </div>
            )}

            {step !== 'success' && (
              <div className="mt-6 text-center">
                <Link to="/login" className="text-gray-500 hover:text-gray-700 text-sm">
                  ← 返回登录
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
