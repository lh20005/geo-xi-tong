import { Layout, Space, Tag, Avatar, Typography, Button } from 'antd';
import { DatabaseOutlined, UserOutlined, MenuOutlined } from '@ant-design/icons';
import { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../api/client';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

// 移动端断点
const MOBILE_BREAKPOINT = 768;

export default function Header() {
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState(false);
  const failCountRef = useRef<number>(0); // 连续失败次数
  
  // 从localStorage获取用户信息
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

  // 监听窗口大小变化
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 打开移动端侧边栏
  const openMobileSidebar = () => {
    if ((window as any).__openMobileSidebar) {
      (window as any).__openMobileSidebar();
    }
  };

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
      // 使用一个轻量级的API端点来检查连接
      // 增加超时时间到 15 秒，因为发布任务执行时浏览器自动化会占用资源
      await apiClient.get('/health', { timeout: 15000 });
      setBackendConnected(true);
      failCountRef.current = 0; // 重置失败计数
    } catch (error) {
      // 连续失败 2 次才显示断开（避免单次超时误报）
      failCountRef.current += 1;
      if (failCountRef.current >= 2) {
        console.error('后端连接检查连续失败:', error);
        setBackendConnected(false);
      } else {
        console.warn('后端连接检查超时，将在下次检查时重试');
      }
    }
  };

  return (
    <AntHeader
      style={{
        background: '#fff',
        padding: isMobile ? '0 12px' : '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        position: isMobile ? 'sticky' : 'relative',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* 移动端菜单按钮 */}
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20 }} />}
            onClick={openMobileSidebar}
            style={{ padding: '4px 8px' }}
          />
        )}
        <div style={{ 
          fontSize: isMobile ? 14 : 16, 
          fontWeight: 500, 
          color: '#1e293b',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {isMobile ? 'GEO系统' : '欢迎来到GEO-SaaS系统'}
        </div>
      </div>
      <Space size={isMobile ? 'small' : 'large'}>
        {/* 移动端隐藏数据库状态 */}
        {!isMobile && (
          backendConnected ? (
            <Tag icon={<DatabaseOutlined />} color="success">
              数据库已连接
            </Tag>
          ) : (
            <Tag icon={<DatabaseOutlined />} color="error">
              数据库连接断开
            </Tag>
          )
        )}
        
        {/* 用户信息显示 */}
        <Space size="small">
          <Avatar 
            icon={<UserOutlined />} 
            style={{ backgroundColor: '#1890ff' }} 
            size={isMobile ? 'small' : 'default'}
          />
          {!isMobile && <Text strong>{userInfo.username || '用户'}</Text>}
        </Space>
      </Space>
    </AntHeader>
  );
}
