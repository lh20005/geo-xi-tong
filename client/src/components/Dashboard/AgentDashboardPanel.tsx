/**
 * 代理商工作台面板
 * 在工作台顶部展示代理商数据概览，或引导未开通用户开通代理商
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Button, Space, Typography, 
  Skeleton, Tooltip, Badge
} from 'antd';
import { 
  DollarOutlined, TeamOutlined, RiseOutlined, GiftOutlined,
  WechatOutlined, RocketOutlined, CrownOutlined, 
  ArrowRightOutlined, TrophyOutlined, UserAddOutlined,
  CheckCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Agent, AgentStats, getAgentStatus, getAgentStats } from '../../api/agent';

const { Text, Title } = Typography;

// 基于侧边栏的深色方案
const PANEL_BG = 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)';  // 与侧边栏一致
const CARD_BG = 'rgba(255, 255, 255, 0.06)';  // 卡片背景
const CARD_BORDER = 'rgba(255, 255, 255, 0.08)';  // 卡片边框
const ACCENT_GOLD = '#fadb14';  // Ant Design 金色 - 主要数字
const ACCENT_BLUE = '#40a9ff';  // Ant Design 浅蓝色
const PRIMARY_BLUE = '#1890ff';  // 项目主色
const SUB_TEXT = 'rgba(255,255,255,0.45)';  // 次要文字颜色（统一）

interface AgentDashboardPanelProps {
  onRefresh?: () => void;
}

export const AgentDashboardPanel: React.FC<AgentDashboardPanelProps> = ({ onRefresh: _onRefresh }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAgent, setIsAgent] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);

  const fetchAgentData = async () => {
    setLoading(true);
    try {
      const statusRes = await getAgentStatus();
      setIsAgent(statusRes.isAgent);
      setAgent(statusRes.agent);
      
      if (statusRes.isAgent) {
        const statsData = await getAgentStats();
        setStats(statsData);
      }
    } catch (error) {
      console.error('获取代理商数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, []);

  const handleGoToAgentCenter = () => {
    navigate('/user-center', { state: { activeTab: 'agent' } });
  };

  // 加载状态
  if (loading) {
    return (
      <Card 
        style={{ 
          marginBottom: 24, 
          borderRadius: 12,
          background: PANEL_BG,
          border: 'none'
        }}
      >
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  // 已开通代理商 - 显示数据面板
  if (isAgent && agent) {
    const conversionRate = stats && stats.totalInvites > 0 
      ? ((stats.paidInvites / stats.totalInvites) * 100)
      : 0;

    const isWechatBound = !!agent.wechatOpenid;

    return (
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          background: PANEL_BG,
          border: 'none',
          overflow: 'hidden'
        }}
        styles={{ body: { padding: 0 } }}
      >
        {/* 顶部标题栏 */}
        <div style={{ 
          padding: '14px 24px',
          borderBottom: `1px solid ${CARD_BORDER}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <TrophyOutlined style={{ fontSize: 18, color: ACCENT_GOLD }} />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
              代理商中心
            </Text>
            <Badge 
              count="已认证" 
              style={{ 
                backgroundColor: 'rgba(24, 144, 255, 0.15)',
                color: ACCENT_BLUE,
                fontSize: 11,
                fontWeight: 500,
                border: `1px solid rgba(64, 169, 255, 0.4)`
              }} 
            />
          </Space>
          <Button 
            type="link" 
            style={{ color: ACCENT_BLUE, padding: 0, fontSize: 13 }}
            onClick={handleGoToAgentCenter}
          >
            查看详情 <ArrowRightOutlined />
          </Button>
        </div>

        {/* 数据展示区 */}
        <div style={{ padding: '16px 24px 20px' }}>
          <Row gutter={[16, 16]}>
            {/* 收益数据 */}
            <Col xs={24} sm={12} lg={6}>
              <div style={{ 
                background: CARD_BG, 
                borderRadius: 10, 
                padding: '16px 18px',
                height: '100%',
                minHeight: 110,
                border: `1px solid ${CARD_BORDER}`,
                transition: 'all 0.3s',
              }}>
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                    <DollarOutlined style={{ marginRight: 6, color: ACCENT_GOLD }} />
                    累计收益
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <Text style={{ color: ACCENT_GOLD, fontSize: 28, fontWeight: 600 }}>
                    ¥{(stats?.totalEarnings || 0).toFixed(2)}
                  </Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Tooltip title="已结算到微信零钱">
                    <Text style={{ color: SUB_TEXT, fontSize: 11 }}>
                      <CheckCircleOutlined style={{ marginRight: 4 }} />
                      已结算 ¥{(stats?.settledEarnings || 0).toFixed(2)}
                    </Text>
                  </Tooltip>
                </div>
              </div>
            </Col>

            {/* 待结算 */}
            <Col xs={24} sm={12} lg={6}>
              <div style={{ 
                background: CARD_BG, 
                borderRadius: 10, 
                padding: '16px 18px',
                height: '100%',
                minHeight: 110,
                border: `1px solid ${CARD_BORDER}`
              }}>
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                    <ClockCircleOutlined style={{ marginRight: 6, color: '#faad14' }} />
                    待结算
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <Text style={{ color: ACCENT_GOLD, fontSize: 28, fontWeight: 600 }}>
                    ¥{(stats?.pendingEarnings || 0).toFixed(2)}
                  </Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ color: SUB_TEXT, fontSize: 11 }}>
                    T+1 自动结算到微信
                  </Text>
                </div>
              </div>
            </Col>

            {/* 邀请数据 */}
            <Col xs={24} sm={12} lg={6}>
              <div style={{ 
                background: CARD_BG, 
                borderRadius: 10, 
                padding: '16px 18px',
                height: '100%',
                minHeight: 110,
                border: `1px solid ${CARD_BORDER}`
              }}>
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                    <TeamOutlined style={{ marginRight: 6, color: ACCENT_BLUE }} />
                    邀请用户
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ color: ACCENT_GOLD, fontSize: 28, fontWeight: 600 }}>
                    {stats?.totalInvites || 0}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>人</Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ color: SUB_TEXT, fontSize: 11 }}>
                    <UserAddOutlined style={{ marginRight: 4 }} />
                    付费用户 {stats?.paidInvites || 0} 人
                  </Text>
                </div>
              </div>
            </Col>

            {/* 转化率 & 状态 */}
            <Col xs={24} sm={12} lg={6}>
              <div style={{ 
                background: CARD_BG, 
                borderRadius: 10, 
                padding: '16px 18px',
                height: '100%',
                minHeight: 110,
                border: `1px solid ${CARD_BORDER}`
              }}>
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                    <RiseOutlined style={{ marginRight: 6, color: ACCENT_BLUE }} />
                    转化率
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <Text style={{ color: ACCENT_GOLD, fontSize: 28, fontWeight: 600 }}>
                    {conversionRate.toFixed(1)}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>%</Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  {isWechatBound ? (
                    <Text style={{ color: SUB_TEXT, fontSize: 11 }}>
                      <WechatOutlined style={{ marginRight: 4 }} />
                      微信已绑定
                    </Text>
                  ) : (
                    <Button 
                      type="link" 
                      size="small"
                      style={{ color: '#faad14', padding: 0, height: 'auto', fontSize: 11 }}
                      onClick={handleGoToAgentCenter}
                    >
                      <WechatOutlined style={{ marginRight: 4 }} />
                      绑定微信收款
                    </Button>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </Card>
    );
  }

  // 未开通代理商 - 显示引导面板
  return (
    <Card
      style={{
        marginBottom: 24,
        borderRadius: 12,
        background: PANEL_BG,
        border: 'none',
        position: 'relative',
        overflow: 'hidden'
      }}
      styles={{ body: { padding: 0 } }}
    >
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: -80,
        right: -80,
        width: 250,
        height: 250,
        background: 'radial-gradient(circle, rgba(24, 144, 255, 0.15) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
      <div style={{
        position: 'absolute',
        bottom: -60,
        left: -60,
        width: 180,
        height: 180,
        background: 'radial-gradient(circle, rgba(250, 219, 20, 0.08) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
      
      <div style={{ 
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 24,
        position: 'relative',
        zIndex: 1
      }}>
        {/* 左侧内容 */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <Space align="start" size={16}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${PRIMARY_BLUE} 0%, #096dd9 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(24, 144, 255, 0.4)'
            }}>
              <CrownOutlined style={{ fontSize: 28, color: '#fff' }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, marginBottom: 4, color: ACCENT_GOLD }}>
                开启代理商模式，轻松躺赚
              </Title>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                邀请好友使用 GEO 系统，每笔订单您都能获得 30% 佣金，T+1 自动到账微信零钱
              </Text>
            </div>
          </Space>

          {/* 权益亮点 */}
          <Row gutter={[24, 12]} style={{ marginTop: 20 }}>
            <Col xs={12} sm={6}>
              <Space size={8}>
                <GiftOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>客户首单8折</Text>
              </Space>
            </Col>
            <Col xs={12} sm={6}>
              <Space size={8}>
                <DollarOutlined style={{ color: ACCENT_GOLD, fontSize: 16 }} />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>永久30%分佣</Text>
              </Space>
            </Col>
            <Col xs={12} sm={6}>
              <Space size={8}>
                <WechatOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>T+1自动到账</Text>
              </Space>
            </Col>
            <Col xs={12} sm={6}>
              <Space size={8}>
                <TeamOutlined style={{ color: ACCENT_BLUE, fontSize: 16 }} />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>客户永久绑定</Text>
              </Space>
            </Col>
          </Row>
        </div>

        {/* 右侧按钮 */}
        <div>
          <Button
            type="primary"
            size="large"
            icon={<RocketOutlined />}
            onClick={handleGoToAgentCenter}
            style={{
              height: 48,
              paddingLeft: 28,
              paddingRight: 28,
              borderRadius: 8,
              background: PRIMARY_BLUE,
              border: 'none',
              boxShadow: '0 4px 16px rgba(24, 144, 255, 0.4)',
              fontWeight: 600
            }}
          >
            免费开通代理商
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default AgentDashboardPanel;
