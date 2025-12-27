import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import type { PublishingStatusData } from '../../types/dashboard';

interface PublishingStatusChartProps {
  data: PublishingStatusData | null;
  loading: boolean;
}

export default function PublishingStatusChart({ data, loading }: PublishingStatusChartProps) {
  if (loading) {
    return (
      <Card title="发布任务状态分布">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card title="发布任务状态分布">
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const statusMap: Record<string, string> = {
    pending: '待发布',
    running: '进行中',
    completed: '已完成',
    failed: '失败'
  };

  const colorMap: Record<string, string> = {
    pending: '#faad14',
    running: '#1890ff',
    completed: '#52c41a',
    failed: '#ff4d4f'
  };

  const chartData = data.data.map(item => ({
    name: statusMap[item.status] || item.status,
    value: item.count,
    itemStyle: {
      color: colorMap[item.status] || '#999'
    }
  }));

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [
      {
        name: '发布状态',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: chartData
      }
    ]
  };

  return (
    <Card title="发布任务状态分布">
      <ReactECharts option={option} style={{ height: '300px' }} />
    </Card>
  );
}
