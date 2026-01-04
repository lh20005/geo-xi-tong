import { pool } from '../db/database';

/**
 * 诊断企业图库和知识库的配额问题
 */

async function diagnoseGalleryKnowledgeQuota() {
  try {
    console.log('=== 企业图库和知识库配额诊断 ===\n');
    
    // 1. 检查用户配额记录
    const userQuotaResult = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        uu.feature_code,
        uu.usage_count,
        uu.period_start,
        uu.period_end
      FROM user_usage uu
      JOIN users u ON uu.user_id = u.id
      WHERE uu.feature_code IN ('gallery_albums', 'knowledge_bases', 'gallery_images', 'knowledge_documents')
        AND uu.period_end > CURRENT_TIMESTAMP
      ORDER BY u.username, uu.feature_code
      LIMIT 20
    `);
    
    console.log('\n📊 用户配额记录:\n');
    if (userQuotaResult.rows.length === 0) {
      console.log('❌ 未找到用户配额记录\n');
    } else {
      for (const row of userQuotaResult.rows) {
        // 使用数据库函数获取配额限制
        const quotaResult = await pool.query(
          'SELECT * FROM check_feature_quota($1, $2)',
          [row.user_id, row.feature_code]
        );
        
        const quota = quotaResult.rows[0];
        const remaining = quota.quota_limit - row.usage_count;
        const status = remaining > 0 ? '✅' : '❌';
        
        console.log(`  ${status} 用户: ${row.username}`);
        console.log(`     功能: ${row.feature_code}`);
        console.log(`     配额: ${quota.quota_limit}, 已用: ${row.usage_count}, 剩余: ${remaining}`);
        console.log(`     周期: ${new Date(row.period_start).toLocaleDateString()} ~ ${new Date(row.period_end).toLocaleDateString()}`);
        console.log('     ---');
      }
    }
    
    // 3. 检查实际数据
    const actualDataResult = await pool.query(`
      SELECT 
        u.username,
        COUNT(DISTINCT a.id) as album_count,
        COUNT(DISTINCT i.id) as image_count,
        COUNT(DISTINCT kb.id) as knowledge_base_count,
        COUNT(DISTINCT kd.id) as document_count
      FROM users u
      LEFT JOIN albums a ON u.id = a.user_id
      LEFT JOIN images i ON a.id = i.album_id
      LEFT JOIN knowledge_bases kb ON u.id = kb.user_id
      LEFT JOIN knowledge_documents kd ON kb.id = kd.knowledge_base_id
      GROUP BY u.id, u.username
      HAVING COUNT(DISTINCT a.id) > 0 OR COUNT(DISTINCT kb.id) > 0
      ORDER BY u.username
      LIMIT 20
    `);
    
    console.log('\n📈 实际使用数据:\n');
    if (actualDataResult.rows.length === 0) {
      console.log('❌ 未找到实际使用数据\n');
    } else {
      actualDataResult.rows.forEach(row => {
        console.log(`  用户: ${row.username}`);
        console.log(`    相册数: ${row.album_count}, 图片数: ${row.image_count}`);
        console.log(`    知识库数: ${row.knowledge_base_count}, 文档数: ${row.document_count}`);
        console.log('    ---');
      });
    }
    
    // 4. 检查 usage_records 记录
    const usageRecordsResult = await pool.query(`
      SELECT 
        u.username,
        ur.feature_code,
        COUNT(*) as record_count,
        SUM(ur.amount) as total_amount
      FROM usage_records ur
      JOIN users u ON ur.user_id = u.id
      WHERE ur.feature_code IN ('gallery_albums', 'knowledge_bases', 'gallery_images', 'knowledge_documents')
      GROUP BY u.username, ur.feature_code
      ORDER BY u.username, ur.feature_code
      LIMIT 20
    `);
    
    console.log('\n📝 使用记录:\n');
    if (usageRecordsResult.rows.length === 0) {
      console.log('❌ 未找到使用记录\n');
    } else {
      usageRecordsResult.rows.forEach(row => {
        console.log(`  用户: ${row.username}`);
        console.log(`    功能: ${row.feature_code}`);
        console.log(`    记录数: ${row.record_count}, 总量: ${row.total_amount}`);
        console.log('    ---');
      });
    }
    
    // 5. 诊断结论
    console.log('\n🔍 诊断结论:\n');
    
    if (userQuotaResult.rows.length === 0) {
      console.log('❌ 问题1: 用户没有配额记录（user_usage表）');
      console.log('   需要在订阅时初始化这些功能的配额');
    } else {
      console.log('✅ 用户配额记录存在');
      
      // 检查是否有配额用尽的情况
      const exhaustedQuotas = [];
      for (const row of userQuotaResult.rows) {
        const quotaResult = await pool.query(
          'SELECT * FROM check_feature_quota($1, $2)',
          [row.user_id, row.feature_code]
        );
        const quota = quotaResult.rows[0];
        if (row.usage_count >= quota.quota_limit) {
          exhaustedQuotas.push({ ...row, quota_limit: quota.quota_limit });
        }
      }
      
      if (exhaustedQuotas.length > 0) {
        console.log('\n⚠️  发现配额用尽的情况:');
        exhaustedQuotas.forEach(r => {
          console.log(`   用户 ${r.username} 的 ${r.feature_code} 已用尽 (${r.usage_count}/${r.quota_limit})`);
        });
      }
    }
    
    if (usageRecordsResult.rows.length === 0) {
      console.log('\n⚠️  问题2: 没有使用记录（usage_records表）- 这是主要问题！');
      console.log('   原因: gallery.ts 和 knowledgeBase.ts 没有调用 usageTrackingService.recordUsage');
      console.log('   影响: 用户创建相册/知识库后，配额不会减少，导致可以无限创建');
    } else {
      console.log('\n✅ 使用记录存在');
    }
    
    // 检查数据一致性
    if (actualDataResult.rows.length > 0 && userQuotaResult.rows.length > 0) {
      console.log('\n📊 数据一致性检查:\n');
      for (const actual of actualDataResult.rows) {
        const quotas = userQuotaResult.rows.filter(q => q.username === actual.username);
        
        const albumQuota = quotas.find(q => q.feature_code === 'gallery_albums');
        const kbQuota = quotas.find(q => q.feature_code === 'knowledge_bases');
        
        if (albumQuota && actual.album_count !== albumQuota.usage_count) {
          console.log(`  ⚠️  ${actual.username}: 相册数不一致`);
          console.log(`     实际: ${actual.album_count}, 记录: ${albumQuota.usage_count}`);
        }
        
        if (kbQuota && actual.knowledge_base_count !== kbQuota.usage_count) {
          console.log(`  ⚠️  ${actual.username}: 知识库数不一致`);
          console.log(`     实际: ${actual.knowledge_base_count}, 记录: ${kbQuota.usage_count}`);
        }
      }
    }
    
  } catch (error) {
    console.error('诊断失败:', error);
  } finally {
    await pool.end();
  }
}

diagnoseGalleryKnowledgeQuota();
