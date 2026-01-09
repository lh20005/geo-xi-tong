/**
 * 业务模拟测试脚本
 * 
 * 测试场景：
 * 1. lzc2005 的邀请码邀请 3 个新用户：ceshi1、ceshi2、ceshi3
 * 2. ceshi2 购买专业版，ceshi3 购买企业版
 * 3. ceshi4 自己注册（无邀请码）
 * 4. 验证各项业务逻辑
 */

import { pool } from '../db/database';
import { authService } from '../services/AuthService';
import { invitationService } from '../services/InvitationService';
import { agentService } from '../services/AgentService';
import { commissionService } from '../services/CommissionService';
import { discountService } from '../services/DiscountService';
import { subscriptionService } from '../services/SubscriptionService';
import { orderService } from '../services/OrderService';
import { QuotaInitializationService } from '../services/QuotaInitializationService';

// 测试配置
const TEST_CONFIG = {
  agentUsername: 'lzc2005',
  invitedUsers: ['ceshi1', 'ceshi2', 'ceshi3'],
  normalUser: 'ceshi4',
  testPassword: 'Test123456!',
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.cyan);
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];

function recordTest(name: string, passed: boolean, message: string, details?: any) {
  testResults.push({ name, passed, message, details });
  if (passed) {
    logSuccess(`${name}: ${message}`);
  } else {
    logError(`${name}: ${message}`);
  }
  if (details) {
    console.log('   详情:', JSON.stringify(details, null, 2));
  }
}

async function cleanup() {
  logSection('清理测试数据');
  
  const testUsernames = [...TEST_CONFIG.invitedUsers, TEST_CONFIG.normalUser];
  
  for (const username of testUsernames) {
    try {
      // 删除用户相关数据
      const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // 删除订单
        await pool.query('DELETE FROM orders WHERE user_id = $1', [userId]);
        // 删除订阅
        await pool.query('DELETE FROM user_subscriptions WHERE user_id = $1', [userId]);
        // 删除使用记录
        await pool.query('DELETE FROM user_usage WHERE user_id = $1', [userId]);
        // 删除存储记录
        await pool.query('DELETE FROM user_storage_usage WHERE user_id = $1', [userId]);
        // 删除用户
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        
        logInfo(`已清理用户: ${username}`);
      }
    } catch (error: any) {
      logWarning(`清理用户 ${username} 失败: ${error.message}`);
    }
  }
}

async function getOrCreateAgent(): Promise<{ agentId: number; userId: number; invitationCode: string }> {
  logSection('准备代理商账号');
  
  // 检查 lzc2005 是否存在
  let user = await authService.getUserByUsername(TEST_CONFIG.agentUsername);
  
  if (!user) {
    logInfo(`创建测试用户: ${TEST_CONFIG.agentUsername}`);
    user = await authService.createUser(TEST_CONFIG.agentUsername, TEST_CONFIG.testPassword);
  }
  
  logInfo(`用户 ${TEST_CONFIG.agentUsername} ID: ${user.id}, 邀请码: ${user.invitation_code}`);
  
  // 检查是否已是代理商
  let agent = await agentService.getAgentByUserId(user.id);
  
  if (!agent) {
    logInfo(`将 ${TEST_CONFIG.agentUsername} 设置为代理商`);
    agent = await agentService.applyAgent(user.id);
  }
  
  // 模拟绑定微信（测试环境）
  if (!agent.wechatOpenid) {
    logInfo('模拟绑定微信账户');
    await agentService.bindWechatAccount(agent.id, `test_openid_${Date.now()}`, TEST_CONFIG.agentUsername);
    await agentService.markReceiverAdded(agent.id, true);
    agent = (await agentService.getAgentById(agent.id))!;
  }
  
  logSuccess(`代理商准备完成: ID=${agent.id}, 佣金比例=${agent.commissionRate * 100}%`);
  
  return {
    agentId: agent.id,
    userId: user.id,
    invitationCode: user.invitation_code,
  };
}

async function testInvitationSystem(agentInvitationCode: string, agentId: number) {
  logSection('测试1: 邀请系统');
  
  const createdUsers: { username: string; userId: number }[] = [];
  
  for (const username of TEST_CONFIG.invitedUsers) {
    try {
      // 使用邀请码注册
      const user = await authService.registerUser(username, TEST_CONFIG.testPassword, agentInvitationCode);
      createdUsers.push({ username, userId: user.id });
      
      // 验证邀请关系
      const userRecord = await pool.query(
        'SELECT invited_by_code, invited_by_agent FROM users WHERE id = $1',
        [user.id]
      );
      
      const invitedByCode = userRecord.rows[0].invited_by_code;
      const invitedByAgent = userRecord.rows[0].invited_by_agent;
      
      logInfo(`用户 ${username} 注册成功: ID=${user.id}`);
      logInfo(`  invited_by_code: ${invitedByCode}`);
      logInfo(`  invited_by_agent: ${invitedByAgent}`);
      
      // 【关键检查】invited_by_agent 是否被正确设置
      if (invitedByCode === agentInvitationCode) {
        recordTest(
          `邀请码关联-${username}`,
          true,
          `invited_by_code 正确设置为 ${agentInvitationCode}`
        );
      } else {
        recordTest(
          `邀请码关联-${username}`,
          false,
          `invited_by_code 应为 ${agentInvitationCode}，实际为 ${invitedByCode}`
        );
      }
      
      // 【BUG检测】检查 invited_by_agent 是否被设置
      if (invitedByAgent === agentId) {
        recordTest(
          `代理商关联-${username}`,
          true,
          `invited_by_agent 正确设置为 ${agentId}`
        );
      } else {
        recordTest(
          `代理商关联-${username}`,
          false,
          `BUG: invited_by_agent 应为 ${agentId}，实际为 ${invitedByAgent}。用户注册时未正确设置代理商关联！`,
          { expected: agentId, actual: invitedByAgent }
        );
      }
      
    } catch (error: any) {
      recordTest(`用户注册-${username}`, false, error.message);
    }
  }
  
  // 注册无邀请码用户
  try {
    const normalUser = await authService.registerUser(TEST_CONFIG.normalUser, TEST_CONFIG.testPassword);
    createdUsers.push({ username: TEST_CONFIG.normalUser, userId: normalUser.id });
    
    const userRecord = await pool.query(
      'SELECT invited_by_code, invited_by_agent FROM users WHERE id = $1',
      [normalUser.id]
    );
    
    const hasNoInvitation = !userRecord.rows[0].invited_by_code && !userRecord.rows[0].invited_by_agent;
    
    recordTest(
      `无邀请码注册-${TEST_CONFIG.normalUser}`,
      hasNoInvitation,
      hasNoInvitation ? '正确：无邀请关联' : '错误：不应有邀请关联'
    );
    
  } catch (error: any) {
    recordTest(`无邀请码注册-${TEST_CONFIG.normalUser}`, false, error.message);
  }
  
  return createdUsers;
}

async function testDiscountEligibility(users: { username: string; userId: number }[], agentId: number) {
  logSection('测试2: 折扣资格检查');
  
  for (const { username, userId } of users) {
    try {
      const eligibility = await discountService.checkDiscountEligibility(userId);
      
      const isInvitedUser = TEST_CONFIG.invitedUsers.includes(username);
      
      logInfo(`用户 ${username} 折扣资格检查:`);
      logInfo(`  eligible: ${eligibility.eligible}`);
      logInfo(`  invitedByAgent: ${eligibility.invitedByAgent}`);
      logInfo(`  isFirstPurchase: ${eligibility.isFirstPurchase}`);
      logInfo(`  reason: ${eligibility.reason || '无'}`);
      
      if (isInvitedUser) {
        // 被邀请用户应该有折扣资格
        if (eligibility.eligible) {
          recordTest(
            `折扣资格-${username}`,
            true,
            '被邀请用户正确获得折扣资格'
          );
        } else {
          recordTest(
            `折扣资格-${username}`,
            false,
            `BUG: 被邀请用户应有折扣资格，但 eligible=${eligibility.eligible}, reason=${eligibility.reason}`,
            eligibility
          );
        }
      } else {
        // 非邀请用户不应有折扣资格
        if (!eligibility.eligible && eligibility.reason === 'not_invited_by_agent') {
          recordTest(
            `折扣资格-${username}`,
            true,
            '非邀请用户正确无折扣资格'
          );
        } else {
          recordTest(
            `折扣资格-${username}`,
            false,
            `非邀请用户不应有折扣资格`,
            eligibility
          );
        }
      }
      
    } catch (error: any) {
      recordTest(`折扣资格检查-${username}`, false, error.message);
    }
  }
}

async function testPurchaseWithDiscount(users: { username: string; userId: number }[], agentId: number) {
  logSection('测试3: 购买与折扣');
  
  // 获取套餐信息
  const plansResult = await pool.query(`
    SELECT id, plan_code, plan_name, price, COALESCE(agent_discount_rate, 100) as discount_rate
    FROM subscription_plans 
    WHERE is_active = true AND plan_code IN ('professional', 'enterprise')
    ORDER BY price ASC
  `);
  
  const plans = plansResult.rows;
  logInfo(`可用套餐: ${plans.map(p => `${p.plan_name}(¥${p.price}, 折扣${p.discount_rate}%)`).join(', ')}`);
  
  // ceshi2 购买专业版
  const ceshi2 = users.find(u => u.username === 'ceshi2');
  const professionalPlan = plans.find(p => p.plan_code === 'professional');
  
  if (ceshi2 && professionalPlan) {
    await simulatePurchase(ceshi2, professionalPlan, agentId, true);
  }
  
  // ceshi3 购买企业版
  const ceshi3 = users.find(u => u.username === 'ceshi3');
  const enterprisePlan = plans.find(p => p.plan_code === 'enterprise');
  
  if (ceshi3 && enterprisePlan) {
    await simulatePurchase(ceshi3, enterprisePlan, agentId, true);
  }
  
  // ceshi4 购买（无折扣）
  const ceshi4 = users.find(u => u.username === 'ceshi4');
  if (ceshi4 && professionalPlan) {
    await simulatePurchase(ceshi4, professionalPlan, agentId, false);
  }
}

async function simulatePurchase(
  user: { username: string; userId: number },
  plan: any,
  agentId: number,
  shouldHaveDiscount: boolean
) {
  logInfo(`\n模拟 ${user.username} 购买 ${plan.plan_name}...`);
  
  try {
    // 检查折扣资格
    const eligibility = await discountService.checkDiscountEligibility(user.userId);
    
    // 计算价格
    const originalPrice = parseFloat(plan.price);
    const discountRate = parseInt(plan.discount_rate);
    let finalPrice = originalPrice;
    let isAgentDiscount = false;
    
    if (eligibility.eligible && discountRate < 100) {
      finalPrice = discountService.calculateDiscountedPrice(originalPrice, discountRate);
      isAgentDiscount = true;
    }
    
    logInfo(`  原价: ¥${originalPrice}, 折扣率: ${discountRate}%, 最终价: ¥${finalPrice}`);
    logInfo(`  是否代理商折扣: ${isAgentDiscount}`);
    
    // 验证折扣是否正确应用
    if (shouldHaveDiscount) {
      if (isAgentDiscount && finalPrice < originalPrice) {
        recordTest(
          `折扣应用-${user.username}`,
          true,
          `正确应用折扣: ¥${originalPrice} -> ¥${finalPrice}`
        );
      } else {
        recordTest(
          `折扣应用-${user.username}`,
          false,
          `BUG: 应有折扣但未应用。eligible=${eligibility.eligible}, reason=${eligibility.reason}`,
          { eligibility, discountRate }
        );
      }
    } else {
      if (!isAgentDiscount && finalPrice === originalPrice) {
        recordTest(
          `无折扣-${user.username}`,
          true,
          `正确无折扣: ¥${originalPrice}`
        );
      } else {
        recordTest(
          `无折扣-${user.username}`,
          false,
          `不应有折扣但有折扣`,
          { isAgentDiscount, finalPrice, originalPrice }
        );
      }
    }
    
    // 创建订单
    const order = await orderService.createOrder(user.userId, plan.id, 'purchase', 
      isAgentDiscount ? {
        applyDiscount: true,
        originalPrice,
        discountRate,
        isAgentDiscount: true
      } : undefined
    );
    
    logInfo(`  订单创建成功: ${order.order_no}, 金额: ¥${order.amount}`);
    
    // 模拟支付成功
    await pool.query(
      `UPDATE orders SET status = 'paid', paid_at = CURRENT_TIMESTAMP, transaction_id = $1 WHERE order_no = $2`,
      [`test_txn_${Date.now()}`, order.order_no]
    );
    
    // 激活订阅
    await subscriptionService.activateSubscription(user.userId, plan.id);
    
    // 标记首次购买折扣已使用
    if (isAgentDiscount) {
      await discountService.markFirstPurchaseDiscountUsed(user.userId);
    }
    
    // 创建佣金记录（如果用户被代理商邀请）
    const userRecord = await pool.query(
      'SELECT invited_by_agent FROM users WHERE id = $1',
      [user.userId]
    );
    
    const invitedByAgentId = userRecord.rows[0]?.invited_by_agent;
    
    if (invitedByAgentId) {
      const agent = await agentService.getAgentById(invitedByAgentId);
      if (agent && agent.status === 'active' && agent.wechatOpenid && agent.receiverAdded) {
        await commissionService.createCommission(order.id, invitedByAgentId, user.userId, order.amount);
        logInfo(`  佣金记录已创建，代理商ID: ${invitedByAgentId}`);
      }
    }
    
    logSuccess(`${user.username} 购买完成`);
    
  } catch (error: any) {
    recordTest(`购买-${user.username}`, false, error.message);
  }
}

async function testAgentCommissionData(agentUserId: number, agentId: number) {
  logSection('测试4: 代理商分佣数据');
  
  try {
    // 获取代理商统计
    const stats = await agentService.getAgentStats(agentId);
    
    logInfo('代理商统计数据:');
    logInfo(`  总邀请用户: ${stats.totalInvites}`);
    logInfo(`  付费用户: ${stats.paidInvites}`);
    logInfo(`  总收益: ¥${stats.totalEarnings}`);
    logInfo(`  已结算: ¥${stats.settledEarnings}`);
    logInfo(`  待结算: ¥${stats.pendingEarnings}`);
    logInfo(`  佣金记录数: ${stats.commissionCount}`);
    
    // 验证邀请数据
    const expectedInvites = TEST_CONFIG.invitedUsers.length;
    recordTest(
      '邀请用户统计',
      stats.totalInvites === expectedInvites,
      stats.totalInvites === expectedInvites 
        ? `正确显示 ${expectedInvites} 个邀请用户`
        : `应为 ${expectedInvites}，实际为 ${stats.totalInvites}`
    );
    
    // 获取佣金列表
    const commissions = await commissionService.listCommissions(agentId, { page: 1, pageSize: 10 });
    
    logInfo(`\n佣金记录列表 (共 ${commissions.total} 条):`);
    for (const c of commissions.data) {
      logInfo(`  订单: ${c.orderNo}, 用户: ${c.username}, 金额: ¥${c.orderAmount}, 佣金: ¥${c.commissionAmount}, 状态: ${c.status}`);
    }
    
    // 验证佣金记录
    const expectedCommissions = 2; // ceshi2 和 ceshi3 购买
    recordTest(
      '佣金记录数量',
      commissions.total === expectedCommissions,
      commissions.total === expectedCommissions
        ? `正确创建 ${expectedCommissions} 条佣金记录`
        : `应为 ${expectedCommissions}，实际为 ${commissions.total}`
    );
    
  } catch (error: any) {
    recordTest('代理商分佣数据', false, error.message);
  }
}

async function testRepeatPurchaseCommission(users: { username: string; userId: number }[], agentId: number) {
  logSection('测试5: 重复购买分佣');
  
  const ceshi2 = users.find(u => u.username === 'ceshi2');
  if (!ceshi2) {
    logWarning('找不到 ceshi2 用户');
    return;
  }
  
  try {
    // 获取企业版套餐
    const planResult = await pool.query(
      `SELECT id, plan_code, plan_name, price FROM subscription_plans WHERE plan_code = 'enterprise' AND is_active = true`
    );
    
    if (planResult.rows.length === 0) {
      logWarning('找不到企业版套餐');
      return;
    }
    
    const plan = planResult.rows[0];
    
    logInfo(`ceshi2 再次购买 ${plan.plan_name}...`);
    
    // 检查折扣资格（应该已经用过了）
    const eligibility = await discountService.checkDiscountEligibility(ceshi2.userId);
    logInfo(`  折扣资格: eligible=${eligibility.eligible}, reason=${eligibility.reason}`);
    
    // 第二次购买不应有折扣
    recordTest(
      '重复购买无折扣',
      !eligibility.eligible && eligibility.reason === 'discount_already_used',
      eligibility.reason === 'discount_already_used'
        ? '正确：首次购买折扣已使用'
        : `错误：reason=${eligibility.reason}`
    );
    
    // 创建订单（无折扣）
    const order = await orderService.createOrder(ceshi2.userId, plan.id, 'purchase');
    
    // 模拟支付
    await pool.query(
      `UPDATE orders SET status = 'paid', paid_at = CURRENT_TIMESTAMP, transaction_id = $1 WHERE order_no = $2`,
      [`test_txn_repeat_${Date.now()}`, order.order_no]
    );
    
    // 检查是否创建了新的佣金记录
    const userRecord = await pool.query(
      'SELECT invited_by_agent FROM users WHERE id = $1',
      [ceshi2.userId]
    );
    
    const invitedByAgentId = userRecord.rows[0]?.invited_by_agent;
    
    if (invitedByAgentId) {
      const agent = await agentService.getAgentById(invitedByAgentId);
      if (agent && agent.status === 'active' && agent.wechatOpenid && agent.receiverAdded) {
        await commissionService.createCommission(order.id, invitedByAgentId, ceshi2.userId, order.amount);
        
        recordTest(
          '重复购买分佣',
          true,
          `代理商收到重复购买的分佣，订单金额: ¥${order.amount}`
        );
      }
    } else {
      recordTest(
        '重复购买分佣',
        false,
        'BUG: 用户没有 invited_by_agent 关联，无法创建佣金记录'
      );
    }
    
  } catch (error: any) {
    recordTest('重复购买分佣', false, error.message);
  }
}

async function testUserQuotas(users: { username: string; userId: number }[]) {
  logSection('测试6: 用户配额');
  
  for (const { username, userId } of users) {
    try {
      const subscription = await subscriptionService.getUserActiveSubscription(userId);
      
      if (!subscription) {
        logInfo(`${username}: 无活跃订阅`);
        continue;
      }
      
      const usageStats = await subscriptionService.getUserUsageStats(userId);
      
      logInfo(`\n${username} 的配额 (${(subscription as any).plan_name || subscription.plan?.plan_name}):`);
      for (const stat of usageStats) {
        const limitDisplay = stat.limit === -1 ? '无限' : stat.limit;
        logInfo(`  ${stat.feature_name}: ${stat.used}/${limitDisplay} ${stat.unit}`);
      }
      
      // 验证配额是否正确初始化
      const hasQuotas = usageStats.length > 0;
      recordTest(
        `配额初始化-${username}`,
        hasQuotas,
        hasQuotas ? `正确初始化 ${usageStats.length} 项配额` : '配额未初始化'
      );
      
    } catch (error: any) {
      recordTest(`配额检查-${username}`, false, error.message);
    }
  }
}

async function testQuotaConsumption(users: { username: string; userId: number }[]) {
  logSection('测试7: 配额消耗');
  
  const ceshi1 = users.find(u => u.username === 'ceshi1');
  if (!ceshi1) {
    logWarning('找不到 ceshi1 用户');
    return;
  }
  
  try {
    // ceshi1 是免费版，测试配额限制
    const subscription = await subscriptionService.getUserActiveSubscription(ceshi1.userId);
    
    if (!subscription) {
      logWarning('ceshi1 无订阅');
      return;
    }
    
    logInfo(`ceshi1 当前套餐: ${(subscription as any).plan_name || subscription.plan?.plan_name}`);
    
    // 检查是否可以执行操作
    const canGenerate = await subscriptionService.canUserPerformAction(ceshi1.userId, 'articles_per_month');
    logInfo(`  可以生成文章: ${canGenerate}`);
    
    // 模拟消耗配额
    if (canGenerate) {
      await subscriptionService.recordUsage(ceshi1.userId, 'articles_per_month', 1);
      logInfo('  已消耗 1 次文章生成配额');
    }
    
    // 获取更新后的使用统计
    const stats = await subscriptionService.getUserUsageStats(ceshi1.userId);
    const articleStat = stats.find(s => s.feature_code === 'articles_per_month');
    
    if (articleStat) {
      logInfo(`  文章配额: ${articleStat.used}/${articleStat.limit}`);
      
      recordTest(
        '配额消耗记录',
        articleStat.used > 0,
        articleStat.used > 0 ? '配额消耗正确记录' : '配额消耗未记录'
      );
    }
    
  } catch (error: any) {
    recordTest('配额消耗', false, error.message);
  }
}

async function printSummary() {
  logSection('测试结果汇总');
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  
  console.log(`\n总计: ${testResults.length} 项测试`);
  logSuccess(`通过: ${passed} 项`);
  if (failed > 0) {
    logError(`失败: ${failed} 项`);
  }
  
  if (failed > 0) {
    console.log('\n失败的测试:');
    for (const result of testResults.filter(r => !r.passed)) {
      logError(`  - ${result.name}: ${result.message}`);
    }
  }
  
  // 检测到的 BUG
  const bugs = testResults.filter(r => !r.passed && r.message.includes('BUG'));
  if (bugs.length > 0) {
    console.log('\n' + '!'.repeat(60));
    logError('检测到的 BUG:');
    for (const bug of bugs) {
      logError(`  ${bug.name}: ${bug.message}`);
    }
    console.log('!'.repeat(60));
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('GEO 系统业务模拟测试', colors.cyan);
  console.log('='.repeat(60));
  
  try {
    // 清理旧数据
    await cleanup();
    
    // 准备代理商
    const { agentId, userId: agentUserId, invitationCode } = await getOrCreateAgent();
    
    // 测试邀请系统
    const users = await testInvitationSystem(invitationCode, agentId);
    
    // 测试折扣资格
    await testDiscountEligibility(users, agentId);
    
    // 测试购买与折扣
    await testPurchaseWithDiscount(users, agentId);
    
    // 测试代理商分佣数据
    await testAgentCommissionData(agentUserId, agentId);
    
    // 测试重复购买分佣
    await testRepeatPurchaseCommission(users, agentId);
    
    // 测试用户配额
    await testUserQuotas(users);
    
    // 测试配额消耗
    await testQuotaConsumption(users);
    
    // 打印汇总
    await printSummary();
    
  } catch (error: any) {
    logError(`测试执行失败: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
