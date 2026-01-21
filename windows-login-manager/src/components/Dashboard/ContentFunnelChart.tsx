/**
 * 内容转化漏斗图
 * 展示近一周的内容转化流程（累计数据，不随删除减少）
 * 使用倒三角形设计，从上到下递减
 */

import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin, Tag } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { cardStyle, cardTitleStyle } from './chartStyles';

interface ContentFunnelChartProps {
  data: {
    topics: number;
    articles: number;
    successfulPublishes: number;
  } | null;
  loading: boolean;
}

// 卡片标题组件，包含"近一周"标签
const CardTitle = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
    <span style={cardTitleStyle}>内容转化漏斗</span>
    <Tag icon={<CalendarOutlined />} color="blue" style={{ marginRight: 0 }}>近一周</Tag>
  </div>
);

export default function ContentFunnelChart({ data, loading }: ContentFunnelChartProps) {
  if (loading) {
    return (
      <Card 
        title={<CardTitle />}
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
        title={<CardTitle />}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  // 漏斗层级数据（固定顺序：话题 → 文章 → 发布）
  // 使用固定的漏斗比例，确保即使没有数据也保持漏斗形状
  const hasData = data.topics > 0 || data.articles > 0 || data.successfulPublishes > 0;
  
  // 漏斗形状的固定比例值（用于显示形状）
  const shapeValues = [100, 70, 40];
  
  // 如果有数据，使用实际值；否则使用固定比例保持漏斗形状
  const funnelLayers = [
    { 
      name: '生成话题', 
      value: hasData ? (data.topics || 0.1) : shapeValues[0], 
      displayValue: data.topics 
    },
    { 
      name: '生成文章', 
      value: hasData ? (data.articles || 0.1) : shapeValues[1], 
      displayValue: data.articles 
    },
    { 
      name: '发布成功', 
      value: hasData ? (data.successfulPublishes || 0.1) : shapeValues[2], 
      displayValue: data.successfulPublishes 
    }
  ];

  // 计算最大值用于漏斗比例
  const maxValue = hasData 
    ? Math.max(data.topics || 1, data.articles || 1, data.successfulPublishes || 1)
    : 100;

  // 颜色配置
  const funnelColors = [
    '#1890ff',  // 蓝色
    '#722ed1',  // 紫色
    '#52c41a'   // 绿色
  ];

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `<div style="font-size:13px">
          <strong>${params.name}</strong><br/>
          数量: <span style="color:${params.color};font-weight:600">${params.data.displayValue}</span>
        </div>`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#262626' }
    },
    series: [
      {
        name: '内容转化',
        type: 'funnel',
        left: '15%',
        top: 30,
        bottom: 30,
        width: '70%',
        min: 0,
        max: maxValue,
        minSize: '20%',
        maxSize: '100%',
        sort: 'none',  // 保持固定顺序：话题 → 文章 → 发布
        gap: 3,
        label: {
          show: true,
          position: 'inside',
          formatter: (params: any) => {
            // 根据漏斗宽度动态调整文字
            const name = params.name.length > 4 ? params.name.substring(0, 4) : params.name;
            return `${name}: ${params.data.displayValue}`;
          },
          fontSize: 11,
          color: '#fff',
          fontWeight: 500,
          textShadowColor: 'rgba(0,0,0,0.3)',
          textShadowBlur: 2
        },
        labelLine: { show: false },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(0,0,0,0.1)'
        },
        emphasis: {
          label: { 
            fontSize: 12, 
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 15,
            shadowColor: 'rgba(0,0,0,0.2)'
          }
        },
        data: funnelLayers.map((item, index) => ({
          value: item.value,
          name: item.name,
          displayValue: item.displayValue,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: funnelColors[index] },
                { offset: 1, color: funnelColors[index] + 'cc' }
              ]
            }
          }
        }))
      }
    ]
  };

  return (
    <Card 
      title={<CardTitle />}
      style={cardStyle}
    >
      <ReactECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
