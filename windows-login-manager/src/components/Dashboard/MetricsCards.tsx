import { Card, Row, Col, Statistic, Skeleton } from 'antd';
import {
  ThunderboltOutlined,
  FileTextOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
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
      <Row gutter={[24, 24]}>
        {[1, 2, 3, 4].map((i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card>
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

  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} sm={12} lg={6}>
        <Card
          hoverable
          onClick={() => onCardClick?.('distillations')}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Statistic
            title={<span style={{ color: '#fff', fontSize: 14 }}>关键词蒸馏</span>}
            value={data.distillations.total}
            prefix={<ThunderboltOutlined />}
            suffix={
              <span style={{ fontSize: 14, marginLeft: 8 }}>
                {distillationGrowth >= 0 ? (
                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                )}
                <span style={{ marginLeft: 4 }}>
                  {Math.abs(distillationGrowth).toFixed(1)}%
                </span>
              </span>
            }
            valueStyle={{ color: '#fff', fontSize: 28 }}
          />
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 }}>
            今日新增: {data.distillations.today}
          </div>
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card
          hoverable
          onClick={() => onCardClick?.('articles')}
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Statistic
            title={<span style={{ color: '#fff', fontSize: 14 }}>文章生成</span>}
            value={data.articles.total}
            prefix={<FileTextOutlined />}
            suffix={
              <span style={{ fontSize: 14, marginLeft: 8 }}>
                {articleGrowth >= 0 ? (
                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                )}
                <span style={{ marginLeft: 4 }}>
                  {Math.abs(articleGrowth).toFixed(1)}%
                </span>
              </span>
            }
            valueStyle={{ color: '#fff', fontSize: 28 }}
          />
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 }}>
            今日新增: {data.articles.today}
          </div>
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card
          hoverable
          onClick={() => onCardClick?.('tasks')}
          style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Statistic
            title={<span style={{ color: '#fff', fontSize: 14 }}>发布任务</span>}
            value={data.publishingTasks.total}
            prefix={<RocketOutlined />}
            suffix={
              <span style={{ fontSize: 14, marginLeft: 8 }}>
                {taskGrowth >= 0 ? (
                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                )}
                <span style={{ marginLeft: 4 }}>
                  {Math.abs(taskGrowth).toFixed(1)}%
                </span>
              </span>
            }
            valueStyle={{ color: '#fff', fontSize: 28 }}
          />
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 }}>
            今日新增: {data.publishingTasks.today}
          </div>
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card
          hoverable
          onClick={() => onCardClick?.('success')}
          style={{
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Statistic
            title={<span style={{ color: '#fff', fontSize: 14 }}>发布成功率</span>}
            value={data.publishingSuccessRate.rate.toFixed(1)}
            prefix={<CheckCircleOutlined />}
            suffix={
              <span style={{ fontSize: 14, marginLeft: 8 }}>
                %
                {successRateChange >= 0 ? (
                  <ArrowUpOutlined style={{ color: '#52c41a', marginLeft: 4 }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />
                )}
                <span style={{ marginLeft: 4 }}>
                  {Math.abs(successRateChange).toFixed(1)}%
                </span>
              </span>
            }
            valueStyle={{ color: '#fff', fontSize: 28 }}
          />
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 }}>
            成功: {data.publishingSuccessRate.success} / {data.publishingSuccessRate.total}
          </div>
        </Card>
      </Col>
    </Row>
  );
}
