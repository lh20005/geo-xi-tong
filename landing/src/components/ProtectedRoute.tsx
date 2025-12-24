import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const token = localStorage.getItem('auth_token');
  const userInfo = localStorage.getItem('user_info');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && userInfo) {
    try {
      const user = JSON.parse(userInfo);
      if (user.role !== 'admin') {
        return <Navigate to="/profile" replace />;
      }
    } catch (error) {
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
