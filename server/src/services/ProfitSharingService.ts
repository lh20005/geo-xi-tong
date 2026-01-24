/**
 * 微信支付分账服务
 * 封装微信支付分账 API 调用
 */

import { Wechatpay } from 'wechatpay-axios-plugin';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db/database';
import { ProfitSharingStatus } from '../types/agent';

interface ReceiverResult {
  success: boolean;
  message?: string;
}

interface ProfitSharingResult {
  success: boolean;
  outOrderNo: string;
  wechatOrderId?: string;
  status: ProfitSharingStatus;
  message?: string;
}

export class ProfitSharingService {
  private static instance: ProfitSharingService;
  private wechatpay: any;
  private isConfigured: boolean = false;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): ProfitSharingService {
    if (!ProfitSharingService.instance) {
      ProfitSharingService.instance = new ProfitSharingService();
    }
    return ProfitSharingService.instance;
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.isConfigured) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.initialize();
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  /**
   * 初始化微信支付
   */
  private async initialize(): Promise<void> {
    const appId = process.env.WECHAT_PAY_APP_ID;
    const mchId = process.env.WECHAT_PAY_MCH_ID;
    const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
    const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
    const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;

    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKeyPath) {
      console.warn('[ProfitSharingService] 微信支付配置不完整，分账功能不可用');
      return;
    }

    if (!fs.existsSync(privateKeyPath)) {
      console.warn('[ProfitSharingService] 微信支付私钥文件不存在');
      return;
    }

    try {
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      
      const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH;
      const publicKeyId = process.env.WECHAT_PAY_PUBLIC_KEY_ID;
      let certs: any = {};
      
      if (publicKeyPath && publicKeyId && fs.existsSync(publicKeyPath)) {
        const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        certs = { [publicKeyId]: publicKey };
      }

      this.wechatpay = new Wechatpay({
        mchid: mchId,
        serial: serialNo,
        privateKey: privateKey,
        certs: certs,
      } as any);

      this.isConfigured = true;
      this.initialized = true;
      console.log('[ProfitSharingService] 微信支付分账服务初始化成功');
    } catch (error: any) {
      console.error('[ProfitSharingService] 初始化失败:', error.message);
    }
  }

  /**
   * 生成商户分账单号
   */
  private generateOutOrderNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `PS${timestamp}${random}`;
  }

  /**
   * 添加分账接收方（个人微信零钱）
   */
  async addReceiver(openid: string, name?: string): Promise<ReceiverResult> {
    await this.ensureInitialized();

    if (!this.isConfigured) {
      return { success: false, message: '微信支付未配置' };
    }

    try {
      const appId = process.env.WECHAT_PAY_APP_ID;
      
      const requestBody: any = {
        appid: appId,
        type: 'PERSONAL_OPENID',
        account: openid,
        relation_type: 'USER'
      };

      // 如果提供了姓名，需要加密
      if (name) {
        // 使用微信支付公钥加密姓名
        const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH;
        if (publicKeyPath && fs.existsSync(publicKeyPath)) {
          const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
          const encryptedName = this.encryptWithPublicKey(name, publicKey);
          requestBody.name = encryptedName;
        }
      }

      const response = await this.wechatpay.v3.profitsharing.receivers.add.post(requestBody);
      
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      
      console.log(`[ProfitSharingService] 添加分账接收方成功: ${openid}`);
      return { success: true };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`[ProfitSharingService] 添加分账接收方失败: ${errorMsg}`);
      
      // 如果是已存在的接收方，视为成功
      if (errorMsg?.includes('已存在') || error.response?.data?.code === 'RECEIVER_ACCOUNT_EXIST') {
        return { success: true, message: '接收方已存在' };
      }
      
      return { success: false, message: errorMsg };
    }
  }

  /**
   * 删除分账接收方
   */
  async deleteReceiver(openid: string): Promise<ReceiverResult> {
    await this.ensureInitialized();

    if (!this.isConfigured) {
      return { success: false, message: '微信支付未配置' };
    }

    try {
      const appId = process.env.WECHAT_PAY_APP_ID;
      
      await this.wechatpay.v3.profitsharing.receivers.delete.post({
        appid: appId,
        type: 'PERSONAL_OPENID',
        account: openid
      });

      console.log(`[ProfitSharingService] 删除分账接收方成功: ${openid}`);
      return { success: true };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`[ProfitSharingService] 删除分账接收方失败: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * 请求分账
   */
  async requestProfitSharing(
    transactionId: string,
    openid: string,
    amount: number,  // 分账金额（分）
    description: string,
    commissionId: number
  ): Promise<ProfitSharingResult> {
    await this.ensureInitialized();

    if (!this.isConfigured) {
      return { success: false, outOrderNo: '', status: 'failed', message: '微信支付未配置' };
    }

    const outOrderNo = this.generateOutOrderNo();

    try {
      const appId = process.env.WECHAT_PAY_APP_ID;
      
      const response = await this.wechatpay.v3.profitsharing.orders.post({
        appid: appId,
        transaction_id: transactionId,
        out_order_no: outOrderNo,
        receivers: [{
          type: 'PERSONAL_OPENID',
          account: openid,
          amount: amount,
          description: description
        }],
        unfreeze_unsplit: true  // 解冻剩余资金
      });

      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

      // 记录分账记录
      await this.createProfitSharingRecord(
        commissionId,
        transactionId,
        outOrderNo,
        data.order_id,
        amount,
        'processing'
      );

      console.log(`[ProfitSharingService] 分账请求成功: ${outOrderNo}`);
      return {
        success: true,
        outOrderNo,
        wechatOrderId: data.order_id,
        status: 'processing'
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`[ProfitSharingService] 分账请求失败: ${errorMsg}`);

      // 记录失败的分账记录
      await this.createProfitSharingRecord(
        commissionId,
        transactionId,
        outOrderNo,
        null,
        amount,
        'failed',
        errorMsg
      );

      return {
        success: false,
        outOrderNo,
        status: 'failed',
        message: errorMsg
      };
    }
  }

  /**
   * 查询分账结果
   * 
   * 微信分账状态说明：
   * - PROCESSING: 处理中
   * - FINISHED: 分账完成（成功或失败需看 receivers 中的 result）
   * 
   * receivers 中的 result 状态：
   * - PENDING: 待分账
   * - SUCCESS: 分账成功
   * - CLOSED: 已关闭（订单撤销或退款导致）
   */
  async queryProfitSharing(outOrderNo: string, transactionId: string): Promise<{
    status: ProfitSharingStatus;
    wechatOrderId?: string;
    failReason?: string;
  }> {
    await this.ensureInitialized();

    if (!this.isConfigured) {
      return { status: 'failed', failReason: '微信支付未配置' };
    }

    try {
      const response = await this.wechatpay.v3.profitsharing.orders[outOrderNo].get({
        params: { transaction_id: transactionId }
      });

      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

      // 映射微信状态到系统状态
      let status: ProfitSharingStatus = 'processing';
      let failReason: string | undefined;
      
      if (data.state === 'FINISHED') {
        // 分账单已完成，需要检查接收方的分账结果
        const receiver = data.receivers?.[0];
        if (receiver) {
          if (receiver.result === 'SUCCESS') {
            status = 'success';
          } else if (receiver.result === 'CLOSED') {
            status = 'failed';
            failReason = receiver.fail_reason || '分账已关闭';
          } else if (receiver.result === 'PENDING') {
            // 仍在处理中
            status = 'processing';
          } else {
            // 其他状态视为失败
            status = 'failed';
            failReason = receiver.fail_reason || `分账结果: ${receiver.result}`;
          }
        } else {
          // 没有接收方信息，视为成功（分账单已完成）
          status = 'success';
        }
      } else if (data.state === 'PROCESSING') {
        status = 'processing';
      }

      return {
        status,
        wechatOrderId: data.order_id,
        failReason
      };
    } catch (error: any) {
      const errorCode = error.response?.data?.code;
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`[ProfitSharingService] 查询分账结果失败: ${errorCode} - ${errorMsg}`);
      
      // 对于 RESOURCE_NOT_EXISTS 错误，检查订单的待分金额来判断分账是否已完成
      if (errorCode === 'RESOURCE_NOT_EXISTS') {
        console.log(`[ProfitSharingService] 分账单 ${outOrderNo} 查询返回记录不存在，检查待分金额...`);
        
        // 查询订单的待分金额
        try {
          const amountResponse = await this.wechatpay.v3.profitsharing.transactions[transactionId].amounts.get();
          const amountData = typeof amountResponse.data === 'string' ? JSON.parse(amountResponse.data) : amountResponse.data;
          
          if (amountData.unsplit_amount === 0) {
            // 待分金额为0，说明分账已完成
            console.log(`[ProfitSharingService] 订单 ${transactionId} 待分金额为0，分账已完成`);
            return { status: 'success' };
          } else {
            // 还有待分金额，继续等待
            console.log(`[ProfitSharingService] 订单 ${transactionId} 待分金额: ${amountData.unsplit_amount}分，继续等待`);
            return { status: 'processing', failReason: '分账处理中' };
          }
        } catch (amountError: any) {
          console.error(`[ProfitSharingService] 查询待分金额失败: ${amountError.message}`);
          // 查询待分金额也失败，保持 processing 状态继续重试
          return { status: 'processing', failReason: '分账单处理中，请稍后查询' };
        }
      }
      
      // 对于频率限制错误，也保持 processing 状态
      if (errorCode === 'FREQUENCY_LIMITED') {
        console.log(`[ProfitSharingService] 查询频率受限，稍后重试`);
        return { status: 'processing', failReason: '查询频率受限，稍后重试' };
      }
      
      return { status: 'failed', failReason: errorMsg };
    }
  }

  /**
   * 解冻剩余资金
   */
  async unfreezeRemaining(transactionId: string, outOrderNo: string, description: string = '解冻剩余资金'): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.wechatpay.v3.profitsharing.orders.unfreeze.post({
        transaction_id: transactionId,
        out_order_no: outOrderNo,
        description: description
      });

      console.log(`[ProfitSharingService] 解冻剩余资金成功: ${transactionId}`);
      return true;
    } catch (error: any) {
      console.error(`[ProfitSharingService] 解冻剩余资金失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 创建分账记录
   */
  private async createProfitSharingRecord(
    commissionId: number,
    transactionId: string,
    outOrderNo: string,
    wechatOrderId: string | null,
    amount: number,
    status: ProfitSharingStatus,
    failReason?: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO profit_sharing_records 
       (commission_id, transaction_id, out_order_no, wechat_order_id, amount, status, fail_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [commissionId, transactionId, outOrderNo, wechatOrderId, amount, status, failReason]
    );
  }

  /**
   * 更新分账记录状态
   */
  async updateProfitSharingRecord(
    outOrderNo: string,
    status: ProfitSharingStatus,
    wechatOrderId?: string,
    failReason?: string
  ): Promise<void> {
    const updates: string[] = ['status = $2'];
    const params: any[] = [outOrderNo, status];
    let paramIndex = 3;

    if (status === 'success') {
      updates.push('finish_time = CURRENT_TIMESTAMP');
    }

    if (wechatOrderId) {
      updates.push(`wechat_order_id = $${paramIndex}`);
      params.push(wechatOrderId);
      paramIndex++;
    }

    if (failReason) {
      updates.push(`fail_reason = $${paramIndex}`);
      params.push(failReason);
      paramIndex++;
    }

    await pool.query(
      `UPDATE profit_sharing_records SET ${updates.join(', ')} WHERE out_order_no = $1`,
      params
    );
  }

  /**
   * 获取待处理的分账记录
   * 只获取重试次数小于最大重试次数的记录
   */
  async getPendingProfitSharingRecords(): Promise<Array<{
    id: number;
    commissionId: number;
    transactionId: string;
    outOrderNo: string;
    amount: number;
    retryCount: number;
  }>> {
    const maxRetries = parseInt(process.env.PROFIT_SHARING_MAX_RETRIES || '24'); // 默认24次（24小时）
    
    const result = await pool.query(
      `SELECT id, commission_id, transaction_id, out_order_no, amount, COALESCE(retry_count, 0) as retry_count
       FROM profit_sharing_records
       WHERE status = 'processing'
       AND COALESCE(retry_count, 0) < $1
       ORDER BY created_at ASC`,
      [maxRetries]
    );

    return result.rows.map(row => ({
      id: row.id,
      commissionId: row.commission_id,
      transactionId: row.transaction_id,
      outOrderNo: row.out_order_no,
      amount: row.amount,
      retryCount: row.retry_count
    }));
  }

  /**
   * 增加分账记录的重试次数
   */
  async incrementRetryCount(outOrderNo: string): Promise<void> {
    await pool.query(
      `UPDATE profit_sharing_records SET retry_count = COALESCE(retry_count, 0) + 1 WHERE out_order_no = $1`,
      [outOrderNo]
    );
  }

  /**
   * 标记超时的分账记录为失败
   */
  async markTimeoutRecordsAsFailed(): Promise<number> {
    const maxRetries = parseInt(process.env.PROFIT_SHARING_MAX_RETRIES || '24');
    
    // 获取超时的记录
    const timeoutRecords = await pool.query(
      `SELECT psr.id, psr.out_order_no, psr.commission_id
       FROM profit_sharing_records psr
       WHERE psr.status = 'processing'
       AND COALESCE(psr.retry_count, 0) >= $1`,
      [maxRetries]
    );

    let count = 0;
    for (const record of timeoutRecords.rows) {
      // 更新分账记录状态
      await pool.query(
        `UPDATE profit_sharing_records 
         SET status = 'failed', fail_reason = '查询超时，已达最大重试次数'
         WHERE id = $1`,
        [record.id]
      );
      
      // 更新佣金记录状态
      await pool.query(
        `UPDATE commission_records 
         SET status = 'cancelled', fail_reason = '分账查询超时', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [record.commission_id]
      );
      
      count++;
    }

    return count;
  }

  /**
   * 使用公钥加密（用于加密姓名）
   */
  private encryptWithPublicKey(data: string, publicKey: string): string {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1'
      },
      buffer
    );
    return encrypted.toString('base64');
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * 检查分账限额
   * @param amount 分账金额（分）
   * @param orderAmount 订单总金额（分）
   * @returns 检查结果
   */
  async checkProfitSharingLimits(amount: number, orderAmount: number): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // 检查单笔分账不超过订单金额的 30%
    const maxAllowed = Math.floor(orderAmount * 0.30);
    if (amount > maxAllowed) {
      return {
        allowed: false,
        reason: `分账金额 ${amount / 100} 元超过订单金额 30% 限制（最大 ${maxAllowed / 100} 元）`
      };
    }

    // 检查单日分账总额（可配置，默认 100 万）
    const dailyLimit = parseInt(process.env.PROFIT_SHARING_DAILY_LIMIT || '100000000'); // 默认 100 万分
    const todayTotal = await this.getTodayProfitSharingTotal();
    
    if (todayTotal + amount > dailyLimit) {
      return {
        allowed: false,
        reason: `今日分账总额已达上限（${dailyLimit / 100} 元），当前已分账 ${todayTotal / 100} 元`
      };
    }

    return { allowed: true };
  }

  /**
   * 获取今日分账总额
   */
  private async getTodayProfitSharingTotal(): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM profit_sharing_records
       WHERE status IN ('processing', 'success')
       AND created_at >= CURRENT_DATE`
    );
    return parseInt(result.rows[0].total);
  }

  /**
   * 获取代理商的分账统计
   */
  async getAgentProfitSharingStats(agentId: number): Promise<{
    totalAmount: number;
    successAmount: number;
    pendingAmount: number;
    failedCount: number;
  }> {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(psr.amount), 0) as total_amount,
        COALESCE(SUM(psr.amount) FILTER (WHERE psr.status = 'success'), 0) as success_amount,
        COALESCE(SUM(psr.amount) FILTER (WHERE psr.status = 'processing'), 0) as pending_amount,
        COUNT(*) FILTER (WHERE psr.status = 'failed') as failed_count
       FROM profit_sharing_records psr
       JOIN commission_records cr ON psr.commission_id = cr.id
       WHERE cr.agent_id = $1`,
      [agentId]
    );

    return {
      totalAmount: parseInt(result.rows[0].total_amount),
      successAmount: parseInt(result.rows[0].success_amount),
      pendingAmount: parseInt(result.rows[0].pending_amount),
      failedCount: parseInt(result.rows[0].failed_count)
    };
  }
}

export const profitSharingService = ProfitSharingService.getInstance();
