import { useState, useEffect } from 'react';
import { Table, Tag, Tooltip, message } from 'antd';
import { getAdjustmentHistory, AdjustmentHistory } from '../../api/userSubscriptions';

interface Props {
  userId: number;
}

export default function AdjustmentHistoryTable({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AdjustmentHistory[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadHistory();
  }, [userId, page]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await getAdjustmentHistory(userId, page, pageSize);
      setHistory(result.history);
      setTotal(result.total);
    } catch (error: any) {
      message.error('加载历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  const getTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; label: string }> = {
      upgrade: { color: 'blue', label: '升级套餐' },
      extend: { color: 'green', label: '延期订阅' },
      pause: { color: 'orange', label: '暂停订阅' },
      resume: { color: 'cyan', label: '恢复订阅' },
      cancel: { color: 'red', label: '取消订阅' },
      quota_adjust: { color: 'purple', label: '配额调整' },
      gift: { color: 'gold', label: '赠送套餐' },
    };

    const config = typeMap[type] || { color: 'default', label: type };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const renderDetails = (record: AdjustmentHistory) => {
    const details: string[] = [];

    if (record.old_plan_name && record.new_plan_name) {
      details.push(`${record.old_plan_name} → ${record.new_plan_name}`);
    }

    if (record.days_added) {
      details.push(`延长 ${record.days_added} 天`);
    }

    if (record.old_end_date && record.new_end_date) {
      const oldDate = new Date(record.old_end_date).toLocaleDateString('zh-CN');
      const newDate = new Date(record.new_end_date).toLocaleDateString('zh-CN');
      details.push(`${oldDate} → ${newDate}`);
    }

    if (record.quota_adjustments) {
      const quotas = Object.entries(record.quota_adjustments).map(([key, value]: [string, any]) => {
        if (value.action === 'reset') {
          return `${key}: 重置使用量`;
        }
        return `${value.feature_name || key}: ${value.old} → ${value.new}`;
      });
      details.push(...quotas);
    }

    return details.length > 0 ? details.join(' | ') : '-';
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作类型',
      dataIndex: 'adjustment_type',
      key: 'adjustment_type',
      width: 120,
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '操作详情',
      key: 'details',
      render: (_: any, record: AdjustmentHistory) => (
        <Tooltip title={renderDetails(record)}>
          <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {renderDetails(record)}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      render: (reason: string) => (
        <Tooltip title={reason}>
          <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {reason || '-'}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'admin_username',
      key: 'admin_username',
      width: 120,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={history}
      rowKey="id"
      loading={loading}
      pagination={{
        current: page,
        pageSize,
        total,
        onChange: setPage,
        showSizeChanger: false,
        showTotal: (total) => `共 ${total} 条记录`,
      }}
      scroll={{ x: 900 }}
    />
  );
}
