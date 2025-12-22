import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import './AccountList.css';

const AccountList: React.FC = () => {
  const { accounts, isLoading, refreshAccounts, deleteAccount, setDefaultAccount } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refreshAccounts();
    } catch (error) {
      console.error('Failed to refresh accounts:', error);
      alert('刷新失败，请重试');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (accountId: number, accountName: string) => {
    if (!confirm(`确定要删除账号 "${accountName}" 吗？`)) {
      return;
    }

    try {
      await deleteAccount(accountId);
      alert('账号已删除');
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('删除失败，请重试');
    }
  };

  const handleSetDefault = async (platformId: string, accountId: number, accountName: string) => {
    try {
      await setDefaultAccount(platformId, accountId);
      alert(`已将 "${accountName}" 设为默认账号`);
    } catch (error) {
      console.error('Failed to set default account:', error);
      alert('设置失败，请重试');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      active: { text: '活跃', className: 'status-active' },
      inactive: { text: '未激活', className: 'status-inactive' },
      expired: { text: '已过期', className: 'status-expired' },
    };
    return badges[status] || badges.inactive;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN');
  };

  if (isLoading) {
    return (
      <div className="account-list">
        <div className="loading">加载账号列表...</div>
      </div>
    );
  }

  return (
    <div className="account-list">
      <div className="page-header">
        <div>
          <h1>账号管理</h1>
          <p>管理所有已登录的平台账号</p>
        </div>
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h2>暂无账号</h2>
          <p>点击"平台登录"添加您的第一个账号</p>
        </div>
      ) : (
        <div className="accounts-grid">
          {accounts.map((account) => {
            const statusBadge = getStatusBadge(account.status);
            return (
              <div key={account.id} className="account-card">
                {account.is_default && (
                  <div className="default-badge">默认</div>
                )}
                
                <div className="account-header">
                  <div className="account-avatar">
                    {account.account_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="account-info">
                    <h3>{account.account_name}</h3>
                    <p className="platform-name">{account.platform_id}</p>
                  </div>
                </div>

                <div className="account-details">
                  {account.real_username && (
                    <div className="detail-item">
                      <span className="detail-label">真实用户名:</span>
                      <span className="detail-value">{account.real_username}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">状态:</span>
                    <span className={`status-badge ${statusBadge.className}`}>
                      {statusBadge.text}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">创建时间:</span>
                    <span className="detail-value">{formatDate(account.created_at)}</span>
                  </div>
                  {account.last_used_at && (
                    <div className="detail-item">
                      <span className="detail-label">最后使用:</span>
                      <span className="detail-value">{formatDate(account.last_used_at)}</span>
                    </div>
                  )}
                </div>

                <div className="account-actions">
                  {!account.is_default && (
                    <button
                      className="action-btn set-default"
                      onClick={() =>
                        handleSetDefault(account.platform_id, account.id, account.account_name)
                      }
                    >
                      设为默认
                    </button>
                  )}
                  <button
                    className="action-btn delete"
                    onClick={() => handleDelete(account.id, account.account_name)}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AccountList;
