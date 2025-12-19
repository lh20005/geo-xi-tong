import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';

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
      <Card title="24小时活动热力图">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.hours.length === 0) {
    return (
      <Card title="24小时活动热力图">
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
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.hours.map(h => h.toString().padStart(2, '0')),
      axisLabel: {
        interval: 2,
        formatter: '{value}:00'
      }
    },
    yAxis: {
      type: 'value',
      name: '活动次数'
    },
    series: [
      {
        name: '活动',
        type: 'bar',
        data: data.activities.map((value, index) => ({
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
                  color: value > maxActivity * 0.7 ? '#ff4d4f' :
                         value > maxActivity * 0.4 ? '#faad14' : '#52c41a'
                },
                { 
                  offset: 1, 
                  color: value > maxActivity * 0.7 ? '#ff7875' :
                         value > maxActivity * 0.4 ? '#ffc53d' : '#73d13d'
                }
              ]
            }
          }
        })),
        barWidth: '60%'
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
    <Card title="24小时活动热力图">
      <ReactECharts option={option} style={{ height: '300px' }} />
    </Card>
  );
}
