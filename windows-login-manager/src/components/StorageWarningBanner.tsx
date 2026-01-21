/**
 * 存储空间警告横幅组件
 * 当用户存储空间使用超过阈值时显示警告
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button, Space, Progress } from 'antd';
import { WarningOutlined, CloudUploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { getUserWebSocketService } from '../services/UserWebSocketService';

interface StorageUsage {
  totalStorageBytes: number;
  storageQuotaBytes: number;
  purchasedStorageBytes: number;
  usagePercentage: number;
  availableBytes: number;
}

interface StorageWarningBannerProps {
  /** 是否显示在页面顶部（固定定位） */
  fixed?: boolean;
}

export const StorageWarningBanner: React.FC<StorageWarningBannerProps> = ({ fixed = false }) => {
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [alertType, setAlertType] = useState<'warning' | 'critical' | 'depleted' | null>(null);

  useEffect(() => {
    const wsService = getUserWebSocketService();
    
    // 监听存储更新
    const handleStorageUpdate = (data: any) => {
      if (data.usage) {
        setStorageUsage(data.usage);
        updateAlertType(data.usage);
      }
    };

    // 监听存储警报
    const handleStorageAlert = (data: any) => {
      if (data.alert) {
        setAlertType(data.alert.alertType);
        setDismissed(false); // 新警报时重新显示
      }
    };

    wsService.on('storage_updated', handleStorageUpdate);
    wsService.on('storage_alert', handleStorageAlert);

    return () => {
      wsService.off('storage_updated', handleStorageUpdate);
      wsService.off('storage_alert', handleStorageAlert);
    };
  }, []);

  const updateAlertType = (usage: StorageUsage) => {
    // 无限配额不显示警告
    if (usage.storageQuotaBytes === -1) {
      setAlertType(null);
      return;
    }

    const percentage = usage.usagePercentage;
    if (percentage >= 100) {
      setAlertType('depleted');
    } else if (percentage >= 95) {
      setAlertType('critical');
    } else if (percentage >= 80) {
      setAlertType('warning');
    } else {
      setAlertType(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes === -1) return '无限';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpgrade = () => {
    // Windows 端打开外部浏览器到用户中心
    const url = 'http://localhost:5173/user-center?tab=subscription';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleManageStorage = () => {
    // Windows 端打开外部浏览器到存储管理
    const url = 'http://localhost:5173/user-center?tab=storage';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // 不显示警告的情况
  if (!alertType || dismissed) {
    return null;
  }

  const getAlertConfig = () => {
    switch (alertType) {
      case 'depleted':
        return {
          type: 'error' as const,
          icon: <WarningOutlined />,
          message: '存储空间已用完',
          description: '您的存储空间已耗尽，无法上传新内容。请立即升级套餐或删除不需要的文件。'
        };
      case 'critical':
        return {
          type: 'warning' as const,
          icon: <WarningOutlined />,
          message: '存储空间即将耗尽',
          description: `您的存储空间已使用 ${storageUsage?.usagePercentage?.toFixed(1) || 95}%，即将用完。建议升级套餐或清理空间。`
        };
      case 'warning':
        return {
          type: 'warning' as const,
          icon: <CloudUploadOutlined />,
          message: '存储空间使用提醒',
          description: `您的存储空间已使用 ${storageUsage?.usagePercentage?.toFixed(1) || 80}%。`
        };
      default:
        return null;
    }
  };

  const config = getAlertConfig();
  if (!config) return null;

  const bannerStyle: React.CSSProperties = fixed ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderRadius: 0
  } : {};

  return (
    <Alert
      style={bannerStyle}
      type={config.type}
      icon={config.icon}
      showIcon
      closable
      onClose={() => setDismissed(true)}
      message={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>{config.message}</span>
          {storageUsage && (
            <Progress 
              percent={Math.min(storageUsage.usagePercentage, 100)} 
              size="small" 
              style={{ width: 120 }}
              status={alertType === 'depleted' ? 'exception' : alertType === 'critical' ? 'exception' : 'active'}
            />
          )}
        </div>
      }
      description={
        <div>
          <p style={{ marginBottom: 8 }}>{config.description}</p>
          {storageUsage && (
            <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              已使用: {formatBytes(storageUsage.totalStorageBytes)} / {formatBytes(storageUsage.storageQuotaBytes + storageUsage.purchasedStorageBytes)}
            </p>
          )}
          <Space>
            <Button type="primary" size="small" onClick={handleUpgrade}>
              升级套餐
            </Button>
            <Button size="small" icon={<DeleteOutlined />} onClick={handleManageStorage}>
              管理存储
            </Button>
          </Space>
        </div>
      }
    />
  );
};

export default StorageWarningBanner;
