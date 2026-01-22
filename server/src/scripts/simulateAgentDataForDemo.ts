/**
 * 代理商数据模拟脚本 - 用于演示
 * 
 * 功能：为指定用户（zhuangxiu）生成拟真的代理商数据
 * 
 * 规则：
 * 1. 累计数据只增不减（符合真实业务逻辑）
 * 2. 每次执行随机增加 1-3 个新邀请用户
 * 3. 新用户有 60% 概率付费
 * 4. 付费用户产生佣金记录
 * 5. 历史佣金按时间推移自动结算（T+1）
 * 
 * 注意：这只是修改数据库数字，不会触发真实的微信支付分账！
 * 
 * 本地运行: npx ts-node src/scripts/simulateAgentDataForDemo.ts
 * 服务器运行: node scripts/simulateAgentDemo.js
 * 快捷脚本: ./scripts/simulate-agent-demo.sh
 */

import { pool } from '../db/database';

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

// 配置
const CONFIG = {
  targetUsername: 'zhuangxiu',  // 目标用户
  newInvitesMin: 1,             // 每次最少新增邀请
  newInvitesMax: 3,             // 每次最多新增邀请
  paidProbability: 0.6,         // 付费概率 60%
  immediateSettleProbability: 0.4, // 立即结算概率
  // 使用真实的套餐价格（2026-01-22 更新）
  plans: [
    { id: 2, name: 'Plus版', price: 99.00, weight: 50 },
    { id: 3, name: 'Pro版', price: 199.00, weight: 35 },
    { id: 5, name: 'Max版', price: 999.00, weight: 15 },
  ],
};

// 生成随机用户名（使用 demo_ 前缀便于识别虚拟用户）
function generateUsername(): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `demo_${suffix}`;
}

// 生成随机邮箱（使用 @demo.test 后缀便于识别）
function generateEmail(username: string): string {
  return `${username}@demo.test`;
}

// 根据权重随机选择套餐
function selectPlan(): typeof CONFIG.plans[0] {
  const totalWeight = CONFIG.plans.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const plan of CONFIG.plans) {
    random -= plan.weight;
    if (random <= 0) return plan;
  }
  return CONFIG.plans[0];
}

// 生成随机邀请码
function generateInvitationCode(): string {
  return Math.random().toString(36).substring(2, 8);
}

async function simulateAgentData() {
  log('\n' + '═'.repeat(60), COLORS.cyan);
  log('  🎯 代理商数据模拟器 - 演示版', COLORS.cyan);
  log('═'.repeat(60) + '\n', COLORS.cyan);

  const client = await pool.connect();
  
  try {
    // 1. 获取目标代理商信息
    log('【步骤1】获取代理商信息', COLORS.blue);
    
    const agentResult = await client.query(`
      SELECT a.*, u.invitation_code as user_invitation_code, u.id as user_id
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE u.username = $1
    `, [CONFIG.targetUsername]);
    
    if (agentResult.rows.length === 0) {
      log(`  ❌ 用户 ${CONFIG.targetUsername} 不是代理商`, COLORS.red);
      return;
    }
    
    const agent = agentResult.rows[0];
    const agentId = agent.id;
    const invitationCode = agent.user_invitation_code;
    const commissionRate = parseFloat(agent.commission_rate);
    
    log(`  代理商: ${CONFIG.targetUsername} (ID: ${agentId})`, COLORS.green);
    log(`  邀请码: ${invitationCode}`, COLORS.green);
    log(`  佣金比例: ${(commissionRate * 100).toFixed(0)}%`, COLORS.green);

    // 2. 获取当前统计
    log('\n【步骤2】当前数据统计', COLORS.blue);
    
    const currentStats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE invited_by_code = $1) as total_invites,
        (SELECT COUNT(*) FROM users u 
         JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
         WHERE u.invited_by_code = $1) as paid_invites,
        a.total_earnings,
        a.settled_earnings,
        a.pending_earnings
      FROM agents a WHERE a.id = $2
    `, [invitationCode, agentId]);
    
    const stats = currentStats.rows[0];
    log(`  当前邀请用户: ${stats.total_invites}`, COLORS.yellow);
    log(`  当前付费用户: ${stats.paid_invites}`, COLORS.yellow);
    log(`  累计收益: ¥${parseFloat(stats.total_earnings).toFixed(2)}`, COLORS.yellow);
    log(`  已结算: ¥${parseFloat(stats.settled_earnings).toFixed(2)}`, COLORS.yellow);
    log(`  待结算: ¥${parseFloat(stats.pending_earnings).toFixed(2)}`, COLORS.yellow);

    // 3. 先处理历史待结算佣金（模拟 T+1 结算）
    log('\n【步骤3】处理历史待结算佣金', COLORS.blue);
    
    const pendingCommissions = await client.query(`
      SELECT id, commission_amount, settle_date 
      FROM commission_records 
      WHERE agent_id = $1 AND status = 'pending' AND settle_date <= CURRENT_DATE
      ORDER BY settle_date
    `, [agentId]);
    
    let settledAmount = 0;
    for (const commission of pendingCommissions.rows) {
      await client.query(`
        UPDATE commission_records 
        SET status = 'settled', settled_at = NOW()
        WHERE id = $1
      `, [commission.id]);
      settledAmount += parseFloat(commission.commission_amount);
    }
    
    if (pendingCommissions.rows.length > 0) {
      log(`  ✓ 结算了 ${pendingCommissions.rows.length} 笔佣金，共 ¥${settledAmount.toFixed(2)}`, COLORS.green);
    } else {
      log(`  - 无待结算佣金`, COLORS.reset);
    }

    // 4. 新增邀请用户
    log('\n【步骤4】新增邀请用户', COLORS.blue);
    
    const newInvitesCount = Math.floor(Math.random() * (CONFIG.newInvitesMax - CONFIG.newInvitesMin + 1)) + CONFIG.newInvitesMin;
    log(`  本次新增 ${newInvitesCount} 个邀请用户`, COLORS.magenta);
    
    let newPaidCount = 0;
    let newCommissionTotal = 0;
    
    await client.query('BEGIN');
    
    try {
      for (let i = 0; i < newInvitesCount; i++) {
        const username = generateUsername();
        const email = generateEmail(username);
        const userInvCode = generateInvitationCode();
        const isPaid = Math.random() < CONFIG.paidProbability;
        
        // 创建用户
        const userResult = await client.query(`
          INSERT INTO users (username, email, password_hash, invitation_code, invited_by_code, invited_by_agent, created_at)
          VALUES ($1, $2, 'demo_hash_${Date.now()}', $3, $4, $5, NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days')
          RETURNING id
        `, [username, email, userInvCode, invitationCode, agentId]);
        
        const userId = userResult.rows[0].id;
        
        if (isPaid) {
          newPaidCount++;
          const plan = selectPlan();
          
          // 创建订阅
          await client.query(`
            INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, created_at)
            VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days', NOW())
          `, [userId, plan.id]);
          
          // 创建订单
          const orderNo = `DEMO_${Date.now()}_${i}`;
          const orderResult = await client.query(`
            INSERT INTO orders (order_no, user_id, plan_id, amount, status, agent_id, profit_sharing, expected_commission, created_at, paid_at)
            VALUES ($1, $2, $3, $4, 'paid', $5, true, $6, NOW(), NOW())
            RETURNING id
          `, [orderNo, userId, plan.id, plan.price, agentId, plan.price * commissionRate]);
          
          const orderId = orderResult.rows[0].id;
          const commissionAmount = plan.price * commissionRate;
          
          // 创建佣金记录（T+1 结算）
          const settleDate = new Date();
          settleDate.setDate(settleDate.getDate() + 1);
          
          await client.query(`
            INSERT INTO commission_records (agent_id, order_id, invited_user_id, order_amount, commission_rate, commission_amount, status, settle_date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
          `, [agentId, orderId, userId, plan.price, commissionRate, commissionAmount, settleDate]);
          
          newCommissionTotal += commissionAmount;
          
          log(`  ✓ ${username} - 付费用户 [${plan.name} ¥${plan.price}] 佣金 ¥${commissionAmount.toFixed(2)}`, COLORS.green);
        } else {
          log(`  ○ ${username} - 免费用户`, COLORS.reset);
        }
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // 5. 更新代理商统计
    log('\n【步骤5】更新代理商统计', COLORS.blue);
    
    await client.query(`
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

    // 6. 显示最终统计
    log('\n【步骤6】最终数据统计', COLORS.blue);
    
    const finalStats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE invited_by_code = $1) as total_invites,
        (SELECT COUNT(*) FROM users u 
         JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
         WHERE u.invited_by_code = $1) as paid_invites,
        a.total_earnings,
        a.settled_earnings,
        a.pending_earnings
      FROM agents a WHERE a.id = $2
    `, [invitationCode, agentId]);
    
    const final = finalStats.rows[0];
    
    log('', COLORS.reset);
    log('  ┌─────────────────────────────────────────┐', COLORS.cyan);
    log('  │           📊 数据变化汇总               │', COLORS.cyan);
    log('  ├─────────────────────────────────────────┤', COLORS.cyan);
    log(`  │  邀请用户: ${stats.total_invites} → ${final.total_invites} (+${parseInt(final.total_invites) - parseInt(stats.total_invites)})`.padEnd(43) + '│', COLORS.green);
    log(`  │  付费用户: ${stats.paid_invites} → ${final.paid_invites} (+${parseInt(final.paid_invites) - parseInt(stats.paid_invites)})`.padEnd(43) + '│', COLORS.green);
    log(`  │  累计收益: ¥${parseFloat(stats.total_earnings).toFixed(2)} → ¥${parseFloat(final.total_earnings).toFixed(2)}`.padEnd(42) + '│', COLORS.green);
    log(`  │  已结算:   ¥${parseFloat(stats.settled_earnings).toFixed(2)} → ¥${parseFloat(final.settled_earnings).toFixed(2)}`.padEnd(42) + '│', COLORS.green);
    log(`  │  待结算:   ¥${parseFloat(stats.pending_earnings).toFixed(2)} → ¥${parseFloat(final.pending_earnings).toFixed(2)}`.padEnd(42) + '│', COLORS.yellow);
    log('  └─────────────────────────────────────────┘', COLORS.cyan);

    log('\n' + '═'.repeat(60), COLORS.cyan);
    log('  ✅ 模拟完成！刷新代理商中心页面查看变化', COLORS.green);
    log('═'.repeat(60) + '\n', COLORS.cyan);

  } catch (error: any) {
    log(`\n❌ 模拟失败: ${error.message}`, COLORS.red);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

simulateAgentData();
