import { useState, useEffect, useCallback } from 'react';
import { 
  Card, Table, Tag, Button, Select, DatePicker, Statistic, Row, Col, 
  message, Space, Alert, Tabs, List, Badge, Tooltip, Descriptions
} from 'antd';
import { 
  DollarOutlined, CheckCircleOutlined, ClockCircleOutlined, 
  ReloadOutlined, WarningOutlined, SyncOutlined, 
  ExclamationCircleOutlined, DatabaseOutlined, ScheduleOutlined,
  AlertOutlined, UserOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface CommissionStats {
  byStatus: Record<string, { count: number; amount: number }>;
  today: { count: number; amount: number };
  month: { count: number; amount: number };
  pendingByDate: Array<{ date: string; count: number; amount: number }>;
  processingProfitSharing: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: string;
  components: {
    database: boolean;
    scheduler: boolean;
    profitSharing: boolean;
  };
  metrics: {
    pendingCommissions: number;
    overdueCommissions: number;
    failedSettlements24h: number;
    processingProfitSharing: number;
  };
}

interface CommissionRecord {
  id: number;
  agentId: number;
  agentUsername: string;
  orderId: number;
  orderNo: string;
  orderTotalAmount: number;
  invitedUserId: number;
  invitedUsername: string;
  planName: string;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  settleDate: string;
  settledAt: string | null;
  failReason: string | null;
  profitSharingStatus: string | null;
  profitSharingOrderNo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ServiceEvent {
  id: number;
  eventType: string;
  severity: string;
  message: string;
  details: any;
  createdAt: string;
}

interface ScheduledTask {
  name: string;
  schedule: string;
  description: string;
  lastExecution: {
    time: string;
    status: string;
    result?: string;
  } | null;
}

interface Agent {
  id: number;
  username: string;
  status: string;
  commissionRate: number;
}

const CommissionMonitorPage = () => {
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<{ tasks: ScheduledTask[]; recentEvents: any[] } | null>(null);
  const [anomalies, setAnomalies] = useState<{ hasAnomalies: boolean; anomalies: string[] } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<{ 
    status?: string; 
    agentId?: number;
    dateRange?: [string, string];
  }>({});

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/monitoring/commission-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取佣金统计失败:', error);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/monitoring/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHealth(response.data);
    } catch (error) {
      console.error('获取健康状态失败:', error);
    }
  }, []);

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params: any = {
        page: pagination.current,
        pageSize: pagination.pageSize
      };
      if (filters.status) params.status = filters.status;
      if (filters.agentId) params.agentId = filters.agentId;
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0];
        params.endDate = filters.dateRange[1];
      }

      const response = await axios.get(`${API_BASE_URL}/monitoring/commissions`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      if (response.data.success) {
        setCommissions(response.data.data);
        setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
      }
    } catch (error) {
      message.error('获取佣金记录失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/monitoring/events`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 }
      });
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('获取事件日志失败:', error);
    }
  }, []);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/monitoring/scheduler-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSchedulerStatus(response.data.data);
      }
    } catch (error) {
      console.error('获取定时任务状态失败:', error);
    }
  }, []);

  const fetchAnomalies = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/monitoring/commission-anomalies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnomalies(response.data);
    } catch (error) {
      console.error('获取异常信息失败:', error);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/monitoring/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setAgents(response.data.data);
      }
    } catch (error) {
      console.error('获取代理商列表失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchHealth();
    fetchSchedulerStatus();
    fetchAnomalies();
    fetchAgents();
    fetchEvents();
  }, [fetchStats, fetchHealth, fetchSchedulerStatus, fetchAnomalies, fetchAgents, fetchEvents]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const refreshAll = () => {
    fetchStats();
    fetchHealth();
    fetchCommissions();
    fetchEvents();
    fetchSchedulerStatus();
    fetchAnomalies();
    message.success('数据已刷新');
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    return parts.join('') || '刚启动';
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'orange', text: '待结算' },
      settled: { color: 'green', text: '已结算' },
      cancelled: { color: 'red', text: '已取消' },
      refunded: { color: 'purple', text: '已退款' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getSeverityTag = (severity: string) => {
    const map: Record<string, { color: string }> = {
      info: { color: 'blue' },
      warning: { color: 'orange' },
      error: { color: 'red' },
      critical: { color: 'magenta' }
    };
    return <Tag color={map[severity]?.color || 'default'}>{severity}</Tag>;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 180 },
    { 
      title: '代理商', 
      dataIndex: 'agentUsername', 
      key: 'agentUsername', 
      width: 100,
      render: (text: string) => <Tag icon={<UserOutlined />}>{text}</Tag>
    },
    { title: '被邀请用户', dataIndex: 'invitedUsername', key: 'invitedUsername', width: 100 },
    { title: '套餐', dataIndex: 'planName', key: 'planName', width: 100 },
    { 
      title: '订单金额', 
      dataIndex: 'orderAmount', 
      key: 'orderAmount', 
      width: 100,
      render: (v: number) => `¥${v.toFixed(2)}`
    },
    { 
      title: '佣金比例', 
      dataIndex: 'commissionRate', 
      key: 'commissionRate', 
      width: 80,
      render: (v: number) => `${(v * 100).toFixed(0)}%`
    },
    { 
      title: '佣金金额', 
      dataIndex: 'commissionAmount', 
      key: 'commissionAmount', 
      width: 100,
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{v.toFixed(2)}</span>
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 90,
      render: (status: string) => getStatusTag(status)
    },
    { 
      title: '结算日期', 
      dataIndex: 'settleDate', 
      key: 'settleDate', 
      width: 110,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    { 
      title: '分账状态', 
      key: 'profitSharing', 
      width: 100,
      render: (_: any, record: CommissionRecord) => {
        if (!record.profitSharingStatus) return '-';
        const map: Record<string, { color: string; text: string }> = {
          processing: { color: 'processing', text: '处理中' },
          success: { color: 'success', text: '成功' },
          failed: { color: 'error', text: '失败' }
        };
        const config = map[record.profitSharingStatus] || { color: 'default', text: record.profitSharingStatus };
        return <Badge status={config.color as any} text={config.text} />;
      }
    },
    { 
      title: '失败原因', 
      dataIndex: 'failReason', 
      key: 'failReason', 
      width: 150,
      ellipsis: true,
      render: (text: string | null) => text ? (
        <Tooltip title={text}>
          <span style={{ color: '#ff4d4f' }}>{text}</span>
        </Tooltip>
      ) : '-'
    },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>佣金监控</h1>
        <Button icon={<ReloadOutlined />} onClick={refreshAll}>刷新全部</Button>
      </div>

      {/* 异常告警 */}
      {anomalies?.hasAnomalies && (
        <Alert
          message="检测到异常"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {anomalies.anomalies.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          }
          type="warning"
          showIcon
          icon={<AlertOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      <Tabs defaultActiveKey="overview" items={[
        {
          key: 'overview',
          label: <span><DatabaseOutlined /> 系统概览</span>,
          children: (
            <>
              {/* 系统健康状态 */}
              <Card title="系统健康状态" style={{ marginBottom: 24 }}>
                {health && (
                  <Row gutter={24}>
                    <Col span={6}>
                      <Statistic
                        title="系统状态"
                        value={health.status === 'healthy' ? '健康' : health.status === 'degraded' ? '降级' : '异常'}
                        valueStyle={{ 
                          color: health.status === 'healthy' ? '#52c41a' : 
                                 health.status === 'degraded' ? '#faad14' : '#ff4d4f' 
                        }}
                        prefix={health.status === 'healthy' ? <CheckCircleOutlined /> : <WarningOutlined />}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="运行时间"
                        value={formatUptime(health.uptime)}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="待结算佣金"
                        value={health.metrics.pendingCommissions}
                        suffix="笔"
                        prefix={<SyncOutlined />}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="超期未结算"
                        value={health.metrics.overdueCommissions}
                        suffix="笔"
                        valueStyle={{ color: health.metrics.overdueCommissions > 0 ? '#ff4d4f' : undefined }}
                        prefix={<ExclamationCircleOutlined />}
                      />
                    </Col>
                  </Row>
                )}
                {health && (
                  <Descriptions style={{ marginTop: 16 }} column={4} size="small">
                    <Descriptions.Item label="数据库">
                      <Badge status={health.components.database ? 'success' : 'error'} 
                             text={health.components.database ? '正常' : '异常'} />
                    </Descriptions.Item>
                    <Descriptions.Item label="调度器">
                      <Badge status={health.components.scheduler ? 'success' : 'error'} 
                             text={health.components.scheduler ? '正常' : '异常'} />
                    </Descriptions.Item>
                    <Descriptions.Item label="分账服务">
                      <Badge status={health.components.profitSharing ? 'success' : 'error'} 
                             text={health.components.profitSharing ? '正常' : '异常'} />
                    </Descriptions.Item>
                    <Descriptions.Item label="24h失败结算">
                      <span style={{ color: health.metrics.failedSettlements24h > 0 ? '#ff4d4f' : undefined }}>
                        {health.metrics.failedSettlements24h} 笔
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </Card>

              {/* 佣金统计 */}
              {stats && (
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="待结算佣金"
                        value={stats.byStatus.pending?.amount || 0}
                        precision={2}
                        prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                        suffix="元"
                        valueStyle={{ color: '#faad14' }}
                      />
                      <div style={{ marginTop: 8, color: '#999' }}>
                        {stats.byStatus.pending?.count || 0} 笔
                      </div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="已结算佣金"
                        value={stats.byStatus.settled?.amount || 0}
                        precision={2}
                        prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        suffix="元"
                        valueStyle={{ color: '#52c41a' }}
                      />
                      <div style={{ marginTop: 8, color: '#999' }}>
                        {stats.byStatus.settled?.count || 0} 笔
                      </div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="今日佣金"
                        value={stats.today.amount}
                        precision={2}
                        prefix={<DollarOutlined />}
                        suffix="元"
                      />
                      <div style={{ marginTop: 8, color: '#999' }}>
                        {stats.today.count} 笔
                      </div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="本月佣金"
                        value={stats.month.amount}
                        precision={2}
                        prefix={<DollarOutlined />}
                        suffix="元"
                      />
                      <div style={{ marginTop: 8, color: '#999' }}>
                        {stats.month.count} 笔
                      </div>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* 待结算佣金分布 */}
              {stats && stats.pendingByDate.length > 0 && (
                <Card title="待结算佣金分布（按结算日期）" style={{ marginBottom: 24 }}>
                  <Row gutter={16}>
                    {stats.pendingByDate.map((item, index) => (
                      <Col span={Math.floor(24 / Math.min(stats.pendingByDate.length, 7))} key={index}>
                        <Card size="small">
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#999', marginBottom: 8 }}>
                              {dayjs(item.date).format('MM-DD')}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                              ¥{item.amount.toFixed(2)}
                            </div>
                            <div style={{ color: '#999', fontSize: 12 }}>
                              {item.count} 笔
                            </div>
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Card>
              )}
            </>
          )
        },
        {
          key: 'commissions',
          label: <span><DollarOutlined /> 佣金记录</span>,
          children: (
            <>
              {/* 筛选器 */}
              <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                  <Select
                    placeholder="佣金状态"
                    style={{ width: 120 }}
                    allowClear
                    onChange={(v) => {
                      setFilters(prev => ({ ...prev, status: v }));
                      setPagination(prev => ({ ...prev, current: 1 }));
                    }}
                  >
                    <Option value="pending">待结算</Option>
                    <Option value="settled">已结算</Option>
                    <Option value="cancelled">已取消</Option>
                    <Option value="refunded">已退款</Option>
                  </Select>
                  <Select
                    placeholder="代理商"
                    style={{ width: 150 }}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    onChange={(v) => {
                      setFilters(prev => ({ ...prev, agentId: v }));
                      setPagination(prev => ({ ...prev, current: 1 }));
                    }}
                  >
                    {agents.map(a => (
                      <Option key={a.id} value={a.id}>{a.username}</Option>
                    ))}
                  </Select>
                  <RangePicker 
                    onChange={(dates) => {
                      if (dates && dates.length === 2) {
                        setFilters(prev => ({
                          ...prev,
                          dateRange: [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')]
                        }));
                      } else {
                        setFilters(prev => ({ ...prev, dateRange: undefined }));
                      }
                      setPagination(prev => ({ ...prev, current: 1 }));
                    }}
                  />
                  <Button icon={<ReloadOutlined />} onClick={fetchCommissions}>刷新</Button>
                </Space>
              </Card>

              {/* 佣金列表 */}
              <Card>
                <Table
                  columns={columns}
                  dataSource={commissions}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1600 }}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    onChange: (page, pageSize) => {
                      setPagination({ ...pagination, current: page, pageSize: pageSize || 10 });
                    }
                  }}
                />
              </Card>
            </>
          )
        },
        {
          key: 'scheduler',
          label: <span><ScheduleOutlined /> 定时任务</span>,
          children: (
            <>
              {schedulerStatus && (
                <>
                  <Card title="定时任务状态" style={{ marginBottom: 24 }}>
                    <List
                      dataSource={schedulerStatus.tasks}
                      renderItem={(task) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <Badge 
                                status={
                                  !task.lastExecution ? 'default' :
                                  task.lastExecution.status === 'success' ? 'success' : 'error'
                                } 
                              />
                            }
                            title={task.name}
                            description={
                              <Space>
                                <Tag>{task.schedule}</Tag>
                                <span>{task.description}</span>
                              </Space>
                            }
                          />
                          <div style={{ textAlign: 'right' }}>
                            {task.lastExecution ? (
                              <>
                                <div style={{ color: '#999', fontSize: 12 }}>
                                  上次执行: {dayjs(task.lastExecution.time).format('MM-DD HH:mm:ss')}
                                </div>
                                {task.lastExecution.result && (
                                  <div style={{ fontSize: 12 }}>
                                    {task.lastExecution.result}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span style={{ color: '#999' }}>尚未执行</span>
                            )}
                          </div>
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card title="最近任务执行记录">
                    <List
                      size="small"
                      dataSource={schedulerStatus.recentEvents}
                      renderItem={(event) => (
                        <List.Item>
                          <Space>
                            <Tag color={
                              event.type === 'task_complete' ? 'green' :
                              event.type === 'task_error' ? 'red' : 'blue'
                            }>
                              {event.type === 'task_start' ? '开始' :
                               event.type === 'task_complete' ? '完成' : '错误'}
                            </Tag>
                            <span>{event.message}</span>
                          </Space>
                          <span style={{ color: '#999' }}>
                            {dayjs(event.time).format('MM-DD HH:mm:ss')}
                          </span>
                        </List.Item>
                      )}
                    />
                  </Card>
                </>
              )}
            </>
          )
        },
        {
          key: 'events',
          label: <span><AlertOutlined /> 事件日志</span>,
          children: (
            <Card>
              <Table
                dataSource={events}
                rowKey="id"
                columns={[
                  { 
                    title: '时间', 
                    dataIndex: 'createdAt', 
                    key: 'createdAt', 
                    width: 180,
                    render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
                  },
                  { 
                    title: '级别', 
                    dataIndex: 'severity', 
                    key: 'severity', 
                    width: 80,
                    render: (severity: string) => getSeverityTag(severity)
                  },
                  { 
                    title: '类型', 
                    dataIndex: 'eventType', 
                    key: 'eventType', 
                    width: 200,
                    render: (type: string) => <Tag>{type}</Tag>
                  },
                  { title: '消息', dataIndex: 'message', key: 'message' },
                  { 
                    title: '详情', 
                    dataIndex: 'details', 
                    key: 'details',
                    width: 200,
                    ellipsis: true,
                    render: (details: any) => details ? (
                      <Tooltip title={JSON.stringify(details, null, 2)}>
                        <span>{JSON.stringify(details)}</span>
                      </Tooltip>
                    ) : '-'
                  }
                ]}
                pagination={{ pageSize: 20 }}
              />
            </Card>
          )
        }
      ]} />
    </div>
  );
};

export default CommissionMonitorPage;
