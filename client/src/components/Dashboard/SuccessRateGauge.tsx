import ReactECharts from 'echarts-for-react';
import { Card, Spin } from 'antd';
import { cardStyle, cardTitleStyle, colors } from './chartStyles';

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
      <Card 
        title={<span style={cardTitleStyle}>成功率仪表盘</span>}
        style={cardStyle}
      >
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
          color: colors.success
        },
        progress: {
          show: true,
          width: 20
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#f0f0f0']]
          }
        },
        axisTick: {
          distance: -28,
          splitNumber: 5,
          lineStyle: {
            width: 1,
            color: '#d9d9d9'
          }
        },
        splitLine: {
          distance: -32,
          length: 16,
          lineStyle: {
            width: 2,
            color: '#d9d9d9'
          }
        },
        axisLabel: {
          distance: -18,
          color: '#8c8c8c',
          fontSize: 11
        },
        anchor: {
          show: false
        },
        title: {
          show: true,
          offsetCenter: [0, '85%'],
          fontSize: 14,
          color: '#595959',
          fontWeight: 500
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 32,
          borderRadius: 8,
          offsetCenter: [0, '10%'],
          fontSize: 26,
          fontWeight: 600,
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
          color: colors.primary
        },
        progress: {
          show: true,
          width: 20
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#f0f0f0']]
          }
        },
        axisTick: {
          distance: -28,
          splitNumber: 5,
          lineStyle: {
            width: 1,
            color: '#d9d9d9'
          }
        },
        splitLine: {
          distance: -32,
          length: 16,
          lineStyle: {
            width: 2,
            color: '#d9d9d9'
          }
        },
        axisLabel: {
          distance: -18,
          color: '#8c8c8c',
          fontSize: 11
        },
        anchor: {
          show: false
        },
        title: {
          show: true,
          offsetCenter: [0, '85%'],
          fontSize: 14,
          color: '#595959',
          fontWeight: 500
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 32,
          borderRadius: 8,
          offsetCenter: [0, '10%'],
          fontSize: 26,
          fontWeight: 600,
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
    <Card 
      title={<span style={cardTitleStyle}>成功率仪表盘</span>}
      style={cardStyle}
    >
      <ReactECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
