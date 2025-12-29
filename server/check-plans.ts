import { pool } from './src/db/database';

(async () => {
  try {
    const result = await pool.query('SELECT id, plan_code, plan_name, price FROM subscription_plans');
    console.log('套餐数据:', result.rows);
    
    const features = await pool.query('SELECT * FROM plan_features LIMIT 5');
    console.log('功能配额:', features.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
})();
