import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  AimOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { ipcBridge } from '../services/ipc';
import ResizableTable from '../components/ResizableTable';

const { TextArea } = Input;
const { Text } = Typography;

type ModalMode = 'create' | 'edit' | 'view';

type ConversionTarget = {
  id: number;
  company_name: string;
  industry?: string | null;
  website?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
};

export default function ConversionTargets() {
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

  const queryParams = useMemo(() => {
    return {
      page: currentPage,
      pageSize,
      search: searchKeyword || undefined,
      sortField,
      sortOrder: sortOrder === 'ascend' ? 'asc' : 'desc',
    } as const;
  }, [currentPage, pageSize, searchKeyword, sortField, sortOrder]);

  // 数据获取函数
  const loadTargets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipcBridge.getConversionTargets(queryParams);
      if (!res.success) throw new Error(res.error || '加载失败');

      const payload = res.data;
      if (!payload?.success) throw new Error(payload?.error || '加载失败');

      setTargets(payload.data.targets || []);
      setTotal(payload.data.total || 0);
    } catch (e: any) {
      console.error('加载转化目标失败:', e);
      message.error(e?.message || '加载转化目标失败');
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // 初始加载和依赖变化时重新加载
  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

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
      sorter: true,
      width: 150,
      align: 'center',
      render: (v?: string | null) => (v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">-</Text>),
    },
    {
      title: '官方网站',
      dataIndex: 'website',
      key: 'website',
      width: 200,
      align: 'center',
      render: (v?: string | null) =>
        v ? (
          <a href={v} target="_blank" rel="noreferrer">
            {v}
          </a>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '公司地址',
      dataIndex: 'address',
      key: 'address',
      width: 250,
      align: 'center',
      render: (v?: string | null) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 180,
      align: 'center',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      align: 'center',
      render: (_: any, record: ConversionTarget) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => onView(record)}>
            查看
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<ConversionTarget> | SorterResult<ConversionTarget>[]
  ) => {
    if (pagination.current) setCurrentPage(pagination.current);
    if (pagination.pageSize) setPageSize(pagination.pageSize);

    if (!Array.isArray(sorter) && sorter.field) {
      setSortField(String(sorter.field));
      setSortOrder((sorter.order as any) || 'descend');
    }
  };

  const onSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  const onCreate = () => {
    setModalMode('create');
    setSelectedTarget(null);
    form.resetFields();
    setModalVisible(true);
  };

  const onView = (record: ConversionTarget) => {
    setModalMode('view');
    setSelectedTarget(record);
    form.setFieldsValue({
      companyName: record.company_name,
      industry: record.industry || '',
      website: record.website || '',
      address: record.address || '',
    });
    setModalVisible(true);
  };

  const onEdit = (record: ConversionTarget) => {
    setModalMode('edit');
    setSelectedTarget(record);
    form.setFieldsValue({
      companyName: record.company_name,
      industry: record.industry || '',
      website: record.website || '',
      address: record.address || '',
    });
    setModalVisible(true);
  };

  const onDelete = (record: ConversionTarget) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除转化目标"${record.company_name}"吗？`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await ipcBridge.deleteConversionTarget(record.id);
          if (!res.success) throw new Error(res.error || '删除失败');
          const payload = res.data;
          if (!payload?.success) throw new Error(payload?.error || '删除失败');
          message.success('删除成功');
          loadTargets();
        } catch (e: any) {
          console.error('删除失败:', e);
          message.error(e?.message || '删除失败');
        }
      },
    });
  };

  const onSubmit = async () => {
    if (modalMode === 'view') {
      setModalVisible(false);
      return;
    }

    try {
      const values = await form.validateFields();
      const payload = {
        companyName: values.companyName,
        industry: values.industry || '',
        website: values.website || '',
        address: values.address || '',
      };

      if (modalMode === 'create') {
        const res = await ipcBridge.createConversionTarget(payload);
        if (!res.success) throw new Error(res.error || '创建失败');
        const apiPayload = res.data;
        if (!apiPayload?.success) throw new Error(apiPayload?.error || '创建失败');
        message.success('创建成功');
        setModalVisible(false);
        loadTargets();
      }

      if (modalMode === 'edit' && selectedTarget) {
        const res = await ipcBridge.updateConversionTarget(selectedTarget.id, payload);
        if (!res.success) throw new Error(res.error || '更新失败');
        const apiPayload = res.data;
        if (!apiPayload?.success) throw new Error(apiPayload?.error || '更新失败');
        message.success('更新成功');
        setModalVisible(false);
        loadTargets();
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      console.error('操作失败:', e);
      message.error(e?.message || '操作失败');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <AimOutlined />
            <span>转化目标管理</span>
          </Space>
        }
        extra={
          <Space wrap>
            <Input.Search
              placeholder="搜索公司名称或行业"
              allowClear
              onSearch={onSearch}
              style={{ width: 260 }}
              prefix={<SearchOutlined />}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              新建
            </Button>
          </Space>
        }
      >
        <ResizableTable<ConversionTarget>
          tableId="conversion-target-list"
          columns={columns}
          dataSource={targets || []}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: <Empty description="暂无转化目标" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      <Modal
        title={modalMode === 'create' ? '新建转化目标' : modalMode === 'edit' ? '编辑转化目标' : '查看转化目标'}
        open={modalVisible}
        onOk={onSubmit}
        onCancel={() => setModalVisible(false)}
        okText={modalMode === 'view' ? '关闭' : modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        cancelButtonProps={{ style: { display: modalMode === 'view' ? 'none' : 'inline-block' } }}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" disabled={modalMode === 'view'}>
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

          <Form.Item label="行业类型" name="industry" extra="可选，例如：教育、互联网、金融等">
            <Input placeholder="请输入行业类型（可选）" maxLength={100} />
          </Form.Item>

          <Form.Item
            label="官方网站"
            name="website"
            rules={[{ type: 'url', message: '请输入有效的网址' }]}
            extra="可选，必须以http://或https://开头"
          >
            <Input placeholder="请输入官方网站（可选）" />
          </Form.Item>

          <Form.Item label="公司地址" name="address" extra="可选，用于文章生成时引用真实地址">
            <TextArea
              placeholder="请输入公司地址（可选）\n例如：杭州市西湖区教工路123号"
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
