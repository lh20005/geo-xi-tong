import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import type { User } from '../types/user';
import { formatDateTime } from '../utils/dateFormat';

interface UserDetailModalProps {
  userId: number;
  onClose: () => void;
  onUpdate: () => void;
}

export default function UserDetailModal({ userId, onClose, onUpdate }: UserDetailModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ username: '', role: 'user' as 'admin' | 'user' });
  const [error, setError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  const loadUserDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getUserDetails(userId);
      if (response.success) {
        setUser(response.data);
        setEditData({
          username: response.data.username,
          role: response.data.role
        });

        // 获取邀请统计（如果API支持）
        // 注意：这里假设getUserDetails返回的数据包含邀请统计
        // 如果不包含，需要单独调用
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '加载用户详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setError('');
    setActionLoading(true);

    try {
      const response = await apiClient.updateUser(userId, editData);
      if (response.success) {
        setUser(response.data);
        setEditing(false);
        onUpdate();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '更新用户失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setActionLoading(true);

    try {
      const response = await apiClient.resetPassword(userId);
      if (response.success) {
        setTempPassword(response.data.temporaryPassword);
        setShowResetConfirm(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '重置密码失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setActionLoading(true);

    try {
      const response = await apiClient.deleteUser(userId);
      if (response.success) {
        onUpdate();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '删除用户失败');
    } finally {
      setActionLoading(false);
    }
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">用户详情</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {tempPassword && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 mb-2">临时密码已生成：</p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 px-3 py-2 bg-white rounded border border-green-300 font-mono text-lg">
                  {tempPassword}
                </code>
                <button
                  onClick={copyTempPassword}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  复制
                </button>
              </div>
              <p className="text-xs text-green-700 mt-2">请将此密码发送给用户，用户下次登录时需要修改密码</p>
            </div>
          )}

          {/* 基本信息 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">用户ID</span>
                <span className="font-medium text-gray-900">{user?.id}</span>
              </div>

              {editing ? (
                <>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">用户名</span>
                    <input
                      type="text"
                      value={editData.username}
                      onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">角色</span>
                    <select
                      value={editData.role}
                      onChange={(e) => setEditData({ ...editData, role: e.target.value as 'admin' | 'user' })}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">用户名</span>
                    <span className="font-medium text-gray-900">{user?.username}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">角色</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user?.role === 'admin' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user?.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">邀请码</span>
                <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                  {user?.invitationCode}
                </code>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">注册时间</span>
                <span className="text-gray-900">
                  {formatDateTime(user?.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">最后登录</span>
                <span className="text-gray-900">
                  {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '从未登录'}
                </span>
              </div>

              {user?.isTempPassword && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600">密码状态</span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                    临时密码
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3">
            {editing ? (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditData({
                      username: user?.username || '',
                      role: user?.role || 'user'
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  编辑信息
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  重置密码
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  删除用户
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 重置密码确认对话框 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">确认重置密码</h3>
            <p className="text-gray-600 mb-6">
              确定要重置用户 <span className="font-medium">{user?.username}</span> 的密码吗？
              系统将生成一个临时密码，用户下次登录时需要修改密码。
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? '重置中...' : '确认重置'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除用户确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-4">⚠️ 危险操作</h3>
            <p className="text-gray-600 mb-6">
              确定要删除用户 <span className="font-medium">{user?.username}</span> 吗？
              此操作不可撤销，用户的所有数据将被永久删除。
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
