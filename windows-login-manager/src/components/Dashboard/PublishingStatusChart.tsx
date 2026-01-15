import SafeECharts from '../SafeECharts';
import { Card, Empty, Spin } from 'antd';
import type { PublishingStatusData } from '../../types/dashboard';
import { cardStyle, cardTitleStyle, colors } from './chartStyles';

interface PublishingStatusChartProps {
  data: PublishingStatusData | null;
  loading: boolean;
}

export default function PublishingStatusChart({ data, loading }: PublishingStatusChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>发布任务状态分布</span>}
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
        title={<span style={cardTitleStyle}>发布任务状态分布</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const statusMap: Record<string, string> = {
    pending: '待发布',
    running: '进行中',
    success: '已完成',
    failed: '失败',
    cancelled: '已取消',
    timeout: '超时'
  };

  const colorMap: Record<string, string> = {
    pending: colors.warning,
    running: colors.primary,
    success: colors.success,
    failed: colors.error,
    cancelled: '#8c8c8c',
    timeout: '#ff7a45'
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
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#262626'
      }
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: {
        fontSize: 13
      }
    },
    series: [
      {
        name: '发布状态',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
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
            fontSize: 22,
            fontWeight: 600,
            color: '#262626'
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
    <Card 
      title={<span style={cardTitleStyle}>发布任务状态分布</span>}
      style={cardStyle}
    >
      <SafeECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
