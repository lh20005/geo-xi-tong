import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Progress, Tag, Space, Typography, Alert, Descriptions, Result, Divider } from 'antd';
import { 
  CloudDownloadOutlined, 
  CheckCircleOutlined, 
  SyncOutlined, 
  DownloadOutlined,
  RocketOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined
} from '@ant-design/icons';
import type { UpdateStatus, UpdateInfoResult } from '../types/electron';

const { Title, Text, Paragraph } = Typography;

const SoftwareUpdatePage = () => {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    status: 'idle',
    message: '就绪'
  });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfoResult | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取当前版本
  const fetchCurrentVersion = useCallback(async () => {
    try {
      if (window.electronAPI?.updater) {
        const version = await window.electronAPI.updater.getVersion();
        setCurrentVersion(version);
      }
    } catch (error) {
      console.error('获取版本失败:', error);
    }
  }, []);

  // 获取更新状态
  const fetchUpdateStatus = useCallback(async () => {
    try {
      if (window.electronAPI?.updater) {
        const status = await window.electronAPI.updater.getStatus();
        setUpdateStatus(status);
      }
    } catch (error) {
      console.error('获取更新状态失败:', error);
    }
  }, []);

  // 获取更新信息
  const fetchUpdateInfo = useCallback(async () => {
    try {
      if (window.electronAPI?.updater) {
        const info = await window.electronAPI.updater.getInfo();
        setUpdateInfo(info);
      }
    } catch (error) {
      console.error('获取更新信息失败:', error);
    }
  }, []);

  // 检查更新
  const handleCheckUpdate = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.updater) {
        await window.electronAPI.updater.checkForUpdates();
        await fetchUpdateInfo();
      }
    } catch (error) {
      console.error('检查更新失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 下载更新
  const handleDownloadUpdate = async () => {
    try {
      if (window.electronAPI?.updater) {
        await window.electronAPI.updater.downloadUpdate();
      }
    } catch (error) {
      console.error('下载更新失败:', error);
    }
  };

  // 安装更新
  const handleInstallUpdate = async () => {
    try {
      if (window.electronAPI?.updater) {
        await window.electronAPI.updater.installUpdate();
      }
    } catch (error) {
      console.error('安装更新失败:', error);
    }
  };

  // 手动下载
  const handleManualDownload = () => {
    if (updateInfo?.downloadUrl) {
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(updateInfo.downloadUrl);
      } else {
        window.open(updateInfo.downloadUrl, '_blank');
      }
    }
  };

  // 初始化
  useEffect(() => {
    fetchCurrentVersion();
    fetchUpdateStatus();
    fetchUpdateInfo();

    // 监听更新状态变化
    let cleanup: (() => void) | undefined;
    if (window.electronAPI?.updater?.onStatusChanged) {
      cleanup = window.electronAPI.updater.onStatusChanged((status) => {
        setUpdateStatus(status);
        // 状态变化时也更新信息
        fetchUpdateInfo();
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [fetchCurrentVersion, fetchUpdateStatus, fetchUpdateInfo]);

  // 获取状态标签
  const getStatusTag = () => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      'idle': { color: 'default', icon: <InfoCircleOutlined />, text: '就绪' },
      'checking': { color: 'processing', icon: <SyncOutlined spin />, text: '检查中' },
      'available': { color: 'warning', icon: <ExclamationCircleOutlined />, text: '有新版本' },
      'not-available': { color: 'success', icon: <CheckCircleOutlined />, text: '已是最新' },
      'downloading': { color: 'processing', icon: <DownloadOutlined />, text: '下载中' },
      'downloaded': { color: 'success', icon: <CheckCircleOutlined />, text: '下载完成' },
      'error': { color: 'error', icon: <ExclamationCircleOutlined />, text: '错误' }
    };

    const config = statusConfig[updateStatus.status] || statusConfig['idle'];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 渲染操作按钮
  const renderActionButton = () => {
    switch (updateStatus.status) {
      case 'idle':
      case 'not-available':
      case 'error':
        return (
          <Button 
            type="primary" 
            icon={<SyncOutlined />} 
            onClick={handleCheckUpdate}
            loading={loading}
            size="large"
          >
            检查更新
          </Button>
        );
      case 'checking':
        return (
          <Button type="primary" loading size="large">
            检查中...
          </Button>
        );
      case 'available':
        return (
          <Button 
            type="primary" 
            icon={<CloudDownloadOutlined />} 
            onClick={handleDownloadUpdate}
            size="large"
          >
            下载更新
          </Button>
        );
      case 'downloading':
        return (
          <Button type="primary" loading size="large">
            下载中...
          </Button>
        );
      case 'downloaded':
        return (
          <Button 
            type="primary" 
            icon={<RocketOutlined />} 
            onClick={handleInstallUpdate}
            size="large"
            danger
          >
            立即安装并重启
          </Button>
        );
      default:
        return null;
    }
  };

  // 渲染更新内容
  const renderUpdateContent = () => {
    if (updateStatus.status === 'available' || updateStatus.status === 'downloaded') {
      return (
        <Card 
          title={
            <Space>
              <RocketOutlined />
              <span>新版本 {updateStatus.version}</span>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          {updateStatus.releaseNotes ? (
            <div>
              <Title level={5}>更新内容</Title>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {updateStatus.releaseNotes}
              </Paragraph>
            </div>
          ) : (
            <Text type="secondary">暂无更新说明</Text>
          )}
          {updateStatus.releaseDate && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              发布时间: {new Date(updateStatus.releaseDate).toLocaleString('zh-CN')}
            </Text>
          )}
        </Card>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>
        <Space>
          <CloudDownloadOutlined />
          软件升级
        </Space>
      </Title>

      {/* 当前版本信息 */}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="当前版本">
            <Text strong style={{ fontSize: 16 }}>v{currentVersion || '加载中...'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="更新状态">
            {getStatusTag()}
            <Text style={{ marginLeft: 8 }}>{updateStatus.message}</Text>
          </Descriptions.Item>
          {updateInfo?.latestVersion && updateInfo.latestVersion !== currentVersion && (
            <Descriptions.Item label="最新版本">
              <Text type="success" strong>v{updateInfo.latestVersion}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 下载进度 */}
      {updateStatus.status === 'downloading' && updateStatus.progress !== undefined && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <Progress 
              type="circle" 
              percent={updateStatus.progress} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
            <div style={{ marginTop: 16 }}>
              <Text>{updateStatus.message}</Text>
            </div>
          </div>
        </Card>
      )}

      {/* 错误提示 */}
      {updateStatus.status === 'error' && updateStatus.error && (
        <Alert
          message="更新检查失败"
          description={updateStatus.error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 已是最新版本 */}
      {updateStatus.status === 'not-available' && (
        <Result
          status="success"
          title="已是最新版本"
          subTitle={`当前版本 v${currentVersion} 已经是最新版本`}
          style={{ padding: '24px 0' }}
        />
      )}

      {/* 更新内容 */}
      {renderUpdateContent()}

      {/* 操作按钮 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        {renderActionButton()}
      </div>

      {/* 提示信息 */}
      <Alert
        message="温馨提示"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>更新过程中请勿关闭应用程序</li>
            <li>安装更新后应用将自动重启</li>
            <li>建议在网络稳定时进行更新</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 24 }}
      />

      {/* 手动下载区域 */}
      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>
            <LinkOutlined style={{ marginRight: 8 }} />
            手动下载安装包
          </Text>
          <Text type="secondary">
            如果自动更新失败，您可以手动下载安装包进行更新
          </Text>
          <Divider style={{ margin: '12px 0' }} />
          {updateInfo?.platformInfo && (
            <Text type="secondary">
              当前系统: {updateInfo.platformInfo.displayName}
            </Text>
          )}
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleManualDownload}
            disabled={!updateInfo?.downloadUrl}
          >
            下载 {updateInfo?.platformInfo?.displayName || ''} 安装包
          </Button>
          {updateInfo?.downloadUrl && (
            <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }}>
              下载地址: {updateInfo.downloadUrl}
            </Text>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default SoftwareUpdatePage;
