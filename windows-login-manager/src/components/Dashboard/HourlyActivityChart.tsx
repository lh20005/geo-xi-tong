import SafeECharts from '../SafeECharts';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors, axisStyle } from './chartStyles';

interface HourlyActivityChartProps {
  data: {
    hours: number[];
    activities: number[];
  } | null;
  loading: boolean;
}

export default function HourlyActivityChart({ data, loading }: HourlyActivityChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>24小时活动热力图</span>}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.hours.length === 0) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>24小时活动热力图</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const maxActivity = Math.max(...data.activities);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const hour = params[0].name;
        const count = params[0].value;
        return `${hour}:00 - ${hour}:59<br/>活动次数: ${count}`;
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
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.hours.map(h => h.toString().padStart(2, '0')),
      axisLabel: {
        interval: 2,
        formatter: '{value}:00',
        color: '#8c8c8c',
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
      name: '活动次数',
      ...axisStyle
    },
    series: [
      {
        name: '活动',
        type: 'bar',
        data: data.activities.map((value) => ({
          value,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { 
                  offset: 0, 
                  color: value > maxActivity * 0.7 ? colors.error :
                         value > maxActivity * 0.4 ? colors.warning : colors.success
                },
                { 
                  offset: 1, 
                  color: value > maxActivity * 0.7 ? '#ff7875' :
                         value > maxActivity * 0.4 ? '#ffc53d' : '#95de64'
                }
              ]
            },
            borderRadius: [4, 4, 0, 0]
          }
        })),
        barMaxWidth: 30
      }
    ],
    visualMap: {
      show: false,
      min: 0,
      max: maxActivity,
      inRange: {
        colorLightness: [0.2, 0.8]
      }
    }
  };

  return (
    <Card 
      title={<span style={cardTitleStyle}>24小时活动热力图</span>}
      style={cardStyle}
    >
      <SafeECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
