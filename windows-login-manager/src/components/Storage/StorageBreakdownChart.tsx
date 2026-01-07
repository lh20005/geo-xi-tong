import React, { useEffect, useRef } from 'react';
import { Card } from 'antd';
import { PieChartOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';
import { StorageBreakdown, formatBytes } from '../../api/storage';

interface StorageBreakdownChartProps {
  breakdown: StorageBreakdown;
}

export const StorageBreakdownChart: React.FC<StorageBreakdownChartProps> = ({ breakdown }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const data = [
      {
        name: `图片 (${breakdown.images.count})`,
        value: breakdown.images.sizeBytes,
        itemStyle: { color: '#1890ff' }
      },
      {
        name: `文档 (${breakdown.documents.count})`,
        value: breakdown.documents.sizeBytes,
        itemStyle: { color: '#52c41a' }
      },
      {
        name: `文章 (${breakdown.articles.count})`,
        value: breakdown.articles.sizeBytes,
        itemStyle: { color: '#faad14' }
      }
    ].filter(item => item.value > 0);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `${params.name}<br/>大小: ${formatBytes(params.value)}<br/>占比: ${params.percent.toFixed(1)}%`;
        }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle'
      },
      series: [
        {
          name: '存储分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: (params: any) => `${params.percent.toFixed(1)}%`
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: { show: true },
          data: data
        }
      ]
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [breakdown]);

  useEffect(() => {
    return () => { chartInstance.current?.dispose(); };
  }, []);

  const totalSize = breakdown.images.sizeBytes + breakdown.documents.sizeBytes + breakdown.articles.sizeBytes;

  return (
    <Card title={<><PieChartOutlined /> 存储分布</>}>
      {/* 详细信息 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: '#e6f7ff', borderRadius: 4, marginBottom: 8 }}>
          <span style={{ color: '#1890ff' }}>📷 图片</span>
          <span style={{ fontWeight: 600 }}>{formatBytes(breakdown.images.sizeBytes)} ({breakdown.images.count} 个)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: '#f6ffed', borderRadius: 4, marginBottom: 8 }}>
          <span style={{ color: '#52c41a' }}>📄 文档</span>
          <span style={{ fontWeight: 600 }}>{formatBytes(breakdown.documents.sizeBytes)} ({breakdown.documents.count} 个)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: '#fffbe6', borderRadius: 4 }}>
          <span style={{ color: '#faad14' }}>📝 文章</span>
          <span style={{ fontWeight: 600 }}>{formatBytes(breakdown.articles.sizeBytes)} ({breakdown.articles.count} 个)</span>
        </div>
      </div>
      
      {/* 饼图 - 仅在有数据时显示 */}
      {totalSize > 0 && (
        <div ref={chartRef} style={{ width: '100%', height: '200px', marginTop: 16 }} />
      )}
    </Card>
  );
};
