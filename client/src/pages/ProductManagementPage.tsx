import { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, InputNumber, Switch, 
  message, Card, Tag, Space, Timeline, Descriptions,
  Popconfirm, Select, Spin
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  HistoryOutlined, SettingOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;

interface PlanFeature {
  id?: number;
  featureCode: string;
  featureName: string;
  featureValue: number;
  featureUnit: string;
}

interface Plan {
  id: number;
  planCode: string;
  planName: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  durationDays: number;
  isActive: boolean;
  description?: string;
  displayOrder: number;
  features?: PlanFeature[];
  createdAt?: string;
  updatedAt?: string;
}

interface ConfigHistory {
  id: number;
  planId: number;
  planName: string;
  changedBy: number;
  changedByUsername: string;
  changeType: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
}

export default function ProductManagementPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<ConfigHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form] = Form.useForm();

  // 功能配额选项
  const featureOptions = [
    { code: 'articles_per_day', name: '每日生成文章数', unit: '篇' },
    { code: 'publish_per_day', name: '每日发布文章数', unit: '篇' },
    { code: 'platform_accounts', name: '可管理平台账号数', unit: '个' },
    { code: 'keyword_distillation', name: '关键词蒸馏数', unit: '个' }
  ];

  useEffect(() => {
    loadPlans();
  }, []);

  // 加载套餐列表
  const loadPlans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/admin/products/plans?include_inactive=true', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[ProductManagement] 加载套餐列表:', response.data);
      setPlans(response.data.data);
    } catch (error: any) {
      console.error('[ProductManagement] 加载套餐失败:', error);
      message.error(error.response?.data?.message || '加载套餐失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载配置历史
  const loadHistory = async (planId?: number) => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const url = planId 
        ? `/api/admin/products/history?plan_id=${planId}`
        : '/api/admin/products/history';
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(response.data.data.history);
    } catch (error: any) {
      message.error('加载历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 打开编辑模态框
  const handleEdit = (plan: Plan) => {
    console.log('[ProductManagement] 编辑套餐:', plan);
    console.log('[ProductManagement] 套餐功能配额:', plan.features);
    
    setCurrentPlan(plan);
    
    // 确保 features 数据完整
    const features = (plan.features || []).map(feature => ({
      featureCode: feature.featureCode,
      featureName: feature.featureName,
      featureValue: feature.featureValue,
      featureUnit: feature.featureUnit
    }));
    
    console.log('[ProductManagement] 设置表单 features:', features);
    
    form.setFieldsValue({
      planName: plan.planName,
      price: plan.price,
      billingCycle: plan.billingCycle,
      description: plan.description,
      displayOrder: plan.displayOrder,
      isActive: plan.isActive,
      features: features
    });
    
    setEditModalVisible(true);
  };

  // 保存修改
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (!currentPlan) return;

      console.log('[ProductManagement] 准备保存的数据:', values);

      const token = localStorage.getItem('auth_token');
      const response = await axios.put(`/api/admin/products/plans/${currentPlan.id}`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[ProductManagement] 保存成功:', response.data);
      message.success('套餐更新成功');
      setEditModalVisible(false);
      loadPlans();
    } catch (error: any) {
      console.error('[ProductManagement] 保存失败:', error);
      console.error('[ProductManagement] 错误详情:', error.response?.data);
      if (error.response) {
        message.error(error.response.data.message || '更新失败');
      } else {
        message.error('网络错误，请稍后重试');
      }
    }
  };

  // 删除套餐
  const handleDelete = async (planId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete(`/api/admin/products/plans/${planId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('套餐删除成功');
      loadPlans();
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 查看历史
  const handleViewHistory = (plan?: Plan) => {
    setHistoryModalVisible(true);
    loadHistory(plan?.id);
  };

  // 表格列定义
  const columns: ColumnsType<Plan> = [
    {
      title: '排序',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 80,
      sorter: (a, b) => a.displayOrder - b.displayOrder,
    },
    {
      title: '套餐名称',
      dataIndex: 'planName',
      key: 'planName',
      render: (text, record) => (
        <Space>
          <span className="font-semibold">{text}</span>
          <Tag color={record.planCode === 'free' ? 'default' : record.planCode === 'professional' ? 'blue' : 'gold'}>
            {record.planCode}
          </Tag>
        </Space>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price, record) => (
        <span className="text-lg font-bold text-red-600">
          ¥{price} / {record.billingCycle === 'monthly' ? '月' : '年'}
        </span>
      ),
    },
    {
      title: '功能配额',
      key: 'features',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          {record.features?.map((feature, index) => (
            <Tag key={feature.id || `${feature.featureCode}-${index}`} color="blue">
              {feature.featureName}: {feature.featureValue === -1 ? '无限制' : `${feature.featureValue} ${feature.featureUnit}`}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
          <Popconfirm
            title="确定要删除这个套餐吗？"
            description="删除后无法恢复，且正在使用的用户将无法访问。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card 
        title={
          <Space>
            <SettingOutlined />
            <span className="text-xl font-bold">商品管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={<HistoryOutlined />}
              onClick={() => handleViewHistory()}
            >
              查看所有历史
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              disabled
            >
              新增套餐
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 编辑模态框 */}
      <Modal
        title={`编辑套餐 - ${currentPlan?.planName}`}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="套餐名称"
            name="planName"
            rules={[{ required: true, message: '请输入套餐名称' }]}
          >
            <Input placeholder="例如：专业版" />
          </Form.Item>

          <Form.Item
            label="价格（元）"
            name="price"
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber 
              min={0} 
              precision={2}
              style={{ width: '100%' }}
              placeholder="例如：99.00"
            />
          </Form.Item>

          <Form.Item
            label="计费周期"
            name="billingCycle"
            rules={[{ required: true, message: '请选择计费周期' }]}
          >
            <Select>
              <Select.Option value="monthly">月付</Select.Option>
              <Select.Option value="yearly">年付</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={3} placeholder="套餐描述" />
          </Form.Item>

          <Form.Item
            label="显示顺序"
            name="displayOrder"
            tooltip="数字越小越靠前"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="启用状态"
            name="isActive"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>

          <Form.Item label="功能配额">
            <Form.List name="features">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card key={key} size="small" className="mb-2">
                      <Space align="baseline" style={{ width: '100%' }}>
                        <Form.Item
                          {...restField}
                          name={[name, 'featureCode']}
                          style={{ marginBottom: 0, width: 200 }}
                        >
                          <Select 
                            placeholder="选择功能"
                            onChange={(value) => {
                              const option = featureOptions.find(opt => opt.code === value);
                              if (option) {
                                const features = form.getFieldValue('features');
                                features[name] = {
                                  ...features[name],
                                  featureCode: value,
                                  featureName: option.name,
                                  featureUnit: option.unit
                                };
                                form.setFieldsValue({ features });
                              }
                            }}
                          >
                            {featureOptions.map(opt => (
                              <Select.Option key={opt.code} value={opt.code}>
                                {opt.name}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>

                        <Space.Compact style={{ width: 150 }}>
                          <Form.Item
                            {...restField}
                            name={[name, 'featureValue']}
                            style={{ marginBottom: 0, flex: 1 }}
                          >
                            <InputNumber 
                              placeholder="配额值" 
                              min={-1}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'featureUnit']}
                            style={{ marginBottom: 0 }}
                            hidden
                          >
                            <Input />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'featureName']}
                            style={{ marginBottom: 0 }}
                            hidden
                          >
                            <Input />
                          </Form.Item>
                          <span className="ant-input" style={{ width: 60, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
                            {form.getFieldValue(['features', name, 'featureUnit']) || '单位'}
                          </span>
                        </Space.Compact>

                        <Button 
                          type="link" 
                          danger
                          onClick={() => remove(name)}
                        >
                          删除
                        </Button>
                      </Space>
                      <div className="text-xs text-gray-500 mt-1">
                        提示：-1 表示无限制
                      </div>
                    </Card>
                  ))}
                  <Button 
                    type="dashed" 
                    onClick={() => add()} 
                    block
                    icon={<PlusOutlined />}
                  >
                    添加功能配额
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>

      {/* 历史记录模态框 */}
      <Modal
        title="配置变更历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={900}
      >
        <Spin spinning={historyLoading}>
          <Timeline
            items={history.map(item => ({
              children: (
                <Card size="small" className="mb-2">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="套餐">{item.planName}</Descriptions.Item>
                    <Descriptions.Item label="操作人">{item.changedByUsername}</Descriptions.Item>
                    <Descriptions.Item label="变更类型">
                      <Tag color="blue">{item.changeType}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="时间">
                      {new Date(item.createdAt).toLocaleString()}
                    </Descriptions.Item>
                    {item.oldValue && (
                      <Descriptions.Item label="旧值" span={2}>
                        <code className="text-xs bg-gray-100 p-1 rounded">
                          {item.oldValue.length > 100 ? item.oldValue.substring(0, 100) + '...' : item.oldValue}
                        </code>
                      </Descriptions.Item>
                    )}
                    {item.newValue && (
                      <Descriptions.Item label="新值" span={2}>
                        <code className="text-xs bg-gray-100 p-1 rounded">
                          {item.newValue.length > 100 ? item.newValue.substring(0, 100) + '...' : item.newValue}
                        </code>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              ),
            }))}
          />
        </Spin>
      </Modal>
    </div>
  );
}
