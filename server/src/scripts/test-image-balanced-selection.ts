import { pool } from '../db/database';

/**
 * 测试图片均衡选择功能
 */

async function testImageBalancedSelection() {
  console.log('==========================================');
  console.log('测试图片均衡选择功能');
  console.log('==========================================\n');

  try {
    // 1. 检查数据库迁移状态
    console.log('步骤1: 检查数据库迁移状态...\n');

    // 检查images表是否有usage_count字段
    const usageCountCheck = await pool.query(`
      SELECT COUNT(*) 
      FROM information_schema.columns 
      WHERE table_name='images' AND column_name='usage_count'
    `);

    if (parseInt(usageCountCheck.rows[0].count) === 0) {
      console.log('⚠️  images表缺少usage_count字段，需要运行迁移');
      console.log('运行迁移命令: npm run db:migrate:image-usage\n');
    } else {
      console.log('✅ images表已有usage_count字段\n');
    }

    // 检查image_usage表是否存在
    const imageUsageCheck = await pool.query(`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_name='image_usage'
    `);

    if (parseInt(imageUsageCheck.rows[0].count) === 0) {
      console.log('⚠️  image_usage表不存在，需要运行迁移');
      console.log('运行迁移命令: npm run db:migrate:image-usage\n');
    } else {
      console.log('✅ image_usage表已存在\n');
    }

    // 2. 查看相册和图片信息
    console.log('步骤2: 查看相册和图片信息...\n');

    const albumsResult = await pool.query(`
      SELECT 
        a.id as album_id,
        a.name as album_name,
        COUNT(i.id) as image_count
      FROM albums a
      LEFT JOIN images i ON a.id = i.album_id
      GROUP BY a.id, a.name
      ORDER BY a.id
    `);

    if (albumsResult.rows.length === 0) {
      console.log('没有找到相册\n');
    } else {
      console.log('相册列表:');
      console.table(albumsResult.rows);
      console.log('');
    }

    // 3. 查看图片使用统计
    console.log('步骤3: 查看图片使用统计...\n');

    const imagesResult = await pool.query(`
      SELECT 
        i.id,
        i.filename,
        i.album_id,
        COALESCE(i.usage_count, 0) as usage_count,
        (SELECT COUNT(*) FROM image_usage WHERE image_id = i.id) as usage_records
      FROM images i
      ORDER BY i.album_id, i.usage_count ASC, i.created_at ASC
      LIMIT 20
    `);

    if (imagesResult.rows.length === 0) {
      console.log('没有找到图片\n');
    } else {
      console.log('图片使用统计（前20条）:');
      console.table(imagesResult.rows);
      console.log('');
    }

    // 4. 查看图片使用分布
    console.log('步骤4: 查看图片使用分布...\n');

    const distributionResult = await pool.query(`
      SELECT 
        a.name as album_name,
        COUNT(i.id) as total_images,
        SUM(COALESCE(i.usage_count, 0)) as total_usage,
        ROUND(AVG(COALESCE(i.usage_count, 0)), 2) as avg_usage,
        MIN(COALESCE(i.usage_count, 0)) as min_usage,
        MAX(COALESCE(i.usage_count, 0)) as max_usage
      FROM albums a
      LEFT JOIN images i ON a.id = i.album_id
      GROUP BY a.id, a.name
      ORDER BY a.id
    `);

    if (distributionResult.rows.length === 0) {
      console.log('没有找到相册\n');
    } else {
      console.log('图片使用分布统计:');
      console.table(distributionResult.rows);
      console.log('');
    }

    // 5. 测试建议
    console.log('==========================================');
    console.log('测试建议：');
    console.log('==========================================\n');
    console.log('1. 创建测试任务生成文章，观察图片选择是否均衡\n');
    console.log('2. 查看图片使用统计：');
    console.log('   SELECT album_id, filename, usage_count');
    console.log('   FROM images');
    console.log('   ORDER BY album_id, usage_count ASC;\n');
    console.log('3. 验证每次生成文章时，使用次数最少的图片被优先选择\n');
    console.log('4. 观察usage_count是否均衡增长\n');
    console.log('==========================================\n');

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

// 运行测试
testImageBalancedSelection();
