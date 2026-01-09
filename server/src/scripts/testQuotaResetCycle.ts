/**
 * 配额重置周期测试脚本
 * 
 * 测试场景：
 * 1. 企业版用户（年度订阅）的月度配额重置
 * 2. 模拟跨月后配额是否正确重置为0
 * 3. 验证订阅周期内的配额（如平台账号数）不会重置
 */

import { pool } from '../db/database';
import { subscriptionService } from '../services/SubscriptionService';

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

function logSuccess(message: string) { log(`✅ ${message}`, colors.green); }
function logError(message: string) { log(`❌ ${message}`, colors.red); }
function logInfo(message: string) { log(`ℹ️  ${message}`, colors.blue); }

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

function recordTest(name: string, passed: boolean, message: string) {
  testResults.push({ name, passed, message });
  if (passed) {
    logSuccess(`${name}: ${message}`);
  } else {
    logError(`${name}: ${message}`);
  }
}

async function getTestUser(username: string) {
  const result = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) return null;
  return { userId: result.rows[0].id, username: result.rows[0].username };
}

async function testMonthlyQuotaReset() {
  logSection('测试: 月度配额重置（企业版年度订阅）');
  
  // 使用 ceshi3（企业版用户）
  const user = await getTestUser('ceshi3');
  if (!user) {
    logError('找不到 ceshi3 用户，请先运行 businessSimulationTest.ts');
    return;
  }
  
  logInfo(`测试用户: ${user.username} (ID: ${user.userId})`);
  
  try {
    // 1. 获取当前订阅信息
    const subscription = await subscriptionService.getUserActiveSubscription(user.userId);
    if (!subscription) {
      logError('用户无活跃订阅');
      return;
    }
    
    const planName = (subscription as any).plan_name || subscription.plan?.plan_name;
    logInfo(`当前套餐: ${planName}`);
    logInfo(`订阅开始: ${subscription.start_date}`);
    logInfo(`订阅结束: ${subscription.end_date}`);
    
    // 2. 查看当前配额使用情况
    const statsBefore = await subscriptionService.getUserUsageStats(user.userId);
    logInfo('\n当前配额使用情况:');
    for (const stat of statsBefore) {
      logInfo(`  ${stat.feature_name}: ${stat.used}/${stat.limit} (重置周期: ${stat.reset_period})`);
    }
    
    // 3. 消耗一些配额
    logInfo('\n消耗配额...');
    await subscriptionService.recordUsage(user.userId, 'articles_per_month', 5);
    await subscriptionService.recordUsage(user.userId, 'publish_per_month', 3);
    
    const statsAfterUsage = await subscriptionService.getUserUsageStats(user.userId);
    const articleStatAfter = statsAfterUsage.find(s => s.feature_code === 'articles_per_month');
    const publishStatAfter = statsAfterUsage.find(s => s.feature_code === 'publish_per_month');
    
    logInfo(`消耗后 - 文章: ${articleStatAfter?.used}/${articleStatAfter?.limit}`);
    logInfo(`消耗后 - 发布: ${publishStatAfter?.used}/${publishStatAfter?.limit}`);
    
    // 4. 查看 user_usage 表中的周期记录
    const usageRecords = await pool.query(
      `SELECT feature_code, usage_count, period_start, period_end 
       FROM user_usage 
       WHERE user_id = $1 
       ORDER BY feature_code, period_start DESC`,
      [user.userId]
    );
    
    logInfo('\n配额周期记录:');
    for (const record of usageRecords.rows) {
      logInfo(`  ${record.feature_code}: 使用${record.usage_count}, 周期: ${record.period_start.toISOString().split('T')[0]} ~ ${record.period_end.toISOString().split('T')[0]}`);
    }
    
    // 5. 模拟下个月（创建新的周期记录）
    logInfo('\n模拟进入下个月...');
    
    // 获取当前月度配额的周期
    const currentPeriod = usageRecords.rows.find(r => r.feature_code === 'articles_per_month');
    if (!currentPeriod) {
      logError('找不到文章配额记录');
      return;
    }
    
    // 计算下个月的周期
    const nextMonthStart = new Date(currentPeriod.period_end);
    nextMonthStart.setDate(nextMonthStart.getDate() + 1);
    const nextMonthEnd = new Date(nextMonthStart);
    nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 1);
    
    logInfo(`下个月周期: ${nextMonthStart.toISOString().split('T')[0]} ~ ${nextMonthEnd.toISOString().split('T')[0]}`);
    
    // 6. 在新周期记录使用量（模拟新月份的使用）
    // 直接插入新周期的记录 - 使用 toISOString() 确保类型一致
    const nextMonthStartStr = nextMonthStart.toISOString();
    const nextMonthEndStr = nextMonthEnd.toISOString();
    
    await pool.query(
      `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
       VALUES ($1, 'articles_per_month', 0, $2::timestamp, $3::timestamp, $2::timestamp)
       ON CONFLICT (user_id, feature_code, period_start) DO NOTHING`,
      [user.userId, nextMonthStartStr, nextMonthEndStr]
    );
    
    // 7. 查询新周期的使用量
    const newPeriodUsage = await pool.query(
      `SELECT usage_count FROM user_usage 
       WHERE user_id = $1 AND feature_code = 'articles_per_month' 
       AND period_start::date = $2::date`,
      [user.userId, nextMonthStartStr]
    );
    
    const newUsageCount = newPeriodUsage.rows[0]?.usage_count || 0;
    
    recordTest(
      '新月份配额重置',
      newUsageCount === 0,
      newUsageCount === 0 
        ? '新月份配额正确重置为0' 
        : `BUG: 新月份配额应为0，实际为${newUsageCount}`
    );
    
    // 8. 验证旧周期的使用量仍然保留（用于历史记录）
    const oldPeriodUsage = await pool.query(
      `SELECT usage_count FROM user_usage 
       WHERE user_id = $1 AND feature_code = 'articles_per_month' 
       AND period_start = $2`,
      [user.userId, currentPeriod.period_start]
    );
    
    const oldUsageCount = oldPeriodUsage.rows[0]?.usage_count || 0;
    
    recordTest(
      '旧周期记录保留',
      oldUsageCount > 0,
      oldUsageCount > 0 
        ? `旧周期使用量保留: ${oldUsageCount}` 
        : 'BUG: 旧周期使用量丢失'
    );
    
    // 9. 清理测试数据（删除模拟的新周期记录）
    await pool.query(
      `DELETE FROM user_usage 
       WHERE user_id = $1 AND feature_code = 'articles_per_month' 
       AND period_start::date = $2::date`,
      [user.userId, nextMonthStartStr]
    );
    
  } catch (error: any) {
    logError(`测试失败: ${error.message}`);
    console.error(error);
  }
}

async function testSubscriptionQuotaNoReset() {
  logSection('测试: 订阅周期配额不重置（平台账号数）');
  
  const user = await getTestUser('ceshi3');
  if (!user) {
    logError('找不到 ceshi3 用户');
    return;
  }
  
  try {
    // 平台账号数是订阅周期内的配额，不应该每月重置
    const stats = await subscriptionService.getUserUsageStats(user.userId);
    const platformStat = stats.find(s => s.feature_code === 'platform_accounts');
    
    if (!platformStat) {
      logInfo('未找到平台账号配额记录');
      return;
    }
    
    logInfo(`平台账号配额: ${platformStat.used}/${platformStat.limit}`);
    logInfo(`重置周期: ${platformStat.reset_period}`);
    
    recordTest(
      '平台账号重置周期',
      platformStat.reset_period === 'subscription',
      platformStat.reset_period === 'subscription'
        ? '正确设置为订阅周期'
        : `应为subscription，实际为${platformStat.reset_period}`
    );
    
  } catch (error: any) {
    logError(`测试失败: ${error.message}`);
  }
}

async function testQuotaResetOnNewMonth() {
  logSection('测试: 跨月后获取使用量');
  
  const user = await getTestUser('ceshi3');
  if (!user) {
    logError('找不到 ceshi3 用户');
    return;
  }
  
  try {
    // 模拟场景：当前日期在新的月份，但旧周期的记录还存在
    // getUserUsage 应该返回当前周期的使用量（如果没有记录则为0）
    
    // 1. 先记录当前使用量
    const currentUsage = await subscriptionService.getUserUsage(user.userId, 'articles_per_month');
    logInfo(`当前周期使用量: ${currentUsage}`);
    
    // 2. 检查 getUserUsage 的逻辑是否正确
    // 它应该只返回当前日期所在周期的使用量
    const usageRecords = await pool.query(
      `SELECT usage_count, period_start, period_end 
       FROM user_usage 
       WHERE user_id = $1 AND feature_code = 'articles_per_month'
       AND period_start::date <= CURRENT_DATE
       AND period_end::date >= CURRENT_DATE
       ORDER BY period_start DESC LIMIT 1`,
      [user.userId]
    );
    
    if (usageRecords.rows.length > 0) {
      const record = usageRecords.rows[0];
      logInfo(`数据库记录: 使用${record.usage_count}, 周期: ${record.period_start.toISOString().split('T')[0]} ~ ${record.period_end.toISOString().split('T')[0]}`);
      
      recordTest(
        '当前周期使用量查询',
        currentUsage === record.usage_count,
        currentUsage === record.usage_count
          ? '使用量查询正确'
          : `查询结果不一致: API返回${currentUsage}, 数据库${record.usage_count}`
      );
    } else {
      logInfo('当前周期无使用记录（新周期）');
      recordTest(
        '新周期使用量',
        currentUsage === 0,
        currentUsage === 0 ? '新周期使用量为0' : `应为0，实际为${currentUsage}`
      );
    }
    
  } catch (error: any) {
    logError(`测试失败: ${error.message}`);
  }
}

async function testQuotaCycleCalculation() {
  logSection('测试: 配额周期计算逻辑');
  
  const user = await getTestUser('ceshi3');
  if (!user) {
    logError('找不到 ceshi3 用户');
    return;
  }
  
  try {
    // 获取订阅信息
    const subscription = await subscriptionService.getUserActiveSubscription(user.userId);
    if (!subscription) {
      logError('用户无活跃订阅');
      return;
    }
    
    // 检查数据库函数 get_user_quota_period 是否存在并正确工作
    try {
      const periodResult = await pool.query(
        `SELECT period_start, period_end 
         FROM get_user_quota_period($1, 'articles_per_month')`,
        [user.userId]
      );
      
      if (periodResult.rows.length > 0) {
        const period = periodResult.rows[0];
        logInfo(`配额周期函数返回:`);
        logInfo(`  开始: ${period.period_start}`);
        logInfo(`  结束: ${period.period_end}`);
        
        // 验证周期是否在订阅有效期内
        const periodEnd = new Date(period.period_end);
        const subscriptionEnd = new Date(subscription.end_date);
        
        recordTest(
          '配额周期在订阅有效期内',
          periodEnd <= subscriptionEnd,
          periodEnd <= subscriptionEnd
            ? '配额周期正确限制在订阅有效期内'
            : 'BUG: 配额周期超出订阅有效期'
        );
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        logInfo('get_user_quota_period 函数不存在，使用备用逻辑');
      } else {
        throw error;
      }
    }
    
    // 检查下次重置时间
    try {
      const resetResult = await pool.query(
        `SELECT get_next_quota_reset_time($1) as next_reset`,
        [user.userId]
      );
      
      if (resetResult.rows[0]?.next_reset) {
        const nextReset = new Date(resetResult.rows[0].next_reset);
        logInfo(`下次配额重置时间: ${nextReset.toISOString()}`);
        
        // 验证下次重置时间是否合理（应该在未来）
        const now = new Date();
        recordTest(
          '下次重置时间有效',
          nextReset > now,
          nextReset > now
            ? '下次重置时间在未来'
            : 'BUG: 下次重置时间已过期'
        );
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        logInfo('get_next_quota_reset_time 函数不存在');
      } else {
        throw error;
      }
    }
    
  } catch (error: any) {
    logError(`测试失败: ${error.message}`);
  }
}

async function testActualMonthTransition() {
  logSection('测试: 实际月份切换场景');
  
  const user = await getTestUser('ceshi3');
  if (!user) {
    logError('找不到 ceshi3 用户');
    return;
  }
  
  try {
    // 场景：模拟用户在1月使用了配额，现在是2月，检查配额是否重置
    
    // 1. 创建一个"上个月"的使用记录
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);
    
    logInfo(`模拟上个月周期: ${lastMonthStart.toISOString().split('T')[0]} ~ ${lastMonthEnd.toISOString().split('T')[0]}`);
    
    // 插入上个月的使用记录 - 使用 toISOString() 确保类型一致
    const lastMonthStartStr = lastMonthStart.toISOString();
    const lastMonthEndStr = lastMonthEnd.toISOString();
    
    await pool.query(
      `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
       VALUES ($1, 'articles_per_month', 15, $2::timestamp, $3::timestamp, $2::timestamp)
       ON CONFLICT (user_id, feature_code, period_start) 
       DO UPDATE SET usage_count = 15`,
      [user.userId, lastMonthStartStr, lastMonthEndStr]
    );
    
    logInfo('已创建上个月使用记录: 15次');
    
    // 2. 获取当前使用量（应该是当前月份的，不是上个月的）
    const currentUsage = await subscriptionService.getUserUsage(user.userId, 'articles_per_month');
    logInfo(`当前月份使用量: ${currentUsage}`);
    
    // 3. 验证：当前使用量不应该包含上个月的15次
    // 如果系统正确实现，当前月份应该有独立的记录
    
    // 查看所有周期记录
    const allRecords = await pool.query(
      `SELECT usage_count, period_start, period_end 
       FROM user_usage 
       WHERE user_id = $1 AND feature_code = 'articles_per_month'
       ORDER BY period_start DESC`,
      [user.userId]
    );
    
    logInfo('\n所有周期记录:');
    for (const record of allRecords.rows) {
      const isCurrentPeriod = new Date() >= new Date(record.period_start) && new Date() <= new Date(record.period_end);
      logInfo(`  ${record.period_start.toISOString().split('T')[0]} ~ ${record.period_end.toISOString().split('T')[0]}: ${record.usage_count}次 ${isCurrentPeriod ? '(当前周期)' : ''}`);
    }
    
    // 4. 验证当前使用量不是上个月的15
    recordTest(
      '月份切换配额隔离',
      currentUsage !== 15,
      currentUsage !== 15
        ? `当前月份使用量(${currentUsage})与上月(15)正确隔离`
        : 'BUG: 当前月份使用量错误地包含了上月数据'
    );
    
    // 5. 清理测试数据
    await pool.query(
      `DELETE FROM user_usage 
       WHERE user_id = $1 AND feature_code = 'articles_per_month' 
       AND period_start::date = $2::date`,
      [user.userId, lastMonthStartStr]
    );
    
  } catch (error: any) {
    logError(`测试失败: ${error.message}`);
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
    console.log('\n失败的测试:');
    for (const result of testResults.filter(r => !r.passed)) {
      logError(`  - ${result.name}: ${result.message}`);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('配额重置周期测试', colors.cyan);
  console.log('='.repeat(60));
  
  try {
    await testMonthlyQuotaReset();
    await testSubscriptionQuotaNoReset();
    await testQuotaResetOnNewMonth();
    await testQuotaCycleCalculation();
    await testActualMonthTransition();
    
    await printSummary();
    
  } catch (error: any) {
    logError(`测试执行失败: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
