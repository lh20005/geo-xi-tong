/**
 * 本周与上周对比图表
 * 展示关键指标的周环比变化
 */

import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors } from './chartStyles';

interface WeeklyComparisonChartProps {
  data: {
    thisWeek: {
      distillations: number;
      articles: number;
      publishes: number;
      successRate: number;
    };
    lastWeek: {
      distillations: number;
      articles: number;
      publishes: number;
      successRate: number;
    };
  } | null;
  loading: boolean;
}

export default function WeeklyComparisonChart({ data, loading }: WeeklyComparisonChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>周环比对比</span>}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>周环比对比</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const categories = ['关键词蒸馏', '文章生成', '发布任务', '成功率(%)'];
  const thisWeekData = [
    data.thisWeek.distillations,
    data.thisWeek.articles,
    data.thisWeek.publishes,
    data.thisWeek.successRate
  ];
  const lastWeekData = [
    data.lastWeek.distillations,
    data.lastWeek.articles,
    data.lastWeek.publishes,
    data.lastWeek.successRate
  ];

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: { color: '#262626' }
    },
    legend: {
      data: ['本周', '上周'],
      top: 10,
      textStyle: { fontSize: 13 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '18%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: '#595959', fontSize: 12 },
      axisLine: { lineStyle: { color: '#e8e8e8' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8c8c8c' },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [
      {
        name: '本周',
        type: 'bar',
        data: thisWeekData,
        itemStyle: {
          color: colors.primary,
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 35
      },
      {
        name: '上周',
        type: 'bar',
        data: lastWeekData,
        itemStyle: {
          color: '#bfbfbf',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 35
      }
    ]
  };

  // 计算增长率
  const calcGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const rate = ((current - previous) / previous * 100).toFixed(0);
    return Number(rate) >= 0 ? `+${rate}%` : `${rate}%`;
  };

  return (
    <Card 
      title={<span style={cardTitleStyle}>周环比对比</span>}
      style={cardStyle}
      extra={
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          蒸馏 <span style={{ color: Number(calcGrowth(data.thisWeek.distillations, data.lastWeek.distillations).replace('%','')) >= 0 ? colors.success : colors.error, fontWeight: 500 }}>
            {calcGrowth(data.thisWeek.distillations, data.lastWeek.distillations)}
          </span>
          {' | '}
          文章 <span style={{ color: Number(calcGrowth(data.thisWeek.articles, data.lastWeek.articles).replace('%','')) >= 0 ? colors.success : colors.error, fontWeight: 500 }}>
            {calcGrowth(data.thisWeek.articles, data.lastWeek.articles)}
          </span>
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: '300px' }} />
    </Card>
  );
}
