/**
 * 订单分账完整业务模拟测试
 * 模拟真实场景：代理商邀请 → 用户注册 → 用户下单 → 支付成功 → 佣金创建 → T+1分账
 */

import { pool } from '../db/database';
import { agentService } from '../services/AgentService';
import { commissionService } from '../services/CommissionService';
import { profitSharingService } from '../services/ProfitSharingService';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg: string, color = COLORS.reset) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function logSection(title: string) {
  console.log();
  log('─'.repeat(70), COLORS.cyan);
  log(`  ${title}`, COLORS.cyan);
  log('─'.repeat(70), COLORS.cyan);
}

// 测试数据
const TEST_DATA = {
  agentUserId: 1,  // lzc2005
  plans: [
    { id: 2, name: '专业版', price: 299.00 },
    { id: 3, name: '企业版', price: 999.00 },
    { id: 4, name: '加量包', price: 4.00 },
  ]
};

async function runSimulation() {
  log('\n' + '═'.repeat(70), COLORS.magenta);
  log('  订单分账完整业务模拟测试', COLORS.magenta);
  log('  代理商: lzc2005 (ID: 1)', COLORS.magenta);
  log('═'.repeat(70), COLORS.magenta);

  const createdUserIds: number[] = [];
  const createdOrderIds: number[] = [];
  const createdCommissionIds: number[] = [];

  try {
    // ========== 第1步：验证代理商状态 ==========
    logSection('第1步：验证代理商状态');
    
    const agent = await agentService.getAgentByUserId(TEST_DATA.agentUserId);
    if (!agent) {
      throw new Error('代理商不存在');
    }
    
    log(`  代理商ID: ${agent.id}`, COLORS.green);
    log(`  状态: ${agent.status}`, COLORS.green);
    log(`  佣金比例: ${(agent.commissionRate * 100).toFixed(0)}%`, COLORS.green);
    log(`  微信绑定: ${agent.wechatOpenid ? '✓ 已绑定' : '✗ 未绑定'}`, agent.wechatOpenid ? COLORS.green : COLORS.yellow);
    log(`  分账接收方: ${agent.receiverAdded ? '✓ 已添加' : '✗ 未添加'}`, agent.receiverAdded ? COLORS.green : COLORS.yellow);

    // 获取邀请码
    const codeResult = await pool.query('SELECT invitation_code FROM agents WHERE id = $1', [agent.id]);
    const invitationCode = codeResult.rows[0]?.invitation_code;
    log(`  邀请码: ${invitationCode}`, COLORS.green);

    // ========== 第2步：模拟3个用户通过邀请码注册 ==========
    logSection('第2步：模拟用户通过邀请码注册');
    
    const users = [];
    for (let i = 1; i <= 3; i++) {
      const username = `sim_user_${Date.now()}_${i}`;
      const userInvCode = `T${Date.now().toString().slice(-4)}${i}`; // 6位邀请码
      
      // 获取代理商对应用户的邀请码
      const agentUserResult = await pool.query(
        'SELECT invitation_code FROM users WHERE id = $1',
        [TEST_DATA.agentUserId]
      );
      const agentInvCode = agentUserResult.rows[0]?.invitation_code;
      
      const result = await pool.query(`
        INSERT INTO users (username, email, password_hash, invitation_code, invited_by_code, invited_by_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username
      `, [username, `${username}@test.com`, 'test_hash', userInvCode, agentInvCode, agent.id]);
      
      const userId = result.rows[0].id;
      createdUserIds.push(userId);
      users.push({ id: userId, username });
      log(`  ✓ 用户${i}: ${username} (ID: ${userId}) - 关联代理商 ${agent.id}`, COLORS.green);
    }

    // ========== 第3步：模拟用户下单（不同套餐） ==========
    logSection('第3步：模拟用户下单');
    
    const orders = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const plan = TEST_DATA.plans[i % TEST_DATA.plans.length];
      const orderNo = `ORD_SIM_${Date.now()}_${i + 1}`;
      const expectedCommission = plan.price * agent.commissionRate;
      
      const result = await pool.query(`
        INSERT INTO orders (
          order_no, user_id, plan_id, amount, status, 
          agent_id, profit_sharing, expected_commission, 
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, order_no
      `, [
        orderNo, user.id, plan.id, plan.price, 'pending',
        agent.id, true, expectedCommission
      ]);
      
      const orderId = result.rows[0].id;
      createdOrderIds.push(orderId);
      orders.push({ 
        id: orderId, 
        orderNo, 
        userId: user.id, 
        amount: plan.price, 
        planName: plan.name,
        expectedCommission 
      });
      
      log(`  ✓ 订单${i + 1}: ${orderNo}`, COLORS.green);
      log(`    用户: ${user.username}`, COLORS.reset);
      log(`    套餐: ${plan.name} ¥${plan.price.toFixed(2)}`, COLORS.reset);
      log(`    预计佣金: ¥${expectedCommission.toFixed(2)} (${(agent.commissionRate * 100).toFixed(0)}%)`, COLORS.reset);
    }

    // ========== 第4步：模拟支付成功回调 ==========
    logSection('第4步：模拟支付成功回调');
    
    for (const order of orders) {
      // 模拟微信支付回调 - 更新订单状态
      const transactionId = `MOCK_TXN_${Date.now()}_${order.id}`;
      
      await pool.query(`
        UPDATE orders 
        SET status = 'paid', transaction_id = $1, paid_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [transactionId, order.id]);
      
      log(`  ✓ 订单 ${order.orderNo} 支付成功`, COLORS.green);
      log(`    微信交易号: ${transactionId}`, COLORS.reset);
      
      // 创建佣金记录（模拟 PaymentService.handleWeChatPayNotify 中的逻辑）
      const settleDate = new Date();
      settleDate.setDate(settleDate.getDate() + 1); // T+1
      
      const commissionResult = await pool.query(`
        INSERT INTO commission_records (
          agent_id, order_id, invited_user_id, order_amount, 
          commission_rate, commission_amount, status, settle_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `, [
        agent.id, order.id, order.userId, order.amount,
        agent.commissionRate, order.expectedCommission, 'pending', settleDate
      ]);
      
      const commissionId = commissionResult.rows[0].id;
      createdCommissionIds.push(commissionId);
      
      log(`    佣金记录: ID=${commissionId}, 金额=¥${order.expectedCommission.toFixed(2)}, 状态=pending`, COLORS.reset);
    }

    // ========== 第5步：查看当前佣金状态 ==========
    logSection('第5步：查看当前佣金状态');
    
    const pendingCommissions = await pool.query(`
      SELECT cr.*, o.order_no, o.transaction_id
      FROM commission_records cr
      JOIN orders o ON cr.order_id = o.id
      WHERE cr.agent_id = $1 AND cr.status = 'pending'
      ORDER BY cr.created_at DESC
    `, [agent.id]);
    
    log(`  待结算佣金记录: ${pendingCommissions.rows.length} 条`, COLORS.green);
    let totalPending = 0;
    for (const c of pendingCommissions.rows) {
      const amount = parseFloat(c.commission_amount);
      totalPending += amount;
      log(`    - 订单 ${c.order_no}: ¥${amount.toFixed(2)} (结算日: ${c.settle_date.toISOString().split('T')[0]})`, COLORS.reset);
    }
    log(`  待结算总额: ¥${totalPending.toFixed(2)}`, COLORS.yellow);

    // ========== 第6步：模拟 T+1 分账执行 ==========
    logSection('第6步：模拟 T+1 分账执行');
    
    if (!agent.wechatOpenid) {
      log(`  ⚠️ 代理商未绑定微信，无法执行真实分账`, COLORS.yellow);
      log(`  模拟分账流程...`, COLORS.yellow);
    }
    
    // 检查分账限额
    for (const c of pendingCommissions.rows) {
      const commissionAmountCents = Math.round(parseFloat(c.commission_amount) * 100);
      const orderAmountCents = Math.round(parseFloat(c.order_amount) * 100);
      
      const limitCheck = await profitSharingService.checkProfitSharingLimits(
        commissionAmountCents, 
        orderAmountCents
      );
      
      if (!limitCheck.allowed) {
        log(`  ✗ 佣金 ${c.id} 分账限额检查失败: ${limitCheck.reason}`, COLORS.red);
        continue;
      }
      
      log(`  ✓ 佣金 ${c.id} 分账限额检查通过`, COLORS.green);
      
      // 模拟分账执行
      const psOrderNo = `PS_${Date.now()}_${c.id}`;
      
      // 创建分账记录
      await pool.query(`
        INSERT INTO profit_sharing_records (
          commission_id, transaction_id, out_order_no, amount, status, request_time
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [c.id, c.transaction_id, psOrderNo, commissionAmountCents, 'success']);
      
      // 更新佣金状态为已结算
      await pool.query(`
        UPDATE commission_records 
        SET status = 'settled', settled_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [c.id]);
      
      log(`    分账单号: ${psOrderNo}`, COLORS.reset);
      log(`    分账金额: ¥${parseFloat(c.commission_amount).toFixed(2)} (${commissionAmountCents} 分)`, COLORS.reset);
    }
    
    // 更新代理商累计收益
    const totalSettled = await pool.query(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM commission_records 
      WHERE agent_id = $1 AND status = 'settled'
    `, [agent.id]);
    
    await pool.query(`
      UPDATE agents 
      SET total_earnings = $1, settled_earnings = $1, pending_earnings = 0, updated_at = NOW()
      WHERE id = $2
    `, [totalSettled.rows[0].total, agent.id]);

    // ========== 第7步：验证最终数据 ==========
    logSection('第7步：验证最终数据');
    
    const finalStats = await agentService.getAgentStats(agent.id);
    log(`  邀请用户数: ${finalStats.totalInvites}`, COLORS.green);
    log(`  付费用户数: ${finalStats.paidInvites}`, COLORS.green);
    log(`  累计收益: ¥${finalStats.totalEarnings.toFixed(2)}`, COLORS.green);
    log(`  已结算: ¥${finalStats.settledEarnings.toFixed(2)}`, COLORS.green);
    log(`  待结算: ¥${finalStats.pendingEarnings.toFixed(2)}`, COLORS.green);
    
    // 查看分账记录
    const psRecords = await pool.query(`
      SELECT psr.*, cr.commission_amount
      FROM profit_sharing_records psr
      JOIN commission_records cr ON psr.commission_id = cr.id
      WHERE cr.agent_id = $1
      ORDER BY psr.request_time DESC
      LIMIT 10
    `, [agent.id]);
    
    log(`\n  分账记录 (共 ${psRecords.rows.length} 条):`, COLORS.green);
    for (const ps of psRecords.rows) {
      log(`    - ${ps.out_order_no}: ¥${(ps.amount / 100).toFixed(2)} [${ps.status}]`, COLORS.reset);
    }

    // ========== 第8步：测试退款场景 ==========
    logSection('第8步：测试退款场景');
    
    // 选择一个订单进行退款测试
    const refundOrder = orders[0];
    log(`  模拟订单 ${refundOrder.orderNo} 全额退款...`, COLORS.yellow);
    
    // 查找对应的佣金记录
    const refundCommission = await pool.query(`
      SELECT id, status FROM commission_records WHERE order_id = $1
    `, [refundOrder.id]);
    
    if (refundCommission.rows.length > 0) {
      const commissionId = refundCommission.rows[0].id;
      const currentStatus = refundCommission.rows[0].status;
      
      log(`    佣金记录 ID: ${commissionId}, 当前状态: ${currentStatus}`, COLORS.reset);
      
      // 调用退款处理
      await commissionService.handleRefund(refundOrder.id, refundOrder.amount, true);
      
      // 查询退款后状态
      const afterRefund = await pool.query(`
        SELECT status FROM commission_records WHERE id = $1
      `, [commissionId]);
      
      log(`    退款后状态: ${afterRefund.rows[0].status}`, COLORS.green);
      
      // 如果已结算，需要记录待回收
      if (currentStatus === 'settled') {
        log(`    ⚠️ 佣金已结算，需要人工处理回收`, COLORS.yellow);
      }
    }

    // ========== 第9步：测试部分退款 ==========
    logSection('第9步：测试部分退款');
    
    const partialRefundOrder = orders[1];
    const partialRefundAmount = partialRefundOrder.amount * 0.5; // 退款50%
    
    log(`  模拟订单 ${partialRefundOrder.orderNo} 部分退款 (50%)...`, COLORS.yellow);
    log(`    原订单金额: ¥${partialRefundOrder.amount.toFixed(2)}`, COLORS.reset);
    log(`    退款金额: ¥${partialRefundAmount.toFixed(2)}`, COLORS.reset);
    
    const partialCommission = await pool.query(`
      SELECT id, commission_amount, status FROM commission_records WHERE order_id = $1
    `, [partialRefundOrder.id]);
    
    if (partialCommission.rows.length > 0) {
      const commissionId = partialCommission.rows[0].id;
      const originalCommission = parseFloat(partialCommission.rows[0].commission_amount);
      
      log(`    原佣金金额: ¥${originalCommission.toFixed(2)}`, COLORS.reset);
      
      // 调用部分退款处理
      await commissionService.handleRefund(partialRefundOrder.id, partialRefundAmount, false);
      
      // 查询退款后状态
      const afterPartialRefund = await pool.query(`
        SELECT commission_amount, status FROM commission_records WHERE id = $1
      `, [commissionId]);
      
      const newCommission = parseFloat(afterPartialRefund.rows[0].commission_amount);
      log(`    调整后佣金: ¥${newCommission.toFixed(2)}`, COLORS.green);
      log(`    状态: ${afterPartialRefund.rows[0].status}`, COLORS.green);
    }

    // ========== 清理测试数据 ==========
    logSection('清理测试数据');
    
    // 删除分账记录
    await pool.query(`
      DELETE FROM profit_sharing_records 
      WHERE commission_id IN (SELECT id FROM commission_records WHERE order_id = ANY($1))
    `, [createdOrderIds]);
    log(`  ✓ 删除分账记录`, COLORS.green);
    
    // 删除佣金记录
    await pool.query(`DELETE FROM commission_records WHERE order_id = ANY($1)`, [createdOrderIds]);
    log(`  ✓ 删除佣金记录`, COLORS.green);
    
    // 删除订单
    await pool.query(`DELETE FROM orders WHERE id = ANY($1)`, [createdOrderIds]);
    log(`  ✓ 删除订单`, COLORS.green);
    
    // 删除用户
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUserIds]);
    log(`  ✓ 删除测试用户`, COLORS.green);
    
    // 重新计算代理商收益
    const recalcTotal = await pool.query(`
      SELECT 
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'settled'), 0) as settled,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) as pending
      FROM commission_records 
      WHERE agent_id = $1
    `, [agent.id]);
    
    const settled = parseFloat(recalcTotal.rows[0].settled);
    const pending = parseFloat(recalcTotal.rows[0].pending);
    
    await pool.query(`
      UPDATE agents 
      SET total_earnings = $1, settled_earnings = $2, pending_earnings = $3, updated_at = NOW()
      WHERE id = $4
    `, [settled + pending, settled, pending, agent.id]);
    log(`  ✓ 重新计算代理商收益`, COLORS.green);

    log('\n' + '═'.repeat(70), COLORS.magenta);
    log('  ✅ 订单分账模拟测试完成！', COLORS.green);
    log('═'.repeat(70) + '\n', COLORS.magenta);

  } catch (error: any) {
    log(`\n❌ 测试失败: ${error.message}`, COLORS.red);
    console.error(error.stack);
    
    // 清理已创建的数据
    if (createdOrderIds.length > 0) {
      await pool.query(`DELETE FROM profit_sharing_records WHERE commission_id IN (SELECT id FROM commission_records WHERE order_id = ANY($1))`, [createdOrderIds]);
      await pool.query(`DELETE FROM commission_records WHERE order_id = ANY($1)`, [createdOrderIds]);
      await pool.query(`DELETE FROM orders WHERE id = ANY($1)`, [createdOrderIds]);
    }
    if (createdUserIds.length > 0) {
      await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUserIds]);
    }
  } finally {
    await pool.end();
  }
}

runSimulation();
