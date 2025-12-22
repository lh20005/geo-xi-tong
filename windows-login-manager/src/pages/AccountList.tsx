import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import './AccountList.css';

const AccountList: React.FC = () => {
  const { accounts, isLoading, refreshAccounts, deleteAccount } = useApp();
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
    if (!confirm(`确定要删除账号 "${accountName}" 吗？\n\n注意：此操作需要连接到服务器才能完成。`)) {
      return;
    }

    try {
      await deleteAccount(accountId);
      alert('账号已删除');
    } catch (error) {
      console.error('Failed to delete account:', error);
      const errorMessage = error instanceof Error ? error.message : '删除失败，请重试';
      alert(`删除失败\n\n${errorMessage}`);
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

  const getPlatformInfo = (platformId: string) => {
    const platforms: Record<string, { shortName: string }> = {
      douyin: { shortName: '抖音' },
      toutiao: { shortName: '头条' },
      baijia: { shortName: '百家' },
      wangyi: { shortName: '网易' },
      sohu: { shortName: '搜狐' },
      weibo: { shortName: '微博' },
      zhihu: { shortName: '知乎' },
      bilibili: { shortName: 'B站' },
    };
    return platforms[platformId] || { shortName: platformId.substring(0, 2) };
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
            const platformInfo = getPlatformInfo(account.platform_id);
            return (
              <div key={account.id} className="account-card">
                <div className="platform-avatar">
                  {platformInfo.shortName}
                </div>
                
                <div className="account-name">{account.account_name}</div>
                
                {account.real_username && (
                  <div className="real-username">{account.real_username}</div>
                )}
                
                <div className={`status-badge ${statusBadge.className}`}>
                  {statusBadge.text}
                </div>

                <div className="account-actions">
                  <button
                    className="action-btn delete"
                    onClick={() => handleDelete(account.id, account.account_name)}
                    title="删除账号"
                  >
                    🗑️
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
