import React, { useState, useEffect } from 'react';
import { Modal, Table, Empty, message, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface UsageRecord {
  id: number;
  taskId: number;
  articleId: number;
  articleTitle: string;
  articleDeleted: boolean;
  usedAt: string;
}

interface UsageHistoryModalProps {
  visible: boolean;
  distillationId: number | null;
  onClose: () => void;
}

/**
 * 使用历史弹窗组件
 * Task 7: 创建UsageHistoryModal组件
 * 
 * 功能：
 * - 显示蒸馏结果的使用历史
 * - 分页展示（每页10条）
 * - 支持跳转到文章详情
 * - 处理文章已删除的情况
 * - 显示空状态
 */
const UsageHistoryModal: React.FC<UsageHistoryModalProps> = ({
  visible,
  distillationId,
  onClose,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);
  const [keyword, setKeyword] = useState<string>('');
  const [totalUsageCount, setTotalUsageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // 加载使用历史数据
  useEffect(() => {
    if (visible && distillationId) {
      loadUsageHistory(currentPage);
    }
  }, [visible, distillationId, currentPage]);

  const loadUsageHistory = async (page: number) => {
    if (!distillationId) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `/api/distillation/${distillationId}/usage`,
        {
          params: { page, pageSize },
        }
      );

      const data = response.data;
      setUsageHistory(data.usageHistory || []);
      setKeyword(data.keyword || '');
      setTotalUsageCount(data.totalUsageCount || 0);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error('加载使用历史失败:', error);
      message.error(error.response?.data?.error || '加载使用历史失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleArticleClick = (record: UsageRecord) => {
    if (!record.articleDeleted) {
      navigate(`/articles/${record.articleId}`);
      onClose();
    }
  };

  const columns: ColumnsType<UsageRecord> = [
    {
      title: '任务ID',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 100,
    },
    {
      title: '文章标题',
      dataIndex: 'articleTitle',
      key: 'articleTitle',
      render: (text: string, record: UsageRecord) => {
        if (record.articleDeleted) {
          return <span style={{ color: '#999' }}>{text}</span>;
        }
        return (
          <a
            onClick={() => handleArticleClick(record)}
            style={{ cursor: 'pointer' }}
          >
            {text}
          </a>
        );
      },
    },
    {
      title: '生成时间',
      dataIndex: 'usedAt',
      key: 'usedAt',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
  ];

  const handleClose = () => {
    setCurrentPage(1);
    setUsageHistory([]);
    setKeyword('');
    setTotalUsageCount(0);
    setTotal(0);
    onClose();
  };

  return (
    <Modal
      title={
        <div>
          <span>使用历史</span>
          {keyword && (
            <span style={{ marginLeft: 16, fontSize: 14, color: '#666' }}>
              关键词: {keyword} | 总使用次数: {totalUsageCount}次
            </span>
          )}
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {usageHistory.length === 0 && !loading ? (
          <Empty
            description="该蒸馏结果尚未被使用"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={usageHistory}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize,
              total,
              onChange: handlePageChange,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        )}
      </Spin>
    </Modal>
  );
};

export default UsageHistoryModal;
