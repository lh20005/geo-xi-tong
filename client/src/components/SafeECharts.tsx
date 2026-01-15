import React, { useRef, useEffect, memo } from 'react';
import ReactECharts, { EChartsReactProps } from 'echarts-for-react';

/**
 * 安全的 ECharts 包装组件
 * 解决 echarts-for-react 在 React 18 严格模式下卸载时的 disconnect 错误
 */
const SafeECharts = memo((props: EChartsReactProps) => {
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    return () => {
      // 安全清理：在组件卸载前手动 dispose
      if (chartRef.current) {
        try {
          const instance = chartRef.current.getEchartsInstance();
          if (instance && !instance.isDisposed()) {
            instance.dispose();
          }
        } catch {
          // 忽略清理时的错误
        }
      }
    };
  }, []);

  return <ReactECharts ref={chartRef} {...props} />;
});

SafeECharts.displayName = 'SafeECharts';

export default SafeECharts;
