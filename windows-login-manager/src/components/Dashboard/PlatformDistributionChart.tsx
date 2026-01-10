import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import type { PlatformDistributionData } from '../../types/dashboard';

interface PlatformDistributionChartProps {
  data: PlatformDistributionData | null;
  loading: boolean;
}

export default function PlatformDistributionChart({ data, loading }: PlatformDistributionChartProps) {
  if (loading) {
    return (
      <Card title="发布平台分布">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card title="发布平台分布">
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
              { offset: 0, color: '#4facfe' },
              { offset: 1, color: '#00f2fe' }
            ]
          },
          borderRadius: [0, 5, 5, 0]
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
    <Card title="发布平台分布">
      <ReactECharts option={option} style={{ height: '300px' }} />
    </Card>
  );
}
