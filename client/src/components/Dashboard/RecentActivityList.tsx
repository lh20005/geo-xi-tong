/**
 * 最近活动列表组件
 * 展示用户最近的操作记录
 */

import React, { useState, useEffect } from 'react';
import { Card, List, Typography, Tag, Space, Empty, Skeleton, Avatar, Button } from 'antd';
import {
  FileTextOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  HistoryOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

interface Activity {
  id: number;
  type: 'article' | 'publish' | 'distillation';
  title: string;
  status: string;
  createdAt: string;
  platform?: string;
}

export const RecentActivityList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // 并行获取最近的文章、发布任务、蒸馏
      const [articlesRes, tasksRes, distillationsRes] = await Promise.all([
        apiClient.get('/articles', { params: { page: 1, pageSize: 5 } }).catch(() => ({ data: { articles: [] } })),
        apiClient.get('/publishing/tasks', { params: { page: 1, pageSize: 5 } }).catch(() => ({ data: { data: { tasks: [] } } })),
        apiClient.get('/distillations', { params: { page: 1, pageSize: 5 } }).catch(() => ({ data: { distillations: [] } }))
      ]);

      const allActivities: Activity[] = [];

      // 处理文章
      const articles = articlesRes.data?.articles || [];
      articles.forEach((a: any) => {
        allActivities.push({
          id: a.id,
          type: 'article',
          title: a.title || '未命名文章',
          status: a.is_published ? 'published' : 'draft',
          createdAt: a.created_at
        });
      });

      // 处理发布任务
      const tasks = tasksRes.data?.data?.tasks || tasksRes.data?.tasks || [];
      tasks.forEach((t: any) => {
        allActivities.push({
          id: t.id,
          type: 'publish',
          title: t.article_title || '发布任务',
          status: t.status,
          createdAt: t.created_at,
          platform: t.platform_name
        });
      });

      // 处理蒸馏
      const distillations = distillationsRes.data?.distillations || [];
      distillations.forEach((d: any) => {
        allActivities.push({
          id: d.id,
          type: 'distillation',
          title: d.keyword || '关键词蒸馏',
          status: d.status,
          createdAt: d.created_at
        });
      });

      // 按时间排序，取最近10条
      allActivities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setActivities(allActivities.slice(0, 8));
    } catch (error) {
      console.error('获取活动记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article': return <FileTextOutlined style={{ color: '#722ed1' }} />;
      case 'publish': return <RocketOutlined style={{ color: '#13c2c2' }} />;
      case 'distillation': return <ThunderboltOutlined style={{ color: '#1890ff' }} />;
      default: return <FileTextOutlined />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'article': return '文章';
      case 'publish': return '发布';
      case 'distillation': return '蒸馏';
      default: return '活动';
    }
  };

  const getStatusTag = (status: string, _type: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      // 文章状态
      published: { color: 'success', icon: <CheckCircleOutlined />, text: '已发布' },
      draft: { color: 'default', icon: <ClockCircleOutlined />, text: '草稿' },
      // 发布任务状态
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      pending: { color: 'warning', icon: <ClockCircleOutlined />, text: '等待中' },
      running: { color: 'processing', icon: <SyncOutlined spin />, text: '进行中' },
      // 蒸馏状态
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '完成' },
      processing: { color: 'processing', icon: <SyncOutlined spin />, text: '处理中' }
    };

    const config = statusConfig[status] || { color: 'default', icon: null, text: status };
    
    return (
      <Tag color={config.color} style={{ margin: 0, fontSize: 11 }}>
        {config.icon} {config.text}
      </Tag>
    );
  };

  const handleItemClick = (activity: Activity) => {
    switch (activity.type) {
      case 'article':
        navigate('/articles');
        break;
      case 'publish':
        navigate('/publishing-tasks');
        break;
      case 'distillation':
        navigate('/distillation-results');
        break;
    }
  };

  return (
    <Card
      title={
        <Space>
          <HistoryOutlined />
          <span>最近活动</span>
        </Space>
      }
      extra={
        <Button type="link" size="small" onClick={() => navigate('/articles')}>
          查看全部 <ArrowRightOutlined />
        </Button>
      }
      style={{ 
        borderRadius: 8, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        height: '100%'
      }}
      bodyStyle={{ padding: '0 16px' }}
    >
      {loading ? (
        <div style={{ padding: '16px 0' }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : activities.length === 0 ? (
        <Empty 
          description="暂无活动记录" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '32px 0' }}
        />
      ) : (
        <List
          dataSource={activities}
          renderItem={(item) => (
            <List.Item
              style={{ 
                padding: '12px 0',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onClick={() => handleItemClick(item)}
            >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    size={36}
                    style={{ 
                      background: item.type === 'article' ? '#f9f0ff' : 
                                  item.type === 'publish' ? '#e6fffb' : '#e6f7ff'
                    }}
                    icon={getTypeIcon(item.type)}
                  />
                }
                title={
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <Text 
                      ellipsis={{ tooltip: item.title }}
                      style={{ maxWidth: 180, fontSize: 13 }}
                    >
                      {item.title}
                    </Text>
                    {getStatusTag(item.status, item.type)}
                  </div>
                }
                description={
                  <Space size={8} style={{ fontSize: 12 }}>
                    <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                      {getTypeLabel(item.type)}
                    </Tag>
                    {item.platform && (
                      <Text type="secondary">{item.platform}</Text>
                    )}
                    <Text type="secondary">
                      {dayjs(item.createdAt).fromNow()}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
};

export default RecentActivityList;
