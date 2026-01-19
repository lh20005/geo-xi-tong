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
      let status: ProfitSharingStatus = 'pending';
      if (data.state === 'FINISHED') {
        status = 'success';
      } else if (data.state === 'PROCESSING') {
        status = 'processing';
      }

      return {
        status,
        wechatOrderId: data.order_id
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`[ProfitSharingService] 查询分账结果失败: ${errorMsg}`);
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
   */
  async getPendingProfitSharingRecords(): Promise<Array<{
    id: number;
    commissionId: number;
    transactionId: string;
    outOrderNo: string;
    amount: number;
  }>> {
    const result = await pool.query(
      `SELECT id, commission_id, transaction_id, out_order_no, amount
       FROM profit_sharing_records
       WHERE status = 'processing'
       ORDER BY created_at ASC`
    );

    return result.rows.map(row => ({
      id: row.id,
      commissionId: row.commission_id,
      transactionId: row.transaction_id,
      outOrderNo: row.out_order_no,
      amount: row.amount
    }));
  }

  /**
   * 处理待处理的分账记录（定时任务调用）
   */
  async processPendingRecords(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    const pendingRecords = await this.getPendingProfitSharingRecords();
    
    const result = {
      processed: pendingRecords.length,
      success: 0,
      failed: 0
    };

    if (pendingRecords.length === 0) {
      console.log('[ProfitSharingService] 没有待查询的分账记录');
      return result;
    }

    console.log(`[ProfitSharingService] 开始处理 ${pendingRecords.length} 条待查询分账记录`);

    // 避免循环依赖，我们需要动态导入或通过事件/回调处理 CommissionService
    // 但为了简单起见，这里假设 updateCommissionStatus 可以通过 sql 直接更新
    // 或者我们在此处不引入 CommissionService，而是只更新 ProfitSharingRecord，
    // CommissionService 的状态更新留给另一层或通过 sql。
    // 更好的方式是：在 SchedulerService 里，我们看到它调用了 commissionService.updateCommissionStatus
    // 所以 ProfitSharingService 不应该直接依赖 CommissionService。
    // 但是，为了封装逻辑，我们可以让 CommissionService 监听或定期检查 ProfitSharingRecord 的状态？
    // 或者，我们可以将 CommissionService 注入？
    // 为了避免循环依赖 (CommissionService -> ProfitSharingService -> CommissionService)，
    // 我们可以在这里只更新 profit_sharing_records 表。
    // 并且我们还需要更新 commission_records 表。
    // 我们可以直接使用 pool 更新 commission_records 表，而不通过 CommissionService 类。
    
    for (const record of pendingRecords) {
      try {
        const queryResult = await this.queryProfitSharing(
          record.outOrderNo,
          record.transactionId
        );

        if (queryResult.status === 'success') {
          // 分账成功
          await this.updateProfitSharingRecord(
            record.outOrderNo,
            'success',
            queryResult.wechatOrderId
          );
          
          // 直接更新 commission_records 表
          await pool.query(
            `UPDATE commission_records 
             SET status = 'settled', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [record.commissionId]
          );
          
          console.log(`[ProfitSharingService] 分账 ${record.outOrderNo} 成功`);
          result.success++;
        } else if (queryResult.status === 'failed') {
          // 分账失败
          await this.updateProfitSharingRecord(
            record.outOrderNo,
            'failed',
            undefined,
            queryResult.failReason
          );
          
          // 直接更新 commission_records 表
          await pool.query(
            `UPDATE commission_records 
             SET status = 'cancelled', fail_reason = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [record.commissionId, queryResult.failReason]
          );
          
          console.log(`[ProfitSharingService] 分账 ${record.outOrderNo} 失败: ${queryResult.failReason}`);
          result.failed++;
        }
        // processing 状态继续等待
      } catch (error: any) {
        console.error(`[ProfitSharingService] 查询分账 ${record.outOrderNo} 失败:`, error);
      }
    }

    console.log('[ProfitSharingService] 分账结果处理完成');
    return result;
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
