import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { config } from '../config/env';
import ChangePasswordModal from '../components/ChangePasswordModal';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [tempPasswordUser, setTempPasswordUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  // 处理导航到首页锚点
  const handleNavigateToSection = (sectionId: string) => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // 页面加载时滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // 输出配置信息用于调试
    console.log('[Landing Login] 页面加载');
    console.log('[Landing Login] API URL:', config.apiUrl);
    console.log('[Landing Login] Client URL:', config.clientUrl);
    console.log('[Landing Login] 当前 localStorage:', {
      auth_token: localStorage.getItem('auth_token'),
      refresh_token: localStorage.getItem('refresh_token'),
      user_info: localStorage.getItem('user_info')
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      console.log('[Landing Login] 开始登录，API URL:', config.apiUrl);
      const response = await axios.post(`${config.apiUrl}/auth/login`, formData);
      
      console.log('[Landing Login] 登录响应:', response.data);
      
      if (response.data.success) {
        // 保存token到localStorage（使用与client一致的key）
        localStorage.setItem('auth_token', response.data.data.token);
        localStorage.setItem('refresh_token', response.data.data.refreshToken);
        localStorage.setItem('user_info', JSON.stringify(response.data.data.user));
        
        console.log('[Landing Login] Token已保存到localStorage');
        
        // 检查是否是临时密码
        if (response.data.data.user.isTempPassword) {
          console.log('[Landing Login] 检测到临时密码，要求修改密码');
          setTempPasswordUser(response.data.data.user);
          setShowPasswordModal(true);
          setSuccess(false);
          return;
        }
        
        console.log('[Landing Login] 登录成功，停留在营销网站');
        
        // 显示成功提示
        setSuccess(true);
        
        // 延迟跳转到首页，让用户看到成功提示
        setTimeout(() => {
          console.log('[Landing Login] 跳转到首页...');
          window.location.href = '/';
        }, 800);
      }
    } catch (err: any) {
      console.error('[Landing Login] 登录失败:', err);
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
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
              <img 
                src="/images/logo.png" 
                alt="JZ Logo" 
                className="w-10 h-10 rounded-lg"
              />
              <span className="text-2xl font-bold text-gray-900">
                GEO优化SaaS系统
              </span>
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                首页
              </Link>
              <button onClick={() => handleNavigateToSection('features')} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                核心功能
              </button>
              <button onClick={() => handleNavigateToSection('advantages')} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                产品优势
              </button>
              <Link to="/cases" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                应用示例
              </Link>
              <button onClick={() => handleNavigateToSection('pricing')} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                价格方案
              </button>
              <Link
                to="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                立即登录
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 登录表单区域 */}
      <div className="flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              欢迎登录
            </h1>
            <p className="text-gray-600">登录开始您的GEO优化之旅</p>
          </div>

          {/* 登录表单 */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  登录成功！正在跳转...
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="请输入用户名"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="请输入密码"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || success}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    登录中...
                  </span>
                ) : success ? '登录成功' : '登录'}
              </button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">
                还没有账号？
                <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                  立即注册
                </Link>
              </p>
              <p className="text-sm">
                <Link to="/" className="text-gray-500 hover:text-gray-700 transition-colors">
                  ← 返回首页
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 强制修改密码模态框 */}
      {showPasswordModal && tempPasswordUser && (
        <ChangePasswordModal
          isForced={true}
          onClose={() => {}}
          onSuccess={() => {
            setShowPasswordModal(false);
            // 修改密码成功后跳转到首页
            window.location.href = '/';
          }}
        />
      )}
    </div>
  );
}
