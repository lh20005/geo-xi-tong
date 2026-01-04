/**
 * 诊断存储空间显示问题
 * 
 * 问题描述：
 * 1. 用户中心显示 0/20，但应该显示剩余空间
 * 2. 无法上传图片和文件到企业图库和知识库
 * 3. 配额检查逻辑可能有问题
 */

import { pool } from '../db/database';

interface StorageUsageRow {
  user_id: number;
  username: string;
  role: string;
  image_storage_bytes: string;
  document_storage_bytes: string;
  article_storage_bytes: string;
  total_storage_bytes: string;
  storage_quota_bytes: string;
  purchased_storage_bytes: string;
  image_count: number;
  document_count: number;
  article_count: number;
}

async function diagnoseStorageDisplay() {
  console.log('='.repeat(80));
  console.log('存储空间显示问题诊断');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. 检查所有用户的存储使用情况
    console.log('📊 1. 检查所有用户的存储使用情况');
    console.log('-'.repeat(80));
    
    const usageResult = await pool.query<StorageUsageRow>(`
      SELECT 
        u.id as user_id,
        u.username,
        u.role,
        COALESCE(usu.image_storage_bytes, 0) as image_storage_bytes,
        COALESCE(usu.document_storage_bytes, 0) as document_storage_bytes,
        COALESCE(usu.article_storage_bytes, 0) as article_storage_bytes,
        COALESCE(usu.total_storage_bytes, 0) as total_storage_bytes,
        COALESCE(usu.storage_quota_bytes, 0) as storage_quota_bytes,
        COALESCE(usu.purchased_storage_bytes, 0) as purchased_storage_bytes,
        COALESCE(usu.image_count, 0) as image_count,
        COALESCE(usu.document_count, 0) as document_count,
        COALESCE(usu.article_count, 0) as article_count
      FROM users u
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      ORDER BY u.id
    `);

    for (const row of usageResult.rows) {
      const totalBytes = Number(row.total_storage_bytes);
      const quotaBytes = Number(row.storage_quota_bytes);
      const purchasedBytes = Number(row.purchased_storage_bytes);
      const effectiveQuota = quotaBytes + purchasedBytes;
      const availableBytes = effectiveQuota === -1 ? -1 : Math.max(0, effectiveQuota - totalBytes);
      const usagePercentage = effectiveQuota === -1 ? 0 : (totalBytes / effectiveQuota) * 100;

      console.log(`\n用户: ${row.username} (ID: ${row.user_id}, 角色: ${row.role})`);
      console.log(`  已使用: ${formatBytes(totalBytes)}`);
      console.log(`    - 图片: ${formatBytes(Number(row.image_storage_bytes))} (${row.image_count} 个)`);
      console.log(`    - 文档: ${formatBytes(Number(row.document_storage_bytes))} (${row.document_count} 个)`);
      console.log(`    - 文章: ${formatBytes(Number(row.article_storage_bytes))} (${row.article_count} 个)`);
      console.log(`  配额: ${formatBytes(quotaBytes)}`);
      console.log(`  购买的额外存储: ${formatBytes(purchasedBytes)}`);
      console.log(`  有效配额: ${formatBytes(effectiveQuota)}`);
      console.log(`  剩余空间: ${formatBytes(availableBytes)}`);
      console.log(`  使用率: ${usagePercentage.toFixed(2)}%`);
      
      // 检查问题
      if (quotaBytes === 0) {
        console.log(`  ⚠️  问题: 配额为 0，用户无法上传任何内容！`);
      }
      if (totalBytes > effectiveQuota && effectiveQuota !== -1) {
        console.log(`  ⚠️  问题: 已使用量超过配额！`);
      }
    }

    // 2. 检查用户订阅和套餐配额
    console.log('\n\n📋 2. 检查用户订阅和套餐配额');
    console.log('-'.repeat(80));
    
    const subscriptionResult = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.role,
        sp.plan_name,
        sp.plan_code,
        us.status as subscription_status,
        us.end_date,
        pf.feature_value as storage_quota_from_plan,
        pf.feature_unit
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id AND pf.feature_code = 'storage_space'
      ORDER BY u.id
    `);

    for (const row of subscriptionResult.rows) {
      console.log(`\n用户: ${row.username} (ID: ${row.user_id}, 角色: ${row.role})`);
      if (row.plan_name) {
        console.log(`  订阅套餐: ${row.plan_name} (${row.plan_code})`);
        console.log(`  订阅状态: ${row.subscription_status}`);
        console.log(`  到期时间: ${row.end_date}`);
        console.log(`  套餐存储配额: ${formatBytes(Number(row.storage_quota_from_plan))}`);
      } else {
        console.log(`  ⚠️  无活跃订阅`);
      }
    }

    // 3. 测试配额检查函数
    console.log('\n\n🧪 3. 测试配额检查函数');
    console.log('-'.repeat(80));
    
    for (const row of usageResult.rows) {
      const testFileSize = 1024 * 1024; // 1MB
      
      console.log(`\n测试用户 ${row.username} 上传 1MB 文件:`);
      
      try {
        const checkResult = await pool.query(
          'SELECT * FROM check_storage_quota($1, $2)',
          [row.user_id, testFileSize]
        );
        
        const check = checkResult.rows[0];
        console.log(`  允许上传: ${check.allowed ? '✅ 是' : '❌ 否'}`);
        console.log(`  当前使用: ${formatBytes(Number(check.current_usage_bytes))}`);
        console.log(`  配额: ${formatBytes(Number(check.quota_bytes))}`);
        console.log(`  可用空间: ${formatBytes(Number(check.available_bytes))}`);
        console.log(`  使用率: ${check.usage_percentage}%`);
        
        if (!check.allowed) {
          console.log(`  ❌ 原因: 空间不足，需要 ${formatBytes(testFileSize)}，但只剩 ${formatBytes(Number(check.available_bytes))}`);
        }
      } catch (error: any) {
        console.log(`  ❌ 检查失败: ${error.message}`);
      }
    }

    // 4. 检查数据库函数
    console.log('\n\n🔧 4. 检查数据库函数');
    console.log('-'.repeat(80));
    
    const functionsResult = await pool.query(`
      SELECT 
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN (
          'get_user_storage_quota',
          'initialize_user_storage',
          'record_storage_usage',
          'check_storage_quota'
        )
      ORDER BY routine_name
    `);
    
    console.log('\n存储相关函数:');
    for (const func of functionsResult.rows) {
      console.log(`  ✅ ${func.routine_name} (${func.routine_type})`);
    }
    
    if (functionsResult.rows.length < 4) {
      console.log('\n  ⚠️  警告: 缺少某些必需的数据库函数！');
    }

    // 5. 检查最近的存储事务
    console.log('\n\n📝 5. 检查最近的存储事务');
    console.log('-'.repeat(80));
    
    const transactionsResult = await pool.query(`
      SELECT 
        st.id,
        u.username,
        st.resource_type,
        st.resource_id,
        st.operation,
        st.size_bytes,
        st.created_at
      FROM storage_transactions st
      JOIN users u ON st.user_id = u.id
      ORDER BY st.created_at DESC
      LIMIT 10
    `);
    
    if (transactionsResult.rows.length === 0) {
      console.log('\n  ℹ️  没有存储事务记录');
    } else {
      console.log('\n最近的存储事务:');
      for (const tx of transactionsResult.rows) {
        console.log(`  ${tx.created_at.toISOString()} - ${tx.username}: ${tx.operation} ${tx.resource_type} #${tx.resource_id} (${formatBytes(Number(tx.size_bytes))})`);
      }
    }

    // 6. 提供修复建议
    console.log('\n\n💡 6. 修复建议');
    console.log('-'.repeat(80));
    
    const issues: string[] = [];
    
    for (const row of usageResult.rows) {
      const quotaBytes = Number(row.storage_quota_bytes);
      
      if (quotaBytes === 0) {
        issues.push(`用户 ${row.username} 的配额为 0，需要初始化配额`);
      }
    }
    
    if (issues.length > 0) {
      console.log('\n发现的问题:');
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
      
      console.log('\n建议的修复步骤:');
      console.log('  1. 运行配额初始化脚本');
      console.log('  2. 确保所有用户都有正确的存储配额');
      console.log('  3. 清除 Redis 缓存');
      console.log('  4. 重新测试上传功能');
    } else {
      console.log('\n✅ 未发现明显问题');
    }

  } catch (error) {
    console.error('\n❌ 诊断过程中出错:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === -1) return '无限';
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// 运行诊断
diagnoseStorageDisplay()
  .then(() => {
    console.log('\n✅ 诊断完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 诊断失败:', error);
    process.exit(1);
  });
