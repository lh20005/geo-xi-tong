import { useState, useEffect } from 'react';
import { Card, Progress, Tag, Space, Button, Tooltip, Empty, Spin, Alert } from 'antd';
import { ThunderboltOutlined, ClockCircleOutlined, WarningOutlined, ReloadOutlined, ShoppingCartOutlined, CrownOutlined } from '@ant-design/icons';
import { apiClient } from '../../api/client';

interface BoosterQuota {
  id: number;
  featureCode: string;
  featureName: string;
  quotaLimit: number;
  quotaUsed: number;
  remaining: number;
  status: 'active' | 'expired' | 'exhausted';
  createdAt: string;
  expiresAt: string;
  planName?: string;
  sourceType?: 'booster' | 'annual_addon';
}

interface CombinedQuota {
  featureCode: string;
  featureName: string;
  baseQuota: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
    resetTime?: string;
  };
  boosterQuota: {
    totalLimit: number;
    totalUsed: number;
    totalRemaining: number;
    activePackCount: number;
    earliestExpiration?: string;
    isBeingConsumed: boolean;
    expirationWarning?: boolean;
    hasAnnualAddon?: boolean;
  };
  combinedRemaining: number;
}

interface BoosterQuotaCardProps {
  onPurchase?: () => void;
}

export function BoosterQuotaCard({ onPurchase }: BoosterQuotaCardProps) {
  const [loading, setLoading] = useState(false);
  const [combinedQuotas, setCombinedQuotas] = useState<CombinedQuota[]>([]);
  const [expiringBoosters, setExpiringBoosters] = useState<BoosterQuota[]>([]);
  const [canPurchase, setCanPurchase] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quotaRes, expiringRes, purchaseRes] = await Promise.all([
        apiClient.get('/usage/combined-quota'),
        apiClient.get('/usage/expiring-boosters?days=7'),
        apiClient.get('/orders/can-purchase-booster')
      ]);

      if (quotaRes.data.success) {
        setCombinedQuotas(quotaRes.data.data || []);
      }
      if (expiringRes.data.success) {
        setExpiringBoosters(expiringRes.data.data || []);
      }
      if (purchaseRes.data.success) {
        setCanPurchase(purchaseRes.data.data?.canPurchase || false);
      }
    } catch (error) {
      console.error('加载加量包数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#ff4d4f';
    if (percentage >= 70) return '#faad14';
    return '#52c41a';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // 检查是否有任何加量包配额
  const hasBoosterQuotas = combinedQuotas.some(q => q.boosterQuota.activePackCount > 0);

  if (loading) {
    return (
      <Card title={<Space><ThunderboltOutlined />加量包配额</Space>}>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#722ed1' }} />
          <span>加量包配额</span>
          {hasBoosterQuotas && (
            <Tag color="purple">已激活</Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          {canPurchase && onPurchase && (
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={onPurchase}>
              购买加量包
            </Button>
          )}
        </Space>
      }
    >
      {/* 过期警告 */}
      {expiringBoosters.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="加量包即将过期"
          description={
            <div>
              {expiringBoosters.map(b => (
                <div key={b.id}>
                  {b.featureName}: 剩余 {b.remaining} 配额，将于 {formatDate(b.expiresAt)} 过期
                  （{getDaysUntilExpiry(b.expiresAt)} 天后）
                </div>
              ))}
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {!hasBoosterQuotas ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              暂无加量包配额
              <br />
              <span style={{ color: '#999', fontSize: 12 }}>
                购买加量包可在基础配额用完后继续使用
              </span>
            </span>
          }
        >
          {canPurchase && onPurchase && (
            <Button type="primary" onClick={onPurchase}>
              立即购买
            </Button>
          )}
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {combinedQuotas
            .filter(q => q.boosterQuota.activePackCount > 0)
            .map(quota => {
              const booster = quota.boosterQuota;
              const percentage = booster.totalLimit > 0 
                ? Math.round((booster.totalUsed / booster.totalLimit) * 100) 
                : 0;
              
              // 检查是否包含年度套餐额外购买的配额
              const hasAnnualAddon = booster.hasAnnualAddon;
              
              return (
                <Card 
                  key={quota.featureCode} 
                  size="small" 
                  style={{ background: hasAnnualAddon ? '#fffbeb' : '#faf5ff' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space>
                      <span style={{ fontWeight: 500 }}>{quota.featureName}</span>
                      <Tag color="purple">{booster.activePackCount} 个加量包</Tag>
                      {hasAnnualAddon && (
                        <Tooltip title="包含年度会员额外购买的配额">
                          <Tag color="gold" icon={<CrownOutlined />}>年度会员加量</Tag>
                        </Tooltip>
                      )}
                      {booster.isBeingConsumed && (
                        <Tooltip title="基础配额已用完，正在消耗加量包配额">
                          <Tag color="orange">正在使用</Tag>
                        </Tooltip>
                      )}
                    </Space>
                    {booster.earliestExpiration && (
                      <Tooltip title={`最早过期时间: ${formatDate(booster.earliestExpiration)}`}>
                        <Space style={{ color: '#999', fontSize: 12 }}>
                          <ClockCircleOutlined />
                          {getDaysUntilExpiry(booster.earliestExpiration)} 天后过期
                        </Space>
                      </Tooltip>
                    )}
                  </div>
                  
                  <Progress
                    percent={percentage}
                    strokeColor={getProgressColor(percentage)}
                    format={() => `${booster.totalUsed} / ${booster.totalLimit}`}
                  />
                  
                  <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                    剩余配额: <span style={{ fontWeight: 500, color: '#722ed1' }}>{booster.totalRemaining}</span>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </Card>
  );
}

export default BoosterQuotaCard;
