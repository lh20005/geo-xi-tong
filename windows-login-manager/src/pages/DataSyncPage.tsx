/**
 * 数据同步页面
 * 支持云端备份/恢复和本地导出/导入
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  message,
  Statistic,
  Row,
  Col,
  Typography,
  Tag,
  Popconfirm,
  Progress,
  Alert,
  Divider,
} from 'antd';
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  FileOutlined,
  UserOutlined,
  PictureOutlined,
  BookOutlined,
  ScheduleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useSyncStore } from '../stores';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const DataSyncPage: React.FC = () => {
  const {
    snapshots,
    localStats,
    loading,
    backing,
    restoring,
    exporting,
    importing,
    error,
    backup,
    restore,
    fetchSnapshots,
    deleteSnapshot,
    exportLocal,
    importLocal,
    fetchLocalStats,
    clearError,
  } = useSyncStore();

  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null);

  useEffect(() => {
    fetchSnapshots();
    fetchLocalStats();
  }, []);

  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error]);

  // 云端备份
  const handleBackup = async () => {
    const result = await backup();
    if (result.success) {
      message.success('备份成功！');
    }
  };

  // 云端恢复
  const handleRestore = async () => {
    if (!selectedSnapshot) return;
    
    const success = await restore(selectedSnapshot);
    if (success) {
      message.success('恢复成功！');
      setRestoreModalVisible(false);
      setSelectedSnapshot(null);
    }
  };

  // 删除快照
  const handleDeleteSnapshot = async (snapshotId: number) => {
    const success = await deleteSnapshot(snapshotId);
    if (success) {
      message.success('删除成功！');
    }
  };

  // 本地导出
  const handleExport = async () => {
    const result = await exportLocal();
    if (result.success) {
      message.success(`导出成功！文件保存在: ${result.path}`);
    }
  };

  // 本地导入
  const handleImport = async () => {
    // 这里需要调用 Electron 的文件选择对话框
    // 暂时使用 prompt 模拟
    const importPath = window.prompt('请输入要导入的数据库文件路径:');
    if (!importPath) return;
    
    const success = await importLocal(importPath);
    if (success) {
      message.success('导入成功！');
    }
  };

  // 快照表格列
  const columns = [
    {
      title: '创建时间',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '数据统计',
      key: 'metadata',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tag icon={<FileOutlined />}>{record.metadata?.articleCount || 0} 篇文章</Tag>
          <Tag icon={<UserOutlined />}>{record.metadata?.accountCount || 0} 个账号</Tag>
        </Space>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        return `${(size / 1024 / 1024).toFixed(2)} MB`;
      },
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (text: string, record: any) => {
        const isExpiringSoon = record.isExpiringSoon;
        return (
          <Space>
            <span>{dayjs(text).format('YYYY-MM-DD')}</span>
            {isExpiringSoon && (
              <Tag color="warning" icon={<WarningOutlined />}>
                即将过期
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<CloudDownloadOutlined />}
            onClick={() => {
              setSelectedSnapshot(record.id);
              setRestoreModalVisible(true);
            }}
          >
            恢复
          </Button>
          <Popconfirm
            title="确定要删除这个快照吗？"
            onConfirm={() => handleDeleteSnapshot(record.id)}
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
      <Title level={2}>
        <DatabaseOutlined /> 数据同步
      </Title>
      <Paragraph type="secondary">
        管理您的本地数据，支持云端备份恢复和本地导出导入。每个用户最多保留 3 个云端快照，90 天未使用的快照将自动删除。
      </Paragraph>

      {/* 本地数据统计 */}
      <Card title="本地数据统计" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic
              title="文章数量"
              value={localStats?.articleCount || 0}
              prefix={<FileOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="平台账号"
              value={localStats?.accountCount || 0}
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="知识库"
              value={localStats?.knowledgeBaseCount || 0}
              prefix={<BookOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="相册"
              value={localStats?.albumCount || 0}
              prefix={<PictureOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="图片"
              value={localStats?.imageCount || 0}
              prefix={<PictureOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="发布任务"
              value={localStats?.taskCount || 0}
              prefix={<ScheduleOutlined />}
            />
          </Col>
        </Row>
        <Divider />
        <Row>
          <Col span={24}>
            <Text type="secondary">
              数据库大小: {localStats?.databaseSize ? `${(localStats.databaseSize / 1024 / 1024).toFixed(2)} MB` : '未知'}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 操作按钮 */}
      <Card title="数据操作" style={{ marginBottom: 24 }}>
        <Space size="large">
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            loading={backing}
            onClick={handleBackup}
            size="large"
          >
            备份到云端
          </Button>
          <Button
            icon={<ExportOutlined />}
            loading={exporting}
            onClick={handleExport}
            size="large"
          >
            导出到本地
          </Button>
          <Button
            icon={<ImportOutlined />}
            loading={importing}
            onClick={handleImport}
            size="large"
          >
            从本地导入
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchSnapshots();
              fetchLocalStats();
            }}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
        
        <Alert
          style={{ marginTop: 16 }}
          message="提示"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>云端备份会自动加密您的数据，确保安全</li>
              <li>每个用户最多保留 3 个云端快照，上传新快照时会自动删除最旧的</li>
              <li>90 天未下载的快照将自动删除</li>
              <li>本地导出的文件可以在其他设备上导入</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Card>

      {/* 云端快照列表 */}
      <Card
        title={`云端快照 (${snapshots.length}/3)`}
        extra={
          <Text type="secondary">
            最多保留 3 个快照
          </Text>
        }
      >
        <Table
          columns={columns}
          dataSource={snapshots}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: '暂无云端快照，点击"备份到云端"创建第一个快照',
          }}
        />
      </Card>

      {/* 恢复确认弹窗 */}
      <Modal
        title="确认恢复数据"
        open={restoreModalVisible}
        onOk={handleRestore}
        onCancel={() => {
          setRestoreModalVisible(false);
          setSelectedSnapshot(null);
        }}
        confirmLoading={restoring}
        okText="确认恢复"
        cancelText="取消"
      >
        <Alert
          message="警告"
          description="恢复操作将覆盖当前本地数据，此操作不可撤销。建议在恢复前先导出当前数据作为备份。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <p>确定要从选中的快照恢复数据吗？</p>
      </Modal>
    </div>
  );
};

export default DataSyncPage;
