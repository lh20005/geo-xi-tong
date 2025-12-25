import React from 'react';
import { Card, Alert, Empty } from 'antd';
import { LockOutlined, ToolOutlined } from '@ant-design/icons';

/**
 * IP白名单管理页面（占位符）
 * 
 * 此页面为未来功能预留，当前仅显示占位信息。
 * 完整实现将包括：
 * - IP地址列表管理
 * - CIDR范围支持
 * - IP添加/删除功能
 * - IP格式验证
 * - 白名单启用/禁用
 */
const IPWhitelistPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        <LockOutlined /> IP白名单管理
      </h1>

      <Card>
        <Alert
          message="功能开发中"
          description="IP白名单管理功能正在开发中，敬请期待。"
          type="info"
          showIcon
          icon={<ToolOutlined />}
          style={{ marginBottom: '24px' }}
        />

        <Empty
          description={
            <div>
              <p>此功能将支持：</p>
              <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                <li>管理允许访问管理后台的IP地址</li>
                <li>支持单个IP和CIDR范围</li>
                <li>IP地址格式验证</li>
                <li>白名单启用/禁用控制</li>
                <li>访问日志记录</li>
              </ul>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default IPWhitelistPage;
