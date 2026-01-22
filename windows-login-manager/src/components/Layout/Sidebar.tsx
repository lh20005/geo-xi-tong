import { Layout, Menu, Modal, message, Badge } from 'antd';
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
  CloudDownloadOutlined,
  GlobalOutlined,
  MonitorOutlined,
} from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';
// 使用相对路径引用 public 目录中的图片
const logoImg = './images/logo.png';

const { Sider } = Layout;

interface SidebarProps {
  onLogout?: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userIsAdmin, setUserIsAdmin] = useState(isAdmin());
  const [hasUpdate, setHasUpdate] = useState(false);

  // 监听用户信息变化，实时更新管理员状态
  useEffect(() => {
    const checkAdminStatus = () => {
      console.log('[Sidebar] 检查管理员状态...');
      const newAdminStatus = isAdmin();
      console.log('[Sidebar] 管理员状态:', newAdminStatus);
      setUserIsAdmin(newAdminStatus);
    };

    // 初始检查
    console.log('[Sidebar] 组件挂载，执行初始检查');
    checkAdminStatus();

    // 监听自定义事件（同一标签页内的变化）
    console.log('[Sidebar] 注册 userInfoUpdated 事件监听');
    window.addEventListener('userInfoUpdated', checkAdminStatus);

    return () => {
      console.log('[Sidebar] 组件卸载，移除事件监听');
      window.removeEventListener('userInfoUpdated', checkAdminStatus);
    };
  }, []);

  // 监听更新状态
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cleanupNavigate: (() => void) | undefined;

    const checkUpdateStatus = async () => {
      try {
        if (window.electronAPI?.updater) {
          const status = await window.electronAPI.updater.getStatus();
          // 有新版本可用或已下载完成时显示红点
          setHasUpdate(status.status === 'available' || status.status === 'downloaded');
        }
      } catch (error) {
        console.error('[Sidebar] 检查更新状态失败:', error);
      }
    };

    // 初始检查
    checkUpdateStatus();

    // 监听更新状态变化
    if (window.electronAPI?.updater?.onStatusChanged) {
      cleanup = window.electronAPI.updater.onStatusChanged((status) => {
        setHasUpdate(status.status === 'available' || status.status === 'downloaded');
      });
    }

    // 监听导航到更新页面的事件（从系统通知点击）
    if (window.electronAPI?.updater?.onNavigateToUpdate) {
      cleanupNavigate = window.electronAPI.updater.onNavigateToUpdate(() => {
        navigate('/software-update');
      });
    }

    return () => {
      if (cleanup) cleanup();
      if (cleanupNavigate) cleanupNavigate();
    };
  }, [navigate]);

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

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
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
      label: '平台管理',
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
      key: '/user-manual',
      icon: <BookOutlined />,
      label: '使用说明书',
    },
    {
      key: '/user-center',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: '/software-update',
      icon: hasUpdate ? (
        <Badge dot offset={[-2, 2]}>
          <CloudDownloadOutlined />
        </Badge>
      ) : (
        <CloudDownloadOutlined />
      ),
      label: hasUpdate ? (
        <span>
          升级软件
          <Badge 
            count="新" 
            style={{ 
              marginLeft: 8, 
              backgroundColor: '#ff4d4f',
              fontSize: 10,
              padding: '0 4px',
              height: 16,
              lineHeight: '16px'
            }} 
          />
        </span>
      ) : '升级软件',
    },
    {
      key: 'visit-website',
      icon: <GlobalOutlined />,
      label: '前往网站',
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
    } else if (key === 'visit-website') {
      // 通过 Electron 打开外部浏览器
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal('https://www.jzgeo.cc/');
      } else {
        // 降级方案：直接打开（在非 Electron 环境下）
        window.open('https://www.jzgeo.cc/', '_blank');
      }
    } else {
      navigate(key);
    }
  };

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
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 20,
          fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <img 
          src={logoImg} 
          alt="Logo" 
          style={{ 
            width: 32, 
            height: 32, 
            marginRight: 8,
            borderRadius: 6
          }} 
        />
        GEO优化系统
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
    </Sider>
  );
}
