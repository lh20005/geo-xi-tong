import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  message,
  Space,
  Modal,
  Input,
  Form,
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
import type { TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import axios from 'axios';
import ResizableTable from '../components/ResizableTable';

const { TextArea } = Input;

// TypeScript 接口定义（简化后的结构）
interface ConversionTarget {
  id: number;
  company_name: string;
  industry?: string;
  website?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

type ModalMode = 'create' | 'edit' | 'view';

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
  const columns: any = [
    {
      title: '公司名称',
      dataIndex: 'company_name',
      key: 'company_name',
      sorter: true,
      width: 200,
      align: 'center',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '行业类型',
      dataIndex: 'industry',
      key: 'industry',
      width: 150,
      align: 'center',
      render: (industry?: string) => 
        industry ? <Tag color="blue">{industry}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '官方网站',
      dataIndex: 'website',
      key: 'website',
      width: 200,
      align: 'center',
      render: (website?: string) =>
        website ? (
          <a href={website} target="_blank" rel="noopener noreferrer">
            {website}
          </a>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '公司地址',
      dataIndex: 'address',
      key: 'address',
      width: 250,
      align: 'center',
      render: (address?: string) => address || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 180,
      align: 'center',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      align: 'center',
      render: (_: any, record: ConversionTarget) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
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

  // 处理表格变化
  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<ConversionTarget> | SorterResult<ConversionTarget>[]
  ) => {
    if (pagination.current) setCurrentPage(pagination.current);
    if (pagination.pageSize) setPageSize(pagination.pageSize);

    if (!Array.isArray(sorter) && sorter.field) {
      setSortField(sorter.field as string);
      setSortOrder(sorter.order || 'descend');
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  // 新建
  const handleCreate = () => {
    setModalMode('create');
    setSelectedTarget(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 查看
  const handleView = (record: ConversionTarget) => {
    setModalMode('view');
    setSelectedTarget(record);
    form.setFieldsValue({
      companyName: record.company_name,
      industry: record.industry,
      website: record.website,
      address: record.address,
    });
    setModalVisible(true);
  };

  // 编辑
  const handleEdit = (record: ConversionTarget) => {
    setModalMode('edit');
    setSelectedTarget(record);
    form.setFieldsValue({
      companyName: record.company_name,
      industry: record.industry,
      website: record.website,
      address: record.address,
    });
    setModalVisible(true);
  };

  // 删除
  const handleDelete = (record: ConversionTarget) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除转化目标"${record.company_name}"吗？`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/conversion-targets/${record.id}`);
          if (response.data.success) {
            message.success('删除成功');
            loadConversionTargets();
          }
        } catch (error: any) {
          console.error('删除失败:', error);
          message.error(error.response?.data?.error || '删除失败');
        }
      },
    });
  };

  // 提交表单
  const handleSubmit = async () => {
    if (modalMode === 'view') {
      setModalVisible(false);
      return;
    }

    try {
      const values = await form.validateFields();
      
      const data = {
        companyName: values.companyName,
        industry: values.industry || '',
        website: values.website || '',
        address: values.address || '',
      };

      if (modalMode === 'create') {
        const response = await axios.post('/api/conversion-targets', data);
        if (response.data.success) {
          message.success('创建成功');
          setModalVisible(false);
          loadConversionTargets();
        }
      } else if (modalMode === 'edit' && selectedTarget) {
        const response = await axios.patch(`/api/conversion-targets/${selectedTarget.id}`, data);
        if (response.data.success) {
          message.success('更新成功');
          setModalVisible(false);
          loadConversionTargets();
        }
      }
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      console.error('操作失败:', error);
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <AimOutlined />
            <span>转化目标管理</span>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="搜索公司名称或行业"
              allowClear
              onSearch={handleSearch}
              style={{ width: 250 }}
              prefix={<SearchOutlined />}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建转化目标
            </Button>
          </Space>
        }
      >
        <ResizableTable<ConversionTarget>
          tableId="conversion-target-list"
          columns={columns}
          dataSource={targets}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无转化目标"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* 新建/编辑/查看模态框 */}
      <Modal
        title={
          modalMode === 'create'
            ? '新建转化目标'
            : modalMode === 'edit'
            ? '编辑转化目标'
            : '查看转化目标'
        }
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={modalMode === 'view' ? '关闭' : modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        cancelButtonProps={{ style: { display: modalMode === 'view' ? 'none' : 'inline-block' } }}
        width={600}
        destroyOnHidden
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
              { min: 2, message: '公司名称至少2个字符' },
              { max: 255, message: '公司名称不能超过255个字符' },
            ]}
          >
            <Input placeholder="请输入公司名称（必填）" maxLength={255} />
          </Form.Item>

          <Form.Item
            label="行业类型"
            name="industry"
            extra="可选，例如：教育、互联网、金融等"
          >
            <Input placeholder="请输入行业类型（可选）" maxLength={100} />
          </Form.Item>

          <Form.Item
            label="官方网站"
            name="website"
            rules={[
              { type: 'url', message: '请输入有效的网址' },
            ]}
            extra="可选，必须以http://或https://开头"
          >
            <Input placeholder="请输入官方网站（可选）" />
          </Form.Item>

          <Form.Item
            label="公司地址"
            name="address"
            extra="可选，用于文章生成时引用真实地址"
          >
            <TextArea
              placeholder="请输入公司地址（可选）&#10;例如：杭州市西湖区教工路123号"
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
