import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import ipcBridge from '../services/ipc';
import { useApp } from '../context/AppContext';
import './PlatformSelection.css';

interface Platform {
  platform_id: string;
  platform_name: string;
  icon_url?: string;
  enabled: boolean;
}

const PlatformSelection: React.FC = () => {
  const { refreshAccounts } = useApp();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    try {
      setIsLoading(true);
      setLoadError('');

      const result = await ipcBridge.getPlatforms();
      const list: Platform[] = (result || []).map((p: any) => ({
        platform_id: p.platform_id,
        platform_name: p.platform_name,
        icon_url: p.icon_url,
        enabled: !!p.enabled,
      }));

      setPlatforms(list);
    } catch (error) {
      console.error('Failed to load platforms:', error);
      setLoadError(error instanceof Error ? error.message : '加载平台列表失败');
      setPlatforms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlatformClick = async (platformId: string) => {
    if (isLoggingIn) return;

    try {
      setIsLoggingIn(true);
      setSelectedPlatform(platformId);

      const result = await ipcBridge.loginPlatform(platformId);

      if (result.success) {
        message.success(`登录成功：${result.account?.account_name || ''}`);
        
        // 刷新账号列表
        try {
          await refreshAccounts();
          console.log('Accounts refreshed after successful login');
        } catch (refreshError) {
          console.error('Failed to refresh accounts:', refreshError);
        }
      } else {
        // 如果是用户取消登录，不显示错误提示
        if (result.message === 'Login cancelled') {
          console.log('Login cancelled by user');
        } else {
          message.error(`登录失败：${result.message || result.error || '未知错误'}`);
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      message.error('登录失败，请重试');
    } finally {
      setIsLoggingIn(false);
      setSelectedPlatform(null);
    }
  };

  const handleCancelLogin = async () => {
    try {
      await ipcBridge.cancelLogin();
      setIsLoggingIn(false);
      setSelectedPlatform(null);
    } catch (error) {
      console.error('Failed to cancel login:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="platform-selection">
        <div className="loading">加载平台列表...</div>
      </div>
    );
  }

  return (
    <div className="platform-selection">
      <div className="page-header">
        <h1>选择平台登录</h1>
        <p>选择一个平台进行账号登录</p>
      </div>

      {loadError && (
        <div className="no-results">
          <p>{loadError}</p>
          <button className="cancel-btn" onClick={loadPlatforms}>
            重试
          </button>
        </div>
      )}

      {isLoggingIn && (
        <div className="login-progress">
          <div className="progress-content">
            <div className="spinner"></div>
            <p>正在登录 {selectedPlatform}...</p>
            <p className="progress-hint">请在弹出的窗口中完成登录</p>
            <button className="cancel-btn" onClick={handleCancelLogin}>
              取消登录
            </button>
          </div>
        </div>
      )}

      <div className="platforms-grid">
        {platforms.length === 0 ? (
          <div className="no-results">
            <p>未找到匹配的平台</p>
          </div>
        ) : (
          platforms.map((platform) => (
            <div
              key={platform.platform_id}
              className={`platform-card ${!platform.enabled ? 'disabled' : ''} ${
                isLoggingIn ? 'loading' : ''
              }`}
              onClick={() => platform.enabled && handlePlatformClick(platform.platform_id)}
            >
              <div className="platform-icon">
                {platform.icon_url ? (
                  <img src={platform.icon_url} alt={platform.platform_name} />
                ) : (
                  <span className="icon-placeholder">
                    {platform.platform_name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="platform-name">{platform.platform_name}</div>
              {!platform.enabled && <div className="disabled-badge">暂不可用</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlatformSelection;
