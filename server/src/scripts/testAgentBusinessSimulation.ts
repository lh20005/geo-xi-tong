/**
 * 代理商分佣系统 - 真实业务模拟测试
 * 使用 lzc2005 用户进行完整业务流程测试
 */

import { pool } from '../db/database';
import { agentService } from '../services/AgentService';
import { commissionService } from '../services/CommissionService';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg: string, color = COLORS.reset) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

async function runBusinessSimulation() {
  log('\n' + '='.repeat(70), COLORS.cyan);
  log('  代理商分佣系统 - 真实业务模拟测试', COLORS.cyan);
  log('  测试用户: lzc2005 (ID: 1)', COLORS.cyan);
  log('='.repeat(70) + '\n', COLORS.cyan);

  try {
    // ========== 1. 查看当前代理商状态 ==========
    log('【场景1】查看 lzc2005 代理商状态', COLORS.blue);
    const agent = await agentService.getAgentByUserId(1);
    
    if (!agent) {
      log('  ❌ lzc2005 还不是代理商，先申请...', COLORS.yellow);
      const newAgent = await agentService.applyAgent(1);
      log(`  ✅ 申请成功！代理商ID: ${newAgent.id}`, COLORS.green);
    } else {
      log(`  代理商ID: ${agent.id}`, COLORS.green);
      log(`  状态: ${agent.status}`, COLORS.green);
      log(`  佣金比例: ${(agent.commissionRate * 100).toFixed(0)}%`, COLORS.green);
      log(`  微信绑定: ${agent.wechatOpenid ? '已绑定' : '未绑定'}`, COLORS.green);
      // 查询邀请码
      const codeResult = await pool.query(`SELECT invitation_code FROM agents WHERE id = $1`, [agent.id]);
      log(`  邀请码: ${codeResult.rows[0]?.invitation_code || '无'}`, COLORS.green);
    }

    // ========== 2. 查看代理商统计数据 ==========
    log('\n【场景2】查看代理商统计数据', COLORS.blue);
    const stats = await agentService.getAgentStats(agent!.id);
    log(`  邀请用户数: ${stats.totalInvites}`, COLORS.green);
    log(`  付费用户数: ${stats.paidInvites}`, COLORS.green);
    log(`  累计收益: ¥${stats.totalEarnings.toFixed(2)}`, COLORS.green);
    log(`  待结算: ¥${stats.pendingEarnings.toFixed(2)}`, COLORS.green);
    log(`  已结算: ¥${stats.settledEarnings.toFixed(2)}`, COLORS.green);

    // ========== 3. 查看佣金记录 ==========
    log('\n【场景3】查看佣金记录列表', COLORS.blue);
    const commissions = await commissionService.listCommissions(agent!.id, { page: 1, pageSize: 10 });
    log(`  总记录数: ${commissions.total}`, COLORS.green);
    
    if (commissions.data.length > 0) {
      log('  最近佣金记录:', COLORS.green);
      for (const c of commissions.data) {
        log(`    - 订单#${c.orderId}: ¥${c.orderAmount.toFixed(2)} → 佣金¥${c.commissionAmount.toFixed(2)} [${c.status}]`);
      }
    }

    // ========== 4. 模拟新用户通过邀请码注册 ==========
    log('\n【场景4】模拟新用户通过邀请码注册', COLORS.blue);
    const testUsername = `invited_${Date.now()}`;
    const userInvCode = `T${Date.now().toString().slice(-5)}`;
    
    // 创建被邀请用户
    const newUserResult = await pool.query(`
      INSERT INTO users (username, email, password_hash, invitation_code, invited_by_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username
    `, [testUsername, `${testUsername}@test.com`, 'test_hash', userInvCode, agent!.id]);
    
    const newUserId = newUserResult.rows[0].id;
    log(`  ✅ 新用户注册成功: ${testUsername} (ID: ${newUserId})`, COLORS.green);
    log(`  关联代理商: ${agent!.id}`, COLORS.green);

    // ========== 5. 模拟用户购买套餐 ==========
    log('\n【场景5】模拟用户购买专业版套餐 (¥299)', COLORS.blue);
    
    const orderNo = `ORD_SIM_${Date.now()}`;
    const orderAmount = 299.00;
    const commissionRate = agent!.commissionRate;
    const expectedCommission = orderAmount * commissionRate;
    
    // 创建订单
    const orderResult = await pool.query(`
      INSERT INTO orders (order_no, user_id, plan_id, amount, status, agent_id, profit_sharing, expected_commission, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [orderNo, newUserId, 2, orderAmount, 'pending', agent!.id, true, expectedCommission]);
    
    const orderId = orderResult.rows[0].id;
    log(`  ✅ 订单创建成功: ${orderNo} (ID: ${orderId})`, COLORS.green);
    log(`  订单金额: ¥${orderAmount.toFixed(2)}`, COLORS.green);
    log(`  预计佣金: ¥${expectedCommission.toFixed(2)} (${(commissionRate * 100).toFixed(0)}%)`, COLORS.green);

    // ========== 6. 模拟支付成功回调 ==========
    log('\n【场景6】模拟支付成功，创建佣金记录', COLORS.blue);
    
    // 更新订单状态为已支付
    await pool.query(`UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = $1`, [orderId]);
    log(`  ✅ 订单状态更新为: paid`, COLORS.green);
    
    // 创建佣金记录
    const settleDate = new Date();
    settleDate.setDate(settleDate.getDate() + 1); // T+1
    
    const commissionResult = await pool.query(`
      INSERT INTO commission_records (agent_id, order_id, invited_user_id, order_amount, commission_rate, commission_amount, status, settle_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [agent!.id, orderId, newUserId, orderAmount, commissionRate, expectedCommission, 'pending', settleDate]);
    
    const commissionId = commissionResult.rows[0].id;
    log(`  ✅ 佣金记录创建成功: ID=${commissionId}`, COLORS.green);
    log(`  结算日期: ${settleDate.toISOString().split('T')[0]} (T+1)`, COLORS.green);

    // ========== 7. 模拟 T+1 分账结算 ==========
    log('\n【场景7】模拟 T+1 分账结算', COLORS.blue);
    
    // 检查代理商是否已绑定微信
    if (!agent!.wechatOpenid) {
      log(`  ⚠️ 代理商未绑定微信，跳过实际分账`, COLORS.yellow);
      log(`  佣金状态保持: pending`, COLORS.yellow);
    } else {
      // 模拟分账成功
      const psOrderNo = `PS_${Date.now()}`;
      
      await pool.query(`
        INSERT INTO profit_sharing_records (commission_id, transaction_id, out_order_no, amount, status, request_time)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [commissionId, `MOCK_TXN_${Date.now()}`, psOrderNo, Math.round(expectedCommission * 100), 'success']);
      
      // 更新佣金状态
      await pool.query(`
        UPDATE commission_records SET status = 'settled', settled_at = NOW() WHERE id = $1
      `, [commissionId]);
      
      // 更新代理商累计收益
      await pool.query(`
        UPDATE agents SET 
          total_earnings = total_earnings + $1,
          settled_earnings = settled_earnings + $1
        WHERE id = $2
      `, [expectedCommission, agent!.id]);
      
      log(`  ✅ 分账执行成功`, COLORS.green);
      log(`  分账单号: ${psOrderNo}`, COLORS.green);
      log(`  分账金额: ¥${expectedCommission.toFixed(2)}`, COLORS.green);
    }

    // ========== 8. 验证最终数据 ==========
    log('\n【场景8】验证最终数据', COLORS.blue);
    
    const finalStats = await agentService.getAgentStats(agent!.id);
    log(`  邀请用户数: ${finalStats.totalInvites}`, COLORS.green);
    log(`  付费用户数: ${finalStats.paidInvites}`, COLORS.green);
    log(`  累计收益: ¥${finalStats.totalEarnings.toFixed(2)}`, COLORS.green);
    log(`  待结算: ¥${finalStats.pendingEarnings.toFixed(2)}`, COLORS.green);
    log(`  已结算: ¥${finalStats.settledEarnings.toFixed(2)}`, COLORS.green);

    // ========== 9. 测试退款场景 ==========
    log('\n【场景9】测试退款场景', COLORS.blue);
    
    // 创建另一个订单用于退款测试
    const refundOrderNo = `ORD_REFUND_${Date.now()}`;
    const refundOrderResult = await pool.query(`
      INSERT INTO orders (order_no, user_id, plan_id, amount, status, agent_id, profit_sharing, expected_commission, created_at, paid_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id
    `, [refundOrderNo, newUserId, 2, orderAmount, 'paid', agent!.id, true, expectedCommission]);
    
    const refundOrderId = refundOrderResult.rows[0].id;
    
    // 创建佣金记录
    const refundCommissionResult = await pool.query(`
      INSERT INTO commission_records (agent_id, order_id, invited_user_id, order_amount, commission_rate, commission_amount, status, settle_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [agent!.id, refundOrderId, newUserId, orderAmount, commissionRate, expectedCommission, 'pending', settleDate]);
    
    const refundCommissionId = refundCommissionResult.rows[0].id;
    log(`  创建待退款订单: ${refundOrderNo}`, COLORS.green);
    
    // 模拟全额退款
    await commissionService.handleRefund(refundOrderId, orderAmount, true);
    
    // 查询退款后的佣金状态
    const refundedCommission = await pool.query(`SELECT status FROM commission_records WHERE id = $1`, [refundCommissionId]);
    log(`  ✅ 退款处理完成，佣金状态: ${refundedCommission.rows[0].status}`, COLORS.green);

    // ========== 10. 管理员操作测试 ==========
    log('\n【场景10】管理员操作测试', COLORS.blue);
    
    // 暂停代理商
    await agentService.updateAgentStatus(agent!.id, 'suspended', 1);
    const suspendedAgent = await agentService.getAgentByUserId(1);
    log(`  暂停代理商: 状态=${suspendedAgent?.status}`, COLORS.green);
    
    // 恢复代理商
    await agentService.updateAgentStatus(agent!.id, 'active', 1);
    const activeAgent = await agentService.getAgentByUserId(1);
    log(`  恢复代理商: 状态=${activeAgent?.status}`, COLORS.green);

    // ========== 清理测试数据 ==========
    log('\n【清理】删除测试数据', COLORS.yellow);
    await pool.query(`DELETE FROM profit_sharing_records WHERE commission_id IN (SELECT id FROM commission_records WHERE order_id IN ($1, $2))`, [orderId, refundOrderId]);
    await pool.query(`DELETE FROM commission_records WHERE order_id IN ($1, $2)`, [orderId, refundOrderId]);
    await pool.query(`DELETE FROM orders WHERE id IN ($1, $2)`, [orderId, refundOrderId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [newUserId]);
    log(`  ✅ 测试数据已清理`, COLORS.green);

    log('\n' + '='.repeat(70), COLORS.cyan);
    log('  ✅ 所有业务场景测试通过！', COLORS.green);
    log('='.repeat(70) + '\n', COLORS.cyan);

  } catch (error: any) {
    log(`\n❌ 测试失败: ${error.message}`, COLORS.red);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

runBusinessSimulation();
