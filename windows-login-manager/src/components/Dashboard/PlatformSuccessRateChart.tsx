/**
 * 各平台发布成功率图表
 * 展示不同平台的发布成功率对比
 */

import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors } from './chartStyles';

interface PlatformSuccessRateChartProps {
  data: Array<{
    platformName: string;
    totalCount: number;
    successCount: number;
    successRate: number;
  }> | null;
  loading: boolean;
}

export default function PlatformSuccessRateChart({ data, loading }: PlatformSuccessRateChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>平台发布成功率</span>}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>平台发布成功率</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  // 按成功率排序
  const sortedData = [...data].sort((a, b) => b.successRate - a.successRate);
  const platforms = sortedData.map(item => item.platformName);
  const successRates = sortedData.map(item => item.successRate);

  const getBarColor = (rate: number) => {
    if (rate >= 80) return colors.success;
    if (rate >= 60) return colors.warning;
    return colors.error;
  };

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0];
        const platformData = sortedData[item.dataIndex];
        return `${item.name}<br/>成功率: ${item.value}%<br/>成功/总数: ${platformData.successCount}/${platformData.totalCount}`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: { color: '#262626' }
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '3%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: '#8c8c8c' },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    yAxis: {
      type: 'category',
      data: platforms,
      axisLabel: { color: '#595959', fontSize: 12 },
      axisLine: { lineStyle: { color: '#e8e8e8' } }
    },
    series: [
      {
        name: '成功率',
        type: 'bar',
        data: successRates.map(rate => ({
          value: rate,
          itemStyle: {
            color: getBarColor(rate),
            borderRadius: [0, 6, 6, 0]
          }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          color: '#595959',
          fontSize: 12,
          fontWeight: 500
        },
        barMaxWidth: 24
      }
    ]
  };

  // 计算平均成功率
  const avgRate = (data.reduce((sum, item) => sum + item.successRate, 0) / data.length).toFixed(1);

  return (
    <Card 
      title={<span style={cardTitleStyle}>平台发布成功率</span>}
      style={cardStyle}
      extra={
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          平均成功率: <span style={{ color: Number(avgRate) >= 80 ? colors.success : colors.warning, fontWeight: 600 }}>{avgRate}%</span>
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
