import { Card, Row, Col, Skeleton, Progress } from 'antd';
import {
  ThunderboltOutlined,
  FileTextOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import type { MetricsData } from '../../types/dashboard';

interface MetricsCardsProps {
  data: MetricsData | null;
  loading: boolean;
  onCardClick?: (type: 'distillations' | 'articles' | 'tasks' | 'success') => void;
}

export default function MetricsCards({ data, loading, onCardClick }: MetricsCardsProps) {
  if (loading || !data) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map((i) => (
          <Col xs={24} sm={12} xl={6} key={i}>
            <Card style={{ borderRadius: 8 }}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  // 计算增长率
  const calculateGrowth = (today: number, yesterday: number) => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return ((today - yesterday) / yesterday) * 100;
  };

  const distillationGrowth = calculateGrowth(
    data.distillations.today,
    data.distillations.yesterday
  );

  const articleGrowth = calculateGrowth(
    data.articles.today,
    data.articles.yesterday
  );

  const taskGrowth = calculateGrowth(
    data.publishingTasks.today,
    data.publishingTasks.yesterday
  );

  const successRateChange = data.publishingSuccessRate.rate - data.publishingSuccessRate.previousRate;

  // 卡片配置
  const cards = [
    {
      key: 'distillations',
      title: '关键词蒸馏',
      value: data.distillations.total,
      today: data.distillations.today,
      growth: distillationGrowth,
      icon: <ThunderboltOutlined />,
      color: '#1890ff',
      bgColor: '#e6f7ff',
      borderColor: '#91d5ff'
    },
    {
      key: 'articles',
      title: '文章生成',
      value: data.articles.total,
      today: data.articles.today,
      growth: articleGrowth,
      icon: <FileTextOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      borderColor: '#d3adf7'
    },
    {
      key: 'tasks',
      title: '发布任务',
      value: data.publishingTasks.total,
      today: data.publishingTasks.today,
      growth: taskGrowth,
      icon: <RocketOutlined />,
      color: '#13c2c2',
      bgColor: '#e6fffb',
      borderColor: '#87e8de'
    },
    {
      key: 'success',
      title: '文章发布率',
      value: data.publishingSuccessRate.rate.toFixed(1),
      suffix: '%',
      today: `${data.publishingSuccessRate.success}/${data.publishingSuccessRate.total}`,
      growth: successRateChange,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      borderColor: '#b7eb8f',
      isRate: true
    }
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col xs={24} sm={12} xl={6} key={card.key}>
          <Card
            hoverable
            onClick={() => onCardClick?.(card.key as any)}
            style={{
              borderRadius: 8,
              border: `1px solid ${card.borderColor}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              height: '100%'
            }}
            bodyStyle={{ padding: '20px 24px' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            }}
          >
            {/* 顶部图标和标题 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ 
                  fontSize: 13, 
                  color: '#8c8c8c', 
                  marginBottom: 8,
                  fontWeight: 500
                }}>
                  {card.title}
                </div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 600, 
                  color: '#262626',
                  lineHeight: 1.2
                }}>
                  {card.value}
                  {card.suffix && <span style={{ fontSize: 20, marginLeft: 2 }}>{card.suffix}</span>}
                </div>
              </div>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: card.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: card.color
              }}>
                {card.icon}
              </div>
            </div>

            {/* 增长率指示器 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              paddingTop: 12,
              borderTop: '1px solid #f0f0f0'
            }}>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                {card.isRate ? (
                  <>已发布: <span style={{ color: '#262626', fontWeight: 500 }}>{card.today}</span></>
                ) : (
                  <>今日: <span style={{ color: '#262626', fontWeight: 500 }}>{card.today}</span></>
                )}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                fontSize: 13,
                fontWeight: 500,
                color: card.growth >= 0 ? '#52c41a' : '#ff4d4f'
              }}>
                {card.growth >= 0 ? (
                  <RiseOutlined style={{ marginRight: 4 }} />
                ) : (
                  <FallOutlined style={{ marginRight: 4 }} />
                )}
                {Math.abs(card.growth).toFixed(1)}%
              </div>
            </div>

            {/* 成功率进度条 */}
            {card.isRate && (
              <div style={{ marginTop: 12 }}>
                <Progress 
                  percent={parseFloat(card.value as string)} 
                  strokeColor={card.color}
                  showInfo={false}
                  size="small"
                />
              </div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );
}
