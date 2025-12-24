import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config/env';

export default function LoginPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // 检查是否已登录
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      // 已登录，跳转到首页
      console.log('[Auth] 已登录，跳转到首页');
      navigate('/', { replace: true });
    } else {
      // 未登录，重定向到 Landing 登录页
      console.log('[Auth] 未登录，重定向到 Landing 登录页');
      window.location.href = `${config.landingUrl}/login`;
    }
  }, [navigate]);
  
  // 显示加载状态
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: 60,
          height: 60,
          margin: '0 auto 20px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontSize: 16 }}>正在跳转到登录页...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
