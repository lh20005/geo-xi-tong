import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { config } from '../config/env';

interface HeaderProps {
  activeSection?: string;
}

export default function Header({ activeSection = 'home' }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 判断导航项是否激活
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // 判断首页锚点是否激活（只在首页时有效）
  const isSectionActive = (section: string) => {
    return location.pathname === '/' && activeSection === section;
  };

  // 处理导航到首页锚点
  const handleNavigateToSection = (sectionId: string) => {
    // 如果已经在首页，直接滚动
    if (window.location.pathname === '/') {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // 如果在其他页面，先导航到首页再滚动
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (token && userInfo) {
      setIsLoggedIn(true);
      try {
        const user = JSON.parse(userInfo);
        setUsername(user.username || '用户');
        setIsAdmin(user.role === 'admin');
      } catch (e) {
        console.error('解析用户信息失败:', e);
      }
    }
    
    // 监听 storage 事件，当其他标签页登录/退出时同步状态
    const handleStorageChange = () => {
      const token = localStorage.getItem('auth_token');
      const userInfo = localStorage.getItem('user_info');
      
      if (token && userInfo) {
        setIsLoggedIn(true);
        try {
          const user = JSON.parse(userInfo);
          setUsername(user.username || '用户');
          setIsAdmin(user.role === 'admin');
        } catch (e) {
          console.error('解析用户信息失败:', e);
        }
      } else {
        setIsLoggedIn(false);
        setUsername('');
        setIsAdmin(false);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    // 显示确认对话框
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    // 清除登录信息
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    
    setIsLoggedIn(false);
    setUsername('');
    setIsAdmin(false);
    setShowLogoutConfirm(false);
    
    // 跳转到首页
    navigate('/');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleEnterSystem = () => {
    // 跳转到前端系统
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

  return (
    <>
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
            <button
              onClick={() => {
                if (window.location.pathname === '/') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  navigate('/');
                }
              }}
              className={`font-medium transition-colors cursor-pointer ${
                isActive('/') && activeSection === 'home' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              首页
            </button>
            <button
              onClick={() => handleNavigateToSection('features')}
              className={`font-medium transition-colors cursor-pointer ${
                isSectionActive('features') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              核心功能
            </button>
            <button
              onClick={() => handleNavigateToSection('advantages')}
              className={`font-medium transition-colors cursor-pointer ${
                isSectionActive('advantages') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              产品优势
            </button>
            <Link 
              to="/cases" 
              className={`font-medium transition-colors ${
                isActive('/cases') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              应用示例
            </Link>
            <button
              onClick={() => handleNavigateToSection('pricing')}
              className={`font-medium transition-colors cursor-pointer ${
                isSectionActive('pricing') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              价格方案
            </button>
            
            {/* 根据登录状态显示不同按钮 */}
            {isLoggedIn ? (
              <>
                {isAdmin && (
                  <Link
                    to="/admin/users"
                    className={`px-4 py-2 font-semibold transition-colors ${
                      isActive('/admin/users') ? 'text-purple-700' : 'text-purple-600 hover:text-purple-700'
                    }`}
                  >
                    用户管理
                  </Link>
                )}
                <Link
                  to="/profile"
                  className={`px-6 py-2.5 font-semibold transition-colors ${
                    isActive('/profile') ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  个人中心
                </Link>
                <button
                  onClick={handleEnterSystem}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  进入系统
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  退出
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className={`px-6 py-2.5 font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 ${
                  isActive('/login') 
                    ? 'bg-gradient-to-r from-blue-700 to-purple-700 text-white shadow-lg' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'
                }`}
              >
                立即登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>

    {/* 退出确认对话框 */}
    {showLogoutConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">确认退出登录</h3>
            <p className="text-gray-600">
              您确定要退出登录吗？退出后需要重新登录才能使用系统功能。
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={cancelLogout}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={confirmLogout}
              className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              确认退出
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
