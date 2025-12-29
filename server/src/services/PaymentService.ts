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
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // 完全延迟初始化，不在构造函数中做任何操作
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PaymentService] 构造函数：延迟初始化模式');
    }
  }

  /**
   * 确保微信支付已初始化（异步）
   */
  private async ensureInitialized() {
    // 如果已经初始化成功，直接返回
    if (this.initialized && this.isConfigured) {
      return;
    }
    
    // 如果有初始化错误，抛出
    if (this.initializationError) {
      throw this.initializationError;
    }
    
    // 如果正在初始化，等待完成
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    
    // 开始初始化
    this.initializationPromise = this.initializeWeChatPay();
    
    try {
      await this.initializationPromise;
      this.initialized = true;
    } catch (error: any) {
      this.initializationError = error;
      console.error('❌ 微信支付初始化失败:', error.message);
      throw new Error('微信支付服务初始化失败');
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * 初始化微信支付（异步）
   */
  private async initializeWeChatPay(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PaymentService] 开始异步初始化微信支付...');
    }
    
    const appId = process.env.WECHAT_PAY_APP_ID;
    const mchId = process.env.WECHAT_PAY_MCH_ID;
    const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
    const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
    const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;

    // 验证配置完整性（不输出实际值）
    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKeyPath) {
      throw new Error('微信支付配置不完整');
    }

    // 检查私钥文件是否存在
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error('微信支付私钥文件不存在');
    }

    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    
    // 读取微信支付公钥（从环境变量获取路径）
    const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH;
    const publicKeyId = process.env.WECHAT_PAY_PUBLIC_KEY_ID;
    let certs: any = {};
    
    if (publicKeyPath && publicKeyId && fs.existsSync(publicKeyPath)) {
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
      certs = {
        [publicKeyId]: publicKey
      };
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PaymentService] 使用公钥模式');
      }
    } else {
      console.warn('[PaymentService] 警告：未配置公钥路径或公钥ID，将使用空证书');
    }
    
    // 在下一个事件循环中创建实例，避免阻塞
    await new Promise<void>((resolve, reject) => {
      setImmediate(() => {
        try {
          this.wechatpay = new Wechatpay({
            mchid: mchId,
            serial: serialNo,
            privateKey: privateKey,
            certs: certs,
          } as any);

          this.isConfigured = true;
          if (process.env.NODE_ENV !== 'production') {
            console.log('✅ 微信支付初始化成功（公钥模式）');
          }
          resolve();
        } catch (error) {
          console.error('❌ 微信支付SDK初始化失败:', error);
          reject(error);
        }
      });
    });
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
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PaymentService] 开始创建订单...');
    }
    
    await this.ensureInitialized();
    
    if (!this.isConfigured) {
      throw new Error('微信支付未配置，无法创建订单。请先配置微信支付参数，详见 WECHAT_PAY_SETUP_GUIDE.md');
    }

    // 创建订单
    const order = await orderService.createOrder(userId, planId, orderType);
    
    // 获取套餐信息
    const planResult = await pool.query(
      'SELECT plan_name FROM subscription_plans WHERE id = $1',
      [planId]
    );
    const planName = planResult.rows[0]?.plan_name || '未知套餐';

    try {
      // 调用微信支付 API 创建预支付订单
      const response = await this.wechatpay.v3.pay.transactions.native.post({
        appid: process.env.WECHAT_PAY_APP_ID,
        mchid: process.env.WECHAT_PAY_MCH_ID,
        description: `${orderType === 'upgrade' ? '升级' : '购买'}${planName} - 订单号: ${order.order_no}`,
        out_trade_no: order.order_no,
        notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
        amount: {
          total: Math.round(order.amount * 100),
          currency: 'CNY'
        }
      });

      const responseData = typeof response.data === 'string' 
        ? JSON.parse(response.data) 
        : response.data;

      const qrCodeUrl = responseData.code_url;

      if (!qrCodeUrl) {
        throw new Error('未获取到支付二维码');
      }

      return {
        order_no: order.order_no,
        amount: order.amount,
        plan_name: planName,
        qr_code_url: qrCodeUrl
      };
    } catch (error: any) {
      await orderService.updateOrderStatus(order.order_no, 'failed');
      AnomalyDetectionService.recordPaymentFailure(userId, order.order_no).catch(() => {});
      throw new Error('创建支付订单失败，请稍后重试');
    }
  }

  /**
   * 处理微信支付回调
   */
  async handleWeChatPayNotify(notifyData: any): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.isConfigured) {
      throw new Error('微信支付未配置');
    }

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

    const order = await orderService.getOrderByNo(orderNo);
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'paid') {
      return;
    }

    if (tradeState === 'SUCCESS') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE orders 
           SET status = 'paid', transaction_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE order_no = $2`,
          [transactionId, orderNo]
        );

        if (order.order_type === 'upgrade') {
          await subscriptionService.applyUpgrade(order.user_id, order.plan_id);
        } else {
          await client.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
             VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month')`,
            [order.user_id, order.plan_id]
          );
        }

        await client.query('COMMIT');

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
      await orderService.updateOrderStatus(orderNo, 'failed');
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
    await this.ensureInitialized();
    
    if (!this.isConfigured) {
      throw new Error('微信支付未配置');
    }

    const order = await orderService.getOrderByNo(orderNo);
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'paid') {
      return {
        order_no: orderNo,
        status: 'paid',
        trade_state: 'SUCCESS'
      };
    }

    try {
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
      return {
        order_no: orderNo,
        status: order.status
      };
    }
  }
}

export const paymentService = new PaymentService();
