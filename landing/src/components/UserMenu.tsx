import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config/env';

interface UserMenuProps {
  username: string;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function UserMenu({ username, isAdmin, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 获取用户头像首字母
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogoutClick = () => {
    setIsOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const handleMenuItemClick = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    const token = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (token && refreshToken && userInfo) {
      const params = new URLSearchParams({
        token,
        refresh_token: refreshToken,
        user_info: userInfo
      });
      window.location.href = `${config.clientUrl}/user-center?${params.toString()}`;
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* 用户头像按钮 */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200 group"
        >
          {/* 头像 */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md group-hover:shadow-lg transition-shadow">
            {getInitials(username)}
          </div>
          
          {/* 用户名和下拉箭头 */}
          <div className="hidden lg:flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
              {username}
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* 下拉菜单卡片 */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-slideDown">
            {/* 用户信息头部 */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 px-6 py-5 border-b border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {getInitials(username)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">
                    {username}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      isAdmin ? 'bg-purple-500' : 'bg-green-500'
                    }`}></span>
                    {isAdmin ? '系统管理员' : '普通用户'}
                  </p>
                </div>
              </div>
            </div>

            {/* 菜单项 */}
            <div className="py-2">
              {/* 个人中心 */}
              <button
                onClick={handleProfileClick}
                className="w-full px-6 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-900">
                    个人中心
                  </div>
                  <div className="text-xs text-gray-500">
                    查看和编辑个人信息
                  </div>
                </div>
              </button>

              {/* 管理员专属：用户管理 */}
              {isAdmin && (
                <>
                  <div className="my-2 border-t border-gray-100"></div>
                  <div className="px-6 py-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      管理功能
                    </div>
                  </div>
                  <button
                    onClick={() => handleMenuItemClick('/admin/users')}
                    className="w-full px-6 py-3 flex items-center space-x-3 hover:bg-purple-50 transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">
                        用户管理
                      </div>
                      <div className="text-xs text-gray-500">
                        管理系统用户和权限
                      </div>
                    </div>
                  </button>
                </>
              )}

              {/* 分隔线 */}
              <div className="my-2 border-t border-gray-100"></div>

              {/* 退出登录 */}
              <button
                onClick={handleLogoutClick}
                className="w-full px-6 py-3 flex items-center space-x-3 hover:bg-red-50 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-red-600">
                    退出登录
                  </div>
                  <div className="text-xs text-red-400">
                    安全退出当前账号
                  </div>
                </div>
              </button>
            </div>

            {/* 底部装饰 */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                GEO优化SaaS系统 · 让品牌被AI主动推荐
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 退出确认对话框 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all animate-scaleIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200 transform hover:scale-105"
              >
                取消
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加动画样式 */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
