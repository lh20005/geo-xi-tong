import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';

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
      <Card title="月度数据对比">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <Card title="月度数据对比">
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
      }
    },
    legend: {
      data: ['关键词蒸馏', '文章生成', '发布任务'],
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
      data: data.months,
      axisPointer: {
        type: 'shadow'
      }
    },
    yAxis: {
      type: 'value',
      name: '数量'
    },
    series: [
      {
        name: '关键词蒸馏',
        type: 'bar',
        data: data.distillations,
        itemStyle: {
          color: '#667eea'
        }
      },
      {
        name: '文章生成',
        type: 'bar',
        data: data.articles,
        itemStyle: {
          color: '#f5576c'
        }
      },
      {
        name: '发布任务',
        type: 'line',
        data: data.publishings,
        yAxisIndex: 0,
        itemStyle: {
          color: '#4facfe'
        },
        lineStyle: {
          width: 3
        },
        smooth: true
      }
    ]
  };

  return (
    <Card title="月度数据对比">
      <ReactECharts option={option} style={{ height: '350px' }} />
    </Card>
  );
}
