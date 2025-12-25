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

  constructor() {
    this.initializeWeChatPay();
  }

  /**
   * 初始化微信支付
   */
  private initializeWeChatPay() {
    try {
      const appId = process.env.WECHAT_PAY_APP_ID;
      const mchId = process.env.WECHAT_PAY_MCH_ID;
      const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
      const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
      const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;

      // 验证配置完整性
      if (!appId || !mchId || !apiV3Key || !serialNo || !privateKeyPath) {
        SecurityService.secureLog('warn', '微信支付配置不完整，支付功能已禁用');
        console.warn('请在 .env 文件中配置以下环境变量：');
        console.warn('- WECHAT_PAY_APP_ID');
        console.warn('- WECHAT_PAY_MCH_ID');
        console.warn('- WECHAT_PAY_API_V3_KEY');
        console.warn('- WECHAT_PAY_SERIAL_NO');
        console.warn('- WECHAT_PAY_PRIVATE_KEY_PATH');
        return;
      }

      // 检查私钥文件是否存在
      if (!fs.existsSync(privateKeyPath)) {
        SecurityService.secureLog('error', '微信支付私钥文件不存在', { path: privateKeyPath });
        return;
      }

      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

      this.wechatpay = new Wechatpay({
        mchid: mchId,
        serial: serialNo,
        privateKey: privateKey,
        key: apiV3Key,
      });

      this.isConfigured = true;
      SecurityService.secureLog('info', '微信支付初始化成功', {
        appId,
        mchId,
        serialNo,
      });
    } catch (error) {
      SecurityService.secureLog('error', '微信支付初始化失败', error);
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
    if (!this.isConfigured) {
      throw new Error('微信支付未配置，无法创建订单。请先配置微信支付参数，详见 WECHAT_PAY_SETUP_GUIDE.md');
    }

    // 创建订单（支持升级订单）
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
          total: Math.round(order.amount * 100), // 转换为分
          currency: 'CNY'
        }
      });

      // 获取二维码链接
      const qrCodeUrl = response.data.code_url;

      return {
        order_no: order.order_no,
        amount: order.amount,
        plan_name: planName,
        qr_code_url: qrCodeUrl
      };
    } catch (error) {
      console.error('创建微信支付订单失败:', error);
      // 订单创建失败，更新订单状态
      await orderService.updateOrderStatus(order.order_no, 'failed');
      
      // 记录支付失败，检测异常
      await AnomalyDetectionService.recordPaymentFailure(userId, order.order_no);
      
      throw new Error('创建支付订单失败，请稍后重试');
    }
  }

  /**
   * 处理微信支付回调
   */
  async handleWeChatPayNotify(notifyData: any): Promise<void> {
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

// 需要导入 pool
import { pool } from '../db/database';

export const paymentService = new PaymentService();
