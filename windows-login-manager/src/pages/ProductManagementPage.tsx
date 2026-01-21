import { useState, useEffect, useCallback } from 'react';
import { 
  Table, Button, Modal, Form, Input, InputNumber, Switch, 
  message, Card, Tag, Space, Timeline, Descriptions,
  Popconfirm, Select, Spin, Statistic, Row, Col, Tooltip
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  HistoryOutlined, SettingOutlined, ShoppingOutlined,
  DollarOutlined, UserOutlined, RocketOutlined, ReloadOutlined
} from '@ant-design/icons';
import { apiClient } from '../api/client';
import { ensureTokensSync } from '../utils/tokenSync';
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
  planType?: 'base' | 'booster';              // 套餐类型
  price: number;
  billingCycle: 'monthly' | 'yearly';        // 计费周期（前端价格显示）
  quotaCycleType: 'monthly' | 'yearly';      // 配额重置周期
  durationDays: number;
  validityPeriod: 'monthly' | 'yearly' | 'permanent';  // 套餐有效期类型
  isActive: boolean;
  description?: string;
  displayOrder: number;
  agentDiscountRate?: number; // 代理商折扣比例（1-100）
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

interface BoosterStats {
  planId: number;
  planName: string;
  planCode: string;
  price: number;
  totalSold: number;
  activeCount: number;
  activeRevenue: number;
  totalRevenue: number;
}

// 功能配额选项
const featureOptions = [
  { code: 'articles_per_month', name: '每月生成文章数', unit: '篇' },
  { code: 'publish_per_month', name: '每月发布文章数', unit: '篇' },
  { code: 'platform_accounts', name: '可管理平台账号数', unit: '个' },
  { code: 'keyword_distillation', name: '关键词蒸馏数', unit: '个' },
  { code: 'storage_space', name: '存储空间', unit: 'MB' }
];

const ProductManagementPage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [boosterStats, setBoosterStats] = useState<BoosterStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [boosterStatsLoading, setBoosterStatsLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<ConfigHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [planTypeFilter, setPlanTypeFilter] = useState<'all' | 'base' | 'booster'>('all');
  const [form] = Form.useForm();

  // 套餐列表获取函数
  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      await ensureTokensSync();
      let url = '/admin/products/plans?include_inactive=true';
      if (planTypeFilter !== 'all') {
        url += `&plan_type=${planTypeFilter}`;
      }
      const response = await apiClient.get(url);
      setPlans(response.data.data || []);
    } catch (error) {
      console.error('加载套餐失败:', error);
      message.error('加载套餐失败');
    } finally {
      setLoading(false);
    }
  }, [planTypeFilter]);

  // 加量包统计获取函数
  const loadBoosterStats = useCallback(async () => {
    setBoosterStatsLoading(true);
    try {
      const response = await apiClient.get('/admin/products/booster-stats');
      setBoosterStats(response.data.data || []);
    } catch (error) {
      console.error('加载加量包统计失败:', error);
    } finally {
      setBoosterStatsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadPlans();
    loadBoosterStats();
  }, [loadPlans, loadBoosterStats]);

  // 刷新数据的辅助函数
  const refreshData = useCallback(async () => {
    await Promise.all([loadPlans(), loadBoosterStats()]);
  }, [loadPlans, loadBoosterStats]);

  // 加载配置历史
  const loadHistory = async (planId?: number) => {
    setHistoryLoading(true);
    try {
      const url = planId 
        ? `/admin/products/history?plan_id=${planId}`
        : '/admin/products/history';
      const response = await apiClient.get(url);
      setHistory(response.data.data?.history || []);
    } catch (error: any) {
      message.error('加载历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 打开新增模态框
  const handleCreate = () => {
    setCurrentPlan(null);
    form.resetFields();
    form.setFieldsValue({
      planName: '',
      planCode: '',
      planType: 'base',
      price: 0,
      billingCycle: 'monthly',
      quotaCycleType: 'monthly',
      validityPeriod: 'monthly',
      durationDays: 30,
      description: '',
      displayOrder: (plans || []).length + 1,
      isActive: true,
      agentDiscountRate: 100,
      features: []
    });
    setEditModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (plan: Plan) => {
    console.log('[ProductManagement] 编辑套餐:', plan);
    console.log('[ProductManagement] 套餐功能配额:', plan.features);
    
    setCurrentPlan(plan);
    
    // 确保 features 数据完整，并统一单位为 MB
    const features = (plan.features || []).map(feature => {
      let featureValue = feature.featureValue;
      let featureUnit = feature.featureUnit;
      
      // 如果是存储空间且单位是 bytes，转换为 MB
      if (feature.featureCode === 'storage_space' && feature.featureUnit === 'bytes') {
        if (featureValue !== -1) {
          featureValue = Math.round((featureValue / (1024 * 1024)) * 100) / 100;
        }
        featureUnit = 'MB';
      }
      
      return {
        featureCode: feature.featureCode,
        featureName: feature.featureName,
        featureValue: featureValue,
        featureUnit: featureUnit
      };
    });
    
    console.log('[ProductManagement] 设置表单 features:', features);
    
    // 计算 validityPeriod
    let validityPeriod: 'monthly' | 'yearly' | 'permanent';
    if (plan.durationDays >= 36500) {
      validityPeriod = 'permanent';
    } else if (plan.durationDays >= 365) {
      validityPeriod = 'yearly';
    } else {
      validityPeriod = 'monthly';
    }
    
    form.setFieldsValue({
      planName: plan.planName,
      planType: plan.planType || 'base',
      price: plan.price,
      billingCycle: plan.billingCycle,
      quotaCycleType: plan.quotaCycleType || plan.billingCycle || 'monthly',
      validityPeriod: validityPeriod,
      description: plan.description,
      displayOrder: plan.displayOrder,
      isActive: plan.isActive,
      agentDiscountRate: plan.agentDiscountRate || 100,
      features: features
    });
    
    setEditModalVisible(true);
  };

  // 保存修改或新增
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 确保存储空间的单位是 MB
      if (values.features) {
        values.features = values.features.map((feature: any) => {
          if (feature.featureCode === 'storage_space' && !feature.featureUnit) {
            return { ...feature, featureUnit: 'MB' };
          }
          return feature;
        });
      }
      
      // 确保 agentDiscountRate 是整数
      if (values.agentDiscountRate !== undefined) {
        values.agentDiscountRate = Math.round(values.agentDiscountRate);
      }
      
      console.log('[ProductManagement] 准备保存的数据:', values);
      
      if (currentPlan) {
        const response = await apiClient.put(`/admin/products/plans/${currentPlan.id}`, values);
        console.log('[ProductManagement] 更新成功:', response.data);
        message.success('套餐更新成功');
      } else {
        const response = await apiClient.post('/admin/products/plans', values);
        console.log('[ProductManagement] 新增成功:', response.data);
        message.success('套餐新增成功');
      }
      
      setEditModalVisible(false);
      refreshData();
    } catch (error: any) {
      console.error('[ProductManagement] 保存失败:', error);
      if (error.response) {
        message.error(error.response.data.message || (currentPlan ? '更新失败' : '新增失败'));
      } else if (error.errorFields) {
        // 表单验证错误
        return;
      } else {
        message.error('网络错误，请稍后重试');
      }
    }
  };

  // 删除套餐
  const handleDelete = async (planId: number) => {
    try {
      await apiClient.delete(`/admin/products/plans/${planId}`);
      message.success('套餐删除成功');
      refreshData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 查看历史
  const handleViewHistory = (plan?: Plan) => {
    setCurrentPlan(plan || null);
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
          <span style={{ fontWeight: 600 }}>{text}</span>
          <Tag color={record.planCode === 'free' ? 'default' : record.planCode === 'professional' ? 'blue' : 'gold'}>
            {record.planCode}
          </Tag>
          {record.planType === 'booster' && (
            <Tag color="purple">加量包</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'planType',
      key: 'planType',
      width: 100,
      render: (planType) => (
        <Tag color={planType === 'booster' ? 'purple' : 'cyan'}>
          {planType === 'booster' ? '加量包' : '基础套餐'}
        </Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price, record) => (
        <span style={{ fontSize: 16, fontWeight: 'bold', color: '#cf1322' }}>
          ¥{price} / {record.billingCycle === 'monthly' ? '月' : '年'}
        </span>
      ),
    },
    {
      title: '代理商折扣',
      dataIndex: 'agentDiscountRate',
      key: 'agentDiscountRate',
      width: 120,
      render: (rate) => {
        const discountRate = rate || 100;
        if (discountRate >= 100) {
          return <Tag>无折扣</Tag>;
        }
        const discountDisplay = discountRate / 10;
        return <Tag color="orange">{discountDisplay}折</Tag>;
      },
    },
    {
      title: '功能配额',
      key: 'features',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          {record.features?.map((feature, index) => {
            let displayValue = feature.featureValue === -1 ? '无限制' : `${feature.featureValue} ${feature.featureUnit}`;
            if (feature.featureCode === 'storage_space' && feature.featureValue >= 1024 && feature.featureValue !== -1) {
              displayValue = `${(feature.featureValue / 1024).toFixed(0)} GB`;
            }
            return (
              <Tag key={feature.id || `${feature.featureCode}-${index}`} color="blue">
                {feature.featureName}: {displayValue}
              </Tag>
            );
          })}
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
          <Tooltip title="编辑">
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="历史">
            <Button type="link" icon={<HistoryOutlined />} onClick={() => handleViewHistory(record)}>
              历史
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要删除这个套餐吗？"
            description="删除后无法恢复，且正在使用的用户将无法访问。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 加量包统计卡片 */}
      {(planTypeFilter === 'all' || planTypeFilter === 'booster') && boosterStats && boosterStats.length > 0 && (
        <Card 
          title={
            <Space>
              <RocketOutlined />
              <span>加量包销售统计</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          loading={boosterStatsLoading}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总销售数量"
                value={(boosterStats || []).reduce((sum, s) => sum + s.totalSold, 0)}
                prefix={<ShoppingOutlined />}
                suffix="份"
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="活跃加量包"
                value={(boosterStats || []).reduce((sum, s) => sum + s.activeCount, 0)}
                prefix={<UserOutlined />}
                suffix="份"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总收入"
                value={(boosterStats || []).reduce((sum, s) => sum + s.totalRevenue, 0)}
                prefix={<DollarOutlined />}
                precision={2}
                suffix="元"
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="活跃收入"
                value={(boosterStats || []).reduce((sum, s) => sum + s.activeRevenue, 0)}
                prefix={<DollarOutlined />}
                precision={2}
                suffix="元"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Card 
        title={
          <Space>
            <SettingOutlined />
            <span style={{ fontSize: 18, fontWeight: 'bold' }}>商品管理</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              value={planTypeFilter}
              onChange={(value) => setPlanTypeFilter(value)}
              style={{ width: 140 }}
            >
              <Select.Option value="all">全部类型</Select.Option>
              <Select.Option value="base">基础套餐</Select.Option>
              <Select.Option value="booster">加量包</Select.Option>
            </Select>
            <Tooltip title="刷新数据">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={refreshData}
              />
            </Tooltip>
            <Button icon={<HistoryOutlined />} onClick={() => handleViewHistory()}>
              查看所有历史
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新增套餐
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={plans || []}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 编辑/新增模态框 */}
      <Modal
        title={currentPlan ? `编辑套餐 - ${currentPlan.planName}` : '新增套餐'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {!currentPlan && (
            <Form.Item
              label="套餐代码"
              name="planCode"
              rules={[
                { required: true, message: '请输入套餐代码' },
                { pattern: /^[a-z_]+$/, message: '只能使用小写字母和下划线' }
              ]}
              tooltip="套餐的唯一标识，如：free, professional, enterprise"
            >
              <Input placeholder="例如：professional" />
            </Form.Item>
          )}

          <Form.Item
            label="套餐类型"
            name="planType"
            rules={[{ required: true, message: '请选择套餐类型' }]}
            tooltip="基础套餐是用户的主订阅，加量包是额外配额补充"
          >
            <Select disabled={!!currentPlan}>
              <Select.Option value="base">基础套餐</Select.Option>
              <Select.Option value="booster">加量包</Select.Option>
            </Select>
          </Form.Item>

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
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="例如：99.00" />
          </Form.Item>

          <Form.Item
            label="计费周期"
            name="billingCycle"
            rules={[{ required: true, message: '请选择计费周期' }]}
            tooltip="用于前端价格显示，如 ¥99/月 或 ¥999/年"
          >
            <Select>
              <Select.Option value="monthly">月付</Select.Option>
              <Select.Option value="yearly">年付</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="套餐重置周期"
            name="quotaCycleType"
            rules={[{ required: true, message: '请选择套餐重置周期' }]}
            tooltip="控制用户配额的重置周期，月度表示每月重置，年度表示每年重置"
          >
            <Select>
              <Select.Option value="monthly">月度（每月重置配额）</Select.Option>
              <Select.Option value="yearly">年度（每年重置配额）</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="套餐有效期"
            name="validityPeriod"
            rules={[{ required: true, message: '请选择套餐有效期' }]}
            tooltip="套餐购买后的有效期，到期后套餐关闭，恢复到免费版配额"
          >
            <Select>
              <Select.Option value="monthly">月度（30天）</Select.Option>
              <Select.Option value="yearly">年度（365天）</Select.Option>
              <Select.Option value="permanent">永久（不过期）</Select.Option>
            </Select>
          </Form.Item>

          {!currentPlan && (
            <Form.Item
              label="有效天数"
              name="durationDays"
              rules={[{ required: true, message: '请输入有效天数' }]}
              tooltip="套餐购买后的有效期，单位：天（选择套餐有效期后会自动计算）"
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：30" />
            </Form.Item>
          )}

          <Form.Item label="描述" name="description">
            <TextArea rows={3} placeholder="套餐描述" />
          </Form.Item>

          <Form.Item label="显示顺序" name="displayOrder" tooltip="数字越小越靠前">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="代理商折扣"
            name="agentDiscountRate"
            tooltip="被代理商邀请的新用户首次购买时享受的折扣。100表示无折扣，80表示8折（支付原价的80%）"
            rules={[{ type: 'number', min: 1, max: 100, message: '折扣比例必须在1-100之间' }]}
          >
            <InputNumber 
              min={1} 
              max={100}
              precision={0}
              style={{ width: '100%' }}
              placeholder="100表示无折扣，80表示8折"
              addonAfter="%"
              parser={(value) => {
                const parsed = parseInt(value || '100', 10);
                return isNaN(parsed) ? 100 : parsed;
              }}
            />
          </Form.Item>
          <div style={{ fontSize: 12, color: '#999', marginTop: -16, marginBottom: 16, marginLeft: 4 }}>
            示例：80 表示 8 折，用户支付原价的 80%
          </div>

          <Form.Item label="启用状态" name="isActive" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>

          <Form.Item label="功能配额">
            <Form.List name="features">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card key={key} size="small" style={{ marginBottom: 8 }}>
                      <Space align="baseline" style={{ width: '100%' }}>
                        <Form.Item {...restField} name={[name, 'featureCode']} style={{ marginBottom: 0, width: 200 }}>
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
                          <Form.Item {...restField} name={[name, 'featureValue']} style={{ marginBottom: 0, flex: 1 }}>
                            <InputNumber placeholder="配额值" min={-1} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'featureUnit']} style={{ marginBottom: 0 }} hidden>
                            <Input />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'featureName']} style={{ marginBottom: 0 }} hidden>
                            <Input />
                          </Form.Item>
                          <span style={{ 
                            display: 'inline-block', 
                            width: 60, 
                            textAlign: 'center', 
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #d9d9d9',
                            borderLeft: 'none',
                            borderRadius: '0 6px 6px 0',
                            lineHeight: '30px'
                          }}>
                            {form.getFieldValue(['features', name, 'featureUnit']) || '单位'}
                          </span>
                        </Space.Compact>

                        <Button type="link" danger onClick={() => remove(name)}>
                          删除
                        </Button>
                      </Space>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        提示：-1 表示无限制
                      </div>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
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
        title={currentPlan ? `配置变更历史 - ${currentPlan.planName}` : '所有配置变更历史'}
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={900}
      >
        <Spin spinning={historyLoading}>
          <Timeline
            items={history.map(item => ({
              children: (
                <Card size="small" style={{ marginBottom: 8 }}>
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
                        <code style={{ fontSize: 12, backgroundColor: '#f5f5f5', padding: 4, borderRadius: 4 }}>
                          {item.oldValue.length > 100 ? item.oldValue.substring(0, 100) + '...' : item.oldValue}
                        </code>
                      </Descriptions.Item>
                    )}
                    {item.newValue && (
                      <Descriptions.Item label="新值" span={2}>
                        <code style={{ fontSize: 12, backgroundColor: '#f5f5f5', padding: 4, borderRadius: 4 }}>
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
};

export default ProductManagementPage;
