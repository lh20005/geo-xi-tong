import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Alert, Table, Tag, Tabs } from 'antd';
import {
  SafetyOutlined,
  WarningOutlined,
  LockOutlined,
  UserOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

interface SecurityMetrics {
  failedLogins: number;
  blockedIPs: number;
  suspiciousActivities: number;
  activeAnomalies: number;
  lastIncident: string | null;
}

interface SecurityEvent {
  id: number;
  event_type: string;
  severity: string;
  user_id: number | null;
  ip_address: string | null;
  message: string;
  created_at: string;
}

const SecurityDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityData();
    // 每30秒刷新一次
    const interval = setInterval(fetchSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // 获取安全指标
      const metricsRes = await axios.get(`${API_BASE_URL}/security/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMetrics(metricsRes.data);

      // 获取最近的安全事件
      const eventsRes = await axios.get(`${API_BASE_URL}/security/events?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(eventsRes.data.events || []);

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch security data:', error);
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'warning': return 'orange';
      case 'info': return 'blue';
      default: return 'default';
    }
  };

  const eventColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>
          {severity.toUpperCase()}
        </Tag>
      )
    },
    {
      title: '事件类型',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 150
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      render: (ip: string | null) => ip || '-'
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        <SafetyOutlined /> 安全仪表板
      </h1>

      {/* 安全指标概览 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败登录次数"
              value={metrics?.failedLogins || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: metrics && metrics.failedLogins > 100 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="被封禁IP数量"
              value={metrics?.blockedIPs || 0}
              prefix={<LockOutlined />}
              valueStyle={{ color: metrics && metrics.blockedIPs > 10 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="可疑活动次数"
              value={metrics?.suspiciousActivities || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: metrics && metrics.suspiciousActivities > 50 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃异常数量"
              value={metrics?.activeAnomalies || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: metrics && metrics.activeAnomalies > 5 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 最后严重事件 */}
      {metrics?.lastIncident && (
        <Alert
          message="最后严重事件"
          description={`发生时间: ${new Date(metrics.lastIncident).toLocaleString('zh-CN')}`}
          type="warning"
          icon={<ClockCircleOutlined />}
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* 安全事件列表 */}
      <Card title="最近安全事件" style={{ marginBottom: '24px' }}>
        <Table
          columns={eventColumns}
          dataSource={events}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      {/* 安全建议 */}
      <Card title="安全建议">
        <Tabs 
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: '当前状态',
              children: metrics && (
                <div>
                  {metrics.failedLogins > 100 && (
                    <Alert
                      message="失败登录次数较高"
                      description="建议检查是否存在暴力破解攻击"
                      type="warning"
                      showIcon
                      style={{ marginBottom: '12px' }}
                    />
                  )}
                  {metrics.blockedIPs > 10 && (
                    <Alert
                      message="被封禁IP数量较多"
                      description="建议审查IP白名单策略"
                      type="warning"
                      showIcon
                      style={{ marginBottom: '12px' }}
                    />
                  )}
                  {metrics.suspiciousActivities > 50 && (
                    <Alert
                      message="可疑活动较多"
                      description="建议加强安全监控和日志审查"
                      type="warning"
                      showIcon
                      style={{ marginBottom: '12px' }}
                    />
                  )}
                  {metrics.activeAnomalies > 5 && (
                    <Alert
                      message="活跃异常数量较高"
                      description="建议检查用户行为模式"
                      type="warning"
                      showIcon
                      style={{ marginBottom: '12px' }}
                    />
                  )}
                  {metrics.failedLogins <= 100 && 
                   metrics.blockedIPs <= 10 && 
                   metrics.suspiciousActivities <= 50 && 
                   metrics.activeAnomalies <= 5 && (
                    <Alert
                      message="系统安全状况良好"
                      description="继续保持监控"
                      type="success"
                      showIcon
                    />
                  )}
                </div>
              )
            },
            {
              key: '2',
              label: '最佳实践',
              children: (
                <ul>
                  <li>定期审查审计日志，关注异常操作</li>
                  <li>及时处理安全告警，不要忽视警告信息</li>
                  <li>保持密码策略的严格性，定期更新密码</li>
                  <li>限制管理员权限，遵循最小权限原则</li>
                  <li>定期备份重要数据和配置</li>
                  <li>保持系统和依赖包的更新</li>
                </ul>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default SecurityDashboardPage;
