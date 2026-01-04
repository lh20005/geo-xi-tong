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

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // 准备数据
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
    ].filter(item => item.value > 0); // 只显示有数据的项

    // 配置图表
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
            formatter: (params: any) => {
              return `${params.percent.toFixed(1)}%`;
            }
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: true
          },
          data: data
        }
      ]
    };

    chartInstance.current.setOption(option);

    // 响应式调整
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [breakdown]);

  // 清理
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  const totalSize = breakdown.images.sizeBytes + breakdown.documents.sizeBytes + breakdown.articles.sizeBytes;

  if (totalSize === 0) {
    return (
      <Card title={<><PieChartOutlined /> 存储分布</>}>
        <div className="text-center text-gray-400 py-8">
          暂无存储数据
        </div>
      </Card>
    );
  }

  return (
    <Card title={<><PieChartOutlined /> 存储分布</>}>
      <div ref={chartRef} style={{ width: '100%', height: '300px' }} />
      
      {/* 详细信息 */}
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
          <span className="text-blue-600">📷 图片</span>
          <span className="font-semibold">{formatBytes(breakdown.images.sizeBytes)} ({breakdown.images.count} 个)</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
          <span className="text-green-600">📄 文档</span>
          <span className="font-semibold">{formatBytes(breakdown.documents.sizeBytes)} ({breakdown.documents.count} 个)</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
          <span className="text-yellow-600">📝 文章</span>
          <span className="font-semibold">{formatBytes(breakdown.articles.sizeBytes)} ({breakdown.articles.count} 个)</span>
        </div>
      </div>
    </Card>
  );
};
