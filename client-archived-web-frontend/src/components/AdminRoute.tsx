import { Navigate } from 'react-router-dom';
import { message } from 'antd';
import { isAdmin } from '../utils/auth';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * 管理员路由保护组件
 * 只有管理员才能访问的路由
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const userIsAdmin = isAdmin();
  
  if (!userIsAdmin) {
    message.warning('您没有权限访问此页面');
    console.log('[Auth] 非管理员用户尝试访问管理员页面');
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
