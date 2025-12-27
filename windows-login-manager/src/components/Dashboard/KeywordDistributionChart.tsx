import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';

interface KeywordDistributionChartProps {
  data: {
    totalKeywords: number;
    totalDistillations: number;
    topKeywords: Array<{
      keyword: string;
      count: number;
      articleCount: number;
    }>;
  } | null;
  loading: boolean;
}

export default function KeywordDistributionChart({ data, loading }: KeywordDistributionChartProps) {
  if (loading) {
    return (
      <Card title="关键词分布">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.topKeywords.length === 0) {
    return (
      <Card title="关键词分布">
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const keywords = data.topKeywords.map(item => item.keyword);
  const distillationCounts = data.topKeywords.map(item => item.count);
  const articleCounts = data.topKeywords.map(item => item.articleCount);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['蒸馏次数', '文章数量'],
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
      data: keywords,
      axisLabel: {
        interval: 0,
        rotate: 30
      }
    },
    yAxis: {
      type: 'value',
      name: '数量'
    },
    series: [
      {
        name: '蒸馏次数',
        type: 'bar',
        data: distillationCounts,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' }
            ]
          }
        }
      },
      {
        name: '文章数量',
        type: 'bar',
        data: articleCounts,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#f093fb' },
              { offset: 1, color: '#f5576c' }
            ]
          }
        }
      }
    ]
  };

  return (
    <Card 
      title="关键词分布 TOP10"
      extra={
        <div style={{ fontSize: 12, color: '#999' }}>
          总关键词: {data.totalKeywords} | 总蒸馏: {data.totalDistillations}
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: '350px' }} />
    </Card>
  );
}
