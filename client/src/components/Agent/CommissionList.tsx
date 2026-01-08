/**
 * 佣金明细列表组件
 */

import { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, DatePicker, Select, Button, message } from 'antd';
import { ReloadOutlined, DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Commission, CommissionStatus, getCommissions, PaginatedResult } from '../../api/agent';

const { RangePicker } = DatePicker;

interface CommissionListProps {
  agentId?: number;
}

const statusMap: Record<CommissionStatus, { text: string; color: string }> = {
  pending: { text: '待结算', color: 'orange' },
  settled: { text: '已结算', color: 'green' },
  cancelled: { text: '已取消', color: 'default' },
  refunded: { text: '已退款', color: 'red' }
};

export const CommissionList: React.FC<CommissionListProps> = () => {
  const [data, setData] = useState<PaginatedResult<Commission>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 10
  });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{
    status?: CommissionStatus;
    startDate?: string;
    endDate?: string;
  }>({});

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const result = await getCommissions({
        ...filters,
        page,
        pageSize
      });
      setData(result);
    } catch (error: any) {
      message.error('获取佣金列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const columns: ColumnsType<Commission> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120
    },
    {
      title: '套餐',
      dataIndex: 'planName',
      key: 'planName',
      width: 120
    },
    {
      title: '订单金额',
      dataIndex: 'orderAmount',
      key: 'orderAmount',
      width: 100,
      render: (amount: number) => `¥${amount.toFixed(2)}`
    },
    {
      title: '佣金比例',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      width: 90,
      render: (rate: number) => `${(rate * 100).toFixed(0)}%`
    },
    {
      title: '佣金金额',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      width: 100,
      render: (amount: number) => (
        <span style={{ color: '#52c41a', fontWeight: 500 }}>
          ¥{amount.toFixed(2)}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: CommissionStatus) => {
        const s = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '预计结算日',
      dataIndex: 'settleDate',
      key: 'settleDate',
      width: 110,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '实际结算时间',
      dataIndex: 'settledAt',
      key: 'settledAt',
      width: 160,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    }
  ];

  const handleDateChange = (dates: any) => {
    if (dates) {
      setFilters({
        ...filters,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD')
      });
    } else {
      setFilters({
        ...filters,
        startDate: undefined,
        endDate: undefined
      });
    }
  };

  const handleStatusChange = (status: CommissionStatus | undefined) => {
    setFilters({ ...filters, status });
  };

  return (
    <Card 
      title={
        <Space>
          <DollarOutlined />
          佣金明细
        </Space>
      }
      extra={
        <Button 
          icon={<ReloadOutlined />} 
          onClick={() => fetchData(data.page, data.pageSize)}
        >
          刷新
        </Button>
      }
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker 
          onChange={handleDateChange}
          placeholder={['开始日期', '结束日期']}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 120 }}
          onChange={handleStatusChange}
          options={[
            { value: 'pending', label: '待结算' },
            { value: 'settled', label: '已结算' },
            { value: 'cancelled', label: '已取消' },
            { value: 'refunded', label: '已退款' }
          ]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={data.data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current: data.page,
          pageSize: data.pageSize,
          total: data.total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
      />
    </Card>
  );
};

export default CommissionList;
