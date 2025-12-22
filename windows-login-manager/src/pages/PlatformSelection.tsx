import React, { useState, useEffect } from 'react';
import ipcBridge from '../services/ipc';
import './PlatformSelection.css';

interface Platform {
  platform_id: string;
  platform_name: string;
  icon_url?: string;
  enabled: boolean;
}

const PlatformSelection: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [filteredPlatforms, setFilteredPlatforms] = useState<Platform[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    loadPlatforms();
  }, []);

  useEffect(() => {
    filterPlatforms();
  }, [searchQuery, platforms]);

  const loadPlatforms = async () => {
    try {
      setIsLoading(true);
      // 模拟平台数据（实际应该从API获取）
      const mockPlatforms: Platform[] = [
        { platform_id: 'douyin', platform_name: '抖音', enabled: true },
        { platform_id: 'toutiao', platform_name: '头条', enabled: true },
        { platform_id: 'baijia', platform_name: '百家号', enabled: true },
        { platform_id: 'wangyi', platform_name: '网易号', enabled: true },
        { platform_id: 'sohu', platform_name: '搜狐号', enabled: true },
        { platform_id: 'weibo', platform_name: '微博', enabled: true },
        { platform_id: 'zhihu', platform_name: '知乎', enabled: true },
        { platform_id: 'bilibili', platform_name: 'B站', enabled: true },
      ];
      setPlatforms(mockPlatforms);
    } catch (error) {
      console.error('Failed to load platforms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterPlatforms = () => {
    if (!searchQuery.trim()) {
      setFilteredPlatforms(platforms);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = platforms.filter(
      (p) =>
        p.platform_name.toLowerCase().includes(query) ||
        p.platform_id.toLowerCase().includes(query)
    );
    setFilteredPlatforms(filtered);
  };

  const handlePlatformClick = async (platformId: string) => {
    if (isLoggingIn) return;

    try {
      setIsLoggingIn(true);
      setSelectedPlatform(platformId);

      const result = await ipcBridge.loginPlatform(platformId);

      if (result.success) {
        alert(`登录成功！账号：${result.account?.account_name}`);
      } else {
        // 如果是用户取消登录，不显示错误提示
        if (result.message === 'Login cancelled') {
          console.log('Login cancelled by user');
        } else {
          alert(`登录失败：${result.message || result.error}`);
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('登录失败，请重试');
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

      <div className="search-box">
        <input
          type="text"
          placeholder="搜索平台..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoggingIn}
        />
      </div>

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
        {filteredPlatforms.length === 0 ? (
          <div className="no-results">
            <p>未找到匹配的平台</p>
          </div>
        ) : (
          filteredPlatforms.map((platform) => (
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
