/**
 * 平台账号概览组件
 * 展示已绑定的平台账号状态
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Space, Tag, Empty, Skeleton, Button, Tooltip } from 'antd';
import {
  LinkOutlined,
  ArrowRightOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { localAccountApi, type LocalAccount } from '../../api';

const { Text } = Typography;

interface PlatformAccount extends LocalAccount {}

// 平台图标映射
const platformIcons: Record<string, string> = {
  xiaohongshu: '📕',
  douyin: '🎵',
  toutiao: '📰',
  zhihu: '💡',
  baijiahao: '📝',
  wangyi: '📧',
  sohu: '🔍',
  csdn: '💻',
  jianshu: '✍️',
  wechat: '💬',
  qq: '🐧',
  bilibili: '📺'
};

export const PlatformAccountsCard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await localAccountApi.findAll();
      if (response.success) {
        setAccounts(response.data || []);
      } else {
        setAccounts([]);
      }
    } catch (error) {
      console.error('获取平台账号失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <LinkOutlined />
          <span>平台账号</span>
          <Tag color="blue" style={{ marginLeft: 4 }}>{accounts.length}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/platform-management')}
          >
            添加
          </Button>
          <Button 
            type="link" 
            size="small"
            onClick={() => navigate('/platform-management')}
          >
            管理 <ArrowRightOutlined />
          </Button>
        </Space>
      }
      style={{ 
        borderRadius: 8, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        height: '100%'
      }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : accounts.length === 0 ? (
        <Empty 
          description="暂未绑定平台账号" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '24px 0' }}
        >
          <Button type="primary" size="small" onClick={() => navigate('/platform-management')}>
            去绑定
          </Button>
        </Empty>
      ) : (
        <Row gutter={[8, 8]}>
          {accounts.slice(0, 8).map((account) => (
            <Col xs={12} sm={8} md={6} key={account.id}>
              <Tooltip title={`${account.platform} - ${account.accountName || account.realUsername || '未命名'}`}>
                <div 
                  style={{ 
                    background: '#fafafa',
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid #f0f0f0'
                  }}
                  onClick={() => navigate('/platform-management')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0f0f0';
                    e.currentTarget.style.borderColor = '#d9d9d9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fafafa';
                    e.currentTarget.style.borderColor = '#f0f0f0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>
                      {platformIcons[account.platform] || '📱'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text 
                        ellipsis 
                        style={{ fontSize: 12, display: 'block' }}
                      >
                        {account.platform}
                      </Text>
                      <Text 
                        type="secondary" 
                        ellipsis 
                        style={{ fontSize: 11 }}
                      >
                        {account.accountName || account.realUsername || '未命名'}
                      </Text>
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Col>
          ))}
          {accounts.length > 8 && (
            <Col xs={12} sm={8} md={6}>
              <div 
                style={{ 
                  background: '#f0f0f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 52
                }}
                onClick={() => navigate('/platform-management')}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  +{accounts.length - 8} 更多
                </Text>
              </div>
            </Col>
          )}
        </Row>
      )}
    </Card>
  );
};

export default PlatformAccountsCard;
