import { Layout, Menu, Modal, message, Drawer } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  DashboardOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  FolderOutlined,
  PictureOutlined,
  BookOutlined,
  FileTextOutlined,
  AimOutlined,
  EditOutlined,
  RocketOutlined,
  CloudUploadOutlined,
  SendOutlined,
  HistoryOutlined,
  SafetyOutlined,
  FileTextOutlined as AuditOutlined,
  LockOutlined,
  TeamOutlined,
  ShoppingOutlined,
  UserOutlined,
  LogoutOutlined,
  DollarOutlined,
  MonitorOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';
import { config } from '../../config/env';

const { Sider } = Layout;

// 移动端断点
const MOBILE_BREAKPOINT = 768;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userIsAdmin = isAdmin();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // 监听窗口大小变化
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 路由变化时关闭抽屉
  useEffect(() => {
    setDrawerVisible(false);
  }, [location.pathname]);

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

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/user-manual',
      icon: <BookOutlined />,
      label: '使用说明书',
    },
    {
      key: '/conversion-targets',
      icon: <AimOutlined />,
      label: '转化目标',
    },
    {
      key: '/distillation',
      icon: <ThunderboltOutlined />,
      label: '关键词蒸馏',
    },
    {
      key: '/distillation-results',
      icon: <FileTextOutlined />,
      label: '蒸馏结果',
    },
    {
      key: '/gallery',
      icon: <PictureOutlined />,
      label: '企业图库',
    },
    {
      key: '/knowledge-base',
      icon: <BookOutlined />,
      label: '企业知识库',
    },
    {
      key: '/article-settings',
      icon: <EditOutlined />,
      label: '文章设置',
    },
    {
      key: '/article-generation',
      icon: <RocketOutlined />,
      label: '生成文章',
    },
    {
      key: '/articles',
      icon: <FolderOutlined />,
      label: '文章管理',
    },
    {
      key: '/platform-management',
      icon: <CloudUploadOutlined />,
      label: '平台登录',
    },
    {
      key: '/publishing-tasks',
      icon: <SendOutlined />,
      label: '发布任务',
    },
    {
      key: '/publishing-records',
      icon: <HistoryOutlined />,
      label: '发布记录',
    },
    // 安全管理 - 仅管理员可见
    ...(userIsAdmin ? [{
      key: 'security',
      icon: <SafetyOutlined />,
      label: '安全管理',
      children: [
        {
          key: '/security/dashboard',
          icon: <SafetyOutlined />,
          label: '安全仪表板',
        },
        {
          key: '/security/audit-logs',
          icon: <AuditOutlined />,
          label: '审计日志',
        },
        {
          key: '/security/permissions',
          icon: <TeamOutlined />,
          label: '权限管理',
        },
        {
          key: '/security/ip-whitelist',
          icon: <LockOutlined />,
          label: 'IP白名单',
        },
        {
          key: '/security/config',
          icon: <SettingOutlined />,
          label: '安全配置',
        },
      ],
    }] : []),
    // 系统管理 - 仅管理员可见
    ...(userIsAdmin ? [{
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: [
        {
          key: '/config',
          icon: <SettingOutlined />,
          label: '系统配置',
        },
        {
          key: '/products',
          icon: <ShoppingOutlined />,
          label: '商品管理',
        },
        {
          key: '/admin/orders',
          icon: <ShoppingOutlined />,
          label: '订单管理',
        },
        {
          key: '/admin/users',
          icon: <TeamOutlined />,
          label: '用户管理',
        },
        {
          key: '/admin/agents',
          icon: <DollarOutlined />,
          label: '代理商管理',
        },
        {
          key: '/admin/commission-monitor',
          icon: <MonitorOutlined />,
          label: '佣金监控',
        },
      ],
    }] : []),
    {
      key: '/user-center',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      handleLogout();
    } else {
      // 传递刷新标记，确保页面在导航时能够刷新数据
      navigate(key, { state: { refresh: Date.now() } });
    }
  };

  // 菜单内容组件
  const MenuContent = () => (
    <>
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          color: '#fff',
          fontSize: 18,
          fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src={`${import.meta.env.BASE_URL}images/logo.png`}
            alt="Logo" 
            style={{ 
              width: 28, 
              height: 28, 
              marginRight: 8,
              borderRadius: 6
            }} 
          />
          GEO优化系统
        </div>
        {isMobile && (
          <CloseOutlined 
            onClick={() => setDrawerVisible(false)}
            style={{ fontSize: 18, cursor: 'pointer' }}
          />
        )}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          background: 'transparent',
          border: 'none',
          marginTop: 16,
        }}
        theme="dark"
      />
    </>
  );

  // 移动端：使用 Drawer
  if (isMobile) {
    return (
      <>
        {/* 移动端菜单按钮 - 通过 Header 组件触发 */}
        <Drawer
          placement="left"
          open={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          width={240}
          styles={{
            body: { padding: 0 },
            header: { display: 'none' },
          }}
          style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          <div style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            minHeight: '100%',
          }}>
            <MenuContent />
          </div>
        </Drawer>
        
        {/* 暴露打开方法给 Header */}
        <MobileMenuTrigger onOpen={() => setDrawerVisible(true)} />
      </>
    );
  }

  // 桌面端：固定侧边栏
  return (
    <Sider
      width={240}
      style={{
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <MenuContent />
    </Sider>
  );
}

// 移动端菜单触发器组件 - 用于在 Header 中显示菜单按钮
function MobileMenuTrigger({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    // 将打开方法暴露到全局，供 Header 调用
    (window as any).__openMobileSidebar = onOpen;
    return () => {
      delete (window as any).__openMobileSidebar;
    };
  }, [onOpen]);
  
  return null;
}
