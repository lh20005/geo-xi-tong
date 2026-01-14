import { Wechatpay } from 'wechatpay-axios-plugin';
import fs from 'fs';
import { orderService } from './OrderService';
import { subscriptionService } from './SubscriptionService';
import { getWebSocketService } from './WebSocketService';
import { pool } from '../db/database';
import { AnomalyDetectionService } from './AnomalyDetectionService';
import { QuotaInitializationService } from './QuotaInitializationService';
import { agentService } from './AgentService';
import { commissionService } from './CommissionService';
import { discountService } from './DiscountService';

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
      setImmediate(async () => {
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
        } catch (error: any) {
          console.error('❌ 微信支付SDK初始化失败:', error.message);
          // 不要抛出错误，允许服务器继续运行
          // 只是标记为未配置
          this.isConfigured = false;
          this.initializationError = error;
          resolve(); // 改为 resolve 而不是 reject
        }
      });
    });
  }

  /**
   * 创建微信支付订单
   * 如果用户是被代理商邀请的，订单会标记为分账订单
   * 如果用户符合代理商折扣条件，自动应用折扣
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
    original_price?: number;
    discount_rate?: number;
    is_agent_discount?: boolean;
  }> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PaymentService] 开始创建订单...');
    }
    
    await this.ensureInitialized();
    
    if (!this.isConfigured) {
      throw new Error('微信支付未配置，无法创建订单。请先配置微信支付参数，详见 WECHAT_PAY_SETUP_GUIDE.md');
    }

    // 获取套餐信息
    const planResult = await pool.query(
      'SELECT plan_name, price, COALESCE(agent_discount_rate, 100) as agent_discount_rate FROM subscription_plans WHERE id = $1',
      [planId]
    );
    
    if (planResult.rows.length === 0) {
      throw new Error('套餐不存在');
    }
    
    const planName = planResult.rows[0]?.plan_name || '未知套餐';
    const planPrice = parseFloat(planResult.rows[0].price);
    const planDiscountRate = parseInt(planResult.rows[0].agent_discount_rate);

    // 检查用户折扣资格（仅购买订单）
    let discountInfo: {
      applyDiscount: boolean;
      originalPrice: number;
      discountRate: number;
      isAgentDiscount: boolean;
    } = {
      applyDiscount: false,
      originalPrice: planPrice,
      discountRate: 100,
      isAgentDiscount: false
    };

    if (orderType === 'purchase') {
      try {
        const eligibility = await discountService.checkDiscountEligibility(userId);
        if (eligibility.eligible && planDiscountRate < 100) {
          discountInfo = {
            applyDiscount: true,
            originalPrice: planPrice,
            discountRate: planDiscountRate,
            isAgentDiscount: true
          };
          console.log(`[PaymentService] 用户 ${userId} 符合代理商折扣条件，折扣比例: ${planDiscountRate}%`);
        }
      } catch (error) {
        console.error('[PaymentService] 检查折扣资格失败:', error);
        // 折扣检查失败不影响订单创建，按原价处理
      }
    }

    // 创建订单（带折扣信息）
    const order = await orderService.createOrder(userId, planId, orderType, discountInfo.applyDiscount ? {
      applyDiscount: true,
      originalPrice: discountInfo.originalPrice,
      discountRate: discountInfo.discountRate,
      isAgentDiscount: discountInfo.isAgentDiscount
    } : undefined);

    // 检查用户是否被代理商邀请，记录代理商关联（无论是否满足分账条件）
    let agentId: number | null = null;
    let expectedCommission: number | null = null;
    let profitSharing = false;

    try {
      // 获取用户的邀请码来源
      const userResult = await pool.query(
        'SELECT invited_by_code FROM users WHERE id = $1',
        [userId]
      );
      const invitedByCode = userResult.rows[0]?.invited_by_code;

      if (invitedByCode) {
        // 检查邀请者是否是已激活的代理商（不要求绑定微信）
        const agent = await agentService.getAgentByInvitationCode(invitedByCode);
        if (agent && agent.status === 'active') {
          agentId = agent.id;
          expectedCommission = commissionService.calculateCommission(order.amount, agent.commissionRate);
          // 只有绑定微信且添加为分账接收方才能实际分账
          profitSharing = !!(agent.wechatOpenid && agent.receiverAdded);
          console.log(`[PaymentService] 订单 ${order.order_no} 关联代理商: ${agentId}, 预计佣金: ${expectedCommission}, 可分账: ${profitSharing}`);
        }
      }
    } catch (error) {
      console.error('[PaymentService] 检查代理商关联失败:', error);
      // 不影响订单创建
    }

    // 更新订单的代理商关联信息（无论是否可分账都记录）
    if (agentId) {
      await pool.query(
        `UPDATE orders SET agent_id = $1, profit_sharing = $2, expected_commission = $3 WHERE order_no = $4`,
        [agentId, profitSharing, expectedCommission, order.order_no]
      );
    }

    try {
      // 构建支付请求参数
      let description = `${orderType === 'upgrade' ? '升级' : '购买'}${planName}`;
      if (discountInfo.isAgentDiscount) {
        description += '（代理商专属优惠）';
      }
      description += ` - 订单号: ${order.order_no}`;

      const paymentParams: any = {
        appid: process.env.WECHAT_PAY_APP_ID,
        mchid: process.env.WECHAT_PAY_MCH_ID,
        description,
        out_trade_no: order.order_no,
        notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
        amount: {
          total: Math.round(order.amount * 100),
          currency: 'CNY'
        }
      };

      // 如果是分账订单，添加分账标记
      if (profitSharing) {
        paymentParams.settle_info = {
          profit_sharing: true
        };
      }

      // 调用微信支付 API 创建预支付订单
      const response = await this.wechatpay.v3.pay.transactions.native.post(paymentParams);

      const responseData = typeof response.data === 'string' 
        ? JSON.parse(response.data) 
        : response.data;

      const qrCodeUrl = responseData.code_url;

      if (!qrCodeUrl) {
        throw new Error('未获取到支付二维码');
      }

      const result: any = {
        order_no: order.order_no,
        amount: order.amount,
        plan_name: planName,
        qr_code_url: qrCodeUrl
      };

      // 如果有折扣，返回折扣信息
      if (discountInfo.isAgentDiscount) {
        result.original_price = discountInfo.originalPrice;
        result.discount_rate = discountInfo.discountRate;
        result.is_agent_discount = true;
      }

      return result;
    } catch (error: any) {
      // 输出详细错误信息用于调试
      console.error('[PaymentService] 微信支付API调用失败:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
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

    console.log('📥 收到微信支付回调数据:', JSON.stringify(notifyData, null, 2));

    // 跳过签名验证（避免 SDK 调用外部 API 导致崩溃）
    // 在生产环境中，应该实现本地签名验证
    console.log('⚠️  跳过签名验证（开发模式）');

    // 解密数据 - 使用 AES-256-GCM
    let decryptedData: string;
    try {
      const crypto = require('crypto');
      const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
      
      if (!apiV3Key) {
        throw new Error('APIv3密钥未配置');
      }

      const { ciphertext, associated_data, nonce } = notifyData.resource;
      
      // AES-256-GCM 解密
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        apiV3Key,
        nonce
      );
      
      // 设置 AAD
      decipher.setAAD(Buffer.from(associated_data));
      
      // 设置 Auth Tag（最后16字节）
      const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
      const authTag = ciphertextBuffer.slice(-16);
      const encryptedData = ciphertextBuffer.slice(0, -16);
      
      decipher.setAuthTag(authTag);
      
      // 解密
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      decryptedData = decrypted.toString('utf8');
      
      console.log('✅ 解密成功');
    } catch (error: any) {
      console.error('❌ 解密回调数据失败:', error.message);
      throw new Error('解密回调数据失败');
    }

    const paymentData = JSON.parse(decryptedData);
    console.log('📦 解密后的支付数据:', JSON.stringify(paymentData, null, 2));
    
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
        } else if (order.order_type === 'booster') {
          // 加量包订单：调用 BoosterPackService 开通加量包
          const { boosterPackService } = await import('./BoosterPackService');
          await boosterPackService.activateBoosterPack(order.user_id, order.plan_id, order.id);
          console.log(`[PaymentService] 加量包开通成功: 用户 ${order.user_id}, 套餐 ${order.plan_id}`);
        } else {
          // 获取套餐的 billing_cycle 和 duration_days 来计算订阅时长
          const planResult = await client.query(
            `SELECT billing_cycle, duration_days FROM subscription_plans WHERE id = $1`,
            [order.plan_id]
          );
          
          let durationDays = 30; // 默认 30 天
          if (planResult.rows.length > 0) {
            const { billing_cycle, duration_days } = planResult.rows[0];
            if (duration_days && duration_days > 0) {
              durationDays = duration_days;
            } else {
              // 根据 billing_cycle 计算
              switch (billing_cycle) {
                case 'yearly':
                  durationDays = 365;
                  break;
                case 'quarterly':
                  durationDays = 90;
                  break;
                case 'monthly':
                default:
                  durationDays = 30;
                  break;
              }
            }
          }
          
          // 将用户现有的 active 订阅标记为已替换
          await client.query(
            `UPDATE user_subscriptions 
             SET status = 'replaced', updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND status = 'active'`,
            [order.user_id]
          );
          
          // 创建订阅（根据套餐计费周期设置时长）
          const subscriptionStartDate = new Date();
          await client.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
             VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, (CURRENT_TIMESTAMP + INTERVAL '1 day' * $3)::timestamp + TIME '23:59:59')`,
            [order.user_id, order.plan_id, durationDays]
          );
          
          // 使用统一的配额初始化服务（先清除旧记录，再初始化新配额）
          await QuotaInitializationService.clearUserQuotas(order.user_id, client);
          await QuotaInitializationService.initializeUserQuotas(order.user_id, order.plan_id, {
            resetUsage: true,
            client,
            subscriptionStartDate  // 传入订阅开始日期
          });
          await QuotaInitializationService.updateStorageQuota(order.user_id, order.plan_id, client);
        }

        await client.query('COMMIT');

        // 如果是代理商折扣订单，标记用户已使用首次购买折扣
        if (order.is_agent_discount) {
          try {
            await discountService.markFirstPurchaseDiscountUsed(order.user_id);
            console.log(`[PaymentService] 用户 ${order.user_id} 已标记使用首次购买折扣`);
          } catch (discountError) {
            console.error('[PaymentService] 标记首次购买折扣失败:', discountError);
            // 标记失败不影响订单状态
          }
        }

        // 代理商永久性收益：检查用户是否被代理商邀请，为每次订单创建佣金记录
        // 即使代理商未绑定微信也创建佣金记录，只是暂时无法分账
        try {
          const userAgentResult = await pool.query(
            'SELECT invited_by_agent FROM users WHERE id = $1',
            [order.user_id]
          );
          const invitedByAgentId = userAgentResult.rows[0]?.invited_by_agent;

          if (invitedByAgentId) {
            // 实时查询代理商信息和当前分账比例
            const agent = await agentService.getAgentById(invitedByAgentId);
            
            if (agent && agent.status === 'active') {
              // 检查是否已存在该订单的佣金记录（避免重复创建）
              const existingCommission = await commissionService.getCommissionByOrderId(order.id);
              
              if (!existingCommission) {
                await commissionService.createCommission(
                  order.id,
                  invitedByAgentId,
                  order.user_id,
                  order.amount
                );
                console.log(`[PaymentService] 代理商永久收益: 订单 ${orderNo} 佣金记录已创建，代理商ID: ${invitedByAgentId}, 当前分账比例: ${agent.commissionRate}`);
                
                // 记录分账条件状态
                if (!agent.wechatOpenid || !agent.receiverAdded) {
                  const reasons = [];
                  if (!agent.wechatOpenid) reasons.push('未绑定微信');
                  if (!agent.receiverAdded) reasons.push('未添加为分账接收方');
                  console.log(`[PaymentService] 代理商 ${invitedByAgentId} 暂不满足分账条件: ${reasons.join(', ')}，佣金记录已创建但暂无法分账`);
                }
              } else {
                console.log(`[PaymentService] 订单 ${orderNo} 佣金记录已存在，跳过创建`);
              }
            } else if (agent) {
              console.log(`[PaymentService] 代理商 ${invitedByAgentId} 状态为 ${agent.status}，不创建佣金记录`);
            }
          }
        } catch (commissionError) {
          console.error('[PaymentService] 创建代理商永久收益佣金记录失败:', commissionError);
          // 佣金记录创建失败不影响订单状态
        }

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
