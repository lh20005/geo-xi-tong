import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import type { ResourceUsageData } from '../../types/dashboard';

interface ResourceEfficiencyChartProps {
  data: ResourceUsageData | null;
  loading: boolean;
}

export default function ResourceEfficiencyChart({ data, loading }: ResourceEfficiencyChartProps) {
  if (loading) {
    return (
      <Card title="资源使用效率">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="资源使用效率">
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

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const item = params[0];
        return `${item.name}<br/>使用率: ${item.value}%`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        formatter: '{value}%'
      }
    },
    yAxis: {
      type: 'category',
      data: ['蒸馏结果', '话题', '图片']
    },
    series: [
      {
        name: '使用率',
        type: 'bar',
        data: [
          {
            value: parseFloat(distillationPercent),
            itemStyle: {
              color: parseFloat(distillationPercent) < 30 ? '#52c41a' :
                     parseFloat(distillationPercent) < 70 ? '#faad14' : '#ff4d4f'
            }
          },
          {
            value: parseFloat(topicPercent),
            itemStyle: {
              color: parseFloat(topicPercent) < 30 ? '#52c41a' :
                     parseFloat(topicPercent) < 70 ? '#faad14' : '#ff4d4f'
            }
          },
          {
            value: parseFloat(imagePercent),
            itemStyle: {
              color: parseFloat(imagePercent) < 30 ? '#52c41a' :
                     parseFloat(imagePercent) < 70 ? '#faad14' : '#ff4d4f'
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
          }
        },
        barWidth: 30
      }
    ]
  };

  return (
    <Card title="资源使用效率">
      <ReactECharts option={option} style={{ height: '250px' }} />
    </Card>
  );
}
