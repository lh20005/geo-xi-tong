import ReactECharts from 'echarts-for-react';
import { Card, Spin } from 'antd';

interface SuccessRateGaugeProps {
  data: {
    publishingSuccessRate: number;
    generationSuccessRate: number;
  } | null;
  loading: boolean;
}

export default function SuccessRateGauge({ data, loading }: SuccessRateGaugeProps) {
  if (loading) {
    return (
      <Card title="成功率仪表盘">
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  const publishingRate = data?.publishingSuccessRate || 0;
  const generationRate = data?.generationSuccessRate || 0;

  const option = {
    series: [
      {
        type: 'gauge',
        center: ['25%', '55%'],
        radius: '80%',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: {
          color: '#52c41a'
        },
        progress: {
          show: true,
          width: 18
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 18
          }
        },
        axisTick: {
          distance: -25,
          splitNumber: 5,
          lineStyle: {
            width: 1,
            color: '#999'
          }
        },
        splitLine: {
          distance: -30,
          length: 14,
          lineStyle: {
            width: 2,
            color: '#999'
          }
        },
        axisLabel: {
          distance: -15,
          color: '#999',
          fontSize: 10
        },
        anchor: {
          show: false
        },
        title: {
          show: true,
          offsetCenter: [0, '80%'],
          fontSize: 14,
          color: '#666'
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 30,
          borderRadius: 8,
          offsetCenter: [0, '10%'],
          fontSize: 24,
          fontWeight: 'bolder',
          formatter: '{value}%',
          color: 'inherit'
        },
        data: [
          {
            value: publishingRate,
            name: '发布成功率'
          }
        ]
      },
      {
        type: 'gauge',
        center: ['75%', '55%'],
        radius: '80%',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: {
          color: '#1890ff'
        },
        progress: {
          show: true,
          width: 18
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 18
          }
        },
        axisTick: {
          distance: -25,
          splitNumber: 5,
          lineStyle: {
            width: 1,
            color: '#999'
          }
        },
        splitLine: {
          distance: -30,
          length: 14,
          lineStyle: {
            width: 2,
            color: '#999'
          }
        },
        axisLabel: {
          distance: -15,
          color: '#999',
          fontSize: 10
        },
        anchor: {
          show: false
        },
        title: {
          show: true,
          offsetCenter: [0, '80%'],
          fontSize: 14,
          color: '#666'
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 30,
          borderRadius: 8,
          offsetCenter: [0, '10%'],
          fontSize: 24,
          fontWeight: 'bolder',
          formatter: '{value}%',
          color: 'inherit'
        },
        data: [
          {
            value: generationRate,
            name: '生成成功率'
          }
        ]
      }
    ]
  };

  return (
    <Card title="成功率仪表盘">
      <ReactECharts option={option} style={{ height: '300px' }} />
    </Card>
  );
}
