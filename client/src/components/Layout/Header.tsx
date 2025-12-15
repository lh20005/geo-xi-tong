import { Layout, Space, Tag } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import axios from 'axios';

const { Header: AntHeader } = Layout;

export default function Header() {
  const [apiConfig, setApiConfig] = useState<any>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await axios.get('/api/config/active');
      setApiConfig(response.data);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  return (
    <AntHeader
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 500, color: '#1e293b' }}>
        品牌AI推荐优化工具
      </div>
      <Space>
        {apiConfig?.configured ? (
          <Tag icon={<ApiOutlined />} color="success">
            {apiConfig.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'} 已连接
          </Tag>
        ) : (
          <Tag icon={<ApiOutlined />} color="warning">
            未配置API
          </Tag>
        )}
      </Space>
    </AntHeader>
  );
}
