/**
 * 发布趋势图表
 * 展示发布成功率和发布量的趋势变化
 */

import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors } from './chartStyles';

interface PublishingTrendChartProps {
  data: {
    dates: string[];
    successCounts: number[];
    failedCounts: number[];
    successRates: number[];
  } | null;
  loading: boolean;
}

export default function PublishingTrendChart({ data, loading }: PublishingTrendChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>发布趋势分析</span>}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.dates.length === 0) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>发布趋势分析</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: { color: '#262626' }
    },
    legend: {
      data: ['成功', '失败', '成功率'],
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
      data: data.dates,
      axisLabel: {
        formatter: (value: string) => {
          const date = new Date(value);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        },
        color: '#8c8c8c'
      },
      axisLine: { lineStyle: { color: '#e8e8e8' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        nameTextStyle: { color: '#8c8c8c' },
        axisLabel: { color: '#8c8c8c' },
        splitLine: { lineStyle: { color: '#f0f0f0' } }
      },
      {
        type: 'value',
        name: '成功率',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%', color: '#8c8c8c' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '成功',
        type: 'bar',
        stack: 'total',
        data: data.successCounts,
        itemStyle: { color: colors.success, borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 30
      },
      {
        name: '失败',
        type: 'bar',
        stack: 'total',
        data: data.failedCounts,
        itemStyle: { color: colors.error, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 30
      },
      {
        name: '成功率',
        type: 'line',
        yAxisIndex: 1,
        data: data.successRates,
        smooth: true,
        itemStyle: { color: colors.primary },
        lineStyle: { width: 3 },
        symbolSize: 6
      }
    ]
  };

  return (
    <Card 
      title={<span style={cardTitleStyle}>发布趋势分析</span>}
      style={cardStyle}
    >
      <ReactECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
