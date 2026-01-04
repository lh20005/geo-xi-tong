import { useState } from 'react';
import { Card, Button, Space, message, Descriptions, Alert, Input } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

declare global {
  interface Window {
    electron?: any;
  }
}

const TokenDebugPage = () => {
  const [tokens, setTokens] = useState<any>(null);
  const [apiTest, setApiTest] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkTokens = async () => {
    setLoading(true);
    try {
      if (window.electron) {
        const result = await window.electron.storage.getTokens();
        console.log('[TokenDebug] Tokens:', result);
        setTokens(result);
        if (result) {
          message.success('Token 获取成功');
        } else {
          message.warning('未找到 Token');
        }
      } else {
        message.error('不在 Electron 环境中');
      }
    } catch (error: any) {
      console.error('[TokenDebug] Error:', error);
      message.error('获取 Token 失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const testAPI = async () => {
    setLoading(true);
    setApiTest(null);
    try {
      if (!tokens?.authToken) {
        message.error('请先检查 Token');
        return;
      }

      const response = await fetch('http://localhost:3000/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${tokens.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('[TokenDebug] API Response:', data);
      
      setApiTest({
        status: response.status,
        ok: response.ok,
        data
      });

      if (response.ok) {
        message.success('API 测试成功');
      } else {
        message.error('API 测试失败');
      }
    } catch (error: any) {
      console.error('[TokenDebug] API Error:', error);
      message.error('API 请求失败: ' + error.message);
      setApiTest({
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToLocalStorage = () => {
    if (tokens?.authToken) {
      localStorage.setItem('auth_token', tokens.authToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);
      message.success('Token 已复制到 localStorage');
    } else {
      message.error('没有可复制的 Token');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="Token 调试工具" variant="borderless">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space wrap>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />}
              onClick={checkTokens}
              loading={loading}
            >
              检查 Token
            </Button>
            <Button 
              onClick={testAPI}
              loading={loading}
              disabled={!tokens}
            >
              测试 API
            </Button>
            <Button 
              onClick={copyToLocalStorage}
              disabled={!tokens}
            >
              复制到 localStorage
            </Button>
          </Space>

          {tokens && (
            <Card 
              title="Token 信息" 
              size="small"
              extra={
                tokens.authToken ? 
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} /> :
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
              }
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="authToken">
                  {tokens.authToken ? (
                    <Input.TextArea 
                      value={tokens.authToken} 
                      rows={3} 
                      readOnly
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  ) : '不存在'}
                </Descriptions.Item>
                <Descriptions.Item label="refreshToken">
                  {tokens.refreshToken ? (
                    <Input.TextArea 
                      value={tokens.refreshToken} 
                      rows={3} 
                      readOnly
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  ) : '不存在'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {apiTest && (
            <Card 
              title="API 测试结果" 
              size="small"
              extra={
                apiTest.ok ? 
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} /> :
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
              }
            >
              <pre style={{ 
                background: '#f5f5f5', 
                padding: 12, 
                borderRadius: 4,
                maxHeight: 400,
                overflow: 'auto',
                fontSize: 12
              }}>
                {JSON.stringify(apiTest, null, 2)}
              </pre>
            </Card>
          )}

          <Alert
            message="使用说明"
            description={
              <ol style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>点击"检查 Token"查看当前存储的 token</li>
                <li>点击"测试 API"直接测试商品 API</li>
                <li>如果 token 存在但 API 失败，可能是 token 过期</li>
                <li>可以"复制到 localStorage"作为临时方案</li>
                <li>查看浏览器控制台获取详细日志</li>
              </ol>
            }
            type="info"
            showIcon
          />
        </Space>
      </Card>
    </div>
  );
};

export default TokenDebugPage;
