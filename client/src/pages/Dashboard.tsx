import { Card, Row, Col, Statistic, Button, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ThunderboltOutlined,
  FileTextOutlined,
  RocketOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2}>欢迎使用 GEO 优化系统</Title>
        <Paragraph style={{ fontSize: 16, color: '#64748b' }}>
          通过AI驱动的关键词蒸馏和内容生成，提升您的品牌在AI平台的推荐率
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
          >
            <Statistic
              title={<span style={{ color: '#fff' }}>关键词蒸馏</span>}
              value="AI驱动"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#fff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              border: 'none',
            }}
          >
            <Statistic
              title={<span style={{ color: '#fff' }}>话题分析</span>}
              value="智能化"
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#fff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
            }}
          >
            <Statistic
              title={<span style={{ color: '#fff' }}>文章生成</span>}
              value="高质量"
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#fff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              border: 'none',
            }}
          >
            <Statistic
              title={<span style={{ color: '#fff' }}>多模型支持</span>}
              value="灵活"
              prefix={<SettingOutlined />}
              valueStyle={{ color: '#fff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 32 }}>
        <Col xs={24} lg={12}>
          <Card
            title="快速开始"
            bordered={false}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4}>1. 配置 AI API</Title>
                <Paragraph>
                  首先配置 DeepSeek 或 Gemini 的 API 密钥，系统将使用AI模型进行关键词分析和内容生成。
                </Paragraph>
                <Button
                  type="primary"
                  icon={<SettingOutlined />}
                  onClick={() => navigate('/config')}
                >
                  前往配置
                </Button>
              </div>
              <div>
                <Title level={4}>2. 关键词蒸馏</Title>
                <Paragraph>
                  输入目标关键词，AI将分析并生成真实用户可能提出的相关问题，帮助您了解用户搜索意图。
                </Paragraph>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={() => navigate('/distillation')}
                >
                  开始蒸馏
                </Button>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="系统特点"
            bordered={false}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Title level={5}>🎯 精准的关键词分析</Title>
                <Paragraph>
                  基于真实用户搜索行为，生成高质量的话题问题，提升内容的针对性。
                </Paragraph>
              </div>
              <div>
                <Title level={5}>✨ 智能内容生成</Title>
                <Paragraph>
                  结合关键词和话题，自动生成符合SEO标准的高质量文章内容。
                </Paragraph>
              </div>
              <div>
                <Title level={5}>🔧 灵活的模型选择</Title>
                <Paragraph>
                  支持 DeepSeek 和 Gemini 两种AI模型，可根据需求灵活切换。
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
