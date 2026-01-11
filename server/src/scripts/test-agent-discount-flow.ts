/**
 * 代理商折扣功能完整业务测试脚本
 * 
 * 测试场景：
 * 1. 修改不同套餐的代理商折扣比例，验证商品卡同步
 * 2. 使用代理商邀请码注册新用户，购买不同套餐，验证折扣结算
 * 3. 验证代理商发展客户数据和购买记录的正确性
 */

import { pool } from '../db/database';
import { DiscountService } from '../services/DiscountService';
import { ProductManagementService } from '../services/ProductManagementService';
import { orderService } from '../services/OrderService';
import bcrypt from 'bcrypt';

const discountService = new DiscountService();
const productService = new ProductManagementService();

// 测试配置
const AGENT_USERNAME = 'testuser2';
const AGENT_INVITATION_CODE = 'a05eav';
const AGENT_ID = 8;  // agents 表中的 ID
const TEST_USER_PREFIX = 'discount_test_user_';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  data?: any;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[测试] ${message}`);
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.log(`❌ ${message}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
}

/**
 * 测试1: 修改套餐折扣比例并验证同步
 */
async function testDiscountRateSync() {
  logSection('测试1: 套餐折扣比例修改与同步');
  
  const discountConfigs = [
    { planId: 2, planName: '专业版', newRate: 80 },  // 8折
    { planId: 3, planName: '企业版', newRate: 70 },  // 7折
    { planId: 4, planName: '加量包', newRate: 90 },  // 9折
  ];

  for (const config of discountConfigs) {
    log(`设置 ${config.planName} 折扣比例为 ${config.newRate}%...`);
    
    // 更新折扣比例
    await pool.query(
      'UPDATE subscription_plans SET agent_discount_rate = $1 WHERE id = $2',
      [config.newRate, config.planId]
    );
    
    // 验证更新结果
    const result = await pool.query(
      'SELECT plan_name, price, agent_discount_rate FROM subscription_plans WHERE id = $1',
      [config.planId]
    );
    
    const plan = result.rows[0];
    const passed = plan.agent_discount_rate === config.newRate;
    
    results.push({
      testName: `套餐折扣设置 - ${config.planName}`,
      passed,
      details: `期望: ${config.newRate}, 实际: ${plan.agent_discount_rate}`,
      data: plan
    });
    
    if (passed) {
      logSuccess(`${config.planName}: 折扣 ${config.newRate}% (原价 ¥${plan.price})`);
    } else {
      logError(`${config.planName}: 折扣设置失败`);
    }
  }

  // 验证商品卡数据同步（通过 API 获取）
  log('\n验证商品卡数据同步...');
  const allPlans = await pool.query(
    'SELECT id, plan_code, plan_name, price, agent_discount_rate FROM subscription_plans ORDER BY id'
  );
  
  console.log('\n当前套餐折扣配置:');
  console.table(allPlans.rows.map(p => ({
    ID: p.id,
    套餐: p.plan_name,
    原价: `¥${p.price}`,
    折扣比例: `${p.agent_discount_rate}%`,
    折扣价: `¥${(parseFloat(p.price) * p.agent_discount_rate / 100).toFixed(2)}`
  })));
}

/**
 * 生成6位随机邀请码
 */
function generateInvitationCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 创建测试用户（使用代理商邀请码注册）
 */
async function createTestUser(suffix: string): Promise<{ id: number; username: string }> {
  const username = `${TEST_USER_PREFIX}${suffix}_${Date.now()}`;
  const passwordHash = await bcrypt.hash('test123456', 10);
  const invitationCode = generateInvitationCode();
  
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, invitation_code, invited_by_code, invited_by_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username`,
    [username, passwordHash, invitationCode, AGENT_INVITATION_CODE, AGENT_ID]
  );
  
  return result.rows[0];
}

/**
 * 测试2: 新用户注册并购买套餐，验证折扣结算
 */
async function testDiscountSettlement() {
  logSection('测试2: 新用户购买套餐折扣结算');
  
  const testCases = [
    { planId: 2, planName: '专业版', expectedRate: 80 },
    { planId: 3, planName: '企业版', expectedRate: 70 },
    { planId: 4, planName: '加量包', expectedRate: 90 },
  ];

  for (const testCase of testCases) {
    log(`\n--- 测试购买 ${testCase.planName} ---`);
    
    // 创建新测试用户
    const user = await createTestUser(testCase.planName.replace(/版|包/g, ''));
    log(`创建测试用户: ${user.username} (ID: ${user.id})`);
    
    // 检查折扣资格
    const eligibility = await discountService.checkDiscountEligibility(user.id);
    log(`折扣资格检查: eligible=${eligibility.eligible}, invitedByAgent=${eligibility.invitedByAgent}`);
    
    results.push({
      testName: `折扣资格检查 - ${testCase.planName}`,
      passed: eligibility.eligible && eligibility.invitedByAgent,
      details: `eligible: ${eligibility.eligible}, invitedByAgent: ${eligibility.invitedByAgent}`,
      data: eligibility
    });
    
    // 获取套餐价格
    const planResult = await pool.query(
      'SELECT price, agent_discount_rate FROM subscription_plans WHERE id = $1',
      [testCase.planId]
    );
    const plan = planResult.rows[0];
    const originalPrice = parseFloat(plan.price);
    const discountRate = plan.agent_discount_rate;
    
    // 计算折扣价
    const discountedPrice = discountService.calculateDiscountedPrice(originalPrice, discountRate);
    const expectedDiscountedPrice = Math.max(0.01, Math.round(originalPrice * discountRate) / 100);
    
    log(`原价: ¥${originalPrice}, 折扣比例: ${discountRate}%, 折扣价: ¥${discountedPrice}`);
    
    // 创建订单（带折扣）
    const order = await orderService.createOrder(user.id, testCase.planId, 'purchase', {
      applyDiscount: true,
      originalPrice: originalPrice,
      discountRate: discountRate,
      isAgentDiscount: true
    });
    
    log(`订单创建成功: ${order.order_no}, 金额: ¥${order.amount}`);
    
    // 验证订单金额
    const orderPassed = Math.abs(Number(order.amount) - discountedPrice) < 0.01;
    results.push({
      testName: `订单金额验证 - ${testCase.planName}`,
      passed: orderPassed,
      details: `期望: ¥${discountedPrice}, 实际: ¥${order.amount}`,
      data: { order_no: order.order_no, amount: order.amount, discountedPrice }
    });
    
    if (orderPassed) {
      logSuccess(`订单金额正确: ¥${order.amount}`);
    } else {
      logError(`订单金额错误: 期望 ¥${discountedPrice}, 实际 ¥${order.amount}`);
    }
    
    // 验证订单折扣信息记录
    const orderDetail = await pool.query(
      'SELECT original_price, discount_rate, is_agent_discount FROM orders WHERE order_no = $1',
      [order.order_no]
    );
    const orderInfo = orderDetail.rows[0];
    
    const discountInfoPassed = 
      parseFloat(orderInfo.original_price) === originalPrice &&
      orderInfo.discount_rate === discountRate &&
      orderInfo.is_agent_discount === true;
    
    results.push({
      testName: `订单折扣信息记录 - ${testCase.planName}`,
      passed: discountInfoPassed,
      details: `original_price: ${orderInfo.original_price}, discount_rate: ${orderInfo.discount_rate}, is_agent_discount: ${orderInfo.is_agent_discount}`,
      data: orderInfo
    });
    
    if (discountInfoPassed) {
      logSuccess(`折扣信息记录正确`);
    } else {
      logError(`折扣信息记录错误`);
    }
  }
}

/**
 * 测试3: 验证代理商客户数据和购买记录
 */
async function testAgentCustomerData() {
  logSection('测试3: 代理商客户数据与购买记录验证');
  
  // 获取代理商信息
  const agentResult = await pool.query(
    `SELECT a.*, u.username, u.invitation_code 
     FROM agents a 
     JOIN users u ON a.user_id = u.id 
     WHERE u.username = $1`,
    [AGENT_USERNAME]
  );
  const agent = agentResult.rows[0];
  log(`代理商: ${agent.username} (邀请码: ${agent.invitation_code})`);
  
  // 统计通过该代理商邀请码注册的用户
  const invitedUsersResult = await pool.query(
    `SELECT id, username, created_at, first_purchase_discount_used
     FROM users 
     WHERE invited_by_code = $1
     ORDER BY created_at DESC`,
    [AGENT_INVITATION_CODE]
  );
  
  log(`\n发展客户数量: ${invitedUsersResult.rows.length}`);
  
  results.push({
    testName: '代理商发展客户统计',
    passed: invitedUsersResult.rows.length > 0,
    details: `客户数量: ${invitedUsersResult.rows.length}`,
    data: { count: invitedUsersResult.rows.length }
  });
  
  // 显示客户列表
  if (invitedUsersResult.rows.length > 0) {
    console.log('\n代理商发展的客户:');
    console.table(invitedUsersResult.rows.slice(0, 10).map(u => ({
      ID: u.id,
      用户名: u.username,
      注册时间: new Date(u.created_at).toLocaleString(),
      已用折扣: u.first_purchase_discount_used ? '是' : '否'
    })));
  }
  
  // 统计这些客户的订单
  const customerIds = invitedUsersResult.rows.map(u => u.id);
  if (customerIds.length > 0) {
    const ordersResult = await pool.query(
      `SELECT o.order_no, o.user_id, u.username, o.amount, o.original_price, 
              o.discount_rate, o.is_agent_discount, o.status, o.created_at,
              sp.plan_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN subscription_plans sp ON o.plan_id = sp.id
       WHERE o.user_id = ANY($1)
       ORDER BY o.created_at DESC`,
      [customerIds]
    );
    
    log(`\n客户订单数量: ${ordersResult.rows.length}`);
    
    // 统计折扣订单
    const discountOrders = ordersResult.rows.filter(o => o.is_agent_discount);
    log(`其中折扣订单: ${discountOrders.length}`);
    
    results.push({
      testName: '客户订单记录',
      passed: ordersResult.rows.length > 0,
      details: `总订单: ${ordersResult.rows.length}, 折扣订单: ${discountOrders.length}`,
      data: { total: ordersResult.rows.length, discount: discountOrders.length }
    });
    
    if (ordersResult.rows.length > 0) {
      console.log('\n客户订单记录:');
      console.table(ordersResult.rows.slice(0, 10).map(o => ({
        订单号: o.order_no,
        用户: o.username,
        套餐: o.plan_name,
        原价: o.original_price ? `¥${o.original_price}` : '-',
        折扣: o.discount_rate ? `${o.discount_rate}%` : '-',
        实付: `¥${o.amount}`,
        代理折扣: o.is_agent_discount ? '是' : '否',
        状态: o.status
      })));
    }
    
    // 计算代理商预期收益（假设佣金比例30%）
    const paidDiscountOrders = discountOrders.filter(o => o.status === 'paid');
    const totalRevenue = paidDiscountOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0);
    const expectedCommission = totalRevenue * 0.3;
    
    log(`\n已支付折扣订单收入: ¥${totalRevenue.toFixed(2)}`);
    log(`预期佣金 (30%): ¥${expectedCommission.toFixed(2)}`);
  }
}

/**
 * 测试4: 验证折扣价格计算的边界情况
 */
async function testDiscountCalculationEdgeCases() {
  logSection('测试4: 折扣价格计算边界测试');
  
  const testCases = [
    { price: 100, rate: 80, expected: 80 },
    { price: 100, rate: 100, expected: 100 },
    { price: 0.01, rate: 50, expected: 0.01 },  // 最小值保护
    { price: 99.99, rate: 1, expected: 1 },
    { price: 1000, rate: 70, expected: 700 },
  ];
  
  for (const tc of testCases) {
    const result = discountService.calculateDiscountedPrice(tc.price, tc.rate);
    const passed = Math.abs(result - tc.expected) < 0.01;
    
    results.push({
      testName: `折扣计算: ¥${tc.price} × ${tc.rate}%`,
      passed,
      details: `期望: ¥${tc.expected}, 实际: ¥${result}`,
      data: { price: tc.price, rate: tc.rate, result, expected: tc.expected }
    });
    
    if (passed) {
      logSuccess(`¥${tc.price} × ${tc.rate}% = ¥${result}`);
    } else {
      logError(`¥${tc.price} × ${tc.rate}% = ¥${result} (期望 ¥${tc.expected})`);
    }
  }
}

/**
 * 清理测试数据
 */
async function cleanup() {
  logSection('清理测试数据');
  
  // 删除测试用户的订单
  const deleteOrdersResult = await pool.query(
    `DELETE FROM orders WHERE user_id IN (
      SELECT id FROM users WHERE username LIKE $1
    ) RETURNING order_no`,
    [`${TEST_USER_PREFIX}%`]
  );
  log(`删除测试订单: ${deleteOrdersResult.rowCount} 条`);
  
  // 删除测试用户
  const deleteUsersResult = await pool.query(
    `DELETE FROM users WHERE username LIKE $1 RETURNING username`,
    [`${TEST_USER_PREFIX}%`]
  );
  log(`删除测试用户: ${deleteUsersResult.rowCount} 个`);
  
  // 恢复套餐折扣为默认值
  await pool.query('UPDATE subscription_plans SET agent_discount_rate = 100');
  log('恢复套餐折扣为默认值 (100%)');
}

/**
 * 打印测试报告
 */
function printReport() {
  logSection('测试报告');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`\n总计: ${total} 项测试`);
  console.log(`通过: ${passed} ✅`);
  console.log(`失败: ${failed} ❌`);
  console.log(`通过率: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.testName}: ${r.details}`);
    });
  }
  
  console.log('\n详细结果:');
  console.table(results.map(r => ({
    测试项: r.testName,
    结果: r.passed ? '✅ 通过' : '❌ 失败',
    详情: r.details
  })));
}

/**
 * 主测试流程
 */
async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          代理商折扣功能 - 完整业务测试                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // 执行测试
    await testDiscountRateSync();
    await testDiscountSettlement();
    await testAgentCustomerData();
    await testDiscountCalculationEdgeCases();
    
    // 打印报告
    printReport();
    
    // 询问是否清理
    console.log('\n⚠️  测试数据保留中，如需清理请手动运行 cleanup()');
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 导出函数供外部调用
export { main, cleanup, testDiscountRateSync, testDiscountSettlement, testAgentCustomerData };

// 直接运行
main().catch(console.error);
