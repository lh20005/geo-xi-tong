import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
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
} from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';

const { Sider } = Layout;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userIsAdmin = isAdmin();

  const menuItems = [
    {
      key: '/',
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
    // 系统配置 - 仅管理员可见
    ...(userIsAdmin ? [{
      key: '/config',
      icon: <SettingOutlined />,
      label: '系统配置',
    }] : []),
    {
      key: '/user-manual',
      icon: <BookOutlined />,
      label: '使用说明书',
    },
  ];

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
          src="/images/logo.png" 
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
        onClick={({ key }) => navigate(key)}
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
