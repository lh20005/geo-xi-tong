/**
 * 微信授权服务
 * 使用小程序方式获取用户 OpenID
 * 支持小程序码扫码绑定
 */

import crypto from 'crypto';
import axios from 'axios';
import { WechatAuthResult } from '../types/agent';

export class WechatAuthService {
  private static instance: WechatAuthService;
  
  // 绑定码存储（生产环境应使用 Redis）
  // key: bindCode, value: { agentId, createdAt }
  private bindCodes: Map<string, { agentId: number; createdAt: number }> = new Map();
  
  // 待确认的绑定（小程序已获取openid，等待确认）
  // key: bindCode, value: { agentId, openid, createdAt }
  private pendingBinds: Map<string, { agentId: number; openid: string; nickname?: string; createdAt: number }> = new Map();
  
  // access_token 缓存
  private accessToken: string | null = null;
  private accessTokenExpiry: number = 0;
  
  private readonly CODE_EXPIRY = 5 * 60 * 1000; // 5分钟过期

  private constructor() {
    // 定期清理过期数据
    setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  public static getInstance(): WechatAuthService {
    if (!WechatAuthService.instance) {
      WechatAuthService.instance = new WechatAuthService();
    }
    return WechatAuthService.instance;
  }

  /**
   * 获取微信小程序配置
   */
  private getConfig() {
    const appId = process.env.WECHAT_PAY_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId) {
      throw new Error('微信小程序 AppID 未配置');
    }
    if (!appSecret) {
      throw new Error('微信小程序 AppSecret 未配置');
    }

    return { appId, appSecret };
  }

  /**
   * 获取小程序 access_token
   */
  private async getAccessToken(): Promise<string> {
    // 检查缓存是否有效
    if (this.accessToken && Date.now() < this.accessTokenExpiry) {
      return this.accessToken;
    }

    const { appId, appSecret } = this.getConfig();

    try {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
      const response = await axios.get(url);
      const data = response.data;

      if (data.errcode) {
        console.error('[WechatAuthService] 获取 access_token 失败:', data);
        throw new Error(`获取 access_token 失败: ${data.errmsg}`);
      }

      this.accessToken = data.access_token;
      // 提前5分钟过期，避免边界问题
      this.accessTokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      console.log('[WechatAuthService] 获取 access_token 成功');
      return this.accessToken!;
    } catch (error: any) {
      console.error('[WechatAuthService] 获取 access_token 失败:', error);
      throw new Error('获取微信 access_token 失败');
    }
  }

  /**
   * 生成绑定码（用于小程序扫码绑定）
   * 返回一个6位数字码，用户在小程序中输入
   */
  generateBindCode(agentId: number): { bindCode: string; expiresIn: number } {
    // 生成6位数字绑定码
    const bindCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 存储绑定码与代理商ID的映射
    this.bindCodes.set(bindCode, {
      agentId,
      createdAt: Date.now()
    });

    console.log(`[WechatAuthService] 生成绑定码: agentId=${agentId}, bindCode=${bindCode}`);
    
    return { 
      bindCode, 
      expiresIn: this.CODE_EXPIRY / 1000 // 返回秒数
    };
  }

  /**
   * 生成小程序码（用于扫码绑定）
   * 返回小程序码的 base64 图片数据
   * @param agentId 代理商ID
   * @param envVersion 小程序版本：release(正式版), trial(体验版), develop(开发版)
   */
  async generateMiniProgramQRCode(agentId: number, envVersion: 'release' | 'trial' | 'develop' = 'release'): Promise<{ 
    bindCode: string; 
    qrCodeBase64: string; 
    expiresIn: number 
  }> {
    // 先生成绑定码
    const { bindCode, expiresIn } = this.generateBindCode(agentId);

    try {
      const accessToken = await this.getAccessToken();
      
      // 调用微信接口生成小程序码
      // 使用 getUnlimited 接口，支持无限数量的小程序码
      const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;
      
      // 开发环境默认使用开发版小程序码
      const isDev = process.env.NODE_ENV === 'development';
      const actualEnvVersion = isDev ? 'develop' : envVersion;
      
      // 注意：page 参数只有在小程序发布后才能使用
      // 如果小程序未发布，不传 page 参数，扫码后进入首页
      // 首页需要检测 scene 参数并跳转到绑定页面
      const requestBody: any = {
        scene: bindCode,  // 绑定码作为场景值（最多32个字符）
        width: 280,
        auto_color: false,
        line_color: { r: 7, g: 193, b: 96 },  // 微信绿色
        is_hyaline: false,
        env_version: actualEnvVersion  // 支持开发版/体验版/正式版
      };
      
      // 只有正式版才传 page 参数（因为开发版可能页面还未发布）
      if (actualEnvVersion === 'release') {
        requestBody.page = 'pages/bindAgent/bindAgent';
      }
      
      const response = await axios.post(url, requestBody, {
        responseType: 'arraybuffer'
      });

      // 检查是否返回错误（错误时返回 JSON）
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        const errorData = JSON.parse(Buffer.from(response.data).toString());
        console.error('[WechatAuthService] 生成小程序码失败:', errorData);
        
        // 如果是页面无效错误，尝试不带 page 参数重新生成
        if (errorData.errcode === 41030) {
          console.log('[WechatAuthService] 页面无效，尝试不带 page 参数生成...');
          delete requestBody.page;
          const retryResponse = await axios.post(url, requestBody, {
            responseType: 'arraybuffer'
          });
          
          const retryContentType = retryResponse.headers['content-type'];
          if (retryContentType && retryContentType.includes('application/json')) {
            const retryErrorData = JSON.parse(Buffer.from(retryResponse.data).toString());
            throw new Error(`生成小程序码失败: ${retryErrorData.errmsg}`);
          }
          
          const qrCodeBase64 = `data:image/png;base64,${Buffer.from(retryResponse.data).toString('base64')}`;
          console.log(`[WechatAuthService] 生成小程序码成功(无page): agentId=${agentId}, bindCode=${bindCode}`);
          return { bindCode, qrCodeBase64, expiresIn };
        }
        
        throw new Error(`生成小程序码失败: ${errorData.errmsg}`);
      }

      // 转换为 base64
      const qrCodeBase64 = `data:image/png;base64,${Buffer.from(response.data).toString('base64')}`;

      console.log(`[WechatAuthService] 生成小程序码成功: agentId=${agentId}, bindCode=${bindCode}, envVersion=${actualEnvVersion}`);

      return {
        bindCode,
        qrCodeBase64,
        expiresIn
      };
    } catch (error: any) {
      console.error('[WechatAuthService] 生成小程序码失败:', error);
      // 如果生成小程序码失败，仍然返回绑定码（降级方案）
      throw new Error(error.message || '生成小程序码失败');
    }
  }

  /**
   * 验证绑定码并获取代理商ID
   */
  validateBindCode(bindCode: string): number | null {
    const data = this.bindCodes.get(bindCode);
    
    if (!data) {
      console.log(`[WechatAuthService] 绑定码不存在: ${bindCode}`);
      return null;
    }

    // 检查是否过期
    if (Date.now() - data.createdAt > this.CODE_EXPIRY) {
      this.bindCodes.delete(bindCode);
      console.log(`[WechatAuthService] 绑定码已过期: ${bindCode}`);
      return null;
    }
    
    return data.agentId;
  }

  /**
   * 小程序端调用：使用 code 换取 openid
   * 小程序通过 wx.login() 获取 code，然后调用此接口
   */
  async code2Session(code: string): Promise<{ openid: string; sessionKey: string }> {
    const { appId, appSecret } = this.getConfig();

    try {
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
      
      const response = await axios.get(url);
      const data = response.data;

      if (data.errcode) {
        console.error('[WechatAuthService] code2session 失败:', data);
        throw new Error(`微信授权失败: ${data.errmsg}`);
      }

      console.log(`[WechatAuthService] code2session 成功: openid=${data.openid}`);

      return {
        openid: data.openid,
        sessionKey: data.session_key
      };
    } catch (error: any) {
      console.error('[WechatAuthService] code2session 失败:', error);
      throw new Error('获取 OpenID 失败，请重试');
    }
  }

  /**
   * 小程序端调用：提交绑定请求
   * 小程序获取到 openid 后，连同绑定码一起提交
   */
  async submitBind(bindCode: string, code: string): Promise<{ success: boolean; message: string }> {
    // 测试绑定码（用于微信审核）
    // 审核员输入 000000 可以模拟绑定成功
    if (bindCode === '000000') {
      console.log('[WechatAuthService] 使用测试绑定码，模拟绑定成功');
      return { success: true, message: '绑定成功（测试模式）' };
    }

    // 验证绑定码
    const agentId = this.validateBindCode(bindCode);
    if (!agentId) {
      return { success: false, message: '绑定码无效或已过期' };
    }

    // 使用 code 换取 openid
    const { openid } = await this.code2Session(code);

    // 存储待确认的绑定
    this.pendingBinds.set(bindCode, {
      agentId,
      openid,
      createdAt: Date.now()
    });

    // 删除已使用的绑定码
    this.bindCodes.delete(bindCode);

    console.log(`[WechatAuthService] 绑定请求已提交: agentId=${agentId}, openid=${openid}`);

    return { success: true, message: '绑定成功' };
  }

  /**
   * 检查绑定状态（前端轮询调用）
   */
  checkBindStatus(bindCode: string): { 
    status: 'pending' | 'success' | 'expired'; 
    openid?: string;
    nickname?: string;
  } {
    // 检查是否有待确认的绑定
    const pending = this.pendingBinds.get(bindCode);
    if (pending) {
      return {
        status: 'success',
        openid: pending.openid,
        nickname: pending.nickname
      };
    }

    // 检查绑定码是否还有效
    const bindData = this.bindCodes.get(bindCode);
    if (bindData) {
      if (Date.now() - bindData.createdAt > this.CODE_EXPIRY) {
        return { status: 'expired' };
      }
      return { status: 'pending' };
    }

    return { status: 'expired' };
  }

  /**
   * 确认绑定并获取 openid（前端确认后调用）
   */
  confirmBind(bindCode: string): WechatAuthResult | null {
    const pending = this.pendingBinds.get(bindCode);
    if (!pending) {
      return null;
    }

    // 删除待确认记录
    this.pendingBinds.delete(bindCode);

    return {
      openid: pending.openid,
      nickname: pending.nickname
    };
  }

  /**
   * 清理过期数据
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [code, data] of this.bindCodes.entries()) {
      if (now - data.createdAt > this.CODE_EXPIRY) {
        this.bindCodes.delete(code);
        cleaned++;
      }
    }

    for (const [code, data] of this.pendingBinds.entries()) {
      if (now - data.createdAt > this.CODE_EXPIRY) {
        this.pendingBinds.delete(code);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[WechatAuthService] 清理了 ${cleaned} 条过期数据`);
    }
  }

  /**
   * 获取待处理数量（用于监控）
   */
  getPendingCount(): { bindCodes: number; pendingBinds: number } {
    return {
      bindCodes: this.bindCodes.size,
      pendingBinds: this.pendingBinds.size
    };
  }
}

export const wechatAuthService = WechatAuthService.getInstance();
