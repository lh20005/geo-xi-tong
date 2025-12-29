import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors, axisStyle } from './chartStyles';

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
      <Card 
        title={<span style={cardTitleStyle}>关键词分布 TOP10</span>}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.topKeywords.length === 0) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>关键词分布 TOP10</span>}
        style={cardStyle}
      >
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
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#262626'
      }
    },
    legend: {
      data: ['蒸馏次数', '文章数量'],
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
      data: keywords,
      axisLabel: {
        interval: 0,
        rotate: 30,
        color: '#595959',
        fontSize: 12
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
      ...axisStyle
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
              { offset: 0, color: colors.primary },
              { offset: 1, color: '#40a9ff' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
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
              { offset: 0, color: colors.purple },
              { offset: 1, color: '#9254de' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      }
    ]
  };

  return (
    <Card 
      title={<span style={cardTitleStyle}>关键词分布 TOP10</span>}
      style={cardStyle}
      extra={
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          总关键词: <span style={{ color: '#262626', fontWeight: 500 }}>{data.totalKeywords}</span> | 
          总蒸馏: <span style={{ color: '#262626', fontWeight: 500 }}>{data.totalDistillations}</span>
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: '350px' }} />
    </Card>
  );
}
