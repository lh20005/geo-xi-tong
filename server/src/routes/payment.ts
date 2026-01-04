import express from 'express';
import { paymentService } from '../services/PaymentService';

const router = express.Router();

/**
 * 微信支付回调
 * POST /api/payment/wechat/notify
 */
router.post('/wechat/notify', async (req, res) => {
  try {
    console.log('📥 收到微信支付回调');
    console.log('   回调数据:', JSON.stringify(req.body, null, 2));

    // 处理支付回调 - 使用 Promise.race 设置超时，避免长时间阻塞
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('处理超时')), 10000); // 10秒超时
    });
    
    await Promise.race([
      paymentService.handleWeChatPayNotify(req.body),
      timeoutPromise
    ]);

    console.log('✅ 支付回调处理成功');
    
    // 返回成功响应（微信要求的格式）
    res.json({
      code: 'SUCCESS',
      message: '成功'
    });
  } catch (error: any) {
    console.error('❌ 处理支付回调失败:', error.message);
    console.error('   错误堆栈:', error.stack);
    
    // 即使处理失败，也要返回响应，避免微信重复回调
    // 返回失败响应
    res.status(500).json({
      code: 'FAIL',
      message: error.message || '处理失败'
    });
  }
});

export default router;
