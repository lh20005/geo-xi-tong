/**
 * 代理商仪表盘组件
 */

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tag, Space, Button, message } from 'antd';
import { 
  DollarOutlined, 
  TeamOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Agent, AgentStats, getAgentStats } from '../../api/agent';
import WechatBindCard from './WechatBindCard';

interface AgentDashboardProps {
  agent: Agent;
  onAgentUpdate: (agent: Agent) => void;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ agent, onAgentUpdate }) => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getAgentStats();
      setStats(data);
    } catch (error: any) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getStatusTag = () => {
    if (agent.status === 'active') {
      return <Tag color="success" icon={<CheckCircleOutlined />}>正常</Tag>;
    }
    return <Tag color="error">已暂停</Tag>;
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 状态和佣金比例 */}
      <Card size="small">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <span>代理商状态：</span>
              {getStatusTag()}
            </Space>
          </Col>
          <Col>
            <Space>
              <span>佣金比例：</span>
              <Tag color="blue" style={{ fontSize: 14 }}>
                {(agent.commissionRate * 100).toFixed(0)}%
              </Tag>
            </Space>
          </Col>
          <Col>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchStats}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 收益统计 */}
      <Card title="收益统计" loading={loading}>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="累计收益"
              value={stats?.totalEarnings || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="已结算"
              value={stats?.settledEarnings || 0}
              precision={2}
              prefix={<CheckCircleOutlined />}
              suffix="元"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="待结算"
              value={stats?.pendingEarnings || 0}
              precision={2}
              prefix={<ClockCircleOutlined />}
              suffix="元"
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 邀请统计 */}
      <Card title="邀请统计" loading={loading}>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="邀请用户数"
              value={stats?.totalInvites || 0}
              prefix={<TeamOutlined />}
              suffix="人"
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="付费用户数"
              value={stats?.paidInvites || 0}
              prefix={<CheckCircleOutlined />}
              suffix="人"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="佣金记录数"
              value={stats?.commissionCount || 0}
              prefix={<DollarOutlined />}
              suffix="笔"
            />
          </Col>
        </Row>
      </Card>

      {/* 微信绑定 */}
      <WechatBindCard agent={agent} onAgentUpdate={onAgentUpdate} />
    </Space>
  );
};

export default AgentDashboard;
