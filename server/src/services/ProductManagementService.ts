import { pool } from '../db/database';
import Redis from 'ioredis';
import { getWebSocketService } from './WebSocketService';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export interface PlanFeature {
  id?: number;
  planId?: number;
  featureCode: string;
  featureName: string;
  featureValue: number;
  featureUnit: string;
}

export interface SubscriptionPlan {
  id?: number;
  planCode: string;
  planName: string;
  planType?: 'base' | 'booster';                // 套餐类型：base=基础套餐, booster=加量包
  price: number;
  billingCycle: 'monthly' | 'yearly';        // 计费周期（用于前端价格显示）
  quotaCycleType: 'monthly' | 'yearly';      // 配额重置周期
  durationDays: number;                       // 套餐有效期（天数）
  validityPeriod: 'monthly' | 'yearly' | 'permanent';  // 套餐有效期类型（用于前端显示和自动计算天数）
  isActive: boolean;
  description?: string;
  displayOrder: number;
  agentDiscountRate?: number; // 代理商折扣比例（1-100，默认100表示无折扣）
  features?: PlanFeature[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConfigChange {
  id?: number;
  planId: number;
  changedBy: number;
  changeType: string;
  oldValue: string;
  newValue: string;
  createdAt?: Date;
}

/**
 * 商品管理服务
 * 负责套餐配置的增删改查和变更历史记录
 */
export class ProductManagementService {
  /**
   * 获取所有套餐（包括未激活的）
   * @param includeInactive 是否包括未激活的套餐
   * @param planType 套餐类型筛选（可选）
   * @returns 套餐列表
   */
  async getAllPlans(includeInactive: boolean = false, planType?: 'base' | 'booster'): Promise<SubscriptionPlan[]> {
    try {
      let query = `
        SELECT 
          sp.id,
          sp.plan_code as "planCode",
          sp.plan_name as "planName",
          COALESCE(sp.plan_type, 'base') as "planType",
          sp.price,
          sp.billing_cycle as "billingCycle",
          COALESCE(sp.quota_cycle_type, sp.billing_cycle, 'monthly') as "quotaCycleType",
          sp.duration_days as "durationDays",
          CASE 
            WHEN sp.duration_days >= 36500 THEN 'permanent'
            WHEN sp.duration_days >= 365 THEN 'yearly'
            ELSE 'monthly'
          END as "validityPeriod",
          sp.is_active as "isActive",
          sp.description,
          sp.display_order as "displayOrder",
          COALESCE(sp.agent_discount_rate, 100) as "agentDiscountRate",
          sp.created_at as "createdAt",
          sp.updated_at as "updatedAt",
          json_agg(
            json_build_object(
              'id', pf.id,
              'planId', pf.plan_id,
              'featureCode', pf.feature_code,
              'featureName', pf.feature_name,
              'featureValue', pf.feature_value,
              'featureUnit', pf.feature_unit
            ) ORDER BY pf.feature_code
          ) FILTER (WHERE pf.id IS NOT NULL) as features
        FROM subscription_plans sp
        LEFT JOIN plan_features pf ON pf.plan_id = sp.id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (!includeInactive) {
        query += ` AND sp.is_active = TRUE`;
      }
      
      if (planType) {
        query += ` AND COALESCE(sp.plan_type, 'base') = $${paramIndex++}`;
        params.push(planType);
      }
      
      query += ` GROUP BY sp.id ORDER BY sp.display_order ASC, sp.id ASC`;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('获取套餐列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取套餐
   * @param planId 套餐ID
   * @returns 套餐信息
   */
  async getPlanById(planId: number): Promise<SubscriptionPlan | null> {
    try {
      const result = await pool.query(
        `SELECT 
          sp.id,
          sp.plan_code as "planCode",
          sp.plan_name as "planName",
          COALESCE(sp.plan_type, 'base') as "planType",
          sp.price,
          sp.billing_cycle as "billingCycle",
          COALESCE(sp.quota_cycle_type, sp.billing_cycle, 'monthly') as "quotaCycleType",
          sp.duration_days as "durationDays",
          CASE 
            WHEN sp.duration_days >= 36500 THEN 'permanent'
            WHEN sp.duration_days >= 365 THEN 'yearly'
            ELSE 'monthly'
          END as "validityPeriod",
          sp.is_active as "isActive",
          sp.description,
          sp.display_order as "displayOrder",
          COALESCE(sp.agent_discount_rate, 100) as "agentDiscountRate",
          sp.created_at as "createdAt",
          sp.updated_at as "updatedAt",
          json_agg(
            json_build_object(
              'id', pf.id,
              'planId', pf.plan_id,
              'featureCode', pf.feature_code,
              'featureName', pf.feature_name,
              'featureValue', pf.feature_value,
              'featureUnit', pf.feature_unit
            ) ORDER BY pf.feature_code
          ) FILTER (WHERE pf.id IS NOT NULL) as features
        FROM subscription_plans sp
        LEFT JOIN plan_features pf ON pf.plan_id = sp.id
        WHERE sp.id = $1
        GROUP BY sp.id`,
        [planId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('获取套餐失败:', error);
      throw error;
    }
  }

  /**
   * 创建新套餐
   * @param plan 套餐信息
   * @param adminId 管理员ID
   * @returns 创建的套餐
   */
  async createPlan(plan: SubscriptionPlan, adminId: number): Promise<SubscriptionPlan> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 加量包验证：至少需要一个 feature_value > 0
      if (plan.planType === 'booster') {
        const hasValidFeature = plan.features?.some(f => f.featureValue > 0);
        if (!hasValidFeature) {
          throw new Error('加量包配置无效，至少需要一个配额项的值大于0');
        }
      }
      
      // 根据 validityPeriod 计算 durationDays
      let durationDays = plan.durationDays;
      if (plan.validityPeriod === 'permanent') {
        durationDays = 36500; // 100年，表示永久
      } else if (plan.validityPeriod === 'yearly') {
        durationDays = 365;
      } else if (plan.validityPeriod === 'monthly') {
        durationDays = 30;
      }
      
      // 插入套餐
      const planResult = await client.query(
        `INSERT INTO subscription_plans (
          plan_code, plan_name, plan_type, price, billing_cycle, quota_cycle_type, duration_days,
          is_active, description, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          plan.planCode,
          plan.planName,
          plan.planType || 'base',
          plan.price,
          plan.billingCycle,
          plan.quotaCycleType || plan.billingCycle || 'monthly',
          durationDays,
          plan.isActive,
          plan.description || null,
          plan.displayOrder
        ]
      );
      
      const createdPlan = planResult.rows[0];
      
      // 插入功能配额
      if (plan.features && plan.features.length > 0) {
        for (const feature of plan.features) {
          await client.query(
            `INSERT INTO plan_features (
              plan_id, feature_code, feature_name, feature_value, feature_unit
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              createdPlan.id,
              feature.featureCode,
              feature.featureName,
              feature.featureValue,
              feature.featureUnit
            ]
          );
        }
      }
      
      // 记录变更历史
      await this.recordConfigChange(
        client,
        createdPlan.id,
        adminId,
        'create',
        null,
        JSON.stringify(createdPlan)
      );
      
      await client.query('COMMIT');
      
      // 清除缓存
      await this.clearPlanCache(plan.planCode);
      
      // 广播更新
      await this.broadcastPlanUpdate('created', createdPlan.id);
      
      return await this.getPlanById(createdPlan.id) as SubscriptionPlan;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('创建套餐失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新套餐信息
   * @param planId 套餐ID
   * @param updates 更新内容
   * @param adminId 管理员ID
   * @returns 更新后的套餐
   */
  async updatePlan(
    planId: number,
    updates: Partial<SubscriptionPlan>,
    adminId: number
  ): Promise<SubscriptionPlan> {
    const client = await pool.connect();
    
    try {
      console.log('[ProductManagementService] 开始更新套餐:', { planId, updates, adminId });
      
      await client.query('BEGIN');
      
      // 获取原始数据 (使用 client 而不是 pool 以保持在同一事务中)
      const oldPlanResult = await client.query(
        `SELECT 
          sp.id,
          sp.plan_code as "planCode",
          sp.plan_name as "planName",
          sp.price,
          sp.billing_cycle as "billingCycle",
          COALESCE(sp.quota_cycle_type, sp.billing_cycle, 'monthly') as "quotaCycleType",
          sp.duration_days as "durationDays",
          sp.is_active as "isActive",
          sp.description,
          sp.display_order as "displayOrder",
          COALESCE(sp.agent_discount_rate, 100) as "agentDiscountRate",
          sp.created_at as "createdAt",
          sp.updated_at as "updatedAt",
          json_agg(
            json_build_object(
              'id', pf.id,
              'planId', pf.plan_id,
              'featureCode', pf.feature_code,
              'featureName', pf.feature_name,
              'featureValue', pf.feature_value,
              'featureUnit', pf.feature_unit
            ) ORDER BY pf.feature_code
          ) FILTER (WHERE pf.id IS NOT NULL) as features
        FROM subscription_plans sp
        LEFT JOIN plan_features pf ON pf.plan_id = sp.id
        WHERE sp.id = $1
        GROUP BY sp.id`,
        [planId]
      );
      
      if (oldPlanResult.rows.length === 0) {
        throw new Error('套餐不存在');
      }
      
      const oldPlan = oldPlanResult.rows[0];
      
      console.log('[ProductManagementService] 原始套餐数据:', oldPlan);
      
      // 更新套餐基本信息
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;
      
      if (updates.planName !== undefined) {
        updateFields.push(`plan_name = $${paramIndex++}`);
        updateValues.push(updates.planName);
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'name',
          oldPlan.planName,
          updates.planName
        );
      }
      
      if (updates.price !== undefined) {
        updateFields.push(`price = $${paramIndex++}`);
        updateValues.push(updates.price);
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'price',
          oldPlan.price.toString(),
          updates.price.toString()
        );
      }
      
      if (updates.billingCycle !== undefined) {
        updateFields.push(`billing_cycle = $${paramIndex++}`);
        updateValues.push(updates.billingCycle);
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'billing_cycle',
          oldPlan.billingCycle,
          updates.billingCycle
        );
      }
      
      // 配额重置周期更新
      if (updates.quotaCycleType !== undefined) {
        updateFields.push(`quota_cycle_type = $${paramIndex++}`);
        updateValues.push(updates.quotaCycleType);
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'quota_cycle_type',
          oldPlan.quotaCycleType || 'monthly',
          updates.quotaCycleType
        );
      }
      
      // 套餐有效期更新（根据 validityPeriod 计算 durationDays）
      if (updates.validityPeriod !== undefined) {
        let newDurationDays: number;
        if (updates.validityPeriod === 'permanent') {
          newDurationDays = 36500; // 100年，表示永久
        } else if (updates.validityPeriod === 'yearly') {
          newDurationDays = 365;
        } else {
          newDurationDays = 30;
        }
        updateFields.push(`duration_days = $${paramIndex++}`);
        updateValues.push(newDurationDays);
        
        // 计算旧的有效期类型
        let oldValidityPeriod: string;
        if (oldPlan.durationDays >= 36500) {
          oldValidityPeriod = 'permanent';
        } else if (oldPlan.durationDays >= 365) {
          oldValidityPeriod = 'yearly';
        } else {
          oldValidityPeriod = 'monthly';
        }
        
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'validity_period',
          oldValidityPeriod,
          updates.validityPeriod
        );
      } else if (updates.durationDays !== undefined) {
        // 直接更新天数（兼容旧逻辑）
        updateFields.push(`duration_days = $${paramIndex++}`);
        updateValues.push(updates.durationDays);
      }
      
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(updates.description);
      }
      
      if (updates.displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramIndex++}`);
        updateValues.push(updates.displayOrder);
      }
      
      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(updates.isActive);
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'status',
          oldPlan.isActive ? 'active' : 'inactive',
          updates.isActive ? 'active' : 'inactive'
        );
      }
      

      // 代理商折扣比例更新
      if (updates.agentDiscountRate !== undefined) {
        // 验证折扣比例
        if (!Number.isInteger(updates.agentDiscountRate) || 
            updates.agentDiscountRate < 1 || 
            updates.agentDiscountRate > 100) {
          throw new Error('代理商折扣比例必须是 1-100 之间的整数');
        }
        updateFields.push(`agent_discount_rate = $${paramIndex++}`);
        updateValues.push(updates.agentDiscountRate);
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'agent_discount_rate',
          (oldPlan.agentDiscountRate || 100).toString(),
          updates.agentDiscountRate.toString()
        );
      }
      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(planId);
        
        const sql = `UPDATE subscription_plans 
           SET ${updateFields.join(', ')}
           WHERE id = $${paramIndex}`;
        
        console.log('[ProductManagementService] SQL:', sql);
        console.log('[ProductManagementService] Values:', updateValues);
        
        await client.query(sql, updateValues);
      }
      
      // 更新功能配额
      if (updates.features) {
        console.log('[ProductManagementService] 准备更新 features:', JSON.stringify(updates.features, null, 2));
        
        // 检查是否有重复的 featureCode
        const featureCodes = updates.features.map(f => f.featureCode);
        const duplicates = featureCodes.filter((code, index) => featureCodes.indexOf(code) !== index);
        if (duplicates.length > 0) {
          throw new Error(`功能配额中有重复的代码: ${duplicates.join(', ')}`);
        }
        
        // 删除旧的功能配额
        const deleteResult = await client.query(
          `DELETE FROM plan_features WHERE plan_id = $1`,
          [planId]
        );
        console.log('[ProductManagementService] 删除了', deleteResult.rowCount, '条旧的功能配额');
        
        // 插入新的功能配额
        for (const feature of updates.features) {
          console.log('[ProductManagementService] 插入功能配额:', feature);
          await client.query(
            `INSERT INTO plan_features (
              plan_id, feature_code, feature_name, feature_value, feature_unit
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              planId,
              feature.featureCode,
              feature.featureName,
              feature.featureValue,
              feature.featureUnit
            ]
          );
        }
        
        await this.recordConfigChange(
          client,
          planId,
          adminId,
          'features',
          JSON.stringify(oldPlan.features),
          JSON.stringify(updates.features)
        );
      }
      
      // 如果更新了配额重置周期，同步到所有使用该套餐的活跃订阅
      if (updates.quotaCycleType !== undefined) {
        const syncResult = await client.query(
          `SELECT sync_subscription_quota_cycle($1) as updated_count`,
          [planId]
        );
        const updatedCount = syncResult.rows[0]?.updated_count || 0;
        if (updatedCount > 0) {
          console.log(`[ProductManagementService] 已同步 ${updatedCount} 个用户订阅的配额周期`);
        }
      }
      
      await client.query('COMMIT');
      
      // 清除缓存
      await this.clearPlanCache(oldPlan.planCode);
      
      // 广播更新（不阻塞主流程）
      this.broadcastPlanUpdate('updated', planId).catch(err => {
        console.error('[ProductManagementService] 广播更新失败（已忽略）:', err.message);
      });
      
      return await this.getPlanById(planId) as SubscriptionPlan;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('更新套餐失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除套餐
   * @param planId 套餐ID
   * @param adminId 管理员ID
   */
  async deletePlan(planId: number, adminId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 获取套餐信息
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('套餐不存在');
      }
      
      // 检查是否有用户正在使用（包括基础订阅和加量包）
      const usageCheck = await client.query(
        `SELECT COUNT(*) as count 
         FROM user_subscriptions 
         WHERE plan_id = $1 AND status = 'active'`,
        [planId]
      );
      
      if (parseInt(usageCheck.rows[0].count) > 0) {
        const errorMsg = plan.planType === 'booster' 
          ? '该加量包有活跃订阅，无法删除'
          : '该套餐正在被用户使用，无法删除';
        throw new Error(errorMsg);
      }
      
      // 如果是加量包，还需要检查是否有活跃的加量包配额
      if (plan.planType === 'booster') {
        const boosterQuotaCheck = await client.query(
          `SELECT COUNT(*) as count 
           FROM user_booster_quotas ubq
           JOIN user_subscriptions us ON ubq.booster_subscription_id = us.id
           WHERE us.plan_id = $1 AND ubq.status = 'active'`,
          [planId]
        );
        
        if (parseInt(boosterQuotaCheck.rows[0].count) > 0) {
          throw new Error('该加量包有活跃配额记录，无法删除');
        }
      }
      
      // 记录变更历史
      await this.recordConfigChange(
        client,
        planId,
        adminId,
        'delete',
        JSON.stringify(plan),
        null
      );
      
      // 删除套餐（级联删除功能配额）
      await client.query(
        `DELETE FROM subscription_plans WHERE id = $1`,
        [planId]
      );
      
      await client.query('COMMIT');
      
      // 清除缓存
      await this.clearPlanCache(plan.planCode);
      
      // 广播更新
      await this.broadcastPlanUpdate('deleted', planId);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('删除套餐失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取配置变更历史
   * @param planId 套餐ID（可选）
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 变更历史列表
   */
  async getConfigHistory(
    planId?: number,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    history: ConfigChange[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * pageSize;
      
      let countQuery = `SELECT COUNT(*) as total FROM product_config_history`;
      let dataQuery = `
        SELECT 
          pch.*,
          sp.plan_name,
          sp.plan_code,
          u.username as changed_by_username
        FROM product_config_history pch
        LEFT JOIN subscription_plans sp ON sp.id = pch.plan_id
        LEFT JOIN users u ON u.id = pch.changed_by
      `;
      
      const params: any[] = [];
      
      if (planId) {
        countQuery += ` WHERE plan_id = $1`;
        dataQuery += ` WHERE pch.plan_id = $1`;
        params.push(planId);
      }
      
      // 获取总数
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.total || '0');
      
      // 获取分页数据
      dataQuery += ` ORDER BY pch.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(pageSize, offset);
      
      const result = await pool.query(dataQuery, params);
      
      return {
        history: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('获取配置历史失败:', error);
      throw error;
    }
  }

  /**
   * 记录配置变更
   * @param client 数据库客户端
   * @param planId 套餐ID
   * @param adminId 管理员ID
   * @param changeType 变更类型
   * @param oldValue 旧值
   * @param newValue 新值
   */
  private async recordConfigChange(
    client: any,
    planId: number,
    adminId: number,
    changeType: string,
    oldValue: string | null,
    newValue: string | null
  ): Promise<void> {
    await client.query(
      `INSERT INTO product_config_history (
        plan_id, changed_by, change_type, old_value, new_value
      ) VALUES ($1, $2, $3, $4, $5)`,
      [planId, adminId, changeType, oldValue, newValue]
    );
  }

  /**
   * 清除套餐缓存
   * @param planCode 套餐代码
   */
  private async clearPlanCache(planCode: string): Promise<void> {
    try {
      await redis.del(`plan:${planCode}`);
      await redis.del('plans:all:active');
      await redis.del('plans:all');
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 广播套餐更新
   * @param action 操作类型
   * @param planId 套餐ID
   */
  private async broadcastPlanUpdate(action: string, planId: number): Promise<void> {
    try {
      const wsService = getWebSocketService();
      const plans = await this.getAllPlans(false);
      
      // 广播给所有连接的客户端
      wsService.broadcastToAll('plans_updated', {
        action,
        planId,
        plans
      });
    } catch (error) {
      console.error('广播套餐更新失败:', error);
    }
  }
}

export const productManagementService = new ProductManagementService();
