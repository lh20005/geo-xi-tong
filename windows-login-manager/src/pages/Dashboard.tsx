import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Typography, Button, Space, message, DatePicker, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import MetricsCards from '../components/Dashboard/MetricsCards';
import TrendsChart from '../components/Dashboard/TrendsChart';
import PublishingStatusChart from '../components/Dashboard/PublishingStatusChart';
import PlatformDistributionChart from '../components/Dashboard/PlatformDistributionChart';
import ResourceEfficiencyChart from '../components/Dashboard/ResourceEfficiencyChart';
import ArticleStatsChart from '../components/Dashboard/ArticleStatsChart';
import KeywordDistributionChart from '../components/Dashboard/KeywordDistributionChart';
import MonthlyComparisonChart from '../components/Dashboard/MonthlyComparisonChart';
import HourlyActivityChart from '../components/Dashboard/HourlyActivityChart';
import SuccessRateGauge from '../components/Dashboard/SuccessRateGauge';
import { ipcBridge } from '../services/ipc';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type TimeRange = {
  startDate: string;
  endDate: string;
  preset: '7d' | '30d' | '90d' | 'custom';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startDate: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    preset: '30d'
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    
    try {
      const res = await ipcBridge.getDashboardAllData({
        startDate: timeRange.startDate,
        endDate: timeRange.endDate
      });

      if (!res.success) throw new Error(res.error || '加载失败');
      
      setDashboardData(res.data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('加载Dashboard数据失败:', error);
      setLoading(false);
      message.error('加载数据失败');
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, []);

  // 时间范围变更
  const handleTimeRangeChange = (preset: '7d' | '30d' | '90d' | 'custom', dates?: [Dayjs, Dayjs]) => {
    let startDate: string;
    let endDate: string;

    if (preset === 'custom' && dates) {
      startDate = dates[0].format('YYYY-MM-DD');
      endDate = dates[1].format('YYYY-MM-DD');
    } else {
      const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
      endDate = dayjs().format('YYYY-MM-DD');
      startDate = dayjs().subtract(days, 'days').format('YYYY-MM-DD');
    }

    setTimeRange({ startDate, endDate, preset });
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 页面标题和工具栏 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>数据工作台</Title>
          <Text type="secondary">
            系统运营数据可视化分析
            {lastUpdate && ` · 最后更新: ${dayjs(lastUpdate).format('HH:mm:ss')}`}
          </Text>
        </div>
        
        <Space wrap>
          <Select
            value={timeRange.preset}
            onChange={(value) => handleTimeRangeChange(value as any)}
            style={{ width: 120 }}
            options={[
              { label: '最近7天', value: '7d' },
              { label: '最近30天', value: '30d' },
              { label: '最近90天', value: '90d' },
              { label: '自定义', value: 'custom' }
            ]}
          />
          
          {timeRange.preset === 'custom' && (
            <RangePicker
              value={[dayjs(timeRange.startDate), dayjs(timeRange.endDate)]}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  handleTimeRangeChange('custom', dates as [Dayjs, Dayjs]);
                }
              }}
            />
          )}
          
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 核心指标卡片 */}
      <MetricsCards
        data={dashboardData?.metrics}
        loading={loading}
        onCardClick={(type) => {
          if (type === 'distillations') navigate('/distillation-results');
          if (type === 'articles') navigate('/articles');
          if (type === 'tasks') navigate('/publishing-tasks');
        }}
      />

      {/* 第一行：趋势图和文章统计 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <TrendsChart data={dashboardData?.trends} loading={loading} />
        </Col>
        <Col xs={24} lg={8}>
          <ArticleStatsChart data={dashboardData?.articleStats} loading={loading} />
        </Col>
      </Row>

      {/* 第二行：月度对比 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <MonthlyComparisonChart data={dashboardData?.monthlyComparison} loading={loading} />
        </Col>
      </Row>

      {/* 第三行：关键词分布 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <KeywordDistributionChart data={dashboardData?.keywordDistribution} loading={loading} />
        </Col>
      </Row>

      {/* 第四行：成功率仪表盘和资源效率 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <SuccessRateGauge data={dashboardData?.successRates} loading={loading} />
        </Col>
        <Col xs={24} lg={12}>
          <ResourceEfficiencyChart data={dashboardData?.resourceUsage} loading={loading} />
        </Col>
      </Row>

      {/* 第五行：发布状态和平台分布 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <PublishingStatusChart data={dashboardData?.publishingStatus} loading={loading} />
        </Col>
        <Col xs={24} lg={12}>
          <PlatformDistributionChart data={dashboardData?.platformDistribution} loading={loading} />
        </Col>
      </Row>

      {/* 第六行：24小时活动热力图 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <HourlyActivityChart data={dashboardData?.hourlyActivity} loading={loading} />
        </Col>
      </Row>
    </div>
  );
}
