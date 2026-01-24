/**
 * 工作台页面
 * 重新设计的专业数据仪表盘，包含代理商视图、核心指标、数据分析等
 */

import { useState, useCallback, useEffect } from 'react';
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
import PublishingTrendChart from '../components/Dashboard/PublishingTrendChart';
import ContentFunnelChart from '../components/Dashboard/ContentFunnelChart';
import WeeklyComparisonChart from '../components/Dashboard/WeeklyComparisonChart';
import PlatformAccountStatus from '../components/Dashboard/PlatformAccountStatus';
import PlatformSuccessRateChart from '../components/Dashboard/PlatformSuccessRateChart';

import { getAllDashboardData } from '../api/dashboard';
import type { TimeRange } from '../types/dashboard';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function Dashboard() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startDate: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    preset: '30d'
  });

  // 数据状态
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 监听窗口大小变化
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 数据获取函数
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllDashboardData({
        startDate: timeRange.startDate,
        endDate: timeRange.endDate
      });
      setDashboardData(data);
      setLastUpdate(new Date());
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange.startDate, timeRange.endDate]);

  // 初始加载和时间范围变化时重新加载
  useEffect(() => {
    loadData();
  }, [loadData]);

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
        padding: isMobile ? '12px 16px' : '16px 32px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 12 : 0,
          maxWidth: 1600,
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DashboardOutlined style={{ fontSize: isMobile ? 24 : 28, color: '#1890ff' }} />
            <div>
              <Title level={isMobile ? 4 : 3} style={{ margin: 0, color: '#262626', fontWeight: 600 }}>
                数据工作台
              </Title>
              {!isMobile && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  实时监控 · 数据分析 · 运营决策
                  {lastUpdate && (
                    <span style={{ marginLeft: 12, color: '#52c41a' }}>
                      ● 最后更新: {dayjs(lastUpdate).format('HH:mm:ss')}
                    </span>
                  )}
                </Text>
              )}
            </div>
          </div>
          
          <Space size="small" wrap style={{ justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
            <Select
              value={timeRange.preset}
              onChange={(value) => handleTimeRangeChange(value as any)}
              style={{ width: isMobile ? 100 : 130 }}
              size={isMobile ? 'middle' : 'large'}
              options={[
                { label: '7天', value: '7d' },
                { label: '30天', value: '30d' },
                { label: '90天', value: '90d' },
                { label: '自定义', value: 'custom' }
              ]}
            />
            
            {timeRange.preset === 'custom' && !isMobile && (
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
              icon={<ReloadOutlined spin={loading} />}
              onClick={loadData}
              loading={loading}
              size={isMobile ? 'middle' : 'large'}
            >
              {isMobile ? '刷新' : '刷新数据'}
            </Button>
          </Space>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ 
        maxWidth: 1600, 
        margin: '0 auto', 
        padding: isMobile ? '16px' : '24px 32px 32px' 
      }}>
        {/* 代理商视图面板 - 顶部醒目位置 */}
        <AgentDashboardPanel onRefresh={loadData} />

        {/* 订阅概览 */}
        <SubscriptionOverview />

        {/* 快捷操作区 - 移动端简化 */}
        <Card 
          style={{ 
            marginBottom: 16,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
          styles={{ body: { padding: isMobile ? '12px' : '16px 20px' } }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 12 : 0
          }}>
            <Text strong style={{ fontSize: 15, color: '#262626' }}>快捷操作</Text>
            <Space size="small" wrap style={{ justifyContent: isMobile ? 'center' : 'flex-end' }}>
              <Button 
                type="primary" 
                icon={<ThunderboltOutlined />}
                onClick={() => navigate('/distillation')}
                style={{ borderRadius: 6 }}
                size={isMobile ? 'middle' : 'middle'}
              >
                {isMobile ? '蒸馏' : '新建蒸馏'}
              </Button>
              <Button 
                icon={<FileTextOutlined />}
                onClick={() => navigate('/article-generation')}
                style={{ borderRadius: 6 }}
                size={isMobile ? 'middle' : 'middle'}
              >
                {isMobile ? '文章' : '生成文章'}
              </Button>
              <Button 
                icon={<RocketOutlined />}
                onClick={() => navigate('/publishing-tasks')}
                style={{ borderRadius: 6 }}
                size={isMobile ? 'middle' : 'middle'}
              >
                {isMobile ? '发布' : '发布任务'}
              </Button>
              {!isMobile && (
                <Button 
                  icon={<SettingOutlined />}
                  onClick={() => navigate('/user-center')}
                  style={{ borderRadius: 6 }}
                >
                  个人中心
                </Button>
              )}
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
          fontSize: isMobile ? 14 : 16,
          fontWeight: 600,
          color: '#262626'
        }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          数据分析与趋势
        </Divider>

        {/* 第一行：发布趋势和内容转化漏斗 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <PublishingTrendChart data={dashboardData?.publishingTrend} loading={loading} />
          </Col>
          <Col xs={24} xl={10}>
            <ContentFunnelChart data={dashboardData?.contentFunnel} loading={loading} />
          </Col>
        </Row>

        {/* 第二行：周环比对比和平台账号状态 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <WeeklyComparisonChart data={dashboardData?.weeklyComparison} loading={loading} />
          </Col>
          <Col xs={24} lg={10}>
            <PlatformAccountStatus data={dashboardData?.platformAccountStatus} loading={loading} />
          </Col>
        </Row>

        {/* 第三行：平台发布成功率 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <PlatformSuccessRateChart data={dashboardData?.platformSuccessRate} loading={loading} />
          </Col>
        </Row>
      </div>
    </div>
  );
}
