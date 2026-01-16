import SafeECharts from '../SafeECharts';
import { Card, Empty, Spin } from 'antd';
import type { TrendsData } from '../../types/dashboard';

interface TrendsChartProps {
  data: TrendsData | null;
  loading: boolean;
}

export default function TrendsChart({ data, loading }: TrendsChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={{ fontSize: 15, fontWeight: 600 }}>内容生产趋势</span>}
        style={{ 
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          height: '100%'
        }}
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
        title={<span style={{ fontSize: 15, fontWeight: 600 }}>内容生产趋势</span>}
        style={{ 
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          height: '100%'
        }}
      >
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
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#262626'
      }
    },
    legend: {
      data: ['文章生成', '关键词蒸馏'],
      top: 10,
      textStyle: {
        fontSize: 13
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
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
        },
        color: '#8c8c8c'
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '数量',
      nameTextStyle: {
        color: '#8c8c8c'
      },
      axisLabel: {
        color: '#8c8c8c'
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      }
    },
    series: [
      {
        name: '文章生成',
        type: 'line',
        smooth: true,
        data: articleCounts,
        itemStyle: {
          color: '#722ed1'
        },
        lineStyle: {
          width: 3
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(114, 46, 209, 0.25)' },
              { offset: 1, color: 'rgba(114, 46, 209, 0.05)' }
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
          color: '#1890ff'
        },
        lineStyle: {
          width: 3
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.25)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
            ]
          }
        }
      }
    ]
  };

  return (
    <Card 
      title={<span style={{ fontSize: 15, fontWeight: 600 }}>内容生产趋势</span>}
      style={{ 
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        height: '100%'
      }}
    >
      <SafeECharts option={option} style={{ height: '350px' }} />
    </Card>
  );
}
