import express, { Request, Response } from 'express';
import { pool } from '../db/database';
import { storageService } from '../services/StorageService';
import { authenticate } from '../middleware/adminAuth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate);

/**
 * GET /api/storage-products
 * 获取可购买的存储产品
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 定义存储产品
    const storageProducts = [
      {
        id: 'storage_10gb',
        name: '10GB 存储空间',
        description: '额外增加 10GB 存储空间，有效期 1 年',
        storageBytes: 10 * 1024 * 1024 * 1024, // 10GB
        price: 29.00,
        validityDays: 365,
        popular: false
      },
      {
        id: 'storage_50gb',
        name: '50GB 存储空间',
        description: '额外增加 50GB 存储空间，有效期 1 年',
        storageBytes: 50 * 1024 * 1024 * 1024, // 50GB
        price: 99.00,
        validityDays: 365,
        popular: true
      },
      {
        id: 'storage_100gb',
        name: '100GB 存储空间',
        description: '额外增加 100GB 存储空间，有效期 1 年',
        storageBytes: 100 * 1024 * 1024 * 1024, // 100GB
        price: 169.00,
        validityDays: 365,
        popular: false
      },
      {
        id: 'storage_500gb',
        name: '500GB 存储空间',
        description: '额外增加 500GB 存储空间，有效期 1 年',
        storageBytes: 500 * 1024 * 1024 * 1024, // 500GB
        price: 699.00,
        validityDays: 365,
        popular: false
      }
    ];

    res.json({
      success: true,
      data: storageProducts
    });
  } catch (error) {
    console.error('[StorageProducts API] 获取产品列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储产品列表失败'
    });
  }
});

/**
 * POST /api/storage-products/purchase
 * 购买存储空间
 */
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: productId'
      });
    }

    // 产品映射
    const productMap: { [key: string]: { storageBytes: number; price: number; validityDays: number; name: string } } = {
      'storage_10gb': { storageBytes: 10 * 1024 * 1024 * 1024, price: 29.00, validityDays: 365, name: '10GB 存储空间' },
      'storage_50gb': { storageBytes: 50 * 1024 * 1024 * 1024, price: 99.00, validityDays: 365, name: '50GB 存储空间' },
      'storage_100gb': { storageBytes: 100 * 1024 * 1024 * 1024, price: 169.00, validityDays: 365, name: '100GB 存储空间' },
      'storage_500gb': { storageBytes: 500 * 1024 * 1024 * 1024, price: 699.00, validityDays: 365, name: '500GB 存储空间' }
    };

    const product = productMap[productId];
    if (!product) {
      return res.status(400).json({
        success: false,
        message: '无效的产品ID'
      });
    }

    // 创建订单
    const orderNo = `STOR${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + product.validityDays);

    const orderResult = await pool.query(
      `INSERT INTO orders (
        order_no, user_id, plan_name, amount, status, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, order_no`,
      [orderNo, userId, product.name, product.price]
    );

    const orderId = orderResult.rows[0].id;

    // 记录存储购买信息（使用订单的 metadata 或创建新表）
    await pool.query(
      `INSERT INTO storage_purchases (
        user_id, order_id, storage_bytes, expiration_date, status
      ) VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, orderId, product.storageBytes, expirationDate]
    );

    res.json({
      success: true,
      message: '订单创建成功',
      data: {
        orderId,
        orderNo: orderResult.rows[0].order_no,
        amount: product.price,
        storageBytes: product.storageBytes,
        expirationDate
      }
    });
  } catch (error: any) {
    console.error('[StorageProducts API] 购买失败:', error);
    
    // 检查是否是表不存在的错误
    if (error.code === '42P01') {
      return res.status(500).json({
        success: false,
        message: '存储购买功能尚未完全配置，请联系管理员'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '购买存储空间失败'
    });
  }
});

/**
 * GET /api/storage-products/my-purchases
 * 获取我的存储购买记录
 */
router.get('/my-purchases', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `SELECT 
        sp.id,
        sp.storage_bytes as "storageBytes",
        sp.expiration_date as "expirationDate",
        sp.status,
        sp.created_at as "createdAt",
        o.order_no as "orderNo",
        o.amount,
        o.status as "orderStatus"
      FROM storage_purchases sp
      JOIN orders o ON sp.order_id = o.id
      WHERE sp.user_id = $1
      ORDER BY sp.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('[StorageProducts API] 获取购买记录失败:', error);
    
    // 如果表不存在，返回空数组
    if (error.code === '42P01') {
      return res.json({
        success: true,
        data: []
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取购买记录失败'
    });
  }
});

export default router;
