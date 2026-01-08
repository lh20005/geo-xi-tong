/**
 * 代理商测试数据设置脚本
 * 创建完整的测试数据用于观察代理商中心功能
 * 
 * 运行方式: npx ts-node src/scripts/setupAgentTestData.ts
 */

import { pool } from '../db/database';

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

async function setupTestData() {
  log('\n' + '='.repeat(60), COLORS.cyan);
  log('  代理商测试数据设置', COLORS.cyan);
  log('='.repeat(60) + '\n', COLORS.cyan);

  try {
    // 1. 获取代理商信息（lzc2005, user_id=1）
    log('【步骤1】获取代理商信息', COLORS.blue);
    
    const agentResult = await pool.query(`
      SELECT a.*, u.invitation_code as user_invitation_code
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = 1
    `);
    
    if (agentResult.rows.length === 0) {
      log('  ❌ 代理商不存在，请先申请成为代理商', COLORS.red);
      return;
    }
    
    const agent = agentResult.rows[0];
    const agentId = agent.id;
    const userInvitationCode = agent.user_invitation_code;
    
    log(`  代理商ID: ${agentId}`, COLORS.green);
    log(`  用户邀请码: ${userInvitationCode}`, COLORS.green);
    log(`  佣金比例: ${(parseFloat(agent.commission_rate) * 100).toFixed(0)}%`, COLORS.green);

    // 2. 检查现有测试数据
    log('\n【步骤2】检查现有数据', COLORS.blue);
    
    const existingInvites = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE invited_by_code = $1
    `, [userInvitationCode]);
    
    const existingCommissions = await pool.query(`
      SELECT COUNT(*) as count FROM commission_records WHERE agent_id = $1
    `, [agentId]);
    
    log(`  现有邀请用户: ${existingInvites.rows[0].count}`, COLORS.green);
    log(`  现有佣金记录: ${existingCommissions.rows[0].count}`, COLORS.green);

    // 3. 创建测试邀请用户（如果不存在）
    log('\n【步骤3】创建测试邀请用户', COLORS.blue);
    
    const testUsers = [
      { username: 'test_invited_user_1', email: 'invited1@test.com', hasPaid: true },
      { username: 'test_invited_user_2', email: 'invited2@test.com', hasPaid: true },
      { username: 'test_invited_user_3', email: 'invited3@test.com', hasPaid: false },
    ];
    
    const createdUserIds: number[] = [];
    
    for (const testUser of testUsers) {
      // 检查用户是否已存在
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [testUser.username]
      );
      
      let userId: number;
      
      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
        // 更新邀请码关联
        await pool.query(`
          UPDATE users 
          SET invited_by_code = $1, invited_by_agent = $2
          WHERE id = $3
        `, [userInvitationCode, agentId, userId]);
        log(`  ✓ 更新用户 ${testUser.username} (ID: ${userId}) 的邀请关联`, COLORS.green);
      } else {
        // 创建新用户
        const userInvCode = `T${Date.now().toString().slice(-5)}`;
        const result = await pool.query(`
          INSERT INTO users (username, email, password_hash, invitation_code, invited_by_code, invited_by_agent)
          VALUES ($1, $2, 'test_hash', $3, $4, $5)
          RETURNING id
        `, [testUser.username, testUser.email, userInvCode, userInvitationCode, agentId]);
        userId = result.rows[0].id;
        log(`  ✓ 创建用户 ${testUser.username} (ID: ${userId})`, COLORS.green);
      }
      
      createdUserIds.push(userId);
      
      // 如果是付费用户，创建订阅
      if (testUser.hasPaid) {
        const existingSub = await pool.query(
          'SELECT id FROM user_subscriptions WHERE user_id = $1',
          [userId]
        );
        
        if (existingSub.rows.length === 0) {
          await pool.query(`
            INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
            VALUES ($1, 2, 'active', NOW(), NOW() + INTERVAL '30 days')
          `, [userId]);
          log(`    + 创建订阅记录`, COLORS.green);
        }
      }
    }

    // 4. 创建测试订单和佣金记录
    log('\n【步骤4】创建测试订单和佣金记录', COLORS.blue);
    
    const testOrders = [
      { planId: 1, planName: '免费版', amount: 299.00, status: 'paid' },
      { planId: 2, planName: '专业版', amount: 599.00, status: 'paid' },
      { planId: 3, planName: '企业版', amount: 999.00, status: 'pending' },
    ];
    
    const commissionRate = parseFloat(agent.commission_rate);
    
    for (let i = 0; i < testOrders.length && i < createdUserIds.length; i++) {
      const order = testOrders[i];
      const userId = createdUserIds[i];
      const orderNo = `TEST_ORDER_${Date.now()}_${i + 1}`;
      const expectedCommission = order.amount * commissionRate;
      
      // 检查是否已有该用户的订单
      const existingOrder = await pool.query(`
        SELECT o.id FROM orders o
        JOIN commission_records cr ON o.id = cr.order_id
        WHERE cr.invited_user_id = $1 AND cr.agent_id = $2
      `, [userId, agentId]);
      
      if (existingOrder.rows.length > 0) {
        log(`  - 用户 ${userId} 已有订单，跳过`, COLORS.yellow);
        continue;
      }
      
      // 创建订单
      const orderResult = await pool.query(`
        INSERT INTO orders (order_no, user_id, plan_id, amount, status, agent_id, profit_sharing, expected_commission, created_at, paid_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), ${order.status === 'paid' ? 'NOW()' : 'NULL'})
        RETURNING id
      `, [orderNo, userId, order.planId, order.amount, order.status, agentId, expectedCommission]);
      
      const orderId = orderResult.rows[0].id;
      log(`  ✓ 创建订单 ${orderNo} (ID: ${orderId})`, COLORS.green);
      log(`    套餐: ${order.planName}, 金额: ¥${order.amount.toFixed(2)}`, COLORS.reset);
      
      // 如果订单已支付，创建佣金记录
      if (order.status === 'paid') {
        const settleDate = new Date();
        settleDate.setDate(settleDate.getDate() + 1);
        
        // 随机设置佣金状态
        const commissionStatus = i === 0 ? 'settled' : 'pending';
        
        await pool.query(`
          INSERT INTO commission_records (agent_id, order_id, invited_user_id, order_amount, commission_rate, commission_amount, status, settle_date, settled_at, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${commissionStatus === 'settled' ? 'NOW()' : 'NULL'}, NOW())
        `, [agentId, orderId, userId, order.amount, commissionRate, expectedCommission, commissionStatus, settleDate]);
        
        log(`    + 创建佣金记录: ¥${expectedCommission.toFixed(2)} [${commissionStatus}]`, COLORS.green);
      }
    }

    // 5. 更新代理商统计（触发器应该自动更新，但手动确保一下）
    log('\n【步骤5】更新代理商统计', COLORS.blue);
    
    await pool.query(`
      UPDATE agents SET
        total_earnings = (
          SELECT COALESCE(SUM(commission_amount), 0)
          FROM commission_records
          WHERE agent_id = $1 AND status IN ('pending', 'settled')
        ),
        settled_earnings = (
          SELECT COALESCE(SUM(commission_amount), 0)
          FROM commission_records
          WHERE agent_id = $1 AND status = 'settled'
        ),
        pending_earnings = (
          SELECT COALESCE(SUM(commission_amount), 0)
          FROM commission_records
          WHERE agent_id = $1 AND status = 'pending'
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [agentId]);
    
    log(`  ✓ 代理商统计已更新`, COLORS.green);

    // 6. 验证最终数据
    log('\n【步骤6】验证最终数据', COLORS.blue);
    
    const finalInvites = await pool.query(`
      SELECT 
        COUNT(*) as total_invites,
        COUNT(CASE WHEN us.id IS NOT NULL THEN 1 END) as paid_invites
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
      WHERE u.invited_by_code = $1
    `, [userInvitationCode]);
    
    const finalCommissions = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(commission_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'settled' THEN commission_amount ELSE 0 END), 0) as settled,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending
      FROM commission_records 
      WHERE agent_id = $1
    `, [agentId]);
    
    const finalAgent = await pool.query(`
      SELECT total_earnings, settled_earnings, pending_earnings
      FROM agents WHERE id = $1
    `, [agentId]);
    
    log(`  邀请用户数: ${finalInvites.rows[0].total_invites}`, COLORS.green);
    log(`  付费用户数: ${finalInvites.rows[0].paid_invites}`, COLORS.green);
    log(`  佣金记录数: ${finalCommissions.rows[0].total}`, COLORS.green);
    log(`  累计收益: ¥${parseFloat(finalAgent.rows[0].total_earnings).toFixed(2)}`, COLORS.green);
    log(`  已结算: ¥${parseFloat(finalAgent.rows[0].settled_earnings).toFixed(2)}`, COLORS.green);
    log(`  待结算: ¥${parseFloat(finalAgent.rows[0].pending_earnings).toFixed(2)}`, COLORS.green);

    log('\n' + '='.repeat(60), COLORS.cyan);
    log('  ✅ 测试数据设置完成！', COLORS.green);
    log('  现在可以在代理商中心页面查看数据', COLORS.green);
    log('='.repeat(60) + '\n', COLORS.cyan);

  } catch (error: any) {
    log(`\n❌ 设置失败: ${error.message}`, COLORS.red);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

setupTestData();
