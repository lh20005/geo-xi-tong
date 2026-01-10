/**
 * 快速统计卡片组件
 * 展示系统核心数据的快速概览
 */

import React from 'react';
import { Card, Row, Col, Skeleton, Tooltip } from 'antd';
import {
  ThunderboltOutlined,
  FileTextOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined,
  BookOutlined,
  PictureOutlined
} from '@ant-design/icons';
import type { MetricsData, ResourceUsageData } from '../../types/dashboard';

interface QuickStatsCardsProps {
  metrics: MetricsData | null;
  resourceUsage: ResourceUsageData | null;
  loading: boolean;
  onCardClick?: (type: string) => void;
}

export const QuickStatsCards: React.FC<QuickStatsCardsProps> = ({
  metrics,
  resourceUsage,
  loading,
  onCardClick
}) => {
  if (loading || !metrics) {
    return (
      <Row gutter={[12, 12]}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Col xs={12} sm={8} lg={4} key={i}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  const calculateGrowth = (today: number, yesterday: number) => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return ((today - yesterday) / yesterday) * 100;
  };

  const cards = [
    {
      key: 'distillations',
      title: '蒸馏总数',
      value: metrics.distillations.total,
      today: metrics.distillations.today,
      growth: calculateGrowth(metrics.distillations.today, metrics.distillations.yesterday),
      icon: <ThunderboltOutlined />,
      color: '#1890ff',
      bgColor: '#e6f7ff'
    },
    {
      key: 'articles',
      title: '文章总数',
      value: metrics.articles.total,
      today: metrics.articles.today,
      growth: calculateGrowth(metrics.articles.today, metrics.articles.yesterday),
      icon: <FileTextOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff'
    },
    {
      key: 'tasks',
      title: '发布任务',
      value: metrics.publishingTasks.total,
      today: metrics.publishingTasks.today,
      growth: calculateGrowth(metrics.publishingTasks.today, metrics.publishingTasks.yesterday),
      icon: <RocketOutlined />,
      color: '#13c2c2',
      bgColor: '#e6fffb'
    },
    {
      key: 'successRate',
      title: '发布成功率',
      value: metrics.publishingSuccessRate?.rate || 0,
      suffix: '%',
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      isRate: true
    },
    {
      key: 'knowledge',
      title: '话题总数',
      value: resourceUsage?.topics?.total || 0,
      icon: <BookOutlined />,
      color: '#fa8c16',
      bgColor: '#fff7e6'
    },
    {
      key: 'images',
      title: '图库图片',
      value: resourceUsage?.images?.total || 0,
      icon: <PictureOutlined />,
      color: '#eb2f96',
      bgColor: '#fff0f6'
    }
  ];

  return (
    <Row gutter={[12, 12]}>
      {cards.map((card) => (
        <Col xs={12} sm={8} lg={4} key={card.key}>
          <Card
            size="small"
            hoverable
            onClick={() => onCardClick?.(card.key)}
            style={{ borderRadius: 8, cursor: 'pointer', transition: 'all 0.3s', height: '100%' }}
            bodyStyle={{ padding: '14px 16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6, whiteSpace: 'nowrap' }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, color: '#262626', lineHeight: 1.2 }}>
                  {card.isRate ? card.value.toFixed(1) : card.value.toLocaleString()}
                  {card.suffix && <span style={{ fontSize: 14, marginLeft: 2 }}>{card.suffix}</span>}
                </div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: card.bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: card.color, flexShrink: 0
              }}>
                {card.icon}
              </div>
            </div>
            
            {card.growth !== undefined && !card.isRate && (
              <div style={{ 
                marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: 11, color: '#8c8c8c' }}>今日 +{card.today}</span>
                <Tooltip title="较昨日">
                  <span style={{ 
                    fontSize: 11, color: card.growth >= 0 ? '#52c41a' : '#ff4d4f',
                    display: 'flex', alignItems: 'center'
                  }}>
                    {card.growth >= 0 ? <RiseOutlined /> : <FallOutlined />}
                    <span style={{ marginLeft: 2 }}>{Math.abs(card.growth).toFixed(0)}%</span>
                  </span>
                </Tooltip>
              </div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default QuickStatsCards;
