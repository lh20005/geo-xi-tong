/**
 * 微信绑定卡片组件
 * 使用小程序码扫码绑定方式
 */

import { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Typography, Modal, message, Tag, Popconfirm, Spin, Alert, Image } from 'antd';
import { WechatOutlined, CheckCircleOutlined, DisconnectOutlined, ReloadOutlined, QrcodeOutlined } from '@ant-design/icons';
import { Agent, getBindQRCode, checkBindStatus, unbindWechat, getAgentStatus } from '../../api/agent';

const { Text, Paragraph } = Typography;

interface WechatBindCardProps {
  agent: Agent;
  onAgentUpdate: (agent: Agent) => void;
}

export const WechatBindCard: React.FC<WechatBindCardProps> = ({ agent, onAgentUpdate }) => {
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [bindCode, setBindCode] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [unbindLoading, setUnbindLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [bindStatus, setBindStatus] = useState<'pending' | 'success' | 'expired'>('pending');
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const isBound = !!agent.wechatOpenid;

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleGenerateQRCode = async () => {
    setCodeLoading(true);
    try {
      const data = await getBindQRCode();
      setBindCode(data.bindCode);
      setQrCodeBase64(data.qrCodeBase64);
      setCountdown(data.expiresIn);
      setBindStatus('pending');
      setBindModalVisible(true);
      startCountdown(data.expiresIn);
      startPolling(data.bindCode);
    } catch (error: any) {
      message.error(error.response?.data?.message || '生成小程序码失败');
    } finally {
      setCodeLoading(false);
    }
  };

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    let remaining = seconds;
    countdownRef.current = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setBindStatus('expired');
      }
    }, 1000);
  };

  const startPolling = (code: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const status = await checkBindStatus(code);
        setBindStatus(status.status);
        if (status.status === 'success') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          message.success('微信绑定成功！');
          setBindModalVisible(false);
          const { agent: updatedAgent } = await getAgentStatus();
          if (updatedAgent) onAgentUpdate(updatedAgent);
        } else if (status.status === 'expired') {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (error) {
        // 忽略轮询错误
      }
    }, 3000);
  };

  const handleCloseModal = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setBindModalVisible(false);
  };

  const handleUnbind = async () => {
    setUnbindLoading(true);
    try {
      await unbindWechat();
      message.success('微信已解绑');
      const { agent: updatedAgent } = await getAgentStatus();
      if (updatedAgent) onAgentUpdate(updatedAgent);
    } catch (error: any) {
      message.error(error.response?.data?.message || '解绑失败');
    } finally {
      setUnbindLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Card title={<Space><WechatOutlined style={{ color: '#07c160' }} />微信账户绑定</Space>}>
        {isBound ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#07c160', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircleOutlined style={{ fontSize: 32, color: 'white' }} />
            </div>
            <Tag color="success" style={{ marginBottom: 16 }}>已绑定</Tag>
            {agent.wechatNickname && (
              <Paragraph><Text type="secondary">微信昵称：</Text><Text strong>{agent.wechatNickname}</Text></Paragraph>
            )}
            {agent.wechatBindtime && (
              <Paragraph><Text type="secondary">绑定时间：</Text><Text>{new Date(agent.wechatBindtime).toLocaleString('zh-CN')}</Text></Paragraph>
            )}
            {agent.receiverAdded ? (
              <Tag color="success" icon={<CheckCircleOutlined />}>已添加为分账接收方</Tag>
            ) : (
              <Tag color="warning">分账接收方添加中...</Tag>
            )}
            <div style={{ marginTop: 24 }}>
              <Space>
                <Button onClick={handleGenerateQRCode} loading={codeLoading}>更换绑定</Button>
                <Popconfirm title="确定要解绑微信账户吗？" description="解绑后将无法接收佣金，请确保没有待结算佣金" onConfirm={handleUnbind} okText="确定" cancelText="取消">
                  <Button danger icon={<DisconnectOutlined />} loading={unbindLoading}>解绑</Button>
                </Popconfirm>
              </Space>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <WechatOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
            </div>
            <Tag color="default" style={{ marginBottom: 16 }}>未绑定</Tag>
            <Paragraph type="secondary">绑定微信账户后，佣金将自动结算到您的微信零钱</Paragraph>
            <Button type="primary" icon={<QrcodeOutlined />} onClick={handleGenerateQRCode} loading={codeLoading} style={{ background: '#07c160', borderColor: '#07c160', marginTop: 16 }}>
              扫码绑定微信
            </Button>
          </div>
        )}
      </Card>

      <Modal title={<Space><WechatOutlined style={{ color: '#07c160' }} />微信绑定</Space>} open={bindModalVisible} onCancel={handleCloseModal} footer={null} width={400} centered>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          {bindStatus === 'expired' ? (
            <>
              <Alert message="绑定码已过期" description="请点击下方按钮重新生成" type="warning" showIcon style={{ marginBottom: 24 }} />
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleGenerateQRCode} loading={codeLoading}>重新生成</Button>
            </>
          ) : bindStatus === 'success' ? (
            <>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: 'white' }} />
              </div>
              <Paragraph style={{ fontSize: 18, fontWeight: 500 }}>绑定成功！</Paragraph>
            </>
          ) : (
            <>
              <Paragraph style={{ marginBottom: 24 }}>请使用微信扫描下方小程序码完成绑定</Paragraph>
              {qrCodeBase64 ? (
                <div style={{ background: '#f5f5f5', padding: '24px', borderRadius: 12, marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Image src={qrCodeBase64} alt="小程序码" width={200} height={200} preview={false} style={{ borderRadius: 8 }} />
                  <Text type="secondary" style={{ marginTop: 12, fontSize: 12 }}>微信扫一扫，自动完成绑定</Text>
                </div>
              ) : (
                <div style={{ background: '#f5f5f5', padding: '24px 32px', borderRadius: 12, marginBottom: 24 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>请在小程序中输入绑定码：</Text>
                  <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 8, fontFamily: 'monospace', color: '#1890ff' }}>{bindCode}</div>
                </div>
              )}
              <Space direction="vertical" size={8}>
                <Text type="secondary">有效期：<Text strong style={{ color: countdown < 60 ? '#ff4d4f' : undefined }}>{formatCountdown(countdown)}</Text></Text>
                <Space><Spin size="small" /><Text type="secondary">等待扫码绑定...</Text></Space>
              </Space>
              {!qrCodeBase64 && (
                <Alert message="操作步骤" description={<ol style={{ margin: 0, paddingLeft: 20, textAlign: 'left' }}><li>打开微信，搜索并进入小程序</li><li>在小程序中找到"绑定代理商"功能</li><li>输入上方6位绑定码</li><li>确认绑定即可</li></ol>} type="info" style={{ marginTop: 24, textAlign: 'left' }} />
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default WechatBindCard;
