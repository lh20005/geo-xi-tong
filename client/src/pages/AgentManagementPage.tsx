import { useState, useEffect, useCallback } from 'react';
import { Input, Button, Tag, Modal, Form, InputNumber, message, Space, Card, Statistic, Row, Col, Tooltip, Select } from 'antd';
import { SearchOutlined, StopOutlined, CheckCircleOutlined, DeleteOutlined, DollarOutlined, TeamOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons';
import axios from 'axios';
import { config } from '../config/env';
import ResizableTable from '../components/ResizableTable';

const { Search } = Input;

interface Agent {
  id: number;
  userId: number;
  username: string;
  invitationCode: string;
  status: 'active' | 'suspended';
  commissionRate: number;
  wechatOpenid?: string;
  wechatNickname?: string;
  totalEarnings: number;
  settledEarnings: number;
  pendingEarnings: number;
  invitedUsers: number;
  paidUsers: number;
  createdAt: string;
  updatedAt: string;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalCommissions: number;
  pendingCommissions: number;
}

interface CommissionRecord {
  id: number;
  orderId: number;
  orderNo: string;
  commissionAmount: number;
  status: 'pending' | 'processing' | 'settled' | 'failed' | 'cancelled';
  settledAt?: string;
  createdAt: string;
  username?: string;
  planName?: string;
}

export default function AgentManagementPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<AgentStats | null>(null);
  
  // 详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  
  // 调整佣金比例弹窗
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [rateForm] = Form.useForm();

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${config.apiUrl}/admin/agents`, {
        params: { 
          page, 
          pageSize, 
          search: search || undefined,
          status: statusFilter || undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAgents(response.data.data.agents);
        setTotal(response.data.data.total);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载代理商列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${config.apiUrl}/admin/agents/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    loadStats();
  }, [loadAgents, loadStats]);

  const handleViewDetail = async (agent: Agent) => {
    setSelectedAgent(agent);
    setDetailModalVisible(true);
    setCommissionsLoading(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${config.apiUrl}/admin/agents/${agent.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCommissions(response.data.data.commissions || []);
      }
    } catch (error: any) {
      message.error('加载代理商详情失败');
    } finally {
      setCommissionsLoading(false);
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'suspended' : 'active';
    const actionText = newStatus === 'active' ? '恢复' : '暂停';
    
    Modal.confirm({
      title: `确认${actionText}`,
      content: `确定要${actionText}代理商 "${agent.username}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('auth_token');
          await axios.put(
            `${config.apiUrl}/admin/agents/${agent.id}/status`,
            { status: newStatus },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          message.success(`代理商已${actionText}`);
          loadAgents();
        } catch (error: any) {
          message.error(error.response?.data?.message || `${actionText}失败`);
        }
      }
    });
  };

  const handleAdjustRate = (agent: Agent) => {
    setSelectedAgent(agent);
    rateForm.setFieldsValue({ commissionRate: agent.commissionRate * 100 });
    setRateModalVisible(true);
  };

  const confirmAdjustRate = async () => {
    try {
      const values = await rateForm.validateFields();
      const token = localStorage.getItem('auth_token');
      
      await axios.put(
        `${config.apiUrl}/admin/agents/${selectedAgent?.id}/rate`,
        { commissionRate: values.commissionRate / 100 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      message.success('佣金比例已调整');
      setRateModalVisible(false);
      loadAgents();
    } catch (error: any) {
      message.error(error.response?.data?.message || '调整佣金比例失败');
    }
  };

  const handleDelete = (agent: Agent) => {
    Modal.confirm({
      title: '确认删除',
      content: (
        <div>
          <p>确定要删除代理商 "{agent.username}" 吗？</p>
          <p style={{ color: '#ff4d4f', fontSize: 12 }}>
            注意：删除后该代理商的所有佣金记录将被保留，但无法再获得新的佣金。
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('auth_token');
          await axios.delete(
            `${config.apiUrl}/admin/agents/${agent.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          message.success('代理商已删除');
          loadAgents();
          loadStats();
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="success">正常</Tag>;
      case 'suspended':
        return <Tag color="error">已暂停</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '邀请码',
      dataIndex: 'invitationCode',
      key: 'invitationCode',
      width: 100,
      render: (code: string) => <code style={{ fontSize: 12 }}>{code}</code>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '佣金比例',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      width: 90,
      render: (rate: number) => <Tag color="blue">{(rate * 100).toFixed(0)}%</Tag>,
    },
    {
      title: '微信绑定',
      key: 'wechat',
      width: 100,
      render: (_: any, record: Agent) => (
        record.wechatOpenid ? (
          <Tooltip title={record.wechatNickname || record.wechatOpenid}>
            <Tag color="green">已绑定</Tag>
          </Tooltip>
        ) : (
          <Tag color="default">未绑定</Tag>
        )
      ),
    },
    {
      title: '累计收益',
      dataIndex: 'totalEarnings',
      key: 'totalEarnings',
      width: 100,
      render: (amount: number) => (
        <span style={{ color: '#52c41a', fontWeight: 500 }}>
          ¥{(amount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '待结算',
      dataIndex: 'pendingEarnings',
      key: 'pendingEarnings',
      width: 100,
      render: (amount: number) => (
        <span style={{ color: '#faad14' }}>
          ¥{(amount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '邀请/付费',
      key: 'users',
      width: 90,
      render: (_: any, record: Agent) => (
        <span>{record.invitedUsers} / {record.paidUsers}</span>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, record: Agent) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => handleAdjustRate(record)}
          >
            调整比例
          </Button>
          <Button
            type="link"
            size="small"
            icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'active' ? '暂停' : '恢复'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const commissionColumns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180,
      render: (text: string) => <code style={{ fontSize: 11 }}>{text}</code>,
    },
    {
      title: '购买用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '商品',
      dataIndex: 'planName',
      key: 'planName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '佣金金额',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      width: 100,
      render: (amount: number) => (
        <span style={{ color: '#52c41a', fontWeight: 500 }}>
          ¥{(amount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '待结算' },
          processing: { color: 'processing', text: '处理中' },
          settled: { color: 'success', text: '已结算' },
          failed: { color: 'error', text: '失败' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="代理商总数"
                value={stats.totalAgents}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="活跃代理商"
                value={stats.activeAgents}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="累计佣金"
                value={(stats.totalCommissions || 0).toFixed(2)}
                prefix={<WalletOutlined />}
                suffix="元"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待结算佣金"
                value={(stats.pendingCommissions || 0).toFixed(2)}
                prefix={<DollarOutlined />}
                suffix="元"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>代理商管理</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>管理系统中的所有代理商和佣金分成</p>
          
          <Space size="middle" style={{ marginBottom: 16 }}>
            <Search
              placeholder="搜索用户名或邀请码..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={setSearch}
              style={{ width: 300 }}
            />
            
            <Select
              placeholder="筛选状态"
              allowClear
              size="large"
              style={{ width: 150 }}
              onChange={(value) => {
                setStatusFilter(value || '');
                setPage(1);
              }}
              value={statusFilter || undefined}
            >
              <Select.Option value="">全部状态</Select.Option>
              <Select.Option value="active">
                <Tag color="success">正常</Tag>
              </Select.Option>
              <Select.Option value="suspended">
                <Tag color="error">已暂停</Tag>
              </Select.Option>
            </Select>
          </Space>
        </div>

        <ResizableTable<Agent>
          tableId="agent-management"
          columns={columns}
          dataSource={agents}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个代理商`,
          }}
        />
      </Card>

      {/* 代理商详情弹窗 */}
      <Modal
        title={`代理商详情 - ${selectedAgent?.username}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)}>关闭</Button>}
        width={900}
      >
        {selectedAgent && (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Statistic
                  title="累计收益"
                  value={(selectedAgent.totalEarnings || 0).toFixed(2)}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="已结算"
                  value={(selectedAgent.settledEarnings || 0).toFixed(2)}
                  prefix="¥"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="待结算"
                  value={(selectedAgent.pendingEarnings || 0).toFixed(2)}
                  prefix="¥"
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
            </Row>
            
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Statistic title="邀请用户" value={selectedAgent.invitedUsers} />
              </Col>
              <Col span={6}>
                <Statistic title="付费用户" value={selectedAgent.paidUsers} />
              </Col>
              <Col span={6}>
                <Statistic title="佣金比例" value={`${(selectedAgent.commissionRate * 100).toFixed(0)}%`} />
              </Col>
              <Col span={6}>
                <div>
                  <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 4 }}>微信绑定</div>
                  {selectedAgent.wechatOpenid ? (
                    <Tag color="green">{selectedAgent.wechatNickname || '已绑定'}</Tag>
                  ) : (
                    <Tag color="default">未绑定</Tag>
                  )}
                </div>
              </Col>
            </Row>

            <h4 style={{ marginBottom: 12 }}>佣金记录</h4>
            <ResizableTable<CommissionRecord>
              tableId="agent-commissions"
              columns={commissionColumns}
              dataSource={commissions}
              rowKey="id"
              loading={commissionsLoading}
              scroll={{ x: 800 }}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </div>
        )}
      </Modal>

      {/* 调整佣金比例弹窗 */}
      <Modal
        title="调整佣金比例"
        open={rateModalVisible}
        onOk={confirmAdjustRate}
        onCancel={() => setRateModalVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        <Form form={rateForm} layout="vertical">
          <Form.Item
            name="commissionRate"
            label="佣金比例"
            rules={[
              { required: true, message: '请输入佣金比例' },
              { type: 'number', min: 1, max: 30, message: '佣金比例必须在 1-30% 之间' }
            ]}
            extra="微信支付分账最高支持 30%"
          >
            <InputNumber
              min={1}
              max={30}
              precision={0}
              addonAfter="%"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
