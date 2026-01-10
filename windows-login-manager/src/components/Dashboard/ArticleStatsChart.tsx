import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors } from './chartStyles';

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
      <Card 
        title={<span style={cardTitleStyle}>文章统计概览</span>}
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
        title={<span style={cardTitleStyle}>文章统计概览</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 篇 ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#262626'
      }
    },
    legend: {
      orient: 'horizontal',
      bottom: 10,
      left: 'center',
      textStyle: {
        fontSize: 13
      }
    },
    series: [
      {
        name: '文章状态',
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        data: [
          { 
            value: data.published, 
            name: '已发布',
            itemStyle: { color: colors.success }
          },
          { 
            value: data.unpublished, 
            name: '未发布',
            itemStyle: { color: colors.warning }
          }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          },
          label: {
            show: false
          }
        },
        label: {
          show: false
        },
        labelLine: {
          show: false
        }
      }
    ],
    graphic: {
      type: 'text',
      left: 'center',
      top: '40%',
      style: {
        text: `总计\n${data.total}`,
        textAlign: 'center',
        fill: '#262626',
        fontSize: 22,
        fontWeight: 600,
        lineHeight: 28
      }
    }
  };

  return (
    <Card 
      title={<span style={cardTitleStyle}>文章统计概览</span>}
      style={cardStyle}
      extra={
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          今日: <span style={{ color: '#262626', fontWeight: 500 }}>{data.todayGenerated}</span> | 
          本月: <span style={{ color: '#262626', fontWeight: 500 }}>{data.monthGenerated}</span>
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: '320px' }} notMerge={true} />
    </Card>
  );
}
