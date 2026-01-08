/**
 * 微信授权服务
 * 使用小程序方式获取用户 OpenID
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
