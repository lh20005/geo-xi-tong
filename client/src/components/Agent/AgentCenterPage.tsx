/**
 * 代理商中心页面组件
 * 整合邀请系统、代理商申请、收益统计、佣金明细等功能
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Row, Col, Statistic, Tag, Space, Button, message, 
  Typography, List, Avatar, Alert, Divider, Tooltip,
  Progress, Badge, Empty, Modal
} from 'antd';
import { 
  DollarOutlined, TeamOutlined, CheckCircleOutlined,
  ReloadOutlined, WechatOutlined, RocketOutlined, GiftOutlined,
  CopyOutlined, QuestionCircleOutlined, SafetyOutlined,
  TrophyOutlined, UserAddOutlined, BulbOutlined, WalletOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { Agent, AgentStats, getAgentStats, applyAgent } from '../../api/agent';
import WechatBindCard from './WechatBindCard';
import CommissionList from './CommissionList';

const { Title, Text } = Typography;

interface InvitationStats {
  invitationCode: string;
  totalInvites: number;
  invitedUsers: {
    username: string;
    createdAt: string;
  }[];
}

interface Subscription {
  plan_code: string;
  plan_name: string;
  status: string;
}

interface AgentCenterPageProps {
  isAgent: boolean;
  agent: Agent | null;
  invitationStats: InvitationStats | null;
  userProfile: { invitationCode: string } | null;
  subscription: Subscription | null;
  onAgentApplySuccess: (agent: Agent) => void;
  onAgentUpdate: (agent: Agent) => void;
  onRefreshInvitation: () => void;
}

// 代理商权益列表
const agentBenefits = [
  {
    icon: <DollarOutlined style={{ color: '#52c41a', fontSize: 28 }} />,
    title: '30% 高额佣金',
    description: '邀请用户付费后，您将获得订单金额 30% 的佣金，行业领先水平'
  },
  {
    icon: <WalletOutlined style={{ color: '#1890ff', fontSize: 28 }} />,
    title: 'T+1 自动结算',
    description: '佣金次日自动结算到您的微信零钱，无需手动提现'
  },
  {
    icon: <TeamOutlined style={{ color: '#722ed1', fontSize: 28 }} />,
    title: '无限邀请',
    description: '邀请人数不设上限，邀请越多收益越多，上不封顶'
  },
  {
    icon: <SafetyOutlined style={{ color: '#fa8c16', fontSize: 28 }} />,
    title: '永久绑定',
    description: '用户一旦通过您的邀请码注册，永久绑定为您的客户'
  }
];

// 赚钱步骤
const earningSteps = [
  {
    title: '申请代理商',
    description: '一键申请，即刻生效'
  },
  {
    title: '绑定微信',
    description: '绑定收款账户'
  },
  {
    title: '分享邀请码',
    description: '让客户注册时填写'
  },
  {
    title: '客户付费',
    description: '自动获得佣金'
  }
];

export const AgentCenterPage: React.FC<AgentCenterPageProps> = ({
  isAgent,
  agent,
  invitationStats,
  userProfile,
  subscription,
  onAgentApplySuccess,
  onAgentUpdate,
  onRefreshInvitation
}) => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [invitationCodeCopied, setInvitationCodeCopied] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  
  // 微信绑定卡片的 ref，用于滚动定位
  const wechatBindRef = useRef<HTMLDivElement>(null);

  // 判断是否为免费版用户
  const isFreeUser = !subscription || subscription.plan_code === 'free' || subscription.status !== 'active';

  const fetchStats = async () => {
    if (!isAgent) return;
    setStatsLoading(true);
    try {
      const data = await getAgentStats();
      setStats(data);
    } catch (error: any) {
      message.error('获取统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isAgent) {
      fetchStats();
    }
  }, [isAgent]);

  // 跳转到落地页套餐购买
  const handleNavigateToPricing = () => {
    const landingUrl = import.meta.env.VITE_LANDING_URL || 'http://localhost:8080';
    window.open(`${landingUrl}/#pricing`, '_blank');
    setUpgradeModalVisible(false);
  };

  // 滚动到微信绑定卡片
  const scrollToWechatBind = () => {
    wechatBindRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // 处理申请按钮点击
  const handleApplyClick = () => {
    if (isFreeUser) {
      setUpgradeModalVisible(true);
    } else {
      handleApply();
    }
  };

  const handleApply = async () => {
    setApplyLoading(true);
    try {
      const newAgent = await applyAgent();
      message.success('🎉 恭喜！您已成功成为代理商');
      onAgentApplySuccess(newAgent);
    } catch (error: any) {
      message.error(error.response?.data?.message || '申请失败，请重试');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleCopyInvitationCode = () => {
    const code = userProfile?.invitationCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setInvitationCodeCopied(true);
      message.success('邀请码已复制到剪贴板');
      setTimeout(() => setInvitationCodeCopied(false), 2000);
    }
  };

  // 未成为代理商时的引导页面
  if (!isAgent || !agent) {
    return (
      <Card>
        {/* 顶部标题区域 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ 
            width: 64, 
            height: 64, 
            borderRadius: '50%', 
            background: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <TrophyOutlined style={{ fontSize: 32, color: 'white' }} />
          </div>
          <Title level={3} style={{ marginBottom: 8 }}>免费升级为代理商，轻松赚取佣金</Title>
          <Text type="secondary">邀请好友使用 GEO 系统，每笔订单获得 30% 佣金，T+1 自动到账微信零钱</Text>
        </div>

        {/* 赚钱步骤 - 横向紧凑展示 */}
        <div style={{ 
          background: '#f5f5f5', 
          borderRadius: 8, 
          padding: '16px 24px',
          marginBottom: 20
        }}>
          <Row gutter={8} justify="space-between" align="middle">
            {earningSteps.map((step, index) => (
              <Col key={index} style={{ textAlign: 'center' }}>
                <Space direction="vertical" size={4}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 14,
                    margin: '0 auto'
                  }}>
                    {index + 1}
                  </div>
                  <Text strong style={{ fontSize: 13 }}>{step.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{step.description}</Text>
                </Space>
                {index < earningSteps.length - 1 && (
                  <div style={{ 
                    position: 'absolute', 
                    right: -12, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#d9d9d9'
                  }}>
                    →
                  </div>
                )}
              </Col>
            ))}
          </Row>
        </div>

        {/* 代理商权益 - 紧凑两列 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {agentBenefits.map((benefit, index) => (
            <Col xs={24} sm={12} key={index}>
              <div style={{ 
                background: '#fafafa', 
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {React.cloneElement(benefit.icon as React.ReactElement, { style: { fontSize: 20 } })}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Text strong style={{ fontSize: 14, display: 'block' }}>{benefit.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{benefit.description}</Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* 温馨提示 */}
        <Alert
          message={<Text strong>💡 温馨提示</Text>}
          description="成为代理商后，需绑定微信账户才能接收佣金。佣金 T+1 自动结算到微信零钱，请确保微信已完成实名认证。"
          type="info"
          showIcon={false}
          style={{ marginBottom: 24 }}
        />

        {/* 申请按钮 */}
        {/* 申请按钮 */}
        <div style={{ textAlign: 'center' }}>
          <Button 
            type="primary" 
            size="large" 
            icon={<RocketOutlined />}
            loading={applyLoading}
            onClick={handleApplyClick}
            style={{ 
              minWidth: 200,
              height: 48,
              fontSize: 16
            }}
          >
            免费升级为代理商
          </Button>
        </div>

        {/* 升级提示对话框 */}
        <Modal
          title={
            <Space>
              <CrownOutlined style={{ color: '#faad14' }} />
              <span>升级套餐后可申请代理商</span>
            </Space>
          }
          open={upgradeModalVisible}
          onCancel={() => setUpgradeModalVisible(false)}
          footer={null}
          centered
          width={420}
        >
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ 
              width: 72, 
              height: 72, 
              borderRadius: '50%', 
              background: '#fff7e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <CrownOutlined style={{ fontSize: 36, color: '#faad14' }} />
            </div>
            
            <Title level={4} style={{ marginBottom: 12 }}>成为付费用户，解锁代理商权益</Title>
            
            <Text type="secondary" style={{ display: 'block', marginBottom: 24, lineHeight: 1.8 }}>
              代理商功能仅对付费套餐用户开放。<br />
              升级套餐后，您可以邀请好友使用 GEO 系统，<br />
              每笔订单获得 <Text strong style={{ color: '#52c41a' }}>30% 佣金</Text>，T+1 自动到账微信零钱。
            </Text>

            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Button 
                type="primary" 
                size="large" 
                icon={<RocketOutlined />}
                onClick={handleNavigateToPricing}
                style={{ width: '100%', height: 44 }}
              >
                查看套餐并升级
              </Button>
              <Button 
                size="large"
                onClick={() => setUpgradeModalVisible(false)}
                style={{ width: '100%', height: 44 }}
              >
                稍后再说
              </Button>
            </Space>
          </div>
        </Modal>
      </Card>
    );
  }

  // 已成为代理商的仪表盘
  const getStatusTag = () => {
    if (agent.status === 'active') {
      return <Tag color="success" icon={<CheckCircleOutlined />}>正常</Tag>;
    }
    return <Tag color="error">已暂停</Tag>;
  };

  const conversionRate = stats && stats.totalInvites > 0 
    ? ((stats.paidInvites / stats.totalInvites) * 100).toFixed(1)
    : '0';

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 代理商状态卡片 */}
      <Card>
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <Badge status="success" />
              <Text strong style={{ fontSize: 16 }}>代理商状态</Text>
              {getStatusTag()}
            </Space>
          </Col>
          <Col>
            <Space size="large">
              <Space>
                <Text type="secondary">佣金比例</Text>
                <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
                  {(agent.commissionRate * 100).toFixed(0)}%
                </Tag>
              </Space>
              <Divider type="vertical" />
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchStats}
                loading={statsLoading}
              >
                刷新数据
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 微信绑定提醒 */}
      {!agent.wechatOpenid && (
        <Alert
          message={
            <Space>
              <WechatOutlined style={{ color: '#07c160' }} />
              <Text strong>请先绑定微信账户</Text>
            </Space>
          }
          description="绑定微信后，佣金将自动结算到您的微信零钱。未绑定微信将无法接收佣金！"
          type="warning"
          showIcon={false}
          action={
            <Button 
              type="primary" 
              style={{ background: '#07c160', borderColor: '#07c160' }}
              onClick={scrollToWechatBind}
            >
              立即绑定
            </Button>
          }
        />
      )}

      {/* 收益统计 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card 
            title={<Space><DollarOutlined /> 收益概览</Space>}
            loading={statsLoading}
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={8}>
                <Statistic
                  title="累计收益"
                  value={stats?.totalEarnings || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a', fontSize: 28 }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={
                    <Space>
                      已结算
                      <Tooltip title="已成功转账到微信零钱的佣金">
                        <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={stats?.settledEarnings || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#1890ff', fontSize: 28 }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={
                    <Space>
                      待结算
                      <Tooltip title="T+1 自动结算到微信零钱">
                        <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={stats?.pendingEarnings || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#faad14', fontSize: 28 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title={<Space><TeamOutlined /> 邀请统计</Space>}
            loading={statsLoading}
            style={{ height: '100%' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="邀请用户"
                  value={stats?.totalInvites || 0}
                  suffix="人"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="付费用户"
                  value={stats?.paidInvites || 0}
                  suffix="人"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={24}>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">转化率</Text>
                  <Progress 
                    percent={parseFloat(conversionRate)} 
                    size="small"
                    format={() => `${conversionRate}%`}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 邀请码和推广指南 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card 
            title={<Space><GiftOutlined /> 我的邀请码</Space>}
            extra={
              <Button 
                icon={<ReloadOutlined />} 
                size="small"
                onClick={onRefreshInvitation}
              >
                刷新
              </Button>
            }
          >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 16, 
                padding: '24px 32px',
                display: 'inline-block',
                marginBottom: 16
              }}>
                <div style={{ 
                  fontSize: 32, 
                  fontWeight: 'bold', 
                  letterSpacing: 8,
                  fontFamily: 'monospace',
                  color: 'white'
                }}>
                  {userProfile?.invitationCode || '------'}
                </div>
              </div>
              <div>
                <Button
                  type="primary"
                  size="large"
                  icon={<CopyOutlined />}
                  onClick={handleCopyInvitationCode}
                  style={{ minWidth: 160 }}
                >
                  {invitationCodeCopied ? '已复制!' : '复制邀请码'}
                </Button>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={<Space><BulbOutlined /> 推广指南</Space>}
            style={{ height: '100%' }}
          >
            <Alert
              message="如何获得佣金"
              description={
                <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  <li><Text strong>分享邀请码</Text> - 将您的专属邀请码分享给潜在客户</li>
                  <li><Text strong>客户注册</Text> - 客户在注册时填写您的邀请码</li>
                  <li><Text strong>客户付费</Text> - 客户购买任意套餐</li>
                  <li><Text strong>获得佣金</Text> - 系统自动计算并 T+1 结算到微信</li>
                </ol>
              }
              type="info"
              showIcon={false}
            />
            <Divider style={{ margin: '16px 0' }} />
            <Space direction="vertical" size={4}>
              <Text type="secondary">
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                客户必须使用您的邀请码注册才能绑定
              </Text>
              <Text type="secondary">
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                客户一旦绑定，永久为您的客户
              </Text>
              <Text type="secondary">
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                客户每次续费您都能获得佣金
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 微信绑定 */}
      <div ref={wechatBindRef}>
        <WechatBindCard agent={agent} onAgentUpdate={onAgentUpdate} />
      </div>

      {/* 受邀用户列表 */}
      <Card
        title={<Space><UserAddOutlined /> 我邀请的用户</Space>}
        extra={
          <Button icon={<ReloadOutlined />} onClick={onRefreshInvitation}>
            刷新
          </Button>
        }
      >
        {invitationStats && invitationStats.invitedUsers && invitationStats.invitedUsers.length > 0 ? (
          <List
            dataSource={invitationStats.invitedUsers.slice(0, 10)}
            renderItem={(user) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      style={{ backgroundColor: '#1890ff' }}
                      size="large"
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  title={<span style={{ fontSize: 15 }}>{user.username}</span>}
                  description={`注册时间: ${new Date(user.createdAt).toLocaleString('zh-CN')}`}
                />
              </List.Item>
            )}
            footer={
              invitationStats.invitedUsers.length > 10 && (
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">
                    共 {invitationStats.totalInvites} 位用户，仅显示最近 10 位
                  </Text>
                </div>
              )
            }
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">还没有邀请任何用户</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  分享您的邀请码开始邀请好友吧
                </Text>
              </Space>
            }
          />
        )}
      </Card>

      {/* 佣金明细 */}
      <CommissionList />
    </Space>
  );
};

export default AgentCenterPage;
