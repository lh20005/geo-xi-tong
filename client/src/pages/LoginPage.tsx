import { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/auth/login', values);
      
      if (response.data.success) {
        // 保存token到localStorage
        const { token, refreshToken, user } = response.data.data;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('user_info', JSON.stringify(user));
        
        console.log('[Auth] 登录成功:', { username: user.username });
        message.success(`欢迎回来，${user.username}！`);
        
        // 跳转到主页
        navigate('/');
      } else {
        message.error(response.data.message || '登录失败');
      }
    } catch (error: any) {
      console.error('[Auth] 登录失败:', error);
      message.error(error.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          borderRadius: 8
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Logo和标题 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 80,
              height: 80,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              color: '#fff'
            }}>
              <LoginOutlined />
            </div>
            <Title level={2} style={{ marginBottom: 8 }}>
              GEO优化系统
            </Title>
            <Text type="secondary">
              请登录以继续使用
            </Text>
          </div>

          {/* 登录表单 */}
          <Form
            name="login"
            onFinish={handleLogin}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                icon={<LoginOutlined />}
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          {/* 提示信息 */}
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              默认账号: admin / admin123
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}
