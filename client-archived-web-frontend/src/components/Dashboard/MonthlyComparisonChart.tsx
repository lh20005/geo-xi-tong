import SafeECharts from '../SafeECharts';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors, axisStyle } from './chartStyles';

interface MonthlyComparisonChartProps {
  data: {
    months: string[];
    distillations: number[];
    articles: number[];
    publishings: number[];
  } | null;
  loading: boolean;
}

export default function MonthlyComparisonChart({ data, loading }: MonthlyComparisonChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>月度数据对比</span>}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>月度数据对比</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#262626'
      }
    },
    legend: {
      data: ['关键词蒸馏', '文章生成', '发布任务'],
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
      data: data.months,
      axisPointer: {
        type: 'shadow'
      },
      ...axisStyle
    },
    yAxis: {
      type: 'value',
      name: '数量',
      ...axisStyle
    },
    series: [
      {
        name: '关键词蒸馏',
        type: 'bar',
        data: data.distillations,
        itemStyle: {
          color: colors.primary,
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      },
      {
        name: '文章生成',
        type: 'bar',
        data: data.articles,
        itemStyle: {
          color: colors.purple,
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      },
      {
        name: '发布任务',
        type: 'line',
        data: data.publishings,
        yAxisIndex: 0,
        itemStyle: {
          color: colors.cyan
        },
        lineStyle: {
          width: 3
        },
        smooth: true,
        symbolSize: 8
      }
    ]
  };

  return (
    <Card 
      title={<span style={cardTitleStyle}>月度数据对比</span>}
      style={cardStyle}
    >
      <SafeECharts option={option} style={{ height: '350px' }} />
    </Card>
  );
}
