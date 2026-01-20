/**
 * 内容转化漏斗图
 * 展示从蒸馏到发布的完整转化流程
 * 使用倒三角形设计，从上到下递减
 */

import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';
import { cardStyle, cardTitleStyle } from './chartStyles';

interface ContentFunnelChartProps {
  data: {
    distillations: number;
    topics: number;
    articles: number;
    publishedArticles: number;
    successfulPublishes: number;
  } | null;
  loading: boolean;
}

export default function ContentFunnelChart({ data, loading }: ContentFunnelChartProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>内容转化漏斗</span>}
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
        title={<span style={cardTitleStyle}>内容转化漏斗</span>}
        style={cardStyle}
      >
        <Empty description="暂无数据" />
      </Card>
    );
  }

  // 漏斗数据：从大到小排列，确保倒三角形效果
  // 使用固定的递减比例来保证视觉效果
  const maxValue = Math.max(
    data.topics || 1,
    data.articles || 1,
    data.successfulPublishes || 1,
    data.distillations || 1,
    data.publishedArticles || 1
  );

  // 漏斗层级数据（从上到下）
  const funnelLayers = [
    { name: '生成话题', value: data.topics, displayValue: data.topics },
    { name: '生成文章', value: data.articles, displayValue: data.articles },
    { name: '发布成功', value: data.successfulPublishes, displayValue: data.successfulPublishes },
    { name: '关键词蒸馏', value: data.distillations, displayValue: data.distillations },
    { name: '已发布文章', value: data.publishedArticles, displayValue: data.publishedArticles }
  ];

  // 按值从大到小排序，确保漏斗形状正确
  funnelLayers.sort((a, b) => b.value - a.value);

  // 颜色配置
  const funnelColors = [
    '#1890ff',  // 蓝色
    '#722ed1',  // 紫色
    '#52c41a',  // 绿色
    '#13c2c2',  // 青色
    '#40a9ff'   // 浅蓝色
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
        max: maxValue || 100,
        minSize: '15%',
        maxSize: '100%',
        sort: 'descending',
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
      title={<span style={cardTitleStyle}>内容转化漏斗</span>}
      style={cardStyle}
    >
      <ReactECharts option={option} style={{ height: '320px' }} />
    </Card>
  );
}
