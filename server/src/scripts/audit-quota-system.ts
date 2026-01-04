import { pool } from '../db/database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 配额系统全面审计脚本
 * 检查所有配额项目的完整性和一致性
 */

interface AuditResult {
  category: string;
  item: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const results: AuditResult[] = [];

function addResult(category: string, item: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: any) {
  results.push({ category, item, status, message, details });
}

async function auditQuotaSystem() {
  console.log('=== 配额系统全面审计 ===\n');
  console.log('开始时间:', new Date().toISOString(), '\n');

  try {
    // 1. 审计数据库函数
    await auditDatabaseFunctions();

    // 2. 审计配额配置
    await auditQuotaConfiguration();

    // 3. 审计 API 路由
    await auditAPIRoutes();

    // 4. 审计用户配额数据
    await auditUserQuotaData();

    // 5. 审计存储配额
    await auditStorageQuota();

    // 6. 生成报告
    generateReport();

  } catch (error) {
    console.error('审计失败:', error);
  } finally {
    await pool.end();
  }
}

/**
 * 1. 审计数据库函数
 */
async function auditDatabaseFunctions() {
  console.log('📋 1. 审计数据库函数\n');

  // 检查 check_user_quota 函数
  const checkQuotaFunc = await pool.query(`
    SELECT pg_get_functiondef(oid) as definition
    FROM pg_proc
    WHERE proname = 'check_user_quota'
  `);

  if (checkQuotaFunc.rows.length === 0) {
    addResult('数据库函数', 'check_user_quota', 'FAIL', '函数不存在');
  } else {
    addResult('数据库函数', 'check_user_quota', 'PASS', '函数存在');
    
    // 检查函数是否支持月度配额
    const def = checkQuotaFunc.rows[0].definition;
    if (def.includes('articles_per_month') || def.includes('publish_per_month')) {
      addResult('数据库函数', 'check_user_quota 月度支持', 'PASS', '支持月度配额');
    } else {
      addResult('数据库函数', 'check_user_quota 月度支持', 'WARNING', '可能不支持月度配额');
    }
  }

  // 检查 record_feature_usage 函数
  const recordUsageFunc = await pool.query(`
    SELECT pg_get_functiondef(oid) as definition
    FROM pg_proc
    WHERE proname = 'record_feature_usage'
  `);

  if (recordUsageFunc.rows.length === 0) {
    addResult('数据库函数', 'record_feature_usage', 'FAIL', '函数不存在');
  } else {
    addResult('数据库函数', 'record_feature_usage', 'PASS', '函数存在');
    
    // 检查函数是否支持月度配额
    const def = recordUsageFunc.rows[0].definition;
    if (def.includes('articles_per_month') && def.includes('publish_per_month')) {
      addResult('数据库函数', 'record_feature_usage 月度支持', 'PASS', '支持月度配额');
    } else {
      addResult('数据库函数', 'record_feature_usage 月度支持', 'FAIL', '不支持月度配额，需要更新');
    }
  }

  console.log('');
}

/**
 * 2. 审计配额配置
 */
async function auditQuotaConfiguration() {
  console.log('📋 2. 审计配额配置\n');

  // 检查 plan_features 表
  const features = await pool.query(`
    SELECT DISTINCT feature_code, COUNT(*) as plan_count
    FROM plan_features
    GROUP BY feature_code
    ORDER BY feature_code
  `);

  console.log('配额功能列表:');
  features.rows.forEach(row => {
    console.log(`  - ${row.feature_code}: ${row.plan_count} 个套餐`);
  });
  console.log('');

  // 检查必需的功能代码
  const requiredFeatures = [
    'articles_per_month',
    'publish_per_month',
    'keyword_distillation',
    'platform_accounts'
  ];

  for (const featureCode of requiredFeatures) {
    const exists = features.rows.some(row => row.feature_code === featureCode);
    if (exists) {
      addResult('配额配置', featureCode, 'PASS', '功能代码存在');
    } else {
      addResult('配额配置', featureCode, 'FAIL', '功能代码缺失');
    }
  }

  console.log('');
}

/**
 * 3. 审计 API 路由
 */
async function auditAPIRoutes() {
  console.log('📋 3. 审计 API 路由\n');

  const routes = [
    {
      name: '文章生成',
      file: 'server/src/routes/articleGeneration.ts',
      featureCode: 'articles_per_month',
      checkQuota: false,
      recordUsage: false
    },
    {
      name: '发布任务',
      file: 'server/src/routes/publishing.ts',
      featureCode: 'publish_per_month',
      checkQuota: false,
      recordUsage: false
    },
    {
      name: '关键词蒸馏',
      file: 'server/src/routes/distillation.ts',
      featureCode: 'keyword_distillation',
      checkQuota: false,
      recordUsage: false
    },
    {
      name: '平台账号',
      file: 'server/src/routes/platformAccounts.ts',
      featureCode: 'platform_accounts',
      checkQuota: false,
      recordUsage: false
    }
  ];

  for (const route of routes) {
    // 修正路径：从 server/src/scripts 到 server/src/routes
    const filePath = path.join(__dirname, '..', route.file.replace('server/src/', ''));
    
    if (!fs.existsSync(filePath)) {
      addResult('API 路由', route.name, 'FAIL', `文件不存在: ${filePath}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // 检查是否有配额检查
    if (content.includes('checkQuota') || content.includes('check_user_quota')) {
      route.checkQuota = true;
      addResult('API 路由', `${route.name} - 配额检查`, 'PASS', '存在配额检查');
    } else {
      addResult('API 路由', `${route.name} - 配额检查`, 'FAIL', '缺少配额检查');
    }

    // 检查是否有配额记录
    if (content.includes('recordUsage') || content.includes('record_feature_usage')) {
      route.recordUsage = true;
      addResult('API 路由', `${route.name} - 配额记录`, 'PASS', '存在配额记录');
    } else {
      addResult('API 路由', `${route.name} - 配额记录`, 'FAIL', '缺少配额记录');
    }
  }

  console.log('');
}

/**
 * 4. 审计用户配额数据
 */
async function auditUserQuotaData() {
  console.log('📋 4. 审计用户配额数据\n');

  // 检查有订阅但没有 user_usage 记录的用户
  const missingUsage = await pool.query(`
    SELECT 
      us.user_id,
      u.username,
      pf.feature_code
    FROM user_subscriptions us
    JOIN users u ON u.id = us.user_id
    JOIN plan_features pf ON pf.plan_id = us.plan_id
    WHERE us.status = 'active'
      AND us.end_date > CURRENT_TIMESTAMP
      AND pf.feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
      AND NOT EXISTS (
        SELECT 1 FROM user_usage uu
        WHERE uu.user_id = us.user_id
          AND uu.feature_code = pf.feature_code
          AND uu.period_end > CURRENT_TIMESTAMP
      )
  `);

  if (missingUsage.rows.length > 0) {
    addResult('用户配额数据', '缺失的 user_usage 记录', 'FAIL', 
      `${missingUsage.rows.length} 条记录缺失`, 
      missingUsage.rows.slice(0, 5)
    );
    console.log(`⚠️  发现 ${missingUsage.rows.length} 条缺失的 user_usage 记录`);
    missingUsage.rows.slice(0, 5).forEach(row => {
      console.log(`   - 用户 ${row.username} (${row.user_id}): ${row.feature_code}`);
    });
  } else {
    addResult('用户配额数据', '缺失的 user_usage 记录', 'PASS', '所有记录完整');
  }

  // 检查 period_end 错误的记录
  const wrongPeriod = await pool.query(`
    SELECT 
      user_id,
      feature_code,
      period_start,
      period_end
    FROM user_usage
    WHERE feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
      AND (
        period_end < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        OR period_end > DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 month'
      )
  `);

  if (wrongPeriod.rows.length > 0) {
    addResult('用户配额数据', '错误的配额周期', 'FAIL', 
      `${wrongPeriod.rows.length} 条记录周期错误`,
      wrongPeriod.rows.slice(0, 5)
    );
    console.log(`⚠️  发现 ${wrongPeriod.rows.length} 条周期错误的记录`);
  } else {
    addResult('用户配额数据', '错误的配额周期', 'PASS', '所有周期正确');
  }

  // 检查 usage_count 与 usage_records 不一致
  const inconsistentUsage = await pool.query(`
    SELECT 
      uu.user_id,
      uu.feature_code,
      uu.usage_count as recorded_count,
      COALESCE(SUM(ur.amount), 0) as actual_count
    FROM user_usage uu
    LEFT JOIN usage_records ur ON ur.user_id = uu.user_id 
      AND ur.feature_code = uu.feature_code
      AND ur.created_at >= uu.period_start
      AND ur.created_at < uu.period_end
    WHERE uu.feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
      AND uu.period_end > CURRENT_TIMESTAMP
    GROUP BY uu.user_id, uu.feature_code, uu.usage_count
    HAVING uu.usage_count != COALESCE(SUM(ur.amount), 0)
  `);

  if (inconsistentUsage.rows.length > 0) {
    addResult('用户配额数据', '使用量不一致', 'FAIL', 
      `${inconsistentUsage.rows.length} 条记录不一致`,
      inconsistentUsage.rows.slice(0, 5)
    );
    console.log(`⚠️  发现 ${inconsistentUsage.rows.length} 条使用量不一致的记录`);
    inconsistentUsage.rows.slice(0, 5).forEach(row => {
      console.log(`   - 用户 ${row.user_id}, ${row.feature_code}: 记录=${row.recorded_count}, 实际=${row.actual_count}`);
    });
  } else {
    addResult('用户配额数据', '使用量一致性', 'PASS', '所有使用量一致');
  }

  console.log('');
}

/**
 * 5. 审计存储配额
 */
async function auditStorageQuota() {
  console.log('📋 5. 审计存储配额\n');

  // 检查 user_storage_usage 表
  const storageUsage = await pool.query(`
    SELECT COUNT(*) as count FROM user_storage_usage
  `);

  if (storageUsage.rows[0].count > 0) {
    addResult('存储配额', 'user_storage_usage 表', 'PASS', `${storageUsage.rows[0].count} 条记录`);
  } else {
    addResult('存储配额', 'user_storage_usage 表', 'WARNING', '没有记录');
  }

  // 检查存储配额函数
  const storageFunc = await pool.query(`
    SELECT proname FROM pg_proc
    WHERE proname IN ('check_storage_quota', 'record_storage_usage')
  `);

  const funcNames = storageFunc.rows.map(row => row.proname);
  if (funcNames.includes('check_storage_quota')) {
    addResult('存储配额', 'check_storage_quota 函数', 'PASS', '函数存在');
  } else {
    addResult('存储配额', 'check_storage_quota 函数', 'FAIL', '函数不存在');
  }

  if (funcNames.includes('record_storage_usage')) {
    addResult('存储配额', 'record_storage_usage 函数', 'PASS', '函数存在');
  } else {
    addResult('存储配额', 'record_storage_usage 函数', 'FAIL', '函数不存在');
  }

  // 检查存储路由
  const galleryPath = path.join(__dirname, '../routes/gallery.ts');
  if (fs.existsSync(galleryPath)) {
    const content = fs.readFileSync(galleryPath, 'utf8');
    
    if (content.includes('storageQuotaService') || content.includes('checkQuota')) {
      addResult('存储配额', 'gallery.ts 配额检查', 'PASS', '存在配额检查');
    } else {
      addResult('存储配额', 'gallery.ts 配额检查', 'FAIL', '缺少配额检查');
    }

    if (content.includes('storageService') || content.includes('recordUsage')) {
      addResult('存储配额', 'gallery.ts 使用记录', 'PASS', '存在使用记录');
    } else {
      addResult('存储配额', 'gallery.ts 使用记录', 'FAIL', '缺少使用记录');
    }
  }

  const knowledgePath = path.join(__dirname, '../routes/knowledgeBases.ts');
  if (fs.existsSync(knowledgePath)) {
    const content = fs.readFileSync(knowledgePath, 'utf8');
    
    if (content.includes('storageQuotaService') || content.includes('checkQuota')) {
      addResult('存储配额', 'knowledgeBases.ts 配额检查', 'PASS', '存在配额检查');
    } else {
      addResult('存储配额', 'knowledgeBases.ts 配额检查', 'FAIL', '缺少配额检查');
    }
  }

  console.log('');
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n=== 审计报告 ===\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warningCount = results.filter(r => r.status === 'WARNING').length;

  console.log(`总计: ${results.length} 项检查`);
  console.log(`✅ 通过: ${passCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`⚠️  警告: ${warningCount}\n`);

  // 按类别分组
  const categories = [...new Set(results.map(r => r.category))];
  
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const categoryFails = categoryResults.filter(r => r.status === 'FAIL');
    
    console.log(`\n## ${category}`);
    console.log(`   检查项: ${categoryResults.length}, 失败: ${categoryFails.length}\n`);
    
    categoryResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`   ${icon} ${result.item}: ${result.message}`);
      if (result.details && result.status !== 'PASS') {
        console.log(`      详情:`, JSON.stringify(result.details, null, 2).split('\n').slice(0, 10).join('\n      '));
      }
    });
  });

  // 生成修复建议
  console.log('\n\n=== 修复建议 ===\n');
  
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length === 0) {
    console.log('✅ 没有发现严重问题！');
  } else {
    failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.category} - ${failure.item}`);
      console.log(`   问题: ${failure.message}`);
      console.log(`   建议: ${getSuggestion(failure)}\n`);
    });
  }

  // 保存报告到文件
  const reportPath = path.join(__dirname, '../../..', '配额系统审计报告.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total: results.length, pass: passCount, fail: failCount, warning: warningCount },
    results
  }, null, 2));
  
  console.log(`\n📄 详细报告已保存到: 配额系统审计报告.json`);
}

function getSuggestion(failure: AuditResult): string {
  if (failure.item.includes('record_feature_usage')) {
    return '运行迁移 022 更新函数以支持月度配额';
  }
  if (failure.item.includes('配额检查')) {
    return '在路由中添加 usageTrackingService.checkQuota() 调用';
  }
  if (failure.item.includes('配额记录')) {
    return '在路由中添加 usageTrackingService.recordUsage() 调用';
  }
  if (failure.item.includes('缺失的 user_usage')) {
    return '运行初始化脚本为用户创建配额记录';
  }
  if (failure.item.includes('错误的配额周期')) {
    return '运行迁移 022 修正配额周期';
  }
  if (failure.item.includes('使用量不一致')) {
    return '运行迁移 022 重新计算使用量';
  }
  return '需要进一步调查';
}

auditQuotaSystem();
