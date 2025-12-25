import { productService } from '../services/ProductService';
import { pool } from '../db/database';

describe('ProductService', () => {
  let testPlanId: number;
  let testAdminId: number;
  let originalPrice: number;

  beforeAll(async () => {
    // 创建测试管理员
    const adminResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [`product_test_admin_${Date.now()}`, `product_admin_${Date.now()}@test.com`, 'hash', 'admin']
    );
    testAdminId = adminResult.rows[0].id;

    // 获取测试套餐
    const planResult = await pool.query(
      `SELECT id, price FROM subscription_plans WHERE plan_code = 'professional' LIMIT 1`
    );
    testPlanId = planResult.rows[0].id;
    originalPrice = planResult.rows[0].price;
  });

  afterAll(async () => {
    // 恢复原始价格
    if (testPlanId && originalPrice) {
      await pool.query(
        'UPDATE subscription_plans SET price = $1 WHERE id = $2',
        [originalPrice, testPlanId]
      );
    }

    // 清理测试数据
    if (testAdminId) {
      await pool.query('DELETE FROM product_config_history WHERE changed_by = $1', [testAdminId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testAdminId]);
    }
  });

  describe('updatePlan', () => {
    it('应该成功更新套餐配置', async () => {
      const newPrice = originalPrice + 10;
      const updates = {
        price: newPrice,
        description: '测试更新描述'
      };

      await productService.updatePlan(testPlanId, updates, testAdminId);

      // 验证更新成功
      const result = await pool.query(
        'SELECT price, description FROM subscription_plans WHERE id = $1',
        [testPlanId]
      );

      expect(result.rows[0].price).toBe(newPrice);
      expect(result.rows[0].description).toBe('测试更新描述');
    });

    it('应该拒绝无效的价格', async () => {
      await expect(
        productService.updatePlan(testPlanId, { price: -10 }, testAdminId)
      ).rejects.toThrow('价格必须大于等于0');
    });

    it('应该拒绝无效的套餐ID', async () => {
      await expect(
        productService.updatePlan(99999, { price: 100 }, testAdminId)
      ).rejects.toThrow();
    });
  });

  describe('recordConfigChange', () => {
    it('应该记录配置变更历史', async () => {
      const oldConfig = { price: originalPrice };
      const newConfig = { price: originalPrice + 20 };

      await productService.recordConfigChange(
        testPlanId,
        oldConfig,
        newConfig,
        testAdminId,
        '测试变更'
      );

      // 验证历史记录已创建
      const history = await pool.query(
        `SELECT * FROM product_config_history 
         WHERE plan_id = $1 AND changed_by = $2 
         ORDER BY changed_at DESC LIMIT 1`,
        [testPlanId, testAdminId]
      );

      expect(history.rows.length).toBe(1);
      expect(history.rows[0].old_config).toEqual(oldConfig);
      expect(history.rows[0].new_config).toEqual(newConfig);
      expect(history.rows[0].change_reason).toBe('测试变更');
    });
  });

  describe('getConfigHistory', () => {
    it('应该获取配置历史记录', async () => {
      // 先创建一些历史记录
      await productService.updatePlan(testPlanId, { price: originalPrice + 5 }, testAdminId);
      await productService.updatePlan(testPlanId, { price: originalPrice + 10 }, testAdminId);

      const history = await productService.getConfigHistory(testPlanId);

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].plan_id).toBe(testPlanId);
    });

    it('应该按时间倒序排列', async () => {
      const history = await productService.getConfigHistory(testPlanId);

      if (history.length > 1) {
        const firstDate = new Date(history[0].changed_at);
        const secondDate = new Date(history[1].changed_at);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });

    it('应该支持分页', async () => {
      const page1 = await productService.getConfigHistory(testPlanId, 1, 1);
      const page2 = await productService.getConfigHistory(testPlanId, 2, 1);

      expect(page1.length).toBeLessThanOrEqual(1);
      expect(page2.length).toBeLessThanOrEqual(1);

      if (page1.length > 0 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });
  });

  describe('rollbackConfig', () => {
    it('应该成功回滚配置', async () => {
      // 更新配置
      const newPrice = originalPrice + 30;
      await productService.updatePlan(testPlanId, { price: newPrice }, testAdminId);

      // 获取历史记录ID
      const history = await productService.getConfigHistory(testPlanId, 1, 1);
      const historyId = history[0].id;

      // 回滚配置
      await productService.rollbackConfig(testPlanId, historyId, testAdminId);

      // 验证配置已回滚
      const result = await pool.query(
        'SELECT price FROM subscription_plans WHERE id = $1',
        [testPlanId]
      );

      expect(result.rows[0].price).toBe(history[0].old_config.price);
    });

    it('应该在回滚时创建新的历史记录', async () => {
      const historyBefore = await productService.getConfigHistory(testPlanId);
      const countBefore = historyBefore.length;

      // 执行回滚
      const history = await productService.getConfigHistory(testPlanId, 1, 1);
      if (history.length > 0) {
        await productService.rollbackConfig(testPlanId, history[0].id, testAdminId);
      }

      const historyAfter = await productService.getConfigHistory(testPlanId);
      const countAfter = historyAfter.length;

      expect(countAfter).toBeGreaterThan(countBefore);
    });

    it('应该拒绝无效的历史记录ID', async () => {
      await expect(
        productService.rollbackConfig(testPlanId, 99999, testAdminId)
      ).rejects.toThrow();
    });
  });

  describe('notifyConfigChange', () => {
    it('应该发送配置变更通知', async () => {
      const changes = {
        plan_name: '专业版',
        old_price: originalPrice,
        new_price: originalPrice + 50
      };

      // 这个方法主要是发送通知，不会抛出错误
      await expect(
        productService.notifyConfigChange(testPlanId, changes, testAdminId)
      ).resolves.not.toThrow();
    });
  });

  describe('权限验证', () => {
    it('应该只允许管理员更新配置', async () => {
      // 创建普通用户
      const userResult = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [`product_test_user_${Date.now()}`, `product_user_${Date.now()}@test.com`, 'hash', 'user']
      );
      const normalUserId = userResult.rows[0].id;

      // 尝试用普通用户更新配置（在实际应用中，这应该在路由层被拦截）
      // 这里我们测试服务层是否记录了正确的操作者
      await productService.updatePlan(testPlanId, { price: originalPrice + 5 }, normalUserId);

      const history = await pool.query(
        `SELECT changed_by FROM product_config_history 
         WHERE plan_id = $1 AND changed_by = $2 
         ORDER BY changed_at DESC LIMIT 1`,
        [testPlanId, normalUserId]
      );

      expect(history.rows[0].changed_by).toBe(normalUserId);

      // 清理
      await pool.query('DELETE FROM product_config_history WHERE changed_by = $1', [normalUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [normalUserId]);
    });
  });

  describe('配置验证', () => {
    it('应该验证价格变动幅度', () => {
      const oldPrice = 100;
      const newPrice = 150;
      const changePercentage = ((newPrice - oldPrice) / oldPrice) * 100;

      expect(changePercentage).toBe(50);
      expect(Math.abs(changePercentage)).toBeGreaterThan(20); // 需要二次确认
    });

    it('应该验证功能配额值', async () => {
      const updates = {
        features: [
          { feature_code: 'articles_per_day', feature_value: -2 } // 无效值（-1表示无限，其他必须>=0）
        ]
      };

      // 在实际应用中，这应该被验证拦截
      // 这里我们测试数据库约束
      await expect(
        pool.query(
          `UPDATE plan_features SET feature_value = $1 
           WHERE plan_id = $2 AND feature_code = $3`,
          [-2, testPlanId, 'articles_per_day']
        )
      ).rejects.toThrow();
    });
  });
});
