import SafeECharts from '../SafeECharts';
import { Card, Empty, Spin } from 'antd';
import type { PlatformDistributionData } from '../../types/dashboard';
import { cardStyle, cardTitleStyle, colors, axisStyle } from './chartStyles';

interface PlatformDistributionChartProps {
  data: PlatformDistributionData | null;
  loading: boolean;
}

export default function PlatformDistributionChart({ data, loading }: PlatformDistributionChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>发布平台分布</span>}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>发布平台分布</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const platforms = data.data.map(item => item.platformName);
  const counts = data.data.map(item => item.publishCount);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#262626'
      }
    },
    grid: {
      left: '3%',
      right: '12%',
      bottom: '8%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '发布数量',
      nameLocation: 'end',
      nameGap: 5,
      ...axisStyle,
      nameTextStyle: {
        color: '#8c8c8c',
        fontSize: 12,
        padding: [0, 0, 0, 0]
      }
    },
    yAxis: {
      type: 'category',
      data: platforms,
      axisLabel: {
        interval: 0,
        color: '#595959',
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8'
        }
      }
    },
    series: [
      {
        name: '发布数量',
        type: 'bar',
        data: counts,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: colors.cyan },
              { offset: 1, color: '#36cfc9' }
            ]
          },
          borderRadius: [0, 6, 6, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c}',
          color: '#595959',
          fontSize: 12,
          fontWeight: 500
        },
        barMaxWidth: 30
      }
    ]
  };

  return (
    <Card 
      title={<span style={cardTitleStyle}>发布平台分布</span>}
      style={cardStyle}
    >
      <SafeECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
