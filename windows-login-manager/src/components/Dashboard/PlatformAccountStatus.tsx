/**
 * 平台账号状态概览
 * 展示各平台账号的登录状态、最近活跃时间和发布统计
 */

import { Card, Empty, Spin, Tag, Typography, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { cardStyle, cardTitleStyle, colors } from './chartStyles';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

interface PlatformAccountStatusProps {
  data: {
    totalAccounts: number;
    activeAccounts: number;
    expiredAccounts: number;
    platforms: Array<{
      platformName: string;
      accountCount: number;
      activeCount: number;
      lastPublishTime?: string;
      publishCount: number;
    }>;
  } | null;
  loading: boolean;
}

// 平台图标映射
const platformIcons: Record<string, string> = {
  '小红书': '📕',
  '抖音': '🎵',
  '头条号': '📰',
  '知乎': '💡',
  '百家号': '📝',
  '网易号': '🎮',
  '搜狐号': '🔍',
  'CSDN': '💻',
  '简书': '✍️',
  '微信公众号': '💬',
  '企鹅号': '🐧',
  'B站': '📺'
};

export default function PlatformAccountStatus({ data, loading }: PlatformAccountStatusProps) {
  if (loading) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>平台账号状态</span>}
        style={{ ...cardStyle, height: '100%' }}
      >
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || !data.platforms || data.platforms.length === 0) {
    return (
      <Card 
        title={<span style={cardTitleStyle}>平台账号状态</span>}
        style={{ ...cardStyle, height: '100%' }}
      >
        <Empty description="暂无账号数据" />
      </Card>
    );
  }

  return (
    <Card 
      title={<span style={cardTitleStyle}>平台账号状态</span>}
      style={{ ...cardStyle, height: '100%' }}
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tooltip title="活跃账号 / 总账号">
            <Tag color="blue" icon={<UserOutlined />}>
              {data.activeAccounts}/{data.totalAccounts}
            </Tag>
          </Tooltip>
          {data.expiredAccounts > 0 && (
            <Tag color="warning" icon={<ExclamationCircleOutlined />}>
              {data.expiredAccounts} 需重登
            </Tag>
          )}
        </div>
      }
      styles={{ body: { padding: '12px 16px', maxHeight: 360, overflowY: 'auto' } }}
    >
      {/* 平台列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.platforms.slice(0, 6).map((platform, index) => {
          const isActive = platform.activeCount > 0;
          
          return (
            <div 
              key={index}
              style={{ 
                padding: '10px 12px',
                background: isActive ? '#f6ffed' : '#fff7e6',
                borderRadius: 6,
                borderLeft: `3px solid ${isActive ? colors.success : colors.warning}`,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>
                    {platformIcons[platform.platformName] || '📱'}
                  </span>
                  <Text strong style={{ fontSize: 13 }}>
                    {platform.platformName}
                  </Text>
                  <Tag 
                    color={isActive ? 'success' : 'warning'} 
                    icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    style={{ margin: 0, fontSize: 10 }}
                  >
                    {platform.activeCount}/{platform.accountCount}
                  </Tag>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                    发布 <span style={{ color: colors.primary, fontWeight: 600 }}>{platform.publishCount}</span> 次
                  </Text>
                </div>
              </div>
              
              {platform.lastPublishTime && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ClockCircleOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    最近发布: {dayjs(platform.lastPublishTime).fromNow()}
                  </Text>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.platforms.length > 6 && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            还有 {data.platforms.length - 6} 个平台...
          </Text>
        </div>
      )}
    </Card>
  );
}
