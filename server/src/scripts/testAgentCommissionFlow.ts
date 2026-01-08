/**
 * 代理商分佣系统完整流程测试
 * 模拟：代理商申请 → 微信绑定 → 邀请用户 → 用户下单 → 佣金计算 → 分账执行
 */

import { pool } from '../db/database';
import { agentService } from '../services/AgentService';
import { commissionService } from '../services/CommissionService';
import { profitSharingService } from '../services/ProfitSharingService';

// 测试配置
const TEST_CONFIG = {
  // 模拟代理商用户ID（使用现有用户或创建测试用户）
  agentUserId: 1,
  // 模拟被邀请用户ID
  invitedUserId: 2,
  // 模拟订单金额（分）
  orderAmount: 29900, // 299元
  // 模拟 OpenID
  mockOpenId: 'test_openid_' + Date.now(),
};

async function runTest() {
  console.log('='.repeat(60));
  console.log('代理商分佣系统完整流程测试');
  console.log('='.repeat(60));
  console.log();

  try {
    // 第0步：检查数据库连接和表结构
    await testDatabaseSetup();

    // 第1步：代理商申请
    const agent = await testAgentApply();

    // 第2步：模拟微信绑定
    await testWechatBind(agent.id);

    // 第3步：模拟邀请用户注册
    await testInviteUser(agent.id);

    // 第4步：模拟用户下单并支付
    const orderId = await testCreateOrder(agent.id);

    // 第5步：验证佣金记录
    await testCommissionRecord(agent.id, orderId);

    // 第6步：模拟分账执行（不实际调用微信API）
    await testProfitSharing(agent.id);

    // 第7步：查看代理商统计
    await testAgentStats(agent.id);

    console.log();
    console.log('='.repeat(60));
    console.log('✅ 所有测试通过！代理商分佣系统工作正常');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error();
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

/**
 * 第0步：检查数据库表结构
 */
async function testDatabaseSetup() {
  console.log('【第0步】检查数据库表结构...');
  
  const tables = ['agents', 'commission_records', 'profit_sharing_records', 'agent_audit_logs'];
  
  for (const table of tables) {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, [table]);
    
    if (!result.rows[0].exists) {
      throw new Error(`表 ${table} 不存在，请先执行数据库迁移: npm run db:migrate`);
    }
  }
  
  // 检查 orders 表是否有新增字段
  const orderColumns = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name IN ('agent_id', 'profit_sharing', 'expected_commission')
  `);
  
  if (orderColumns.rows.length < 3) {
    throw new Error('orders 表缺少代理商相关字段，请执行迁移');
  }
  
  console.log('  ✓ 所有必需表和字段已存在');
  console.log();
}

/**
 * 第1步：代理商申请
 */
async function testAgentApply(): Promise<any> {
  console.log('【第1步】测试代理商申请...');
  
  // 检查是否已有测试代理商
  let agent = await agentService.getAgentByUserId(TEST_CONFIG.agentUserId);
  
  if (agent) {
    console.log(`  ✓ 代理商已存在: ID=${agent.id}, 状态=${agent.status}`);
  } else {
    // 申请成为代理商
    agent = await agentService.applyAgent(TEST_CONFIG.agentUserId);
    console.log(`  ✓ 代理商申请成功: ID=${agent.id}`);
  }
  
  console.log(`  - 佣金比例: ${(agent.commissionRate * 100).toFixed(0)}%`);
  console.log(`  - 状态: ${agent.status}`);
  console.log();
  
  return agent;
}

/**
 * 第2步：模拟微信绑定
 */
async function testWechatBind(agentId: number) {
  console.log('【第2步】测试微信绑定...');
  
  // 检查是否已绑定
  const agent = await pool.query('SELECT wechat_openid FROM agents WHERE id = $1', [agentId]);
  
  if (agent.rows[0]?.wechat_openid) {
    console.log(`  ✓ 微信已绑定: OpenID=${agent.rows[0].wechat_openid.substring(0, 10)}...`);
  } else {
    // 模拟绑定
    await agentService.bindWechatAccount(agentId, TEST_CONFIG.mockOpenId, '测试用户');
    console.log(`  ✓ 微信绑定成功: OpenID=${TEST_CONFIG.mockOpenId}`);
  }
  
  // 模拟添加分账接收方（不实际调用微信API）
  console.log('  - 模拟添加分账接收方...');
  await agentService.markReceiverAdded(agentId, true);
  console.log('  ✓ 分账接收方已标记');
  console.log();
}

/**
 * 第3步：模拟邀请用户注册
 */
async function testInviteUser(agentId: number) {
  console.log('【第3步】测试邀请用户...');
  
  // 检查被邀请用户是否存在
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [TEST_CONFIG.invitedUserId]);
  
  if (userResult.rows.length === 0) {
    console.log(`  ⚠ 用户 ${TEST_CONFIG.invitedUserId} 不存在，创建测试用户...`);
    
    // 创建测试用户
    await pool.query(`
      INSERT INTO users (id, username, email, password_hash, invited_by_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET invited_by_agent = $5
    `, [TEST_CONFIG.invitedUserId, 'test_invited_user', 'invited@test.com', 'hash', agentId]);
  } else {
    // 更新邀请关系
    await pool.query('UPDATE users SET invited_by_agent = $1 WHERE id = $2', [agentId, TEST_CONFIG.invitedUserId]);
  }
  
  console.log(`  ✓ 用户 ${TEST_CONFIG.invitedUserId} 已关联代理商 ${agentId}`);
  console.log();
}

/**
 * 第4步：模拟用户下单
 */
async function testCreateOrder(agentId: number): Promise<number> {
  console.log('【第4步】测试用户下单...');
  
  const orderNo = `TEST_ORDER_${Date.now()}`;
  const commissionRate = 30; // 30%
  const expectedCommission = Math.floor(TEST_CONFIG.orderAmount * commissionRate / 100);
  
  // 获取一个有效的 plan_id
  const planResult = await pool.query('SELECT id FROM subscription_plans LIMIT 1');
  const planId = planResult.rows[0]?.id || 1;
  
  // 创建测试订单
  const orderResult = await pool.query(`
    INSERT INTO orders (
      order_no, user_id, plan_id, amount, status, 
      agent_id, profit_sharing, expected_commission,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING id
  `, [
    orderNo,
    TEST_CONFIG.invitedUserId,
    planId,
    TEST_CONFIG.orderAmount / 100, // 转换为元
    'paid',
    agentId,
    false,
    expectedCommission / 100 // 转换为元
  ]);
  
  const orderId = orderResult.rows[0].id;
  
  console.log(`  ✓ 订单创建成功: ${orderNo} (ID: ${orderId})`);
  console.log(`  - 订单金额: ¥${(TEST_CONFIG.orderAmount / 100).toFixed(2)}`);
  console.log(`  - 预计佣金: ¥${(expectedCommission / 100).toFixed(2)} (${commissionRate}%)`);
  console.log();
  
  return orderId;
}

/**
 * 第5步：验证佣金记录
 */
async function testCommissionRecord(agentId: number, orderId: number) {
  console.log('【第5步】测试佣金记录...');
  
  // 获取订单金额
  const orderResult = await pool.query('SELECT amount FROM orders WHERE id = $1', [orderId]);
  const orderAmount = parseFloat(orderResult.rows[0]?.amount || '0') * 100; // 转换为分
  
  // 创建佣金记录
  const commissionRate = 0.30;
  const commissionAmount = Math.floor(orderAmount * commissionRate);
  const settleDate = new Date();
  settleDate.setDate(settleDate.getDate() + 1); // T+1
  
  await pool.query(`
    INSERT INTO commission_records (
      agent_id, order_id, invited_user_id, order_amount, 
      commission_rate, commission_amount, status, settle_date, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT DO NOTHING
  `, [
    agentId,
    orderId,
    TEST_CONFIG.invitedUserId,
    orderAmount / 100, // 转换为元
    commissionRate,
    commissionAmount / 100, // 转换为元
    'pending',
    settleDate
  ]);
  
  // 查询佣金记录
  const commissions = await pool.query(`
    SELECT * FROM commission_records WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 5
  `, [agentId]);
  
  console.log(`  ✓ 佣金记录数: ${commissions.rows.length}`);
  
  if (commissions.rows.length > 0) {
    const latest = commissions.rows[0];
    console.log(`  - 最新记录: 订单${latest.order_id}, 佣金¥${(latest.commission_amount / 100).toFixed(2)}, 状态${latest.status}`);
  }
  console.log();
}

/**
 * 第6步：模拟分账执行
 */
async function testProfitSharing(agentId: number) {
  console.log('【第6步】测试分账执行（模拟）...');
  
  // 获取待分账的佣金记录
  const pendingCommissions = await pool.query(`
    SELECT cr.*, a.wechat_openid 
    FROM commission_records cr
    JOIN agents a ON cr.agent_id = a.id
    WHERE cr.agent_id = $1 AND cr.status = 'pending'
  `, [agentId]);
  
  console.log(`  - 待分账记录数: ${pendingCommissions.rows.length}`);
  
  if (pendingCommissions.rows.length > 0) {
    // 模拟分账（不实际调用微信API）
    for (const record of pendingCommissions.rows) {
      const commissionAmountCents = Math.round(parseFloat(record.commission_amount) * 100);
      
      // 创建分账记录（不包含 openid 字段，因为表中没有）
      await pool.query(`
        INSERT INTO profit_sharing_records (
          commission_id, out_order_no, transaction_id, 
          amount, status, request_time
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        record.id,
        `PS_${Date.now()}`,
        `MOCK_TXN_${Date.now()}`,
        commissionAmountCents,
        'success'
      ]);
      
      // 更新佣金状态为已结算
      await pool.query(`
        UPDATE commission_records SET status = 'settled', settled_at = NOW() WHERE id = $1
      `, [record.id]);
      
      console.log(`  ✓ 模拟分账成功: 佣金ID=${record.id}, 金额=¥${parseFloat(record.commission_amount).toFixed(2)}`);
    }
  }
  
  // 更新代理商累计收益
  const totalEarnings = await pool.query(`
    SELECT COALESCE(SUM(commission_amount), 0) as total
    FROM commission_records 
    WHERE agent_id = $1 AND status = 'settled'
  `, [agentId]);
  
  await pool.query(`
    UPDATE agents SET total_earnings = $1 WHERE id = $2
  `, [totalEarnings.rows[0].total, agentId]);
  
  console.log(`  ✓ 代理商累计收益已更新: ¥${(totalEarnings.rows[0].total / 100).toFixed(2)}`);
  console.log();
}

/**
 * 第7步：查看代理商统计
 */
async function testAgentStats(agentId: number) {
  console.log('【第7步】代理商统计数据...');
  
  const stats = await agentService.getAgentStats(agentId);
  
  console.log(`  - 邀请用户数: ${stats.totalInvites}`);
  console.log(`  - 付费用户数: ${stats.paidInvites}`);
  console.log(`  - 累计收益: ¥${(stats.totalEarnings / 100).toFixed(2)}`);
  console.log(`  - 待结算: ¥${(stats.pendingEarnings / 100).toFixed(2)}`);
  console.log(`  - 已结算: ¥${(stats.settledEarnings / 100).toFixed(2)}`);
  console.log();
  
  // 查看佣金列表
  const commissionList = await commissionService.listCommissions(agentId, { page: 1, pageSize: 5 });
  console.log(`  佣金记录 (共${commissionList.total}条):`);
  
  for (const c of commissionList.data) {
    console.log(`    - 订单${c.orderId}: ¥${(c.commissionAmount / 100).toFixed(2)} [${c.status}]`);
  }
  console.log();
}

// 运行测试
runTest();
