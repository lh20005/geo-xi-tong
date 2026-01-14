import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import UserMenu from './UserMenu';
import MobileUserMenu from './MobileUserMenu';
import { config } from '../config/env';

// 下载链接配置
const DOWNLOAD_LINKS = {
  windows: '', // Windows 版本待编译后添加
  macAppleSilicon: 'https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases/Ai智软精准GEO优化系统-1.0.0-arm64.dmg',
  macIntel: 'https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases/Ai智软精准GEO优化系统-1.0.0.dmg',
};

interface HeaderProps {
  activeSection?: string;
}

export default function Header({ activeSection = 'home' }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下载菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        <div className="flex justify-between items-center h-16 md:h-20">
          <Link to="/" className="flex items-center space-x-2 md:space-x-3">
            <img 
              src="/images/logo.png" 
              alt="JZ Logo" 
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg"
            />
            <span className="text-lg md:text-2xl font-bold text-gray-900">
              GEO优化SaaS系统
            </span>
          </Link>
          
          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="打开菜单"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          
          {/* 桌面端菜单 */}
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
            
            {/* 下载桌面版下拉菜单 */}
            <div 
              ref={downloadMenuRef}
              className="relative"
              onMouseEnter={() => setDownloadMenuOpen(true)}
              onMouseLeave={() => setDownloadMenuOpen(false)}
            >
              <button
                className="font-medium transition-colors cursor-pointer text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                下载桌面版
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${downloadMenuOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* 下拉菜单 */}
              <div 
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-200 origin-top ${
                  downloadMenuOpen 
                    ? 'opacity-100 scale-100 visible' 
                    : 'opacity-0 scale-95 invisible'
                }`}
              >
                <div className="py-2">
                  {/* Windows 版 */}
                  <a
                    href={DOWNLOAD_LINKS.windows || '#'}
                    onClick={(e) => {
                      if (!DOWNLOAD_LINKS.windows) {
                        e.preventDefault();
                        alert('Windows 版本即将上线，敬请期待！');
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      DOWNLOAD_LINKS.windows 
                        ? 'hover:bg-blue-50 text-gray-700 hover:text-blue-600' 
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Windows 版</div>
                      <div className="text-xs text-gray-500">{DOWNLOAD_LINKS.windows ? '立即下载' : '即将上线'}</div>
                    </div>
                  </a>
                  
                  {/* Mac Apple Silicon 版 */}
                  <a
                    href={DOWNLOAD_LINKS.macAppleSilicon}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Mac 版（Apple 芯片）</div>
                      <div className="text-xs text-gray-500">适用于 M1/M2/M3 芯片</div>
                    </div>
                  </a>
                  
                  {/* Mac Intel 版 */}
                  <a
                    href={DOWNLOAD_LINKS.macIntel}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Mac 版（Intel 芯片）</div>
                      <div className="text-xs text-gray-500">适用于 Intel 处理器</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
            
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

      {/* 移动端菜单面板 */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-white">
          <div className="h-full overflow-y-auto">
            <div className="px-4 py-6 space-y-4">
              {/* 导航链接 */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (window.location.pathname === '/') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    navigate('/');
                  }
                }}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive('/') && activeSection === 'home' 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                首页
              </button>
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleNavigateToSection('features');
                }}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                  isSectionActive('features') 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                核心功能
              </button>
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleNavigateToSection('advantages');
                }}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                  isSectionActive('advantages') 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                产品优势
              </button>
              
              <Link
                to="/cases"
                onClick={() => setMobileMenuOpen(false)}
                className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive('/cases') 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                应用示例
              </Link>
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleNavigateToSection('pricing');
                }}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                  isSectionActive('pricing') 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                价格方案
              </button>
              
              {/* 移动端下载桌面版 */}
              <div className="px-4 py-2">
                <div className="text-sm font-medium text-gray-500 mb-2">下载桌面版</div>
                <div className="space-y-2 pl-2">
                  <a
                    href={DOWNLOAD_LINKS.windows || '#'}
                    onClick={(e) => {
                      if (!DOWNLOAD_LINKS.windows) {
                        e.preventDefault();
                        alert('Windows 版本即将上线，敬请期待！');
                      }
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 py-2 ${
                      DOWNLOAD_LINKS.windows 
                        ? 'text-gray-700' 
                        : 'text-gray-400'
                    }`}
                  >
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                    </svg>
                    <span>Windows 版 {!DOWNLOAD_LINKS.windows && '(即将上线)'}</span>
                  </a>
                  <a
                    href={DOWNLOAD_LINKS.macAppleSilicon}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 py-2 text-gray-700"
                  >
                    <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span>Mac 版（Apple 芯片）</span>
                  </a>
                  <a
                    href={DOWNLOAD_LINKS.macIntel}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 py-2 text-gray-700"
                  >
                    <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span>Mac 版（Intel 芯片）</span>
                  </a>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="border-t border-gray-200 my-4"></div>

              {/* 登录/用户信息 */}
              {isLoggedIn ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
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
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    进入系统
                  </button>
                  
                  <MobileUserMenu 
                    username={username}
                    isAdmin={isAdmin}
                    onLogout={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                  />
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-center"
                >
                  立即登录
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
