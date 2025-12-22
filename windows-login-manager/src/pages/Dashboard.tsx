import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import ipcBridge from '../services/ipc';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { accounts, config, isLoading } = useApp();
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState<any>(null);

  useEffect(() => {
    loadSyncStatus();
    const interval = setInterval(loadSyncStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await ipcBridge.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  const activeAccounts = accounts.filter((a) => a.status === 'active').length;
  const totalAccounts = accounts.length;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>仪表板</h1>
        <p>欢迎使用Windows平台登录管理器</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <div className="stat-value">{totalAccounts}</div>
            <div className="stat-label">总账号数</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{activeAccounts}</div>
            <div className="stat-label">活跃账号</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <div className="stat-value">
              {syncStatus?.isOnline ? '在线' : '离线'}
            </div>
            <div className="stat-label">同步状态</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{syncStatus?.queueLength || 0}</div>
            <div className="stat-label">待同步</div>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>快速操作</h2>
        <div className="action-buttons">
          <button className="action-btn primary" onClick={() => navigate('/platforms')}>
            <span className="btn-icon">🚀</span>
            <span>添加账号</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/accounts')}>
            <span className="btn-icon">👤</span>
            <span>管理账号</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/settings')}>
            <span className="btn-icon">⚙️</span>
            <span>设置</span>
          </button>
        </div>
      </div>

      {config && (
        <div className="config-info">
          <h2>配置信息</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">服务器地址:</span>
              <span className="info-value">{config.serverUrl}</span>
            </div>
            <div className="info-item">
              <span className="info-label">自动同步:</span>
              <span className="info-value">{config.autoSync ? '开启' : '关闭'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">主题:</span>
              <span className="info-value">{config.theme}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
