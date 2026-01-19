import express from 'express';
import { requireAdmin } from '../../middleware/adminAuth';
import { orderService } from '../../services/OrderService';
import { subscriptionService } from '../../services/SubscriptionService';
import { commissionService } from '../../services/CommissionService';
import { profitSharingService } from '../../services/ProfitSharingService';
import { agentService } from '../../services/AgentService';
import { quotaReservationService } from '../../services/QuotaReservationService';
import { syncService } from '../../services/SyncService';

const router = express.Router();

// 所有任务路由都需要管理员权限
router.use(requireAdmin);

/**
 * 手动触发任务执行
 * POST /api/admin/tasks/:taskName
 */

// 1. 订单超时关闭任务
router.post('/order-timeout', async (req, res) => {
  try {
    const closedCount = await orderService.closeExpiredOrders();
    res.json({ success: true, message: `已关闭 ${closedCount} 个超时订单` });
  } catch (error) {
    console.error('订单超时关闭任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

// 2. 基于订阅周期的配额重置任务
router.post('/quota-reset', async (req, res) => {
  try {
    const resetCount = await subscriptionService.checkAndResetQuotas();
    res.json({ success: true, message: `已重置 ${resetCount} 个用户的配额周期` });
  } catch (error) {
    console.error('配额重置任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

// 3. 订阅到期检查任务
router.post('/subscription-expiry', async (req, res) => {
  try {
    const result = await subscriptionService.checkSubscriptionExpiry();
    res.json({ success: true, message: '订阅到期检查完成', data: result });
  } catch (error) {
    console.error('订阅到期检查任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

// 4. 佣金结算任务
router.post('/commission-settlement', async (req, res) => {
  try {
    const result = await commissionService.batchSettlePendingCommissions();
    res.json({ success: true, message: '佣金结算完成', data: result });
  } catch (error) {
    console.error('佣金结算任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

// 5. 分账结果查询任务
router.post('/profit-sharing-query', async (req, res) => {
  try {
    const result = await profitSharingService.processPendingRecords();
    res.json({ success: true, message: '分账结果查询完成', data: result });
  } catch (error) {
    console.error('分账结果查询任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

// 6. 代理商异常检测任务
router.post('/agent-anomaly-detection', async (req, res) => {
  try {
    const suspendedCount = await agentService.suspendAnomalousAgents();
    res.json({ success: true, message: `已自动暂停 ${suspendedCount} 个异常代理商` });
  } catch (error) {
    console.error('代理商异常检测任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

// 7. 配额预留清理任务
router.post('/quota-reservation-cleanup', async (req, res) => {
  try {
    const cleanedCount = await quotaReservationService.cleanupExpiredReservations();
    res.json({ success: true, message: `已清理 ${cleanedCount} 条过期的配额预留记录` });
  } catch (error) {
    console.error('配额预留清理任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

// 8. 同步快照过期清理任务
router.post('/sync-snapshot-cleanup', async (req, res) => {
  try {
    const cleanedCount = await syncService.cleanupExpiredSnapshots();
    res.json({ success: true, message: `已清理 ${cleanedCount} 个过期的同步快照` });
  } catch (error) {
    console.error('同步快照过期清理任务失败:', error);
    res.status(500).json({ success: false, message: '任务执行失败', error: String(error) });
  }
});

export default router;
