import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>平台登录管理器</h2>
        </div>
        <ul className="nav-menu">
          <li>
            <Link to="/platforms" className={isActive('/platforms')}>
              <span className="icon">🚀</span>
              <span>平台登录</span>
            </Link>
          </li>
          <li>
            <Link to="/accounts" className={isActive('/accounts')}>
              <span className="icon">👤</span>
              <span>账号管理</span>
            </Link>
          </li>
          <li>
            <Link to="/settings" className={isActive('/settings')}>
              <span className="icon">⚙️</span>
              <span>设置</span>
            </Link>
          </li>
        </ul>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
