import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import type { User, InvitationStats } from '../types/user';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { getWebSocketService } from '../services/WebSocketService';
import Header from '../components/Header';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [invitationStats, setInvitationStats] = useState<InvitationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadProfile();
    
    // 连接 WebSocket
    const wsService = getWebSocketService();
    wsService.connect().catch((error) => {
      console.error('[Profile] WebSocket connection failed:', error);
    });

    // 订阅用户更新事件
    const handleUserUpdated = (data: any) => {
      console.log('[Profile] User updated:', data);
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user_info', JSON.stringify(data.user));
      }
    };

    const handlePasswordChanged = (data: any) => {
      console.log('[Profile] Password changed:', data);
      // 可以显示通知
    };

    wsService.on('user:updated', handleUserUpdated);
    wsService.on('user:password-changed', handlePasswordChanged);

    // 清理
    return () => {
      wsService.off('user:updated', handleUserUpdated);
      wsService.off('user:password-changed', handlePasswordChanged);
    };
  }, []);

  const loadProfile = async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([
        apiClient.getProfile(),
        apiClient.getInvitationStats()
      ]);

      console.log('[Profile] API 响应:', profileRes);

      if (profileRes.success) {
        console.log('[Profile] 用户数据:', profileRes.data);
        setUser(profileRes.data);
      }

      if (statsRes.success) {
        setInvitationStats(statsRes.data);
      }
    } catch (error: any) {
      console.error('[Profile] 加载失败:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyInvitationCode = () => {
    if (user?.invitationCode) {
      navigator.clipboard.writeText(user.invitationCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 导航栏 */}
      <Header />

      {/* 主内容 */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">个人资料</h1>

        {/* 用户信息卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">基本信息</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">用户名</span>
              <span className="font-medium text-gray-900">{user?.username}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">角色</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user?.role === 'admin' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {user?.role === 'admin' ? '管理员' : '普通用户'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">注册时间</span>
              <span className="text-gray-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600">最后登录</span>
              <span className="text-gray-900">
                {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : '从未登录'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowPasswordModal(true)}
            className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            修改密码
          </button>
        </div>

        {/* 邀请码卡片 */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white mb-6">
          <h2 className="text-2xl font-semibold mb-4">我的邀请码</h2>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80 mb-2">邀请码</p>
                <p className="text-4xl font-bold tracking-wider">{user?.invitationCode}</p>
              </div>
              <button
                onClick={copyInvitationCode}
                className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                {copySuccess ? '已复制!' : '复制'}
              </button>
            </div>
          </div>
          <p className="text-sm text-white/90">
            分享您的邀请码，邀请好友加入平台
          </p>
        </div>

        {/* 邀请统计卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">邀请统计</h2>
          
          <div className="mb-6">
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
              <div>
                <p className="text-sm text-gray-600 mb-1">累计邀请</p>
                <p className="text-4xl font-bold text-gray-900">
                  {invitationStats?.totalInvites || 0}
                </p>
              </div>
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          {invitationStats && invitationStats.invitedUsers.length > 0 ? (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">受邀用户列表</h3>
              <div className="space-y-3">
                {invitationStats.invitedUsers.map((invitedUser, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {invitedUser.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{invitedUser.username}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(invitedUser.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500">还没有邀请任何用户</p>
              <p className="text-sm text-gray-400 mt-2">分享您的邀请码开始邀请好友吧</p>
            </div>
          )}
        </div>
      </div>

      {/* 修改密码模态框 */}
      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false);
            // 可选：显示成功消息
          }}
        />
      )}
    </div>
  );
}
