import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config/env';

interface MobileUserMenuProps {
  username: string;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function MobileUserMenu({ username, isAdmin, onLogout }: MobileUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const _handleMenuItemClick = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };
  void _handleMenuItemClick; // 保留以备将来使用

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
      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
          {getInitials(username)}
        </div>
      </button>

      {/* 全屏移动端菜单 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 animate-fadeIn"
            onClick={() => setIsOpen(false)}
          ></div>

          {/* 菜单内容 */}
          <div className="absolute inset-x-0 top-0 bg-white rounded-b-3xl shadow-2xl animate-slideDown max-h-[90vh] overflow-y-auto">
            {/* 头部 */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 px-6 py-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">我的账户</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
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
            <div className="py-4 px-4">
              {/* 个人中心 */}
              <button
                onClick={handleProfileClick}
                className="w-full mb-3 px-6 py-4 bg-white border-2 border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-md transition-all duration-200 flex items-center space-x-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-base font-semibold text-gray-900">
                    个人中心
                  </div>
                  <div className="text-sm text-gray-500">
                    查看和编辑个人信息
                  </div>
                </div>
              </button>

              {/* 退出登录 */}
              <button
                onClick={handleLogoutClick}
                className="w-full mt-4 px-6 py-4 bg-red-50 border-2 border-red-100 rounded-2xl hover:border-red-200 hover:shadow-md transition-all duration-200 flex items-center space-x-4"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-base font-semibold text-red-600">
                    退出登录
                  </div>
                  <div className="text-sm text-red-400">
                    安全退出当前账号
                  </div>
                </div>
              </button>
            </div>

            {/* 底部装饰 */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                GEO优化SaaS系统 · 让品牌被AI主动推荐
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 退出确认对话框 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform transition-all animate-scaleIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">确认退出登录</h3>
              <p className="text-sm text-gray-600">
                您确定要退出登录吗？退出后需要重新登录才能使用系统功能。
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200"
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
            transform: translateY(-20px);
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
          animation: slideDown 0.3s ease-out;
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
