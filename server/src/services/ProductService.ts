import { pool } from '../db/database';
import { ConfigHistory, Plan } from '../types/subscription';
import { subscriptionService } from './SubscriptionService';
import { AuditLogService } from './AuditLogService';

export class ProductService {
  /**
   * 更新套餐配置
   */
  async updatePlan(
    planId: number,
    data: {
      price?: number;
      features?: { feature_code: string; feature_value: number }[];
      is_active?: boolean;
    },
    adminId: number,
    ipAddress: string,
    userAgent: string
  ): Promise<Plan> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 获取当前配置
      const currentPlan = await client.query(
        'SELECT * FROM subscription_plans WHERE id = $1',
        [planId]
      );

      if (currentPlan.rows.length === 0) {
        throw new Error('套餐不存在');
      }

      const oldPlan = currentPlan.rows[0];

      // 更新套餐基本信息
      if (data.price !== undefined || data.is_active !== undefined) {
        const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
        const params: any[] = [planId];
        let paramIndex = 2;

        if (data.price !== undefined) {
          updates.push(`price = $${paramIndex}`);
          params.push(data.price);
          paramIndex++;

          // 记录价格变更历史
          await this.recordConfigChange({
            planId,
            changedBy: adminId,
            changeType: 'price',
            fieldName: 'price',
            oldValue: oldPlan.price.toString(),
            newValue: data.price.toString(),
            ipAddress,
            userAgent
          }, client);
        }

        if (data.is_active !== undefined) {
          updates.push(`is_active = $${paramIndex}`);
          params.push(data.is_active);
          paramIndex++;

          // 记录状态变更历史
          await this.recordConfigChange({
            planId,
            changedBy: adminId,
            changeType: 'status',
            fieldName: 'is_active',
            oldValue: oldPlan.is_active.toString(),
            newValue: data.is_active.toString(),
            ipAddress,
            userAgent
          }, client);
        }

        await client.query(
          `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = $1`,
          params
        );
      }

      // 更新功能配额
      if (data.features && data.features.length > 0) {
        for (const feature of data.features) {
          // 获取旧值
          const oldFeature = await client.query(
            'SELECT feature_value FROM plan_features WHERE plan_id = $1 AND feature_code = $2',
            [planId, feature.feature_code]
          );

          if (oldFeature.rows.length > 0) {
            // 更新
            await client.query(
              'UPDATE plan_features SET feature_value = $1 WHERE plan_id = $2 AND feature_code = $3',
              [feature.feature_value, planId, feature.feature_code]
            );

            // 记录变更历史
            await this.recordConfigChange({
              planId,
              changedBy: adminId,
              changeType: 'feature',
              fieldName: feature.feature_code,
              oldValue: oldFeature.rows[0].feature_value.toString(),
              newValue: feature.feature_value.toString(),
              ipAddress,
              userAgent
            }, client);
          }
        }
      }

      await client.query('COMMIT');

      // 记录审计日志
      await AuditLogService.logAdminAction({
        adminId,
        actionType: 'update_plan',
        resourceType: 'plan',
        resourceId: planId.toString(),
        details: {
          changes: data,
          oldPrice: oldPlan.price,
          newPrice: data.price,
        },
        ipAddress,
        userAgent,
      });

      // 清除缓存
      await subscriptionService.clearPlanCache(oldPlan.plan_code);

      // 获取更新后的套餐
      const updatedPlan = await subscriptionService.getPlanConfig(oldPlan.plan_code);
      return updatedPlan!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 记录配置变更
   */
  async recordConfigChange(
    change: {
      planId: number;
      changedBy: number;
      changeType: string;
      fieldName: string;
      oldValue: string;
      newValue: string;
      ipAddress: string;
      userAgent: string;
    },
    client?: any
  ): Promise<void> {
    const db = client || pool;

    await db.query(
      `INSERT INTO product_config_history 
       (plan_id, changed_by, change_type, field_name, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        change.planId,
        change.changedBy,
        change.changeType,
        change.fieldName,
        change.oldValue,
        change.newValue,
        change.ipAddress,
        change.userAgent
      ]
    );

    // 保持最近50条记录
    await db.query(
      `DELETE FROM product_config_history 
       WHERE plan_id = $1 
       AND id NOT IN (
         SELECT id FROM product_config_history 
         WHERE plan_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50
       )`,
      [change.planId]
    );
  }

  /**
   * 获取配置历史
   */
  async getConfigHistory(planId: number, limit: number = 50): Promise<ConfigHistory[]> {
    const result = await pool.query(
      `SELECT h.*, u.username as changed_by_name
       FROM product_config_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.plan_id = $1
       ORDER BY h.created_at DESC
       LIMIT $2`,
      [planId, limit]
    );

    return result.rows;
  }

  /**
   * 回滚配置到历史版本
   */
  async rollbackConfig(historyId: number, adminId: number, ipAddress: string, userAgent: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取历史记录
      const history = await client.query(
        'SELECT * FROM product_config_history WHERE id = $1',
        [historyId]
      );

      if (history.rows.length === 0) {
        throw new Error('历史记录不存在');
      }

      const record = history.rows[0];

      // 根据变更类型回滚
      if (record.change_type === 'price') {
        await client.query(
          'UPDATE subscription_plans SET price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [parseFloat(record.old_value), record.plan_id]
        );
      } else if (record.change_type === 'status') {
        await client.query(
          'UPDATE subscription_plans SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [record.old_value === 'true', record.plan_id]
        );
      } else if (record.change_type === 'feature') {
        await client.query(
          'UPDATE plan_features SET feature_value = $1 WHERE plan_id = $2 AND feature_code = $3',
          [parseInt(record.old_value), record.plan_id, record.field_name]
        );
      }

      // 记录回滚操作
      await this.recordConfigChange({
        planId: record.plan_id,
        changedBy: adminId,
        changeType: 'rollback',
        fieldName: record.field_name,
        oldValue: record.new_value,
        newValue: record.old_value,
        ipAddress,
        userAgent
      }, client);

      await client.query('COMMIT');

      // 记录审计日志
      await AuditLogService.logAdminAction({
        adminId,
        actionType: 'rollback_config',
        resourceType: 'plan',
        resourceId: record.plan_id.toString(),
        details: {
          historyId,
          fieldName: record.field_name,
          oldValue: record.new_value,
          newValue: record.old_value,
        },
        ipAddress,
        userAgent,
      });

      // 清除缓存
      const plan = await pool.query('SELECT plan_code FROM subscription_plans WHERE id = $1', [record.plan_id]);
      if (plan.rows.length > 0) {
        await subscriptionService.clearPlanCache(plan.rows[0].plan_code);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 通知配置变更（发送给所有管理员）
   */
  async notifyConfigChange(change: {
    planId: number;
    planName: string;
    changeType: string;
    changedBy: string;
  }): Promise<void> {
    // 获取所有管理员
    const admins = await pool.query(
      "SELECT id, username, email FROM users WHERE role = 'admin'"
    );

    // TODO: 实现邮件通知
    console.log(`📧 配置变更通知: ${change.planName} - ${change.changeType} by ${change.changedBy}`);
    console.log(`   通知 ${admins.rows.length} 位管理员`);

    // TODO: 实现 WebSocket 实时推送
    // 可以通过 WebSocket 向所有在线管理员推送通知
  }
}

export const productService = new ProductService();
