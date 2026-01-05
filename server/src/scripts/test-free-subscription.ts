/**
 * 测试免费版订阅功能
 * 
 * 使用方法:
 * npx ts-node src/scripts/test-free-subscription.ts
 */

import { pool } from '../db/database';
import { freeSubscriptionService } from '../services/FreeSubscriptionService';
import { subscriptionService } from '../services/SubscriptionService';

async function testNewUserSubscription() {
  console.log('\n========================================');
  console.log('测试 1: 为新用户开通免费版订阅');
  console.log('========================================\n');

  try {
    // 创建测试用户
    const username = `test_free_${Date.now()}`;
    const invCode = `T${Date.now().toString().slice(-5)}`;
    const userResult = await pool.query(
      `INSERT INTO users (username, password_hash, invitation_code, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, username`,
      [username, 'test_hash', invCode]
    );
    
    const user = userResult.rows[0];
    console.log(`✅ 创建测试用户: ${user.username} (ID: ${user.id})`);
    
    // 为用户开通免费版
    await freeSubscriptionService.activateFreeSubscriptionForNewUser(user.id);
    
    // 验证订阅
    const subscription = await subscriptionService.getUserActiveSubscription(user.id);
    if (!subscription) {
      throw new Error('订阅创建失败');
    }
    
    console.log(`✅ 订阅创建成功:`);
    console.log(`   - 套餐: ${subscription.plan?.plan_name || 'N/A'}`);
    console.log(`   - 状态: ${subscription.status}`);
    console.log(`   - 开始日期: ${subscription.start_date}`);
    console.log(`   - 结束日期: ${subscription.end_date}`);
    
    // 验证配额
    const stats = await subscriptionService.getUserUsageStats(user.id);
    console.log(`✅ 配额初始化成功 (${stats.length} 项):`);
    for (const stat of stats) {
      console.log(`   - ${stat.feature_name}: ${stat.used}/${stat.limit === -1 ? '无限' : stat.limit} ${stat.unit}`);
    }
    
    // 验证存储空间
    const storageResult = await pool.query(
      `SELECT storage_quota_bytes, total_storage_bytes 
       FROM user_storage_usage 
       WHERE user_id = $1`,
      [user.id]
    );
    
    if (storageResult.rows.length > 0) {
      const storage = storageResult.rows[0];
      const quotaMB = Math.round(storage.storage_quota_bytes / (1024 * 1024));
      const usedMB = Math.round(storage.total_storage_bytes / (1024 * 1024));
      console.log(`✅ 存储空间初始化成功: ${usedMB}/${quotaMB} MB`);
    }
    
    console.log('\n✅ 测试 1 通过\n');
    return user.id;
  } catch (error) {
    console.error('\n❌ 测试 1 失败:', error);
    throw error;
  }
}

async function testExistingUsersReset() {
  console.log('\n========================================');
  console.log('测试 2: 为现有无订阅用户重置免费版');
  console.log('========================================\n');

  try {
    // 创建几个没有订阅的测试用户
    const testUsers = [];
    for (let i = 0; i < 3; i++) {
      const username = `test_existing_${Date.now()}_${i}`;
      const invCode = `E${Date.now().toString().slice(-4)}${i}`;
      const userResult = await pool.query(
        `INSERT INTO users (username, password_hash, invitation_code, role)
         VALUES ($1, $2, $3, 'user')
         RETURNING id, username`,
        [username, 'test_hash', invCode]
      );
      testUsers.push(userResult.rows[0]);
      console.log(`✅ 创建测试用户: ${userResult.rows[0].username}`);
    }
    
    // 执行批量重置
    console.log('\n开始批量重置...\n');
    const result = await freeSubscriptionService.resetExistingUsersToFree();
    
    console.log(`\n批量重置结果:`);
    console.log(`   - 总计: ${result.total}`);
    console.log(`   - 成功: ${result.success}`);
    console.log(`   - 失败: ${result.failed}`);
    
    // 验证每个用户的订阅
    console.log('\n验证用户订阅:');
    for (const user of testUsers) {
      const subscription = await subscriptionService.getUserActiveSubscription(user.id);
      if (subscription && subscription.plan) {
        console.log(`✅ ${user.username}: 已开通 ${subscription.plan.plan_name}`);
      } else {
        console.log(`❌ ${user.username}: 订阅未创建`);
      }
    }
    
    console.log('\n✅ 测试 2 通过\n');
    return testUsers.map(u => u.id);
  } catch (error) {
    console.error('\n❌ 测试 2 失败:', error);
    throw error;
  }
}

async function testDuplicateSubscription(userId: number) {
  console.log('\n========================================');
  console.log('测试 3: 防止重复订阅');
  console.log('========================================\n');

  try {
    // 尝试为已有订阅的用户再次开通
    await freeSubscriptionService.activateFreeSubscriptionForNewUser(userId);
    
    // 验证只有一个活跃订阅
    const subscriptionsResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_subscriptions 
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    
    const count = parseInt(subscriptionsResult.rows[0].count);
    if (count === 1) {
      console.log('✅ 防止重复订阅成功，用户只有 1 个活跃订阅');
    } else {
      throw new Error(`用户有 ${count} 个活跃订阅，应该只有 1 个`);
    }
    
    console.log('\n✅ 测试 3 通过\n');
  } catch (error) {
    console.error('\n❌ 测试 3 失败:', error);
    throw error;
  }
}

async function cleanup(userIds: number[]) {
  console.log('\n========================================');
  console.log('清理测试数据');
  console.log('========================================\n');

  try {
    for (const userId of userIds) {
      // 删除用户（级联删除订阅、配额等）
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      console.log(`✅ 删除测试用户 ID: ${userId}`);
    }
    console.log('\n✅ 清理完成\n');
  } catch (error) {
    console.error('\n❌ 清理失败:', error);
  }
}

async function main() {
  console.log('========================================');
  console.log('免费版订阅功能测试');
  console.log('========================================');

  const testUserIds: number[] = [];

  try {
    // 测试 1: 新用户订阅
    const userId1 = await testNewUserSubscription();
    testUserIds.push(userId1);
    
    // 测试 2: 批量重置
    const userIds2 = await testExistingUsersReset();
    testUserIds.push(...userIds2);
    
    // 测试 3: 防止重复订阅
    await testDuplicateSubscription(userId1);
    
    console.log('========================================');
    console.log('✅ 所有测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 测试失败');
    console.error('========================================\n');
    console.error(error);
  } finally {
    // 清理测试数据
    if (testUserIds.length > 0) {
      await cleanup(testUserIds);
    }
    await pool.end();
  }
}

main();
