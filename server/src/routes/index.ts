import { Router } from 'express';
import { configRouter } from './config';
import { distillationRouter } from './distillation';
import { topicRouter } from './topic';
import { articleRouter } from './article';
import { galleryRouter } from './gallery';
import { knowledgeBaseRouter } from './knowledgeBase';
import { conversionTargetRouter } from './conversionTarget';
import { articleSettingsRouter } from './articleSettings';
import { articleGenerationRouter } from './articleGeneration';
import platformAccountsRouter from './platformAccounts';
import publishingTasksRouter from './publishingTasks';
import publishingRecordsRouter from './publishingRecords';
import publishingSSERouter from './publishingSSE';
import { dashboardRouter } from './dashboard';
import authRouter from './auth';
import platformsRouter from './platforms';
import accountsRouter from './accounts';
import adminRouter from './admin';
import usersRouter from './users';
import invitationsRouter from './invitations';
import confirmationRouter from './confirmation';
import securityConfigRouter from './securityConfig';
import securityRouter from './security';
import paymentRouter from './payment';
import ordersRouter from './orders';
import subscriptionRouter from './subscription';
import quotaRouter from './quota';
import usageTrackingRouter from './usageTracking';
import productManagementRouter from './admin/productManagement';
import storageRouter from './storage';
import adminStorageRouter from './admin/storage';
import storageProductsRouter from './storageProducts';
import userSubscriptionsRouter from './admin/userSubscriptions';
import agentRouter from './agent';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/admin/products', productManagementRouter);
apiRouter.use('/admin/storage', adminStorageRouter);
apiRouter.use('/admin/user-subscriptions', userSubscriptionsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/invitations', invitationsRouter);
apiRouter.use('/confirm', confirmationRouter);
apiRouter.use('/security-config', securityConfigRouter);
apiRouter.use('/security', securityRouter);
apiRouter.use('/payment', paymentRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/subscription', subscriptionRouter);
apiRouter.use('/quota', quotaRouter);  // 配额管理API
apiRouter.use('/usage', usageTrackingRouter);  // 使用量追踪API
apiRouter.use('/storage', storageRouter);  // 存储管理API
apiRouter.use('/storage-products', storageProductsRouter);  // 存储产品购买API
apiRouter.use('/agent', agentRouter);  // 代理商API
apiRouter.use('/platforms', platformsRouter);
apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/distillation', distillationRouter);
apiRouter.use('/topics', topicRouter);
apiRouter.use('/articles', articleRouter);
apiRouter.use('/gallery', galleryRouter);
apiRouter.use('/knowledge-bases', knowledgeBaseRouter);
apiRouter.use('/conversion-targets', conversionTargetRouter);
apiRouter.use('/article-settings', articleSettingsRouter);
apiRouter.use('/article-generation', articleGenerationRouter);
// SSE 路由必须在其他 publishing 路由之前，因为它有自己的认证逻辑
apiRouter.use('/publishing', publishingSSERouter);
apiRouter.use('/publishing', platformAccountsRouter);
apiRouter.use('/publishing', publishingTasksRouter);
apiRouter.use('/publishing', publishingRecordsRouter);
apiRouter.use('/dashboard', dashboardRouter);

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'GEO优化系统运行正常（多租户模式）' });
});
