import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import ipcBridge from '../services/ipc';
import './Settings.css';

const Settings: React.FC = () => {
  const { config, updateConfig } = useApp();
  const [formData, setFormData] = useState({
    serverUrl: '',
    autoSync: true,
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error',
    theme: 'system' as 'light' | 'dark' | 'system',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateConfig(formData);
      alert('设置已保存');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('确定要清除缓存吗？这将删除所有本地缓存的账号数据。')) {
      return;
    }

    try {
      await ipcBridge.clearCache();
      alert('缓存已清除');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('清除失败，请重试');
    }
  };

  const handleClearAllData = async () => {
    if (
      !confirm(
        '警告：这将删除所有本地数据，包括配置、Token和缓存。确定要继续吗？'
      )
    ) {
      return;
    }

    try {
      await ipcBridge.clearAllData();
      alert('所有数据已清除，应用将重新加载');
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear all data:', error);
      alert('清除失败，请重试');
    }
  };

  const handleViewLogs = async () => {
    try {
      const logData = await ipcBridge.getLogs();
      setLogs(logData);
      setShowLogs(true);
    } catch (error) {
      console.error('Failed to load logs:', error);
      alert('加载日志失败');
    }
  };

  const handleExportLogs = async () => {
    try {
      const logPath = await ipcBridge.exportLogs();
      alert(`日志文件位置：${logPath}`);
    } catch (error) {
      console.error('Failed to export logs:', error);
      alert('导出失败');
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('确定要清除所有日志吗？')) {
      return;
    }

    try {
      await ipcBridge.clearLogs();
      setLogs([]);
      alert('日志已清除');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      alert('清除失败');
    }
  };

  return (
    <div className="settings">
      <div className="page-header">
        <h1>设置</h1>
        <p>配置应用程序选项</p>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h2>服务器配置</h2>
          <div className="form-group">
            <label htmlFor="serverUrl">服务器地址</label>
            <input
              type="text"
              id="serverUrl"
              name="serverUrl"
              value={formData.serverUrl}
              onChange={handleInputChange}
              placeholder="http://localhost:3000"
            />
            <p className="form-hint">后端API服务器的地址</p>
          </div>
        </section>

        <section className="settings-section">
          <h2>同步设置</h2>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="autoSync"
                checked={formData.autoSync}
                onChange={handleInputChange}
              />
              <span>自动同步</span>
            </label>
            <p className="form-hint">自动将账号数据同步到后端服务器</p>
          </div>
        </section>

        <section className="settings-section">
          <h2>外观设置</h2>
          <div className="form-group">
            <label htmlFor="theme">主题</label>
            <select
              id="theme"
              name="theme"
              value={formData.theme}
              onChange={handleInputChange}
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h2>日志设置</h2>
          <div className="form-group">
            <label htmlFor="logLevel">日志级别</label>
            <select
              id="logLevel"
              name="logLevel"
              value={formData.logLevel}
              onChange={handleInputChange}
            >
              <option value="debug">调试 (Debug)</option>
              <option value="info">信息 (Info)</option>
              <option value="warn">警告 (Warn)</option>
              <option value="error">错误 (Error)</option>
            </select>
            <p className="form-hint">设置日志记录的详细程度</p>
          </div>

          <div className="button-group">
            <button className="secondary-btn" onClick={handleViewLogs}>
              查看日志
            </button>
            <button className="secondary-btn" onClick={handleExportLogs}>
              导出日志
            </button>
            <button className="danger-btn" onClick={handleClearLogs}>
              清除日志
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h2>数据管理</h2>
          <div className="button-group">
            <button className="danger-btn" onClick={handleClearCache}>
              清除缓存
            </button>
            <button className="danger-btn" onClick={handleClearAllData}>
              清除所有数据
            </button>
          </div>
          <p className="form-hint warning">
            ⚠️ 清除数据操作不可恢复，请谨慎操作
          </p>
        </section>

        <div className="settings-actions">
          <button
            className="primary-btn"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>

      {showLogs && (
        <div className="logs-modal" onClick={() => setShowLogs(false)}>
          <div className="logs-content" onClick={(e) => e.stopPropagation()}>
            <div className="logs-header">
              <h3>应用日志</h3>
              <button className="close-btn" onClick={() => setShowLogs(false)}>
                ✕
              </button>
            </div>
            <div className="logs-body">
              {logs.length === 0 ? (
                <p className="no-logs">暂无日志</p>
              ) : (
                <pre>{logs.join('\n')}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
