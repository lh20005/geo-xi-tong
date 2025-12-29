import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, InputNumber, message, Card, Statistic, Tag, Tabs } from 'antd';
import { EditOutlined, HistoryOutlined, DollarOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';

interface Plan {
  id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  is_active: boolean;
  features: {
    feature_code: string;
    feature_name: string;
    feature_value: number;
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
}

export default function PlanManagementPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [configHistory, setConfigHistory] = useState<ConfigHistory[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/subscription/plans', {
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
      ...plan.features.reduce((acc, feature) => {
        acc[feature.feature_code] = feature.feature_value;
        return acc;
      }, {} as any)
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values: any) => {
    if (!selectedPlan) return;

    try {
      const token = localStorage.getItem('auth_token');
      
      // 构建更新数据
      const updateData: any = {
        price: values.price
      };

      // 添加功能配额
      const features = selectedPlan.features.map(feature => ({
        feature_code: feature.feature_code,
        feature_value: values[feature.feature_code]
      }));

      if (features.length > 0) {
        updateData.features = features;
      }

      const response = await axios.put(
        `/api/admin/plans/${selectedPlan.id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        message.success('套餐更新成功');
        setEditModalVisible(false);
        fetchPlans();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新套餐失败');
    }
  };

  const handleViewHistory = async (plan: Plan) => {
    setSelectedPlan(plan);
    setLoading(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `/api/admin/plans/${plan.id}/history`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setConfigHistory(response.data.data);
        setHistoryModalVisible(true);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取配置历史失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '套餐名称',
      dataIndex: 'plan_name',
      key: 'plan_name',
      render: (text: string, record: Plan) => (
        <div>
          <div className="font-semibold">{text}</div>
          <div className="text-xs text-gray-500">{record.plan_code}</div>
        </div>
      )
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => (
        <span className="text-lg font-bold text-red-600">¥{price}</span>
      )
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '功能配额',
      key: 'features',
      render: (_: any, record: Plan) => (
        <div className="space-y-1">
          {record.features.map(feature => (
            <div key={feature.feature_code} className="text-xs">
              <span className="text-gray-600">{feature.feature_name}:</span>
              <span className="ml-2 font-semibold">
                {feature.feature_value === -1 ? '不限' : feature.feature_value}
              </span>
            </div>
          ))}
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Plan) => (
        <div className="space-x-2">
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            icon={<HistoryOutlined />}
            size="small"
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
        </div>
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
        return <Tag>{typeMap[type] || type}</Tag>;
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
      key: 'new_value',
      render: (value: string) => (
        <span className="font-semibold text-blue-600">{value}</span>
      )
    },
    {
      title: '操作人',
      dataIndex: 'changed_by_name',
      key: 'changed_by_name'
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">套餐管理</h1>
        <p className="text-gray-600">管理系统套餐价格和功能配额</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <Statistic
            title="总套餐数"
            value={plans.length}
            prefix={<SettingOutlined />}
          />
        </Card>
        <Card>
          <Statistic
            title="启用套餐"
            value={plans.filter(p => p.is_active).length}
            valueStyle={{ color: '#3f8600' }}
          />
        </Card>
        <Card>
          <Statistic
            title="总收入潜力"
            value={plans.reduce((sum, p) => sum + p.price, 0)}
            prefix={<DollarOutlined />}
            suffix="元/月"
          />
        </Card>
      </div>

      {/* 套餐列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 编辑套餐弹窗 */}
      <Modal
        title={`编辑套餐 - ${selectedPlan?.plan_name}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleUpdate} layout="vertical">
          <Form.Item
            label="价格（元/月）"
            name="price"
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入价格"
            />
          </Form.Item>

          {selectedPlan?.features.map(feature => (
            <Form.Item
              key={feature.feature_code}
              label={feature.feature_name}
              name={feature.feature_code}
              rules={[{ required: true, message: `请输入${feature.feature_name}` }]}
            >
              <InputNumber
                min={-1}
                style={{ width: '100%' }}
                placeholder="-1表示不限"
              />
            </Form.Item>
          ))}

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
            <strong>注意：</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>价格变动超过20%需要二次确认</li>
              <li>配额设置为 -1 表示不限制</li>
              <li>所有变更都会记录到历史中</li>
            </ul>
          </div>
        </Form>
      </Modal>

      {/* 配置历史弹窗 */}
      <Modal
        title={`配置历史 - ${selectedPlan?.plan_name}`}
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={900}
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
}
