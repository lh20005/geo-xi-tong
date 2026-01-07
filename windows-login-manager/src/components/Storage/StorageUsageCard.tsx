import React from 'react';
import { Card, Progress, Statistic, Row, Col, Alert, Button } from 'antd';
import { 
  DatabaseOutlined, 
  FileImageOutlined, 
  FileTextOutlined, 
  FileOutlined,
  WarningOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { StorageUsage, formatBytes } from '../../api/storage';

interface StorageUsageCardProps {
  usage: StorageUsage;
  onUpgrade?: () => void;
}

export const StorageUsageCard: React.FC<StorageUsageCardProps> = ({ usage, onUpgrade }) => {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#ff4d4f';
    if (percentage >= 95) return '#ff7a45';
    if (percentage >= 80) return '#faad14';
    return '#52c41a';
  };

  const getAlertType = (percentage: number): 'success' | 'warning' | 'error' | undefined => {
    if (percentage >= 100) return 'error';
    if (percentage >= 95) return 'error';
    if (percentage >= 80) return 'warning';
    return undefined;
  };

  const getAlertIcon = (percentage: number) => {
    if (percentage >= 95) return <ExclamationCircleOutlined />;
    if (percentage >= 80) return <WarningOutlined />;
    return null;
  };

  const getAlertMessage = (percentage: number) => {
    if (percentage >= 100) {
      return '存储空间已用完，无法上传新内容。请立即升级套餐或清理空间。';
    }
    if (percentage >= 95) {
      return '警告：存储空间即将耗尽！请尽快升级套餐或清理空间。';
    }
    if (percentage >= 80) {
      return '提示：存储空间使用已超过 80%，建议升级套餐或清理不需要的内容。';
    }
    return null;
  };

  const isUnlimited = usage.storageQuotaBytes === -1;
  const alertType = getAlertType(usage.usagePercentage);
  const alertMessage = getAlertMessage(usage.usagePercentage);

  return (
    <Card title={<><DatabaseOutlined /> 存储空间使用情况</>} style={{ marginBottom: 16 }}>
      {alertMessage && alertType && (
        <Alert
          message={alertMessage}
          type={alertType}
          icon={getAlertIcon(usage.usagePercentage)}
          showIcon
          style={{ marginBottom: 16 }}
          action={
            usage.usagePercentage >= 80 && onUpgrade && (
              <Button size="small" type="primary" onClick={onUpgrade}>
                升级套餐
              </Button>
            )
          }
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#666' }}>
            已使用 {formatBytes(usage.totalStorageBytes)} / {isUnlimited ? '无限' : formatBytes(usage.storageQuotaBytes + usage.purchasedStorageBytes)}
          </span>
          {!isUnlimited && (
            <span style={{ color: '#666', fontWeight: 600 }}>
              {usage.usagePercentage.toFixed(1)}%
            </span>
          )}
        </div>
        {!isUnlimited && (
          <Progress
            percent={Math.min(usage.usagePercentage, 100)}
            strokeColor={getProgressColor(usage.usagePercentage)}
            showInfo={false}
            size="small"
          />
        )}
        {!isUnlimited && (
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            剩余空间: {formatBytes(usage.availableBytes)}
          </div>
        )}
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title={<><FileImageOutlined /> 图片</>}
            value={formatBytes(usage.imageStorageBytes)}
            suffix={`(${usage.imageCount})`}
            valueStyle={{ fontSize: '16px' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<><FileTextOutlined /> 文档</>}
            value={formatBytes(usage.documentStorageBytes)}
            suffix={`(${usage.documentCount})`}
            valueStyle={{ fontSize: '16px' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<><FileOutlined /> 文章</>}
            value={formatBytes(usage.articleStorageBytes)}
            suffix={`(${usage.articleCount})`}
            valueStyle={{ fontSize: '16px' }}
          />
        </Col>
      </Row>

      {usage.purchasedStorageBytes > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#e6f7ff', borderRadius: 4 }}>
          <div style={{ fontSize: 14, color: '#1890ff' }}>
            已购买额外存储: {formatBytes(usage.purchasedStorageBytes)}
          </div>
        </div>
      )}
    </Card>
  );
};
