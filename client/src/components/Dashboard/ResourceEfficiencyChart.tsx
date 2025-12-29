import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import type { ResourceUsageData } from '../../types/dashboard';
import { cardStyle, cardTitleStyle, colors, axisStyle } from './chartStyles';

interface ResourceEfficiencyChartProps {
  data: ResourceUsageData | null;
  loading: boolean;
}

export default function ResourceEfficiencyChart({ data, loading }: ResourceEfficiencyChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>资源使用效率</span>}
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
        title={<span style={cardTitleStyle}>资源使用效率</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const calculatePercentage = (used: number, total: number) => {
    return total > 0 ? ((used / total) * 100).toFixed(1) : '0';
  };

  const distillationPercent = calculatePercentage(data.distillations.used, data.distillations.total);
  const topicPercent = calculatePercentage(data.topics.used, data.topics.total);
  const imagePercent = calculatePercentage(data.images.used, data.images.total);

  const getColor = (percent: number) => {
    if (percent < 30) return colors.success;
    if (percent < 70) return colors.warning;
    return colors.error;
  };

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const item = params[0];
        const resourceData = [
          { used: data.distillations.used, total: data.distillations.total },
          { used: data.topics.used, total: data.topics.total },
          { used: data.images.used, total: data.images.total }
        ];
        const resource = resourceData[item.dataIndex];
        return `${item.name}<br/>使用率: ${item.value}%<br/>已用/总量: ${resource.used}/${resource.total}`;
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
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        formatter: '{value}%',
        color: '#8c8c8c'
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      }
    },
    yAxis: {
      type: 'category',
      data: ['蒸馏结果', '话题', '图片'],
      axisLabel: {
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
        name: '使用率',
        type: 'bar',
        data: [
          {
            value: parseFloat(distillationPercent),
            itemStyle: {
              color: getColor(parseFloat(distillationPercent)),
              borderRadius: [0, 6, 6, 0]
            }
          },
          {
            value: parseFloat(topicPercent),
            itemStyle: {
              color: getColor(parseFloat(topicPercent)),
              borderRadius: [0, 6, 6, 0]
            }
          },
          {
            value: parseFloat(imagePercent),
            itemStyle: {
              color: getColor(parseFloat(imagePercent)),
              borderRadius: [0, 6, 6, 0]
            }
          }
        ],
        label: {
          show: true,
          position: 'right',
          formatter: (params: any) => {
            const resourceData = [
              { used: data.distillations.used, total: data.distillations.total },
              { used: data.topics.used, total: data.topics.total },
              { used: data.images.used, total: data.images.total }
            ];
            const resource = resourceData[params.dataIndex];
            return `${params.value}% (${resource.used}/${resource.total})`;
          },
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
      title={<span style={cardTitleStyle}>资源使用效率</span>}
      style={cardStyle}
    >
      <ReactECharts option={option} style={{ height: '280px' }} />
    </Card>
  );
}
