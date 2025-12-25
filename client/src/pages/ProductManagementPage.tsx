import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Switch, message, Tag, Space, Tooltip } from 'antd';
import { EditOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

interface Plan {
  id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  billing_cycle: string;
  is_active: boolean;
  display_order: number;
  features: {
    feature_code: string;
    feature_name: string;
    feature_value: number;
    reset_period: string;
  }[];
}

interface ConfigHistory {
  id: number;
  change_type: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by_name: string;
  created_at: string;
  ip_address: string;
}

const ProductManagementPage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [configHistory, setConfigHistory] = useState<ConfigHistory[]>([]);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE_URL}/admin/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setPlans(response.data.data);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取套餐列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    form.setFieldsValue({
      price: plan.price,
      is_active: plan.is_active,
      ...plan.features.reduce((acc, f) => ({
        ...acc,
        [f.feature_code]: f.feature_value
      }), {})
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values: any) => {
    if (!selectedPlan) return;

    const updateData = {
      price: values.price,
      is_active: values.is_active,
      features: selectedPlan.features.map(f => ({
        feature_code: f.feature_code,
        feature_value: values[f.feature_code]
      }))
    };

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.put(
        `${API_BASE_URL}/admin/products/${selectedPlan.id}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.requiresConfirmation) {
        // 需要二次确认
        setPendingUpdate(updateData);
        setConfirmModalVisible(true);
        message.warning(response.data.message);
      } else if (response.data.success) {
        message.success('套餐配置已更新');
        setEditModalVisible(false);
        fetchPlans();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleConfirmUpdate = async () => {
    if (!selectedPlan || !pendingUpdate) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.put(
        `${API_BASE_URL}/admin/products/${selectedPlan.id}`,
        { ...pendingUpdate, confirmationToken: 'confirmed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        message.success('套餐配置已更新');
        setEditModalVisible(false);
        setConfirmModalVisible(false);
        setPendingUpdate(null);
        fetchPlans();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleViewHistory = async (plan: Plan) => {
    setSelectedPlan(plan);
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${API_BASE_URL}/admin/products/${plan.id}/history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setConfigHistory(response.data.data);
        setHistoryModalVisible(true);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (historyId: number) => {
    Modal.confirm({
      title: '确认回滚',
      content: '确定要回滚到此配置吗？',
      onOk: async () => {
        try {
          const token = localStorage.getItem('auth_token');
          const response = await axios.post(
            `${API_BASE_URL}/admin/products/${selectedPlan?.id}/rollback`,
            { historyId, confirmationToken: 'confirmed' },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (response.data.success) {
            message.success('配置已回滚');
            setHistoryModalVisible(false);
            fetchPlans();
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '回滚失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '套餐名称',
      dataIndex: 'plan_name',
      key: 'plan_name',
      width: 150,
      fixed: 'left' as const,
      render: (text: string, record: Plan) => (
        <Space>
          {text}
          {!record.is_active && <Tag color="red">已停用</Tag>}
        </Space>
      )
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number | string) => `¥${parseFloat(String(price)).toFixed(2)}`
    },
    {
      title: '计费周期',
      dataIndex: 'billing_cycle',
      key: 'billing_cycle',
      width: 100,
      render: (cycle: string) => cycle === 'monthly' ? '月付' : cycle === 'yearly' ? '年付' : '一次性'
    },
    {
      title: '功能配额',
      key: 'features',
      width: 400,
      render: (_: any, record: Plan) => (
        <Space direction="vertical" size="small">
          {record.features.map(f => (
            <div key={f.feature_code}>
              {f.feature_name}: {f.feature_value === -1 ? '无限制' : f.feature_value}
            </div>
          ))}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Plan) => (
        <Space>
          <Tooltip title="编辑配置">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="查看历史">
            <Button
              type="link"
              icon={<HistoryOutlined />}
              onClick={() => handleViewHistory(record)}
            >
              历史
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '变更类型',
      dataIndex: 'change_type',
      key: 'change_type',
      render: (type: string) => {
        const typeMap: any = {
          price: '价格',
          feature: '功能配额',
          status: '状态',
          rollback: '回滚'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '字段',
      dataIndex: 'field_name',
      key: 'field_name'
    },
    {
      title: '旧值',
      dataIndex: 'old_value',
      key: 'old_value'
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value'
    },
    {
      title: '操作人',
      dataIndex: 'changed_by_name',
      key: 'changed_by_name'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: ConfigHistory) => (
        <Button
          type="link"
          icon={<RollbackOutlined />}
          onClick={() => handleRollback(record.id)}
        >
          回滚
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="商品管理" bordered={false}>
        <Table
          columns={columns}
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 编辑对话框 */}
      <Modal
        title={`编辑套餐 - ${selectedPlan?.plan_name}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleUpdate} layout="vertical">
          <Form.Item
            label="价格（元）"
            name="price"
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="启用状态" name="is_active" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>

          {selectedPlan?.features.map(feature => (
            <Form.Item
              key={feature.feature_code}
              label={`${feature.feature_name}（-1表示无限制）`}
              name={feature.feature_code}
              rules={[{ required: true, message: '请输入配额' }]}
            >
              <InputNumber min={-1} style={{ width: '100%' }} />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {/* 二次确认对话框 */}
      <Modal
        title="确认价格变更"
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        onOk={handleConfirmUpdate}
      >
        <p>价格变动超过20%，请确认是否继续？</p>
      </Modal>

      {/* 历史记录对话框 */}
      <Modal
        title={`配置历史 - ${selectedPlan?.plan_name}`}
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={1000}
      >
        <Table
          columns={historyColumns}
          dataSource={configHistory}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
};

export default ProductManagementPage;
