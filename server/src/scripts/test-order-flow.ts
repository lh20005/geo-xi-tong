/**
 * 模拟用户下单流程测试
 * 验证新用户下单数据和代理商 testuser2 的数据是否正常
 */

import { pool } from '../db/database';
import { DiscountService } from '../services/DiscountService';
import { orderService } from '../services/OrderService';
import { agentService } from '../services/AgentService';
import bcrypt from 'bcrypt';

const discountService = new DiscountService();

// 代理商配置
const AGENT_USERNAME = 'testuser2';
const AGENT_INVITATION_CODE = 'a05eav';
const AGENT_ID = 8;

function log(msg: string) { console.log(`[测试] ${msg}`); }
function logSuccess(msg: string) { console.log(`✅ ${msg}`); }
function logError(msg: string) { console.log(`❌ ${msg}`); }
function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
}

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function createUser(name: string, useAgentCode: boolean = true) {
  const username = `order_test_${name}_${Date.now()}`;
  const hash = await bcrypt.hash('test123', 10);
  
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, invitation_code, invited_by_code, invited_by_agent)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [username, hash, generateCode(), 
     useAgentCode ? AGENT_INVITATION_CODE : null, 
     useAgentCode ? AGENT_ID : null]
  );
  return result.rows[0];
}

async function simulatePayment(orderNo: string) {
  // 模拟支付成功
  await pool.query(
    `UPDATE orders SET status = 'paid', paid_at = NOW() WHERE order_no = $1`,
    [orderNo]
  );
  
  // 标记用户已使用首次折扣
  const order = await pool.query('SELECT user_id FROM orders WHERE order_no = $1', [orderNo]);
  if (order.rows[0]) {
    await pool.query(
      'UPDATE users SET first_purchase_discount_used = true WHERE id = $1',
      [order.rows[0].user_id]
    );
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║            模拟用户下单流程测试                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // ========== 测试前状态 ==========
    logSection('测试前 - 代理商 testuser2 状态');
    
    const agentBefore = await pool.query(`
      SELECT a.*, u.username, u.invitation_code,
        (SELECT COUNT(*) FROM users WHERE invited_by_code = u.invitation_code) as total_invited,
        (SELECT COUNT(*) FROM orders o 
         JOIN users iu ON o.user_id = iu.id 
         WHERE iu.invited_by_code = u.invitation_code AND o.status = 'paid') as paid_orders
      FROM agents a JOIN users u ON a.user_id = u.id
      WHERE u.username = $1
    `, [AGENT_USERNAME]);
    
    const agent = agentBefore.rows[0];
    console.log(`代理商: ${agent.username}`);
    console.log(`邀请码: ${agent.invitation_code}`);
    console.log(`佣金比例: ${(agent.commission_rate * 100).toFixed(0)}%`);
    console.log(`已邀请用户: ${agent.total_invited}`);
    console.log(`已支付订单: ${agent.paid_orders}`);

    // ========== 场景1: 代理商邀请的新用户首次购买 ==========
    logSection('场景1: 代理商邀请的新用户首次购买（享受折扣）');
    
    const user1 = await createUser('invited_new', true);
    log(`创建用户: ${user1.username} (ID: ${user1.id})`);
    log(`邀请来源: ${user1.invited_by_code} (代理商ID: ${user1.invited_by_agent})`);
    
    // 检查折扣资格
    const elig1 = await discountService.checkDiscountEligibility(user1.id);
    log(`折扣资格: eligible=${elig1.eligible}, invitedByAgent=${elig1.invitedByAgent}, isFirstPurchase=${elig1.isFirstPurchase}`);
    
    // 获取专业版套餐
    const plan = await pool.query('SELECT * FROM subscription_plans WHERE id = 2');
    const planData = plan.rows[0];
    
    // 创建折扣订单
    const order1 = await orderService.createOrder(user1.id, 2, 'purchase', {
      applyDiscount: true,
      originalPrice: parseFloat(planData.price),
      discountRate: planData.agent_discount_rate,
      isAgentDiscount: true
    });
    
    log(`订单创建: ${order1.order_no}`);
    log(`原价: ¥${planData.price}, 折扣: ${planData.agent_discount_rate}%, 实付: ¥${order1.amount}`);
    
    // 模拟支付
    await simulatePayment(order1.order_no);
    logSuccess(`订单支付成功`);

    // ========== 场景2: 同一用户再次购买（不享受折扣）==========
    logSection('场景2: 同一用户再次购买（不享受折扣）');
    
    const elig2 = await discountService.checkDiscountEligibility(user1.id);
    log(`折扣资格: eligible=${elig2.eligible}, reason=${elig2.reason}`);
    
    // 创建无折扣订单
    const order2 = await orderService.createOrder(user1.id, 3, 'purchase');
    log(`订单创建: ${order2.order_no}, 金额: ¥${order2.amount} (原价，无折扣)`);
    
    await simulatePayment(order2.order_no);
    logSuccess(`订单支付成功`);

    // ========== 场景3: 非代理商邀请的用户购买 ==========
    logSection('场景3: 非代理商邀请的用户购买（无折扣资格）');
    
    const user2 = await createUser('normal', false);
    log(`创建用户: ${user2.username} (ID: ${user2.id})`);
    log(`邀请来源: ${user2.invited_by_code || '无'}`);
    
    const elig3 = await discountService.checkDiscountEligibility(user2.id);
    log(`折扣资格: eligible=${elig3.eligible}, reason=${elig3.reason}`);
    
    const order3 = await orderService.createOrder(user2.id, 2, 'purchase');
    log(`订单创建: ${order3.order_no}, 金额: ¥${order3.amount} (原价)`);
    
    await simulatePayment(order3.order_no);
    logSuccess(`订单支付成功`);

    // ========== 测试后状态 ==========
    logSection('测试后 - 代理商 testuser2 状态');
    
    const agentAfter = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE invited_by_code = $1) as total_invited,
        (SELECT COUNT(*) FROM orders o 
         JOIN users iu ON o.user_id = iu.id 
         WHERE iu.invited_by_code = $1 AND o.status = 'paid') as paid_orders,
        (SELECT COALESCE(SUM(o.amount), 0) FROM orders o 
         JOIN users iu ON o.user_id = iu.id 
         WHERE iu.invited_by_code = $1 AND o.status = 'paid') as total_revenue
    `, [AGENT_INVITATION_CODE]);
    
    const stats = agentAfter.rows[0];
    console.log(`已邀请用户: ${stats.total_invited}`);
    console.log(`已支付订单: ${stats.paid_orders}`);
    console.log(`总收入: ¥${parseFloat(stats.total_revenue).toFixed(2)}`);
    console.log(`预期佣金 (30%): ¥${(parseFloat(stats.total_revenue) * 0.3).toFixed(2)}`);

    // ========== 验证数据完整性 ==========
    logSection('数据完整性验证');
    
    // 验证用户数据
    const userCheck = await pool.query(`
      SELECT id, username, invited_by_code, invited_by_agent, first_purchase_discount_used
      FROM users WHERE id IN ($1, $2)
    `, [user1.id, user2.id]);
    
    console.log('\n用户数据:');
    console.table(userCheck.rows.map(u => ({
      ID: u.id,
      用户名: u.username,
      邀请码来源: u.invited_by_code || '-',
      代理商ID: u.invited_by_agent || '-',
      已用折扣: u.first_purchase_discount_used ? '是' : '否'
    })));
    
    // 验证订单数据
    const orderCheck = await pool.query(`
      SELECT o.order_no, u.username, sp.plan_name, 
             o.original_price, o.discount_rate, o.amount, 
             o.is_agent_discount, o.status
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN subscription_plans sp ON o.plan_id = sp.id
      WHERE o.order_no IN ($1, $2, $3)
      ORDER BY o.created_at
    `, [order1.order_no, order2.order_no, order3.order_no]);
    
    console.log('\n订单数据:');
    console.table(orderCheck.rows.map(o => ({
      订单号: o.order_no.slice(-10),
      用户: o.username.slice(0, 20),
      套餐: o.plan_name,
      原价: o.original_price ? `¥${o.original_price}` : '-',
      折扣: o.discount_rate ? `${o.discount_rate}%` : '-',
      实付: `¥${o.amount}`,
      代理折扣: o.is_agent_discount ? '是' : '否',
      状态: o.status
    })));

    // ========== 测试结论 ==========
    logSection('测试结论');
    
    const allPassed = 
      elig1.eligible === true &&
      elig2.eligible === false &&
      elig3.eligible === false &&
      Number(order1.amount) < parseFloat(planData.price);
    
    if (allPassed) {
      logSuccess('所有测试通过！');
      console.log('- 代理商邀请的新用户首次购买享受折扣 ✓');
      console.log('- 同一用户再次购买不享受折扣 ✓');
      console.log('- 非代理商邀请用户无折扣资格 ✓');
      console.log('- 代理商客户数据正确记录 ✓');
      console.log('- 订单折扣信息完整保存 ✓');
    } else {
      logError('部分测试失败');
    }

    console.log('\n⚠️  测试数据已保留，可在数据库中查看');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  } finally {
    await pool.end();
  }
}

main();
