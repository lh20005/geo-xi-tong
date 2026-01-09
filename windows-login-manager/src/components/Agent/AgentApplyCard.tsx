/**
 * 代理商申请卡片组件
 */

import { useState } from 'react';
import { Card, Button, Space, Typography, List, message } from 'antd';
import { RocketOutlined, GiftOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
import { applyAgent, Agent } from '../../api/agent';

const { Title, Text, Paragraph } = Typography;

interface AgentApplyCardProps {
  onApplySuccess: (agent: Agent) => void;
}

const benefits = [
  {
    icon: <DollarOutlined style={{ color: '#52c41a', fontSize: 24 }} />,
    title: '30% 高额佣金',
    description: '邀请用户付费后，您将获得订单金额 30% 的佣金'
  },
  {
    icon: <TeamOutlined style={{ color: '#1890ff', fontSize: 24 }} />,
    title: '无限邀请',
    description: '邀请人数不设上限，邀请越多收益越多'
  },
  {
    icon: <GiftOutlined style={{ color: '#722ed1', fontSize: 24 }} />,
    title: '自动结算',
    description: '佣金 T+1 自动结算到您的微信零钱'
  }
];

export const AgentApplyCard: React.FC<AgentApplyCardProps> = ({ onApplySuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);
    try {
      const agent = await applyAgent();
      message.success('恭喜！您已成功成为代理商');
      onApplySuccess(agent);
    } catch (error: any) {
      message.error(error.response?.data?.message || '申请失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ 
          width: 80, 
          height: 80, 
          borderRadius: '50%', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <RocketOutlined style={{ fontSize: 36, color: 'white' }} />
        </div>
        
        <Title level={3} style={{ marginBottom: 8 }}>成为代理商</Title>
        <Paragraph type="secondary" style={{ marginBottom: 32 }}>
          邀请好友使用 GEO 系统，赚取丰厚佣金
        </Paragraph>

        <List
          itemLayout="horizontal"
          dataSource={benefits}
          style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto 32px' }}
          renderItem={item => (
            <List.Item style={{ border: 'none', padding: '12px 0' }}>
              <List.Item.Meta
                avatar={item.icon}
                title={<Text strong>{item.title}</Text>}
                description={item.description}
              />
            </List.Item>
          )}
        />

        <Space direction="vertical" size="small">
          <Button 
            type="primary" 
            size="large" 
            icon={<RocketOutlined />}
            loading={loading}
            onClick={handleApply}
            style={{ 
              minWidth: 200,
              height: 48,
              fontSize: 16,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none'
            }}
          >
            立即申请
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            申请即刻生效，无需审核
          </Text>
        </Space>
      </div>
    </Card>
  );
};

export default AgentApplyCard;
