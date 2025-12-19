import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';

interface ArticleStatsChartProps {
  data: {
    total: number;
    published: number;
    unpublished: number;
    todayGenerated: number;
    monthGenerated: number;
  } | null;
  loading: boolean;
}

export default function ArticleStatsChart({ data, loading }: ArticleStatsChartProps) {
  if (loading) {
    return (
      <Card title="文章统计概览">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="文章统计概览">
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 篇 ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: 10,
      left: 'center'
    },
    series: [
      {
        name: '文章状态',
        type: 'pie',
        radius: ['30%', '50%'],
        center: ['50%', '45%'],
        data: [
          { 
            value: data.published, 
            name: '已发布',
            itemStyle: { color: '#52c41a' }
          },
          { 
            value: data.unpublished, 
            name: '未发布',
            itemStyle: { color: '#faad14' }
          }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          formatter: '{b}\n{c} 篇\n{d}%',
          fontSize: 12
        }
      }
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: `总计\n${data.total}`,
          textAlign: 'center',
          fill: '#333',
          fontSize: 20,
          fontWeight: 'bold'
        }
      }
    ]
  };

  return (
    <Card 
      title="文章统计概览"
      extra={
        <div style={{ fontSize: 12, color: '#999' }}>
          今日: {data.todayGenerated} | 本月: {data.monthGenerated}
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: '300px' }} />
    </Card>
  );
}
