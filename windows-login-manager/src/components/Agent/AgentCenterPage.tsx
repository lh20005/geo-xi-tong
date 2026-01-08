/**
 * 代理商中心页面组件
 * 整合邀请系统、代理商申请、收益统计、佣金明细等功能
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Row, Col, Statistic, Space, Button, message, 
  Typography, List, Avatar, Alert, Divider, Tooltip,
  Progress, Empty, Modal
} from 'antd';
import { 
  DollarOutlined, TeamOutlined,
  ReloadOutlined, WechatOutlined, RocketOutlined, GiftOutlined,
  CopyOutlined, QuestionCircleOutlined,
  TrophyOutlined, UserAddOutlined, CrownOutlined
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
  
  const wechatBindRef = useRef<HTMLDivElement>(null);

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
    if (isAgent) fetchStats();
  }, [isAgent]);

  const handleNavigateToPricing = () => {
    const landingUrl = import.meta.env.VITE_LANDING_URL || 'http://localhost:8080';
    window.open(`${landingUrl}/#pricing`, '_blank');
    setUpgradeModalVisible(false);
  };

  const scrollToWechatBind = () => {
    wechatBindRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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

  // 未成为代理商时的申请页面
  if (!isAgent || !agent) {
    return (
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title={<Space><TrophyOutlined />成为代理商</Space>}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, color: '#1890ff', marginBottom: 8 }}><TrophyOutlined /></div>
              <Title level={4} style={{ marginBottom: 4 }}>成为代理商，开启躺赚模式</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>邀请好友使用 GEO 系统，轻松赚取持续佣金收入</Text>
              
              <Row gutter={16} justify="center" style={{ marginBottom: 16, maxWidth: 600, margin: '0 auto 16px' }}>
                <Col span={12}>
                  <Card size="small" style={{ background: '#fff1f0', border: '1px solid #ffccc7' }}>
                    <Statistic title={<Text type="secondary">客户专属福利</Text>} value="首单8折" valueStyle={{ color: '#ff4d4f', fontSize: 20 }} prefix={<GiftOutlined />} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                    <Statistic title={<Text type="secondary">代理商收益</Text>} value="永久30%分佣" valueStyle={{ color: '#52c41a', fontSize: 20 }} prefix={<DollarOutlined />} />
                  </Card>
                </Col>
              </Row>

              <Space size="large">
                <Button type="primary" size="large" icon={<RocketOutlined />} loading={applyLoading} onClick={handleApplyClick}>免费升级为代理商</Button>
              </Space>
            </div>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="代理商权益">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card size="small" variant="borderless" style={{ background: '#fafafa' }}>
                  <Space><GiftOutlined style={{ fontSize: 20, color: '#ff4d4f' }} /><div><Text strong>客户首单8折</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>使用您的邀请码注册的新用户，首次购买套餐享受8折优惠，助您拓展客户</Text></div></Space>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" variant="borderless" style={{ background: '#fafafa' }}>
                  <Space><DollarOutlined style={{ fontSize: 20, color: '#52c41a' }} /><div><Text strong>永久30%分佣</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>客户每次续费充值，您都能获得30%佣金，持续躺赚</Text></div></Space>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" variant="borderless" style={{ background: '#fafafa' }}>
                  <Space><WechatOutlined style={{ fontSize: 20, color: '#07c160' }} /><div><Text strong>T+1 自动到账</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>佣金次日自动结算到您的微信零钱，无需手动提现</Text></div></Space>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" variant="borderless" style={{ background: '#fafafa' }}>
                  <Space><TeamOutlined style={{ fontSize: 20, color: '#1890ff' }} /><div><Text strong>客户永久绑定</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>用户一旦通过您的邀请码注册，永久绑定为您的客户</Text></div></Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        <Modal title={<Space><CrownOutlined style={{ color: '#faad14' }} />升级套餐后可申请代理商</Space>} open={upgradeModalVisible} onCancel={() => setUpgradeModalVisible(false)} footer={null} centered>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }}><CrownOutlined /></div>
            <Title level={4} style={{ marginBottom: 8 }}>成为付费用户，解锁代理商权益</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>代理商功能仅对付费套餐用户开放。升级任意付费套餐后，您可以免费成为代理商，获得该客户每笔订单的 30% 佣金。</Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block icon={<RocketOutlined />} onClick={handleNavigateToPricing}>查看套餐并升级</Button>
              <Button size="large" block onClick={() => setUpgradeModalVisible(false)}>稍后再说</Button>
            </Space>
          </div>
        </Modal>
      </Row>
    );
  }

  const conversionRate = stats && stats.totalInvites > 0 ? ((stats.paidInvites / stats.totalInvites) * 100).toFixed(1) : '0';

  return (
    <Row gutter={[16, 16]}>
      {!agent.wechatOpenid && (
        <Col span={24}>
          <Alert message="请先绑定微信账户" description="绑定微信后，佣金将自动结算到您的微信零钱。未绑定微信将无法接收佣金！" type="warning" showIcon action={<Button size="small" type="primary" onClick={scrollToWechatBind}>立即绑定</Button>} />
        </Col>
      )}

      <Col span={24}>
        <Card title={<Space><DollarOutlined />收益概览</Space>} loading={statsLoading} extra={<Button icon={<ReloadOutlined />} onClick={fetchStats}>刷新</Button>}>
          <Row gutter={16}>
            <Col xs={24} sm={8}><Statistic title="累计收益" value={stats?.totalEarnings || 0} precision={2} prefix="¥" valueStyle={{ color: '#52c41a' }} /></Col>
            <Col xs={24} sm={8}><Statistic title={<Space>已结算<Tooltip title="已成功转账到微信零钱的佣金"><QuestionCircleOutlined style={{ color: '#8c8c8c' }} /></Tooltip></Space>} value={stats?.settledEarnings || 0} precision={2} prefix="¥" valueStyle={{ color: '#1890ff' }} /></Col>
            <Col xs={24} sm={8}><Statistic title={<Space>待结算<Tooltip title="T+1 自动结算到微信零钱"><QuestionCircleOutlined style={{ color: '#8c8c8c' }} /></Tooltip></Space>} value={stats?.pendingEarnings || 0} precision={2} prefix="¥" valueStyle={{ color: '#faad14' }} /></Col>
          </Row>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={<Space><TeamOutlined />邀请统计</Space>} loading={statsLoading} style={{ height: '100%' }}>
          <Row gutter={16}>
            <Col span={12}><Statistic title="邀请用户" value={stats?.totalInvites || 0} suffix="人" /></Col>
            <Col span={12}><Statistic title="付费用户" value={stats?.paidInvites || 0} suffix="人" valueStyle={{ color: '#52c41a' }} /></Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <div><Text type="secondary">转化率</Text><Progress percent={parseFloat(conversionRate)} size="small" format={() => `${conversionRate}%`} /></div>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={<Space><GiftOutlined />我的邀请码</Space>} extra={<Button icon={<ReloadOutlined />} size="small" onClick={onRefreshInvitation}>刷新</Button>} style={{ height: '100%' }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '16px 24px', display: 'inline-block', marginBottom: 12 }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 6, fontFamily: 'monospace' }}>{userProfile?.invitationCode || '------'}</Text>
            </div>
            <div><Button type="primary" icon={<CopyOutlined />} onClick={handleCopyInvitationCode}>{invitationCodeCopied ? '已复制!' : '复制邀请码'}</Button></div>
            <div style={{ marginTop: 12 }}><Text type="secondary" style={{ fontSize: 12 }}>客户使用邀请码注册享首单8折，您获得永久30%分佣</Text></div>
          </div>
        </Card>
      </Col>

      <Col span={24}>
        <div ref={wechatBindRef}><WechatBindCard agent={agent} onAgentUpdate={onAgentUpdate} /></div>
      </Col>

      <Col span={24}>
        <Card title={<Space><UserAddOutlined />我邀请的用户</Space>} extra={<Button icon={<ReloadOutlined />} onClick={onRefreshInvitation}>刷新</Button>}>
          {invitationStats && invitationStats.invitedUsers && invitationStats.invitedUsers.length > 0 ? (
            <List dataSource={invitationStats.invitedUsers.slice(0, 10)} renderItem={(user) => (
              <List.Item>
                <List.Item.Meta avatar={<Avatar style={{ backgroundColor: '#1890ff' }}>{user.username.charAt(0).toUpperCase()}</Avatar>} title={user.username} description={`注册时间: ${new Date(user.createdAt).toLocaleString('zh-CN')}`} />
              </List.Item>
            )} footer={invitationStats.invitedUsers.length > 10 && (<div style={{ textAlign: 'center' }}><Text type="secondary">共 {invitationStats.totalInvites} 位用户，仅显示最近 10 位</Text></div>)} />
          ) : (
            <Empty description="还没有邀请任何用户" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>

      <Col span={24}><CommissionList /></Col>
    </Row>
  );
};

export default AgentCenterPage;
