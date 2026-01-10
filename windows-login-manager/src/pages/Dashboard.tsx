/**
 * 工作台页面
 * 重新设计的专业数据仪表盘，包含代理商视图、核心指标、数据分析等
 */

import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Typography, Button, Space, message, DatePicker, Select, Card, Divider } from 'antd';
import { 
  ReloadOutlined, 
  ThunderboltOutlined, 
  FileTextOutlined, 
  RocketOutlined,
  BarChartOutlined,
  DashboardOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';

// Dashboard 组件
import AgentDashboardPanel from '../components/Dashboard/AgentDashboardPanel';
import SubscriptionOverview from '../components/Dashboard/SubscriptionOverview';
import QuickStatsCards from '../components/Dashboard/QuickStatsCards';
import TrendsChart from '../components/Dashboard/TrendsChart';
import PublishingStatusChart from '../components/Dashboard/PublishingStatusChart';
import PlatformDistributionChart from '../components/Dashboard/PlatformDistributionChart';
import ResourceEfficiencyChart from '../components/Dashboard/ResourceEfficiencyChart';
import ArticleStatsChart from '../components/Dashboard/ArticleStatsChart';
import KeywordDistributionChart from '../components/Dashboard/KeywordDistributionChart';
import MonthlyComparisonChart from '../components/Dashboard/MonthlyComparisonChart';
import HourlyActivityChart from '../components/Dashboard/HourlyActivityChart';

import { getAllDashboardData } from '../api/dashboard';
import type { TimeRange } from '../types/dashboard';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

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
      const data = await getAllDashboardData({
        startDate: timeRange.startDate,
        endDate: timeRange.endDate
      });

      setDashboardData(data);
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

  // 快捷操作点击
  const handleQuickAction = (type: string) => {
    switch (type) {
      case 'distillations':
        navigate('/distillation');
        break;
      case 'articles':
        navigate('/articles');
        break;
      case 'tasks':
      case 'successRate':
        navigate('/publishing-tasks');
        break;
      case 'knowledge':
        navigate('/distillation-results');
        break;
      case 'images':
        navigate('/gallery');
        break;
    }
  };

  return (
    <div style={{ 
      padding: 0, 
      background: 'linear-gradient(180deg, #f5f7fa 0%, #e8ecf1 100%)', 
      minHeight: '100vh' 
    }}>
      {/* 顶部导航栏 */}
      <div style={{ 
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        padding: '16px 32px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          maxWidth: 1600,
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DashboardOutlined style={{ fontSize: 28, color: '#1890ff' }} />
            <div>
              <Title level={3} style={{ margin: 0, color: '#262626', fontWeight: 600 }}>
                数据工作台
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                实时监控 · 数据分析 · 运营决策
                {lastUpdate && (
                  <span style={{ marginLeft: 12, color: '#52c41a' }}>
                    ● 最后更新: {dayjs(lastUpdate).format('HH:mm:ss')}
                  </span>
                )}
              </Text>
            </div>
          </div>
          
          <Space size="middle">
            <Select
              value={timeRange.preset}
              onChange={(value) => handleTimeRangeChange(value as any)}
              style={{ width: 130 }}
              size="large"
              options={[
                { label: '最近7天', value: '7d' },
                { label: '最近30天', value: '30d' },
                { label: '最近90天', value: '90d' },
                { label: '自定义', value: 'custom' }
              ]}
            />
            
            {timeRange.preset === 'custom' && (
              <RangePicker
                size="large"
                value={[dayjs(timeRange.startDate), dayjs(timeRange.endDate)]}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    handleTimeRangeChange('custom', dates as [Dayjs, Dayjs]);
                  }
                }}
              />
            )}
            
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              size="large"
            >
              刷新数据
            </Button>
          </Space>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ 
        maxWidth: 1600, 
        margin: '0 auto', 
        padding: '24px 32px 32px' 
      }}>
        {/* 代理商视图面板 - 顶部醒目位置 */}
        <AgentDashboardPanel onRefresh={loadData} />

        {/* 订阅概览 */}
        <SubscriptionOverview />

        {/* 快捷操作区 */}
        <Card 
          style={{ 
            marginBottom: 16,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 15, color: '#262626' }}>快捷操作</Text>
            <Space size="middle">
              <Button 
                type="primary" 
                icon={<ThunderboltOutlined />}
                onClick={() => navigate('/distillation')}
                style={{ borderRadius: 6 }}
              >
                新建蒸馏
              </Button>
              <Button 
                icon={<FileTextOutlined />}
                onClick={() => navigate('/article-generation')}
                style={{ borderRadius: 6 }}
              >
                生成文章
              </Button>
              <Button 
                icon={<RocketOutlined />}
                onClick={() => navigate('/publishing-tasks')}
                style={{ borderRadius: 6 }}
              >
                发布任务
              </Button>
              <Button 
                icon={<SettingOutlined />}
                onClick={() => navigate('/user-center')}
                style={{ borderRadius: 6 }}
              >
                个人中心
              </Button>
            </Space>
          </div>
        </Card>

        {/* 核心数据概览 - 6个小卡片 */}
        <div style={{ marginBottom: 16 }}>
          <QuickStatsCards 
            metrics={dashboardData?.metrics}
            resourceUsage={dashboardData?.resourceUsage}
            loading={loading}
            onCardClick={handleQuickAction}
          />
        </div>

        {/* 数据分析区域标题 */}
        <Divider orientation="left" style={{ 
          marginTop: 24, 
          marginBottom: 20,
          fontSize: 16,
          fontWeight: 600,
          color: '#262626'
        }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          数据分析与趋势
        </Divider>

        {/* 第一行：趋势图和文章统计 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <TrendsChart data={dashboardData?.trends} loading={loading} />
          </Col>
          <Col xs={24} xl={8}>
            <ArticleStatsChart data={dashboardData?.articleStats} loading={loading} />
          </Col>
        </Row>

        {/* 第二行：月度对比 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <MonthlyComparisonChart data={dashboardData?.monthlyComparison} loading={loading} />
          </Col>
        </Row>

        {/* 第三行：资源效率 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <ResourceEfficiencyChart data={dashboardData?.resourceUsage} loading={loading} />
          </Col>
        </Row>

        {/* 第四行：发布状态和平台分布 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <PublishingStatusChart data={dashboardData?.publishingStatus} loading={loading} />
          </Col>
          <Col xs={24} lg={12}>
            <PlatformDistributionChart data={dashboardData?.platformDistribution} loading={loading} />
          </Col>
        </Row>

        {/* 第五行：关键词分布 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <KeywordDistributionChart data={dashboardData?.keywordDistribution} loading={loading} />
          </Col>
        </Row>

        {/* 第六行：24小时活动热力图 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <HourlyActivityChart data={dashboardData?.hourlyActivity} loading={loading} />
          </Col>
        </Row>
      </div>
    </div>
  );
}
