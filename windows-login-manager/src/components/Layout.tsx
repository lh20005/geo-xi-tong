import React, { ReactNode } from 'react';
import { Layout as AntLayout } from 'antd';
import Sidebar from './Layout/Sidebar';
import Header from './Layout/Header';

const { Content } = AntLayout;

interface LayoutProps {
  children: ReactNode;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  return (
    <AntLayout style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <AntLayout style={{ marginLeft: 240, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header onLogout={onLogout} />
        <Content
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
