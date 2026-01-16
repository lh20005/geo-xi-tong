import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    console.log('[Auth] 未登录，跳转到登录页');
    // 未登录，跳转到登录页
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}
