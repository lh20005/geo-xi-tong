import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import UserMenu from './UserMenu';
import MobileUserMenu from './MobileUserMenu';
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
    const checkLoginStatus = () => {
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
    
    checkLoginStatus();
    
    // 监听 storage 事件（跨标签页）和自定义 auth-change 事件（同标签页）
    window.addEventListener('storage', checkLoginStatus);
    window.addEventListener('auth-change', checkLoginStatus);
    
    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      window.removeEventListener('auth-change', checkLoginStatus);
    };
  }, []);

  const handleLogout = () => {
    // 清除登录信息
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    
    setIsLoggedIn(false);
    setUsername('');
    setIsAdmin(false);
    
    // 触发自定义事件，通知其他组件登录状态已改变
    window.dispatchEvent(new Event('auth-change'));
    
    // 跳转到首页
    navigate('/');
  };

  return (
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
                {/* 进入系统按钮 */}
                <button
                  onClick={() => {
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
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  进入系统
                </button>
                
                {/* 桌面端用户菜单 */}
                <div className="hidden md:block">
                  <UserMenu 
                    username={username}
                    isAdmin={isAdmin}
                    onLogout={handleLogout}
                  />
                </div>
                {/* 移动端用户菜单 */}
                <MobileUserMenu 
                  username={username}
                  isAdmin={isAdmin}
                  onLogout={handleLogout}
                />
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
  );
}
