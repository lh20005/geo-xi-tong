import { Layout, Space, Tag, Avatar, Dropdown, Typography, Modal, message } from 'antd';
import { ApiOutlined, UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { MenuProps } from 'antd';
import { config } from '../../config/env';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

export default function Header() {
  const [apiConfig, setApiConfig] = useState<any>(null);
  const navigate = useNavigate();
  
  // 从localStorage获取用户信息
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

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
        
        // 清除所有认证信息
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        
        message.success('已退出登录');
        
        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          // 跳转到 Landing 首页（营销网站）
          window.location.href = config.landingUrl;
        }, 500);
      }
    });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => {
        // 跳转到个人信息页面（可选）
        console.log('个人信息');
      }
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => {
        // 跳转到设置页面（可选）
        console.log('设置');
      }
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
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
        品牌AI推荐优化工具
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
            <Text strong>{userInfo.username || '用户'}</Text>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
