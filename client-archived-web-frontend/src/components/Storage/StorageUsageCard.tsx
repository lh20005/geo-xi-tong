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
  // 确定进度条颜色
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#ff4d4f'; // 红色 - 耗尽
    if (percentage >= 95) return '#ff7a45'; // 橙红色 - 严重
    if (percentage >= 80) return '#faad14'; // 黄色 - 警告
    return '#52c41a'; // 绿色 - 正常
  };

  // 确定警告级别
  const getAlertType = (percentage: number): 'success' | 'warning' | 'error' | undefined => {
    if (percentage >= 100) return 'error';
    if (percentage >= 95) return 'error';
    if (percentage >= 80) return 'warning';
    return undefined;
  };

  // 确定警告图标
  const getAlertIcon = (percentage: number) => {
    if (percentage >= 95) return <ExclamationCircleOutlined />;
    if (percentage >= 80) return <WarningOutlined />;
    return null;
  };

  // 确定警告消息
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
    <Card title={<><DatabaseOutlined /> 存储空间使用情况</>} className="mb-4">
      {/* 警告提示 */}
      {alertMessage && alertType && (
        <Alert
          message={alertMessage}
          type={alertType}
          icon={getAlertIcon(usage.usagePercentage)}
          showIcon
          className="mb-4"
          action={
            usage.usagePercentage >= 80 && onUpgrade && (
              <Button size="small" type="primary" onClick={onUpgrade}>
                升级套餐
              </Button>
            )
          }
        />
      )}

      {/* 总体使用情况 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">
            已使用 {formatBytes(usage.totalStorageBytes)} / {isUnlimited ? '无限' : formatBytes(usage.storageQuotaBytes + usage.purchasedStorageBytes)}
          </span>
          {!isUnlimited && (
            <span className="text-gray-600 font-semibold">
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
          <div className="text-sm text-gray-500 mt-1">
            剩余空间: {formatBytes(usage.availableBytes)}
          </div>
        )}
      </div>

      {/* 分类统计 */}
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

      {/* 购买的额外存储 */}
      {usage.purchasedStorageBytes > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded">
          <div className="text-sm text-blue-600">
            已购买额外存储: {formatBytes(usage.purchasedStorageBytes)}
          </div>
        </div>
      )}
    </Card>
  );
};
