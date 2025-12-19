import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import type { TrendsData } from '../../types/dashboard';

interface TrendsChartProps {
  data: TrendsData | null;
  loading: boolean;
}

export default function TrendsChart({ data, loading }: TrendsChartProps) {
  if (loading) {
    return (
      <Card title="内容生产趋势">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card title="内容生产趋势">
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const dates = data.data.map(item => item.date);
  const articleCounts = data.data.map(item => item.articleCount);
  const distillationCounts = data.data.map(item => item.distillationCount);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['文章生成', '关键词蒸馏'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: {
        formatter: (value: string) => {
          const date = new Date(value);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '数量'
    },
    series: [
      {
        name: '文章生成',
        type: 'line',
        smooth: true,
        data: articleCounts,
        itemStyle: {
          color: '#f5576c'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 87, 108, 0.3)' },
              { offset: 1, color: 'rgba(245, 87, 108, 0.05)' }
            ]
          }
        }
      },
      {
        name: '关键词蒸馏',
        type: 'line',
        smooth: true,
        data: distillationCounts,
        itemStyle: {
          color: '#667eea'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
            ]
          }
        }
      }
    ]
  };

  return (
    <Card title="内容生产趋势">
      <ReactECharts option={option} style={{ height: '350px' }} />
    </Card>
  );
}
