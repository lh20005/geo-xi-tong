import { pool } from '../db/database';
import { usageTrackingService } from '../services/UsageTrackingService';

/**
 * 测试企业图库和知识库配额功能
 */

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(test: string, status: 'PASS' | 'FAIL', message: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log('   详情:', JSON.stringify(details, null, 2));
  }
}

async function testGalleryKnowledgeQuota() {
  console.log('=== 企业图库和知识库配额测试 ===\n');
  console.log('开始时间:', new Date().toISOString(), '\n');

  try {
    // 获取测试用户
    const username = process.argv[2] || 'lzc2005';
    console.log(`测试用户: ${username}\n`);

    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`用户ID: ${userId}\n`);

    // 测试 1: 检查相册配额
    await testAlbumQuota(userId);

    // 测试 2: 检查知识库配额
    await testKnowledgeBaseQuota(userId);

    // 测试 3: 检查配额记录功能
    await testQuotaRecording(userId);

    // 测试 4: 检查数据一致性
    await testDataConsistency(userId);

    // 生成报告
    generateReport();

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

/**
 * 测试 1: 检查相册配额
 */
async function testAlbumQuota(userId: number) {
  console.log('\n📋 测试 1: 检查相册配额\n');

  try {
    const quota = await usageTrackingService.checkQuota(userId, 'gallery_albums');
    
    if (quota && typeof quota.hasQuota === 'boolean') {
      addResult(
        'checkQuota(gallery_albums)',
        'PASS',
        '配额检查正常',
        {
          hasQuota: quota.hasQuota,
          quotaLimit: quota.quotaLimit,
          currentUsage: quota.currentUsage,
          remaining: quota.remaining
        }
      );
    } else {
      addResult(
        'checkQuota(gallery_albums)',
        'FAIL',
        '配额检查返回格式错误',
        quota
      );
    }

    // 检查实际相册数
    const actualResult = await pool.query(
      'SELECT COUNT(*) as count FROM albums WHERE user_id = $1',
      [userId]
    );
    const actualCount = parseInt(actualResult.rows[0].count);

    if (quota.currentUsage === actualCount) {
      addResult(
        '相册配额一致性',
        'PASS',
        '配额记录与实际数据一致',
        { recorded: quota.currentUsage, actual: actualCount }
      );
    } else {
      addResult(
        '相册配额一致性',
        'FAIL',
        '配额记录与实际数据不一致',
        { recorded: quota.currentUsage, actual: actualCount }
      );
    }
  } catch (error: any) {
    addResult('相册配额检查', 'FAIL', error.message);
  }
}

/**
 * 测试 2: 检查知识库配额
 */
async function testKnowledgeBaseQuota(userId: number) {
  console.log('\n📋 测试 2: 检查知识库配额\n');

  try {
    const quota = await usageTrackingService.checkQuota(userId, 'knowledge_bases');
    
    if (quota && typeof quota.hasQuota === 'boolean') {
      addResult(
        'checkQuota(knowledge_bases)',
        'PASS',
        '配额检查正常',
        {
          hasQuota: quota.hasQuota,
          quotaLimit: quota.quotaLimit,
          currentUsage: quota.currentUsage,
          remaining: quota.remaining
        }
      );
    } else {
      addResult(
        'checkQuota(knowledge_bases)',
        'FAIL',
        '配额检查返回格式错误',
        quota
      );
    }

    // 检查实际知识库数
    const actualResult = await pool.query(
      'SELECT COUNT(*) as count FROM knowledge_bases WHERE user_id = $1',
      [userId]
    );
    const actualCount = parseInt(actualResult.rows[0].count);

    if (quota.currentUsage === actualCount) {
      addResult(
        '知识库配额一致性',
        'PASS',
        '配额记录与实际数据一致',
        { recorded: quota.currentUsage, actual: actualCount }
      );
    } else {
      addResult(
        '知识库配额一致性',
        'FAIL',
        '配额记录与实际数据不一致',
        { recorded: quota.currentUsage, actual: actualCount }
      );
    }
  } catch (error: any) {
    addResult('知识库配额检查', 'FAIL', error.message);
  }
}

/**
 * 测试 3: 检查配额记录功能
 */
async function testQuotaRecording(userId: number) {
  console.log('\n📋 测试 3: 检查配额记录功能\n');

  try {
    // 检查相册使用记录
    const albumRecordsResult = await pool.query(
      `SELECT COUNT(*) as count FROM usage_records 
       WHERE user_id = $1 AND feature_code = 'gallery_albums'`,
      [userId]
    );
    const albumRecordCount = parseInt(albumRecordsResult.rows[0].count);

    const albumResult = await pool.query(
      'SELECT COUNT(*) as count FROM albums WHERE user_id = $1',
      [userId]
    );
    const albumCount = parseInt(albumResult.rows[0].count);

    if (albumRecordCount === albumCount) {
      addResult(
        '相册使用记录',
        'PASS',
        '使用记录数量正确',
        { records: albumRecordCount, albums: albumCount }
      );
    } else {
      addResult(
        '相册使用记录',
        'FAIL',
        '使用记录数量不匹配',
        { records: albumRecordCount, albums: albumCount }
      );
    }

    // 检查知识库使用记录
    const kbRecordsResult = await pool.query(
      `SELECT COUNT(*) as count FROM usage_records 
       WHERE user_id = $1 AND feature_code = 'knowledge_bases'`,
      [userId]
    );
    const kbRecordCount = parseInt(kbRecordsResult.rows[0].count);

    const kbResult = await pool.query(
      'SELECT COUNT(*) as count FROM knowledge_bases WHERE user_id = $1',
      [userId]
    );
    const kbCount = parseInt(kbResult.rows[0].count);

    if (kbRecordCount === kbCount) {
      addResult(
        '知识库使用记录',
        'PASS',
        '使用记录数量正确',
        { records: kbRecordCount, knowledgeBases: kbCount }
      );
    } else {
      addResult(
        '知识库使用记录',
        'FAIL',
        '使用记录数量不匹配',
        { records: kbRecordCount, knowledgeBases: kbCount }
      );
    }
  } catch (error: any) {
    addResult('配额记录功能', 'FAIL', error.message);
  }
}

/**
 * 测试 4: 检查数据一致性
 */
async function testDataConsistency(userId: number) {
  console.log('\n📋 测试 4: 检查数据一致性\n');

  try {
    // 检查 user_usage 和实际数据的一致性
    const consistencyResult = await pool.query(`
      SELECT 
        'gallery_albums' as feature_code,
        uu.usage_count as recorded_count,
        (SELECT COUNT(*) FROM albums WHERE user_id = $1) as actual_count
      FROM user_usage uu
      WHERE uu.user_id = $1 
        AND uu.feature_code = 'gallery_albums'
        AND uu.period_end > CURRENT_TIMESTAMP
      UNION ALL
      SELECT 
        'knowledge_bases' as feature_code,
        uu.usage_count as recorded_count,
        (SELECT COUNT(*) FROM knowledge_bases WHERE user_id = $1) as actual_count
      FROM user_usage uu
      WHERE uu.user_id = $1 
        AND uu.feature_code = 'knowledge_bases'
        AND uu.period_end > CURRENT_TIMESTAMP
    `, [userId]);

    let allConsistent = true;
    for (const row of consistencyResult.rows) {
      const isConsistent = row.recorded_count === parseInt(row.actual_count);
      if (isConsistent) {
        addResult(
          `数据一致性 - ${row.feature_code}`,
          'PASS',
          '数据一致',
          {
            recorded: row.recorded_count,
            actual: row.actual_count
          }
        );
      } else {
        addResult(
          `数据一致性 - ${row.feature_code}`,
          'FAIL',
          '数据不一致',
          {
            recorded: row.recorded_count,
            actual: row.actual_count
          }
        );
        allConsistent = false;
      }
    }

    if (allConsistent && consistencyResult.rows.length > 0) {
      addResult(
        '整体数据一致性',
        'PASS',
        '所有数据一致'
      );
    }
  } catch (error: any) {
    addResult('数据一致性检查', 'FAIL', error.message);
  }
}

/**
 * 生成测试报告
 */
function generateReport() {
  console.log('\n\n=== 测试报告 ===\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`总计: ${total} 项测试`);
  console.log(`✅ 通过: ${passCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`通过率: ${((passCount / total) * 100).toFixed(1)}%\n`);

  if (failCount > 0) {
    console.log('失败的测试:');
    results.filter(r => r.status === 'FAIL').forEach((result, index) => {
      console.log(`${index + 1}. ${result.test}: ${result.message}`);
    });
    console.log('');
  }

  // 总结
  if (failCount === 0) {
    console.log('🎉 所有测试通过！企业图库和知识库配额系统运行正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查配额系统。');
  }

  // 保存报告
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '../../..', '企业图库知识库配额测试报告.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, pass: passCount, fail: failCount },
    results
  }, null, 2));
  
  console.log(`\n📄 详细报告已保存到: 企业图库知识库配额测试报告.json`);
}

testGalleryKnowledgeQuota();
