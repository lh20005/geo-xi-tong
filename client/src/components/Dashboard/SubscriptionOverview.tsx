/**
 * 订阅概览组件
 * 展示用户当前套餐和配额使用情况
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Progress, Typography, Space, Button, Skeleton, Tooltip } from 'antd';
import { 
  CrownOutlined, FileTextOutlined, RocketOutlined, 
  DatabaseOutlined, ArrowRightOutlined, ThunderboltOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';

const { Text } = Typography;

interface UsageFeature {
  feature_code: string;
  feature_name: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  unit: string;
  reset_period: string;
}

interface SubscriptionData {
  plan_name: string;
  plan_code: string;
  status: string;
  end_date: string;
}

export const SubscriptionOverview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usageStats, setUsageStats] = useState<UsageFeature[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, usageRes] = await Promise.all([
        apiClient.get('/subscription/current'),
        apiClient.get('/subscription/usage-stats')
      ]);
      
      setSubscription(subRes.data.data);
      
      if (usageRes.data.data?.features) {
        setUsageStats(usageRes.data.data.features);
      }
    } catch (error) {
      console.error('获取订阅数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFeatureIcon = (code: string) => {
    switch (code) {
      case 'articles_per_month': return <FileTextOutlined />;
      case 'publish_per_month': return <RocketOutlined />;
      case 'storage_space': return <DatabaseOutlined />;
      case 'distillations_per_month': return <ThunderboltOutlined />;
      default: return <FileTextOutlined />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#ff4d4f';
    if (percentage >= 70) return '#faad14';
    return '#52c41a';
  };

  const formatQuota = (value: number, unit: string) => {
    if (value === -1) return '无限';
    if (unit === 'MB' || unit === 'GB') {
      return `${value} ${unit}`;
    }
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <Card style={{ borderRadius: 8, marginBottom: 16 }}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  // 筛选主要配额指标
  const mainFeatures = usageStats.filter(f => 
    ['articles_per_month', 'publish_per_month', 'storage_space'].includes(f.feature_code)
  );

  return (
    <Card
      style={{ 
        borderRadius: 8, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: 16
      }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 16
      }}>
        <Space>
          <CrownOutlined style={{ 
            fontSize: 18, 
            color: subscription?.plan_code === 'free' ? '#8c8c8c' : '#faad14' 
          }} />
          <Text strong style={{ fontSize: 15 }}>
            {subscription?.plan_name || '免费版'}
          </Text>
          {subscription?.status === 'active' && subscription?.end_date && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              · 有效期至 {new Date(subscription.end_date).toLocaleDateString('zh-CN')}
            </Text>
          )}
        </Space>
        <Button 
          type="link" 
          size="small"
          onClick={() => navigate('/user-center', { state: { activeTab: 'subscription' } })}
        >
          管理套餐 <ArrowRightOutlined />
        </Button>
      </div>

      <Row gutter={[16, 12]}>
        {mainFeatures.map((feature) => (
          <Col xs={24} sm={8} key={feature.feature_code}>
            <div style={{ 
              background: '#fafafa', 
              borderRadius: 8, 
              padding: '12px 16px' 
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 8
              }}>
                <Space size={6}>
                  {getFeatureIcon(feature.feature_code)}
                  <Text style={{ fontSize: 13 }}>{feature.feature_name}</Text>
                </Space>
                {feature.percentage >= 90 && (
                  <Tooltip title="配额即将用尽">
                    <WarningOutlined style={{ color: '#ff4d4f' }} />
                  </Tooltip>
                )}
              </div>
              <Progress 
                percent={feature.limit === -1 ? 0 : feature.percentage} 
                size="small"
                strokeColor={getProgressColor(feature.percentage)}
                format={() => null}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginTop: 4
              }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已用 {feature.used}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  / {formatQuota(feature.limit, feature.unit)}
                </Text>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default SubscriptionOverview;
