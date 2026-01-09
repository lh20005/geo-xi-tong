import { useState, useEffect } from 'react';
import {
  Drawer,
  Tabs,
  Card,
  Progress,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Spin,
  Empty,
  Alert,
} from 'antd';
import {
  ClockCircleOutlined,
  RocketOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  GiftOutlined,
  HistoryOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { getUserSubscriptionDetail, SubscriptionDetail } from '../../api/userSubscriptions';
import UpgradePlanModal from './UpgradePlanModal';
import ExtendSubscriptionModal from './ExtendSubscriptionModal';
import AdjustQuotaModal from './AdjustQuotaModal';
import ControlSubscriptionModal from './ControlSubscriptionModal';
import GiftSubscriptionModal from './GiftSubscriptionModal';
import AdjustmentHistoryTable from './AdjustmentHistoryTable';

interface Props {
  visible: boolean;
  userId: number | null;
  username: string;
  onClose: () => void;
}

export default function SubscriptionDetailDrawer({ visible, userId, username, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // 模态框状态
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [adjustQuotaModalVisible, setAdjustQuotaModalVisible] = useState(false);
  const [controlModalVisible, setControlModalVisible] = useState(false);
  const [controlAction, setControlAction] = useState<'pause' | 'resume' | 'cancel'>('pause');
  const [giftModalVisible, setGiftModalVisible] = useState(false);

  useEffect(() => {
    if (visible && userId) {
      loadSubscriptionDetail();
    }
  }, [visible, userId]);

  const loadSubscriptionDetail = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const data = await getUserSubscriptionDetail(userId);
      setDetail(data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        message.warning('该用户没有活跃的订阅');
      } else {
        message.error(error.response?.data?.message || '加载订阅详情失败');
      }
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOperationSuccess = () => {
    message.success('操作成功');
    loadSubscriptionDetail();
  };

  const handleControl = (action: 'pause' | 'resume' | 'cancel') => {
    setControlAction(action);
    setControlModalVisible(true);
  };

  const getStatusTag = (status: string, isPaused: boolean) => {
    if (isPaused) {
      return <Tag color="warning">已暂停</Tag>;
    }
    switch (status) {
      case 'active':
        return <Tag color="success">活跃</Tag>;
      case 'expired':
        return <Tag color="default">已过期</Tag>;
      case 'cancelled':
        return <Tag color="error">已取消</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const renderOverview = () => {
    if (!detail) {
      return (
        <Empty
          description="该用户没有活跃的订阅"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <div style={{ padding: '16px 0' }}>
        {/* 套餐信息卡片 */}
        <Card
          title={
            <Space>
              <RocketOutlined />
              <span>当前套餐</span>
              {detail.is_gift && <Tag color="gold">赠送</Tag>}
            </Space>
          }
          extra={getStatusTag(detail.status, detail.is_paused)}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="套餐名称"
                value={detail.plan_name}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="套餐价格"
                value={detail.price}
                precision={2}
                prefix="¥"
                valueStyle={{ fontSize: 20, color: '#1890ff' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="剩余天数"
                value={detail.days_remaining}
                suffix="天"
                valueStyle={{
                  fontSize: 20,
                  color: detail.days_remaining < 7 ? '#ff4d4f' : '#52c41a',
                }}
              />
            </Col>
          </Row>

          <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#666' }}>开始日期</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  {new Date(detail.start_date).toLocaleDateString('zh-CN')}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#666' }}>到期日期</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  {new Date(detail.end_date).toLocaleDateString('zh-CN')}
                </div>
              </Col>
            </Row>
          </div>

          {detail.is_paused && detail.pause_reason && (
            <Alert
              message="订阅已暂停"
              description={detail.pause_reason}
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        {/* 配额使用情况 */}
        <Card
          title={
            <Space>
              <SettingOutlined />
              <span>配额使用情况</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {detail.features.map((feature) => (
            <div key={feature.feature_code} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>{feature.feature_name}</span>
                <span style={{ color: '#666' }}>
                  {feature.feature_value === -1 ? (
                    <Tag color="green">无限制</Tag>
                  ) : (
                    `${feature.current_usage} / ${feature.feature_value}`
                  )}
                </span>
              </div>
              {feature.feature_value !== -1 && (
                <Progress
                  percent={feature.usage_percentage}
                  status={
                    feature.usage_percentage >= 100
                      ? 'exception'
                      : feature.usage_percentage >= 80
                      ? 'normal'
                      : 'active'
                  }
                  strokeColor={
                    feature.usage_percentage >= 100
                      ? '#ff4d4f'
                      : feature.usage_percentage >= 80
                      ? '#faad14'
                      : '#52c41a'
                  }
                />
              )}
            </div>
          ))}
        </Card>

        {/* 快捷操作 */}
        <Card title="快捷操作">
          <Space wrap>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => setUpgradeModalVisible(true)}
            >
              升级套餐
            </Button>
            <Button
              icon={<ClockCircleOutlined />}
              onClick={() => setExtendModalVisible(true)}
            >
              延期订阅
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setAdjustQuotaModalVisible(true)}
            >
              调整配额
            </Button>
            <Button
              icon={<GiftOutlined />}
              onClick={() => setGiftModalVisible(true)}
            >
              赠送套餐
            </Button>
            {detail.is_paused ? (
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => handleControl('resume')}
              >
                恢复订阅
              </Button>
            ) : (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={() => handleControl('pause')}
              >
                暂停订阅
              </Button>
            )}
            <Button
              danger
              icon={<StopOutlined />}
              onClick={() => handleControl('cancel')}
            >
              取消订阅
            </Button>
          </Space>
        </Card>
      </div>
    );
  };

  return (
    <>
      <Drawer
        title={`${username} - 订阅管理`}
        width={800}
        open={visible}
        onClose={onClose}
        destroyOnClose
      >
        <Spin spinning={loading}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'overview',
                label: (
                  <span>
                    <RocketOutlined />
                    订阅概览
                  </span>
                ),
                children: renderOverview(),
              },
              {
                key: 'history',
                label: (
                  <span>
                    <HistoryOutlined />
                    调整历史
                  </span>
                ),
                children: userId ? (
                  <AdjustmentHistoryTable userId={userId} />
                ) : null,
              },
            ]}
          />
        </Spin>
      </Drawer>

      {/* 各种操作模态框 */}
      {userId && detail && (
        <>
          <UpgradePlanModal
            visible={upgradeModalVisible}
            userId={userId}
            currentPlanId={detail.plan_id}
            onClose={() => setUpgradeModalVisible(false)}
            onSuccess={handleOperationSuccess}
          />
          <ExtendSubscriptionModal
            visible={extendModalVisible}
            userId={userId}
            currentEndDate={detail.end_date}
            onClose={() => setExtendModalVisible(false)}
            onSuccess={handleOperationSuccess}
          />
          <AdjustQuotaModal
            visible={adjustQuotaModalVisible}
            userId={userId}
            features={detail.features}
            onClose={() => setAdjustQuotaModalVisible(false)}
            onSuccess={handleOperationSuccess}
          />
          <ControlSubscriptionModal
            visible={controlModalVisible}
            userId={userId}
            action={controlAction}
            onClose={() => setControlModalVisible(false)}
            onSuccess={handleOperationSuccess}
          />
          <GiftSubscriptionModal
            visible={giftModalVisible}
            userId={userId}
            username={username}
            onClose={() => setGiftModalVisible(false)}
            onSuccess={handleOperationSuccess}
          />
        </>
      )}
    </>
  );
}
