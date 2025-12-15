import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  message,
  Space,
  Modal,
  Input,
  Form,
  Select,
  Empty,
  Tag,
} from 'antd';
import {
  AimOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { TableProps, TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import axios from 'axios';

const { TextArea } = Input;

// TypeScript 接口定义
interface ConversionTarget {
  id: number;
  company_name: string;
  industry: string;
  company_size: string;
  features?: string;
  contact_info: string;
  website?: string;
  target_audience?: string;
  core_products?: string;
  created_at: string;
  updated_at: string;
}

type ModalMode = 'create' | 'edit' | 'view';

// 行业选项
const INDUSTRY_OPTIONS = [
  '互联网',
  '金融',
  '制造业',
  '教育',
  '医疗',
  '零售',
  '其他',
];

// 公司规模选项
const COMPANY_SIZE_OPTIONS = [
  '1-50人',
  '51-200人',
  '201-500人',
  '501-1000人',
  '1000人以上',
];

export default function ConversionTargetPage() {
  // 状态管理
  const [targets, setTargets] = useState<ConversionTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('descend');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedTarget, setSelectedTarget] = useState<ConversionTarget | null>(null);
  const [form] = Form.useForm();

  // 加载数据
  useEffect(() => {
    loadConversionTargets();
  }, [currentPage, pageSize, searchKeyword, sortField, sortOrder]);

  const loadConversionTargets = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/conversion-targets', {
        params: {
          page: currentPage,
          pageSize,
          search: searchKeyword,
          sortField,
          sortOrder: sortOrder === 'ascend' ? 'asc' : 'desc',
        },
      });

      if (response.data.success) {
        setTargets(response.data.data.targets);
        setTotal(response.data.data.total);
      }
    } catch (error: any) {
      console.error('加载转化目标失败:', error);
      message.error('加载转化目标失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns: TableProps<ConversionTarget>['columns'] = [
    {
      title: '公司名称',
      dataIndex: 'company_name',
      key: 'company_name',
      sorter: true,
      width: 200,
    },
    {
      title: '行业类型',
      dataIndex: 'industry',
      key: 'industry',
      sorter: true,
      width: 120,
      render: (industry: string) => <Tag color="blue">{industry}</Tag>,
    },
    {
      title: '公司规模',
      dataIndex: 'company_size',
      key: 'company_size',
      sorter: true,
      width: 120,
      render: (size: string) => <Tag color="green">{size}</Tag>,
    },
    {
      title: '联系方式',
      dataIndex: 'contact_info',
      key: 'contact_info',
      width: 180,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
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

  // 处理表格变化（分页、排序）
  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<ConversionTarget> | SorterResult<ConversionTarget>[]
  ) => {
    if (pagination.current) {
      setCurrentPage(pagination.current);
    }
    if (pagination.pageSize) {
      setPageSize(pagination.pageSize);
    }

    // 处理排序
    if (!Array.isArray(sorter) && sorter.field) {
      setSortField(sorter.field as string);
      setSortOrder(sorter.order || 'descend');
    }
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 打开创建对话框
  const handleCreate = () => {
    setModalMode('create');
    setSelectedTarget(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开查看对话框
  const handleView = (record: ConversionTarget) => {
    setModalMode('view');
    setSelectedTarget(record);
    form.setFieldsValue({
      companyName: record.company_name,
      industry: record.industry,
      companySize: record.company_size,
      features: record.features,
      contactInfo: record.contact_info,
      website: record.website,
      targetAudience: record.target_audience,
      coreProducts: record.core_products,
    });
    setModalVisible(true);
  };

  // 打开编辑对话框
  const handleEdit = (record: ConversionTarget) => {
    setModalMode('edit');
    setSelectedTarget(record);
    form.setFieldsValue({
      companyName: record.company_name,
      industry: record.industry,
      companySize: record.company_size,
      features: record.features,
      contactInfo: record.contact_info,
      website: record.website,
      targetAudience: record.target_audience,
      coreProducts: record.core_products,
    });
    setModalVisible(true);
  };

  // 处理删除
  const handleDelete = (record: ConversionTarget) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除转化目标"${record.company_name}"吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`/api/conversion-targets/${record.id}`);
          message.success('删除成功');
          loadConversionTargets();
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除失败');
        }
      },
    });
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (modalMode === 'create') {
        await axios.post('/api/conversion-targets', values);
        message.success('创建成功');
      } else if (modalMode === 'edit' && selectedTarget) {
        await axios.patch(`/api/conversion-targets/${selectedTarget.id}`, values);
        message.success('更新成功');
      }

      setModalVisible(false);
      form.resetFields();
      loadConversionTargets();
    } catch (error: any) {
      if (error.response?.data?.code === 'DUPLICATE_ENTRY') {
        message.error('公司名称已存在');
      } else if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 关闭对话框
  const handleCancel = () => {
    setModalVisible(false);
    form.resetFields();
    setSelectedTarget(null);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <AimOutlined style={{ color: '#1890ff' }} />
            <span>转化目标管理</span>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="搜索公司名称或行业"
              allowClear
              style={{ width: 250 }}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新增转化目标
            </Button>
          </Space>
        }
        bordered={false}
      >
        <Table
          columns={columns}
          dataSource={targets}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无转化目标"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <p style={{ color: '#64748b' }}>
                  点击"新增转化目标"按钮来创建第一个转化目标
                </p>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* 表单对话框 */}
      <Modal
        title={
          modalMode === 'create'
            ? '新增转化目标'
            : modalMode === 'edit'
            ? '编辑转化目标'
            : '查看转化目标'
        }
        open={modalVisible}
        onOk={modalMode === 'view' ? handleCancel : handleSubmit}
        onCancel={handleCancel}
        confirmLoading={loading}
        okText={modalMode === 'view' ? '关闭' : '保存'}
        cancelText="取消"
        width={720}
        cancelButtonProps={{ style: { display: modalMode === 'view' ? 'none' : 'inline-block' } }}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={modalMode === 'view'}
        >
          <Form.Item
            label="公司名称"
            name="companyName"
            rules={[
              { required: true, message: '请输入公司名称' },
              { min: 2, max: 255, message: '公司名称长度为2-255字符' },
            ]}
          >
            <Input placeholder="请输入公司名称" />
          </Form.Item>

          <Form.Item
            label="行业类型"
            name="industry"
            rules={[{ required: true, message: '请选择行业类型' }]}
          >
            <Select placeholder="请选择行业类型">
              {INDUSTRY_OPTIONS.map((option) => (
                <Select.Option key={option} value={option}>
                  {option}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="公司规模"
            name="companySize"
            rules={[{ required: true, message: '请选择公司规模' }]}
          >
            <Select placeholder="请选择公司规模">
              {COMPANY_SIZE_OPTIONS.map((option) => (
                <Select.Option key={option} value={option}>
                  {option}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="联系方式"
            name="contactInfo"
            rules={[
              { required: true, message: '请输入联系方式' },
              {
                pattern: /^1[3-9]\d{9}$|^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/,
                message: '请输入有效的手机号或邮箱',
              },
            ]}
          >
            <Input placeholder="请输入手机号或邮箱" />
          </Form.Item>

          <Form.Item
            label="官方网站"
            name="website"
            rules={[
              {
                type: 'url',
                message: '请输入有效的网址（以http://或https://开头）',
              },
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item
            label="公司特色"
            name="features"
            rules={[{ max: 1000, message: '公司特色不能超过1000字符' }]}
          >
            <TextArea
              rows={3}
              placeholder="请描述公司的特色和优势"
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="目标客户群"
            name="targetAudience"
            rules={[{ max: 500, message: '目标客户群不能超过500字符' }]}
          >
            <TextArea
              rows={2}
              placeholder="请描述目标客户群体"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="核心产品服务"
            name="coreProducts"
            rules={[{ max: 1000, message: '核心产品服务不能超过1000字符' }]}
          >
            <TextArea
              rows={3}
              placeholder="请描述核心产品和服务"
              maxLength={1000}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
