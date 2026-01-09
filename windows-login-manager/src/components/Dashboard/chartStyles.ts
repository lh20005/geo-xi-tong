// 统一的图表卡片样式
export const cardStyle = {
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  height: '100%'
};

// 统一的卡片标题样式
export const cardTitleStyle = {
  fontSize: 15,
  fontWeight: 600
};

// 统一的ECharts配置
export const commonChartOptions = {
  tooltip: {
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
    top: '15%',
    containLabel: true
  },
  textStyle: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial'
  }
};

// 专业配色方案
export const colors = {
  primary: '#1890ff',
  secondary: '#722ed1',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#13c2c2',
  purple: '#722ed1',
  blue: '#1890ff',
  cyan: '#13c2c2',
  green: '#52c41a',
  orange: '#fa8c16',
  red: '#f5222d',
  volcano: '#fa541c',
  gold: '#faad14',
  lime: '#a0d911',
  geekblue: '#2f54eb',
  magenta: '#eb2f96'
};

// 渐变色配置
export const gradients = {
  blue: ['rgba(24, 144, 255, 0.25)', 'rgba(24, 144, 255, 0.05)'],
  purple: ['rgba(114, 46, 209, 0.25)', 'rgba(114, 46, 209, 0.05)'],
  cyan: ['rgba(19, 194, 194, 0.25)', 'rgba(19, 194, 194, 0.05)'],
  green: ['rgba(82, 196, 26, 0.25)', 'rgba(82, 196, 26, 0.05)'],
  orange: ['rgba(250, 140, 22, 0.25)', 'rgba(250, 140, 22, 0.05)']
};

// 坐标轴样式
export const axisStyle = {
  axisLabel: {
    color: '#8c8c8c',
    fontSize: 12
  },
  axisLine: {
    lineStyle: {
      color: '#e8e8e8'
    }
  },
  splitLine: {
    lineStyle: {
      color: '#f0f0f0'
    }
  },
  nameTextStyle: {
    color: '#8c8c8c'
  }
};
