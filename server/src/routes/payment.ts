import express from 'express';
import { paymentService } from '../services/PaymentService';

const router = express.Router();

/**
 * 微信支付回调
 * POST /api/payment/wechat/notify
 */
router.post('/wechat/notify', async (req, res) => {
  try {
    console.log('收到微信支付回调:', req.body);

    // 处理支付回调
    await paymentService.handleWeChatPayNotify(req.body);

    // 返回成功响应（微信要求的格式）
    res.json({
      code: 'SUCCESS',
      message: '成功'
    });
  } catch (error: any) {
    console.error('处理支付回调失败:', error);
    
    // 返回失败响应
    res.status(500).json({
      code: 'FAIL',
      message: error.message || '处理失败'
    });
  }
});

export default router;
