import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Input, Select, DatePicker, Statistic, Row, Col, message, Space } from 'antd';
import { DollarOutlined, ShoppingOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '../api/client';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface Order {
  id: number;
  order_no: string;
  user_id: number;
  username: string;
  plan_name: string;
  amount: number;
  status: string;
  payment_method: string;
  transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
}

interface OrderStats {
  todayRevenue: number;
  monthRevenue: number;
  todayOrders: number;
  monthOrders: number;
  pendingOrders: number;
}

const OrderManagementPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<{ status?: string; dateRange?: [string, string] }>({});
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.current,
        limit: pagination.pageSize,
      };

      if (filters.status) {
        params.status = filters.status;
      }

      if (filters.dateRange) {
        params.startDate = filters.dateRange[0];
        params.endDate = filters.dateRange[1];
      }

      const response = await apiClient.get('/admin/orders', { params });

      if (response.data.success) {
        setOrders(response.data.data);
        setPagination((prev) => ({
          ...prev,
          total: response.data.pagination.total,
        }));
      }
    } catch (error: any) {
      message.error('获取订单列表失败');
      console.error('获取订单列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/admin/orders/stats/summary');

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      console.error('获取订单统计失败:', error);
    }
  };

  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value || undefined }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters((prev) => ({
        ...prev,
        dateRange: [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')],
      }));
    } else {
      setFilters((prev) => ({ ...prev, dateRange: undefined }));
    }
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const showHandleModal = (order: Order) => {
    setSelectedOrder(order);
    setHandleModalVisible(true);
    form.resetFields();
  };

  const handleOrder = async () => {
    try {
      const values = await form.validateFields();

      await apiClient.put(
        `/admin/orders/${selectedOrder?.order_no}`,
        values
      );

      message.success('处理成功');
      setHandleModalVisible(false);
      fetchOrders();
      fetchStats();
    } catch (error: any) {
      message.error(error.response?.data?.message || '处理失败');
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'orange', text: '待支付' },
      paid: { color: 'green', text: '已支付' },
      closed: { color: 'default', text: '已关闭' },
      failed: { color: 'red', text: '支付失败' },
      refunded: { color: 'purple', text: '已退款' },
    };

    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '套餐',
      dataIndex: 'plan_name',
      key: 'plan_name',
      width: 120,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => `¥${amount}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '支付时间',
      dataIndex: 'paid_at',
      key: 'paid_at',
      width: 180,
      render: (date: string | null) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Order) => (
        <Space>
          {(record.status === 'pending' || record.status === 'paid') && (
            <Button type="link" size="small" onClick={() => showHandleModal(record)}>
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>订单管理</h1>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日收入"
                value={stats.todayRevenue}
                precision={2}
                prefix={<DollarOutlined />}
                suffix="元"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="本月收入"
                value={stats.monthRevenue}
                precision={2}
                prefix={<DollarOutlined />}
                suffix="元"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日订单"
                value={stats.todayOrders}
                prefix={<ShoppingOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待支付订单"
                value={stats.pendingOrders}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选器 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="订单状态"
            style={{ width: 150 }}
            allowClear
            onChange={handleStatusChange}
          >
            <Option value="pending">待支付</Option>
            <Option value="paid">已支付</Option>
            <Option value="closed">已关闭</Option>
            <Option value="failed">支付失败</Option>
            <Option value="refunded">已退款</Option>
          </Select>

          <RangePicker onChange={handleDateRangeChange} />

          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* 订单列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize: pageSize || 10 });
            },
          }}
        />
      </Card>

      {/* 处理订单对话框 */}
      <Modal
        title="处理订单"
        open={handleModalVisible}
        onOk={handleOrder}
        onCancel={() => setHandleModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="订单号">
            <Input value={selectedOrder?.order_no} disabled />
          </Form.Item>

          <Form.Item
            name="action"
            label="操作类型"
            rules={[{ required: true, message: '请选择操作类型' }]}
          >
            <Select placeholder="请选择">
              <Option value="complete">手动完成</Option>
              <Option value="refund">退款</Option>
            </Select>
          </Form.Item>

          <Form.Item name="reason" label="原因说明">
            <Input.TextArea rows={4} placeholder="请输入原因说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrderManagementPage;
