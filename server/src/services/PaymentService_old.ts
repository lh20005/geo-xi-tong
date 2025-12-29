import { Wechatpay } from 'wechatpay-axios-plugin';
import fs from 'fs';
import { orderService } from './OrderService';
import { subscriptionService } from './SubscriptionService';
import { getWebSocketService } from './WebSocketService';
import { pool } from '../db/database';
import { AnomalyDetectionService } from './AnomalyDetectionService';
import { SecurityService } from './SecurityService';

export class PaymentService {
  private wechatpay: any;
  private isConfigured: boolean = false;
  private initialized: boolean = false;
  private initializationError: Error | null = null;

  constructor() {
    // 延迟初始化，确保环境变量已加载
  }

  /**
   * 确保微信支付已初始化
   */
  private ensureInitialized() {
    if (!this.initialized) {
      try {
        this.initializeWeChatPay();
        this.initialized = true;
      } catch (error: any) {
        this.initializationError = error;
        console.error('❌ 微信支付初始化失败:', error.message);
        throw new Error('微信支付服务初始化失败');
      }
    }
    
    if (this.initializationError) {
      throw this.initializationError;
    }
  }

  /**
   * 初始化微信支付
   */
  private initializeWeChatPay() {
    try {
      console.log('[PaymentService] 开始初始化微信支付...');
      
      const appId = process.env.WECHAT_PAY_APP_ID;
      const mchId = process.env.WECHAT_PAY_MCH_ID;
      const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
      const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
      const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;

      console.log('[PaymentService] 配置检查:', {
        hasAppId: !!appId,
        hasMchId: !!mchId,
        hasApiV3Key: !!apiV3Key,
        hasSerialNo: !!serialNo,
        hasPrivateKeyPath: !!privateKeyPath,
        privateKeyPath
      });

      // 验证配置完整性
      if (!appId || !mchId || !apiV3Key || !serialNo || !privateKeyPath) {
        SecurityService.secureLog('warn', '微信支付配置不完整，支付功能已禁用');
        console.warn('❌ 微信支付配置不完整，缺少以下环境变量：');
        if (!appId) console.warn('  - WECHAT_PAY_APP_ID');
        if (!mchId) console.warn('  - WECHAT_PAY_MCH_ID');
        if (!apiV3Key) console.warn('  - WECHAT_PAY_API_V3_KEY');
        if (!serialNo) console.warn('  - WECHAT_PAY_SERIAL_NO');
        if (!privateKeyPath) console.warn('  - WECHAT_PAY_PRIVATE_KEY_PATH');
        return;
      }

      // 检查私钥文件是否存在
      console.log('[PaymentService] 检查私钥文件:', privateKeyPath);
      if (!fs.existsSync(privateKeyPath)) {
        SecurityService.secureLog('error', '微信支付私钥文件不存在', { path: privateKeyPath });
        console.error('❌ 微信支付私钥文件不存在:', privateKeyPath);
        return;
      }

      console.log('[PaymentService] 读取私钥文件...');
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      console.log('[PaymentService] 私钥文件读取成功，长度:', privateKey.length);
      
      // 读取微信支付公钥（如果存在）
      const publicKeyPath = '/Users/lzc/.wechat-pay/wechat_pay_public_key.pem';
      let certs: any = undefined;
      
      if (fs.existsSync(publicKeyPath)) {
        console.log('[PaymentService] 读取微信支付公钥...');
        const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        console.log('[PaymentService] 公钥文件读取成功，长度:', publicKey.length);
        
        // 使用公钥作为证书（公钥模式）
        // 公钥 ID 可以从环境变量获取，或者使用一个默认值
        const publicKeyId = process.env.WECHAT_PAY_PUBLIC_KEY_ID || 'PUB_KEY_ID_0111039601042025122900292089000201';
        certs = {
          [publicKeyId]: publicKey
        };
        console.log('[PaymentService] 使用公钥模式，公钥ID:', publicKeyId);
      } else {
        console.warn('[PaymentService] ⚠️ 未找到微信支付公钥文件，将使用空证书（可能导致验签失败）');
        // 提供一个空的 certs 对象，避免 SDK 报错
        certs = {};
      }
      
      // 配置微信支付 SDK
      console.log('[PaymentService] 创建 Wechatpay 实例...');
      this.wechatpay = new Wechatpay({
        mchid: mchId,
        serial: serialNo,
        privateKey: privateKey,
        certs: certs, // 提供证书参数
      } as any);

      this.isConfigured = true;
      console.log('[PaymentService] isConfigured 设置为 true');
      
      SecurityService.secureLog('info', '微信支付初始化成功', {
        appId,
        mchId,
        serialNo,
      });
      console.log('✅ 微信支付初始化成功（简化配置模式）');
    } catch (error) {
      SecurityService.secureLog('error', '微信支付初始化失败', error);
      console.error('❌ 微信支付初始化失败:', error);
      throw error; // 抛出错误，让 ensureInitialized 捕获
    }
  }

  /**
   * 创建微信支付订单
   */
  async createWeChatPayOrder(
    userId: number, 
    planId: number, 
    orderType: 'purchase' | 'upgrade' = 'purchase'
  ): Promise<{
    order_no: string;
    amount: number;
    plan_name: string;
    qr_code_url: string;
  }> {
    console.log('[PaymentService] 开始创建订单...');
    console.log('[PaymentService] userId:', userId, 'planId:', planId, 'orderType:', orderType);
    
    this.ensureInitialized();
    console.log('[PaymentService] 初始化检查完成, isConfigured:', this.isConfigured);
    
    if (!this.isConfigured) {
      console.error('[PaymentService] 微信支付未配置');
      throw new Error('微信支付未配置，无法创建订单。请先配置微信支付参数，详见 WECHAT_PAY_SETUP_GUIDE.md');
    }

    console.log('[PaymentService] 创建订单记录...');
    // 创建订单（支持升级订单）
    const order = await orderService.createOrder(userId, planId, orderType);
    console.log('[PaymentService] 订单记录创建成功:', order.order_no);
    
    // 获取套餐信息
    const planResult = await pool.query(
      'SELECT plan_name FROM subscription_plans WHERE id = $1',
      [planId]
    );
    const planName = planResult.rows[0]?.plan_name || '未知套餐';
    console.log('[PaymentService] 套餐名称:', planName);

    try {
      console.log('[PaymentService] 调用微信支付API...');
      // 调用微信支付 API 创建预支付订单
      const response = await this.wechatpay.v3.pay.transactions.native.post({
        appid: process.env.WECHAT_PAY_APP_ID,
        mchid: process.env.WECHAT_PAY_MCH_ID,
        description: `${orderType === 'upgrade' ? '升级' : '购买'}${planName} - 订单号: ${order.order_no}`,
        out_trade_no: order.order_no,
        notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
        amount: {
          total: Math.round(order.amount * 100), // 转换为分
          currency: 'CNY'
        }
      });

      console.log('[PaymentService] 微信支付API调用成功');
      console.log('[PaymentService] 响应状态:', response.status);
      console.log('[PaymentService] 响应数据类型:', typeof response.data);
      console.log('[PaymentService] 响应数据原始内容:', JSON.stringify(response.data));

      // 解析响应数据
      let responseData;
      try {
        responseData = typeof response.data === 'string' 
          ? JSON.parse(response.data) 
          : response.data;
        console.log('[PaymentService] 解析后的数据:', JSON.stringify(responseData));
      } catch (parseError) {
        console.error('[PaymentService] JSON解析失败:', parseError);
        console.error('[PaymentService] 原始数据:', response.data);
        throw new Error('解析微信支付响应失败');
      }

      // 获取二维码链接
      const qrCodeUrl = responseData.code_url;
      console.log('[PaymentService] 二维码URL:', qrCodeUrl);

      if (!qrCodeUrl) {
        console.error('[PaymentService] 未获取到二维码URL');
        console.error('[PaymentService] 完整响应数据:', JSON.stringify(responseData));
        throw new Error('未获取到支付二维码');
      }

      console.log('[PaymentService] 订单创建成功，返回结果');
      return {
        order_no: order.order_no,
        amount: order.amount,
        plan_name: planName,
        qr_code_url: qrCodeUrl
      };
    } catch (error: any) {
      console.error('[PaymentService] 捕获到错误类型:', error.constructor.name);
      console.error('[PaymentService] 错误消息:', error.message);
      console.error('[PaymentService] 错误堆栈:', error.stack);
      
      // 如果是 axios 错误，打印更多信息
      if (error.response) {
        console.error('[PaymentService] Axios响应错误:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('[PaymentService] Axios请求错误（无响应）');
      }
      
      // 订单创建失败，更新订单状态
      await orderService.updateOrderStatus(order.order_no, 'failed');
      
      // 记录支付失败，检测异常（不等待，避免阻塞）
      AnomalyDetectionService.recordPaymentFailure(userId, order.order_no).catch(err => {
        console.error('记录支付失败时出错（已忽略）:', err);
      });
      
      // 返回更具体的错误信息
      if (error.message.includes('解析') || error.message.includes('二维码')) {
        throw error;
      }
      throw new Error('创建支付订单失败，请稍后重试');
    }
  }

  /**
   * 处理微信支付回调
   */
  async handleWeChatPayNotify(notifyData: any): Promise<void> {
    this.ensureInitialized();
    
    if (!this.isConfigured) {
      throw new Error('微信支付未配置');
    }

    try {
      // 验证签名
      const isValid = this.wechatpay.verifySign(notifyData);
      if (!isValid) {
        throw new Error('签名验证失败');
      }

      // 解密数据
      const decryptedData = this.wechatpay.decipher(
        notifyData.resource.ciphertext,
        notifyData.resource.associated_data,
        notifyData.resource.nonce
      );

      const paymentData = JSON.parse(decryptedData);
      const orderNo = paymentData.out_trade_no;
      const transactionId = paymentData.transaction_id;
      const tradeState = paymentData.trade_state;

      // 获取订单
      const order = await orderService.getOrderByNo(orderNo);
      if (!order) {
        throw new Error('订单不存在');
      }

      // 幂等性检查：如果订单已支付，直接返回
      if (order.status === 'paid') {
        console.log(`订单 ${orderNo} 已支付，跳过处理`);
        return;
      }

      // 支付成功
      if (tradeState === 'SUCCESS') {
        // 使用事务确保原子性
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // 更新订单状态
          await client.query(
            `UPDATE orders 
             SET status = 'paid', transaction_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE order_no = $2`,
            [transactionId, orderNo]
          );

          // 根据订单类型处理
          if (order.order_type === 'upgrade') {
            // 升级订单：应用升级
            await subscriptionService.applyUpgrade(order.user_id, order.plan_id);
            console.log(`✅ 订单 ${orderNo} 支付成功，套餐已升级`);
          } else {
            // 购买订单：开通订阅
            await client.query(
              `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
               VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month')`,
              [order.user_id, order.plan_id]
            );
            console.log(`✅ 订单 ${orderNo} 支付成功，订阅已开通`);
          }

          await client.query('COMMIT');

          // 推送订单状态变更通知
          try {
            const wsService = getWebSocketService();
            wsService.sendToUser(order.user_id, 'order_status_changed', {
              order_no: orderNo,
              status: 'paid',
              transaction_id: transactionId
            });
          } catch (error) {
            console.error('推送订单状态变更失败:', error);
          }
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } else {
        // 支付失败
        await orderService.updateOrderStatus(orderNo, 'failed');
        console.log(`❌ 订单 ${orderNo} 支付失败: ${tradeState}`);

        // 推送订单状态变更通知
        try {
          const wsService = getWebSocketService();
          wsService.sendToUser(order.user_id, 'order_status_changed', {
            order_no: orderNo,
            status: 'failed'
          });
        } catch (error) {
          console.error('推送订单状态变更失败:', error);
        }
      }
    } catch (error) {
      console.error('处理支付回调失败:', error);
      throw error;
    }
  }

  /**
   * 查询订单支付状态
   */
  async queryOrderStatus(orderNo: string): Promise<{
    order_no: string;
    status: string;
    trade_state?: string;
  }> {
    this.ensureInitialized();
    
    if (!this.isConfigured) {
      throw new Error('微信支付未配置');
    }

    const order = await orderService.getOrderByNo(orderNo);
    if (!order) {
      throw new Error('订单不存在');
    }

    // 如果订单已支付，直接返回
    if (order.status === 'paid') {
      return {
        order_no: orderNo,
        status: 'paid',
        trade_state: 'SUCCESS'
      };
    }

    try {
      // 查询微信支付订单状态
      const response = await this.wechatpay.v3.pay.transactions.outTradeNo[orderNo].get({
        params: {
          mchid: process.env.WECHAT_PAY_MCH_ID
        }
      });

      return {
        order_no: orderNo,
        status: order.status,
        trade_state: response.data.trade_state
      };
    } catch (error) {
      console.error('查询订单状态失败:', error);
      return {
        order_no: orderNo,
        status: order.status
      };
    }
  }

  /**
   * 生成随机字符串
   */
  private generateNonceStr(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const paymentService = new PaymentService();
