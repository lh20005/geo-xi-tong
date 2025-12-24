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
import { dashboardRouter } from './dashboard';
import authRouter from './auth';
import platformsRouter from './platforms';
import accountsRouter from './accounts';
import adminRouter from './admin';
import usersRouter from './users';
import invitationsRouter from './invitations';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/invitations', invitationsRouter);
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
apiRouter.use('/publishing', platformAccountsRouter);
apiRouter.use('/publishing', publishingTasksRouter);
apiRouter.use('/publishing', publishingRecordsRouter);
apiRouter.use('/dashboard', dashboardRouter);

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'GEO优化系统运行正常' });
});
