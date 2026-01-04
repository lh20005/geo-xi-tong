import { Layout, Space, Tag, Avatar, Typography } from 'antd';
import { DatabaseOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../api/client';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  onLogout?: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const { user } = useApp();

  useEffect(() => {
    // 初始检查后端连接
    checkBackendConnection();
    
    // 每10秒检查一次后端连接状态
    const interval = setInterval(() => {
      checkBackendConnection();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const checkBackendConnection = async () => {
    try {
      // 使用配置好的 apiClient 来检查连接
      await apiClient.get('/health', { timeout: 5000 });
      setBackendConnected(true);
    } catch (error) {
      console.error('后端连接检查失败:', error);
      setBackendConnected(false);
    }
  };

  return (
    <AntHeader
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 500, color: '#1e293b' }}>
        欢迎来到GEO优化系统 - 桌面版
      </div>
      <Space size="large">
        {backendConnected ? (
          <Tag icon={<DatabaseOutlined />} color="success">
            数据库已连接
          </Tag>
        ) : (
          <Tag icon={<DatabaseOutlined />} color="error">
            数据库连接断开
          </Tag>
        )}
        
        {/* 用户信息显示 */}
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <Text strong>{user?.username || '用户'}</Text>
        </Space>
      </Space>
    </AntHeader>
  );
}
