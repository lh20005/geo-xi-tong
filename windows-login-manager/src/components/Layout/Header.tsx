import { Layout, Space, Tag, Avatar, Dropdown, Typography, Modal, message } from 'antd';
import { ApiOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { MenuProps } from 'antd';
import { useApp } from '../../context/AppContext';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  onLogout?: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  const [apiConfig, setApiConfig] = useState<any>(null);
  const navigate = useNavigate();
  const { user } = useApp();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await axios.get('/api/config/active');
      setApiConfig(response.data);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '确认退出',
      cancelText: '取消',
      onOk: () => {
        console.log('[Auth] 用户退出登录');
        message.success('已退出登录');
        
        // 调用父组件的登出处理
        if (onLogout) {
          onLogout();
        }
      }
    });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'user-center',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => {
        navigate('/user-center');
      }
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

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
        {apiConfig?.configured ? (
          <Tag icon={<ApiOutlined />} color="success">
            {apiConfig.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'} 已连接
          </Tag>
        ) : (
          <Tag icon={<ApiOutlined />} color="warning">
            未配置API
          </Tag>
        )}
        
        {/* 用户信息下拉菜单 */}
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
            <Text strong>{user?.username || '用户'}</Text>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
