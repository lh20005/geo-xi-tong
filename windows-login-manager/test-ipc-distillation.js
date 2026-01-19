/**
 * 测试蒸馏结果 IPC 调用
 * 模拟前端调用 IPC handler
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_windows',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || '',
});

// 模拟 storageManager.getUser()
async function getUser() {
  // 检查用户存储文件
  const userDataPath = path.join(process.env.HOME || process.env.USERPROFILE, '.geo-system', 'user.json');
  
  console.log('📁 用户数据文件路径:', userDataPath);
  
  if (fs.existsSync(userDataPath)) {
    const userData = JSON.parse(fs.readFileSync(userDataPath, 'utf-8'));
    console.log('✅ 找到用户数据:', { id: userData.id, username: userData.username });
    return userData;
  } else {
    console.log('❌ 未找到用户数据文件');
    return null;
  }
}

// 模拟 IPC handler: distillation:local:getResults
async function getResults(filters = {}) {
  try {
    console.log('\n=== 模拟 IPC: distillation:local:getResults ===');
    console.log('📥 接收参数:', JSON.stringify(filters, null, 2));
    
    const user = await getUser();
    if (!user) {
      return { success: false, error: '用户未登录' };
    }

    // 构建查询条件
    const conditions = ['t.user_id = $1'];
    const params = [user.id];
    let paramIndex = 2;

    // 关键词筛选
    if (filters?.keyword) {
      conditions.push(`d.keyword = $${paramIndex}`);
      params.push(filters.keyword);
      paramIndex++;
    }

    // 搜索
    if (filters?.search) {
      conditions.push(`t.question ILIKE $${paramIndex}`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 分页参数
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    console.log('\n📊 SQL 查询条件:');
    console.log('WHERE:', whereClause);
    console.log('参数:', params);

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    console.log(`\n✅ 总话题数: ${total}`);

    // 查询数据（包含引用次数）
    const dataQuery = `
      SELECT 
        t.id,
        t.question,
        t.distillation_id,
        t.created_at as "createdAt",
        d.keyword,
        COALESCE(
          (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id),
          0
        ) as "referenceCount"
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(pageSize, offset);
    const dataResult = await pool.query(dataQuery, params);

    console.log(`✅ 返回数据: ${dataResult.rows.length} 条`);

    // 获取统计信息
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as "totalTopics",
        COUNT(DISTINCT d.id) as "totalKeywords",
        COALESCE(SUM(
          (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id)
        ), 0) as "totalReferences"
      FROM topics t
      JOIN distillations d ON t.distillation_id = d.id
      WHERE t.user_id = $1
    `;
    const statsResult = await pool.query(statsQuery, [user.id]);

    const response = {
      success: true,
      data: {
        data: dataResult.rows,
        total,
        page,
        pageSize,
        statistics: {
          totalTopics: parseInt(statsResult.rows[0].totalTopics) || 0,
          totalKeywords: parseInt(statsResult.rows[0].totalKeywords) || 0,
          totalReferences: parseInt(statsResult.rows[0].totalReferences) || 0,
        },
      },
    };

    console.log('\n📤 返回响应:');
    console.log('- success:', response.success);
    console.log('- data.data.length:', response.data.data.length);
    console.log('- data.total:', response.data.total);
    console.log('- data.statistics:', response.data.statistics);

    if (response.data.data.length > 0) {
      console.log('\n前 3 条数据:');
      response.data.data.slice(0, 3).forEach((row, index) => {
        console.log(`${index + 1}. [${row.keyword}] ${row.question}`);
      });
    }

    return response;
  } catch (error) {
    console.error('\n❌ IPC 调用失败:', error.message);
    console.error('详细错误:', error);
    return { success: false, error: error.message || '获取蒸馏结果失败' };
  }
}

// 模拟 IPC handler: distillation:local:getKeywords
async function getKeywords() {
  try {
    console.log('\n=== 模拟 IPC: distillation:local:getKeywords ===');
    
    const user = await getUser();
    if (!user) {
      return { success: false, error: '用户未登录' };
    }

    // 只返回有话题的关键词
    const query = `
      SELECT DISTINCT d.keyword
      FROM distillations d
      INNER JOIN topics t ON d.id = t.distillation_id
      WHERE d.user_id = $1
      ORDER BY d.keyword ASC
    `;
    const result = await pool.query(query, [user.id]);

    console.log(`✅ 找到 ${result.rows.length} 个关键词:`, result.rows.map(r => r.keyword));

    return {
      success: true,
      data: {
        keywords: result.rows.map((row) => row.keyword),
      },
    };
  } catch (error) {
    console.error('\n❌ IPC 调用失败:', error.message);
    return { success: false, error: error.message || '获取关键词列表失败' };
  }
}

async function main() {
  console.log('🔍 Windows 端蒸馏结果 IPC 调用测试\n');
  console.log('=' .repeat(60));

  // 测试 1: 获取所有结果（无筛选）
  console.log('\n📋 测试 1: 获取所有结果（无筛选）');
  console.log('=' .repeat(60));
  const result1 = await getResults({});
  
  if (!result1.success) {
    console.log('\n❌ 测试失败:', result1.error);
  } else if (result1.data.data.length === 0) {
    console.log('\n⚠️ 返回数据为空！');
    console.log('可能原因:');
    console.log('1. 用户 ID 不匹配');
    console.log('2. 数据库中没有该用户的话题');
    console.log('3. 查询条件有误');
  } else {
    console.log('\n✅ 测试通过！');
  }

  // 测试 2: 获取关键词列表
  console.log('\n📋 测试 2: 获取关键词列表');
  console.log('=' .repeat(60));
  const result2 = await getKeywords();
  
  if (!result2.success) {
    console.log('\n❌ 测试失败:', result2.error);
  } else if (result2.data.keywords.length === 0) {
    console.log('\n⚠️ 关键词列表为空！');
  } else {
    console.log('\n✅ 测试通过！');
  }

  await pool.end();
  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
}

main().catch(console.error);
