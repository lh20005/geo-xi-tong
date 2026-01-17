/**
 * 本地 API 封装
 * 通过 IPC 调用 Electron 主进程的本地服务
 * 
 * 改造后：文章、知识库、图库、账号、任务等数据存储在本地 SQLite
 */

// ==================== 文章管理 ====================

export interface LocalArticle {
  id: string;
  userId: number;
  title?: string;
  keyword: string;
  content: string;
  imageUrl?: string;
  imageSizeBytes?: number;
  provider: string;
  isPublished: boolean;
  publishingStatus?: string;
  publishedAt?: string;
  distillationId?: number;
  distillationKeywordSnapshot?: string;
  topicId?: number;
  topicQuestionSnapshot?: string;
  taskId?: number;
  imageId?: number;
  requirements?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleParams {
  userId: number;
  title?: string;
  keyword: string;
  content: string;
  imageUrl?: string;
  imageSizeBytes?: number;
  provider: string;
  distillationId?: number;
  distillationKeywordSnapshot?: string;
  topicId?: number;
  topicQuestionSnapshot?: string;
  taskId?: number;
  imageId?: number;
  requirements?: string;
}

export interface ArticleSearchParams {
  keyword?: string;
  isPublished?: boolean;
  provider?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export const localArticleApi = {
  create: async (params: CreateArticleParams) => {
    return window.electron.article.create(params);
  },
  
  findAll: async (params?: { page?: number; pageSize?: number; isPublished?: boolean }) => {
    return window.electron.article.findAll(params);
  },
  
  findById: async (id: string) => {
    return window.electron.article.findById(id);
  },
  
  update: async (id: string, params: Partial<CreateArticleParams>) => {
    return window.electron.article.update(id, params);
  },
  
  delete: async (id: string) => {
    return window.electron.article.delete(id);
  },
  
  search: async (params: ArticleSearchParams) => {
    return window.electron.article.search(params);
  },
  
  deleteBatch: async (ids: string[]) => {
    return window.electron.article.deleteBatch(ids);
  },
  
  deleteAll: async () => {
    return window.electron.article.deleteAll();
  },
  
  getStats: async () => {
    return window.electron.article.getStats();
  },
  
  getKeywordStats: async () => {
    return window.electron.article.getKeywordStats();
  },
  
  markAsPublished: async (id: string, publishedAt?: string) => {
    return window.electron.article.markAsPublished(id, publishedAt);
  },
  
  findUnpublished: async () => {
    return window.electron.article.findUnpublished();
  },
};

// ==================== 任务管理 ====================

export interface LocalTask {
  id: string;
  userId: number;
  articleId?: string;
  accountId: string;
  platformId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  batchId?: string;
  batchOrder?: number;
  intervalMinutes?: number;
  articleTitle?: string;
  articleContent?: string;
  articleKeyword?: string;
  articleImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskParams {
  userId: number;
  articleId?: string;
  accountId: string;
  platformId: string;
  config?: object;
  scheduledAt?: string;
  maxRetries?: number;
  batchId?: string;
  batchOrder?: number;
  intervalMinutes?: number;
  articleTitle?: string;
  articleContent?: string;
  articleKeyword?: string;
  articleImageUrl?: string;
}

export const localTaskApi = {
  create: async (params: CreateTaskParams) => {
    return window.electron.task.create(params);
  },
  
  findAll: async (params?: { status?: string; batchId?: string; page?: number; pageSize?: number }) => {
    return window.electron.task.findAll(params);
  },
  
  findById: async (id: string) => {
    return window.electron.task.findById(id);
  },
  
  updateStatus: async (id: string, status: string, errorMessage?: string) => {
    return window.electron.task.updateStatus(id, status, errorMessage);
  },
  
  cancel: async (id: string) => {
    return window.electron.task.cancel(id);
  },
  
  delete: async (id: string) => {
    return window.electron.task.delete(id);
  },
  
  findPending: async () => {
    return window.electron.task.findPending();
  },
  
  findByBatchId: async (batchId: string) => {
    return window.electron.task.findByBatchId(batchId);
  },
  
  cancelBatch: async (batchId: string) => {
    return window.electron.task.cancelBatch(batchId);
  },
  
  deleteBatch: async (batchId: string) => {
    return window.electron.task.deleteBatch(batchId);
  },
  
  getBatchStats: async (batchId: string) => {
    return window.electron.task.getBatchStats(batchId);
  },
  
  getStats: async () => {
    return window.electron.task.getStats();
  },
  
  getLogs: async (taskId: string) => {
    return window.electron.task.getLogs(taskId);
  },
  
  createRecord: async (params: any) => {
    return window.electron.task.createRecord(params);
  },
  
  updateRecord: async (id: string, params: any) => {
    return window.electron.task.updateRecord(id, params);
  },
};

// ==================== 发布执行 ====================

export const localPublishApi = {
  executeSingle: async (taskId: string) => {
    return window.electron.publish.executeSingle(taskId);
  },
  
  executeBatch: async (batchId: string) => {
    return window.electron.publish.executeBatch(batchId);
  },
  
  stopBatch: async (batchId: string) => {
    return window.electron.publish.stopBatch(batchId);
  },
  
  getBatchStatus: async (batchId: string) => {
    return window.electron.publish.getBatchStatus(batchId);
  },
  
  startScheduler: async () => {
    return window.electron.publish.startScheduler();
  },
  
  stopScheduler: async () => {
    return window.electron.publish.stopScheduler();
  },
  
  getSchedulerStatus: async () => {
    return window.electron.publish.getSchedulerStatus();
  },
  
  // 配额管理
  reserveQuota: async (quotaType: string, amount?: number, taskInfo?: object) => {
    return window.electron.publish.reserveQuota(quotaType, amount, taskInfo);
  },
  
  confirmQuota: async (reservationId: number, result?: object) => {  // ✅ 修复
    return window.electron.publish.confirmQuota(reservationId, result);
  },
  
  releaseQuota: async (reservationId: number, reason?: string) => {  // ✅ 修复
    return window.electron.publish.releaseQuota(reservationId, reason);
  },
  
  getQuotaInfo: async () => {
    return window.electron.publish.getQuotaInfo();
  },
  
  // 分析上报
  reportResult: async (report: any) => {
    return window.electron.publish.reportResult(report);
  },
  
  flushPendingAnalytics: async () => {
    return window.electron.publish.flushPendingAnalytics();
  },
};

// ==================== 浏览器自动化 ====================

export const localBrowserApi = {
  launch: async (options?: { headless?: boolean; userDataDir?: string }) => {
    return window.electron.browser.launch(options);
  },
  
  close: async () => {
    return window.electron.browser.close();
  },
  
  screenshot: async (options?: { fullPage?: boolean; path?: string }) => {
    return window.electron.browser.screenshot(options);
  },
  
  navigateTo: async (url: string, options?: { waitUntil?: string; timeout?: number }) => {
    return window.electron.browser.navigateTo(url, options);
  },
  
  getCurrentUrl: async () => {
    return window.electron.browser.getCurrentUrl();
  },
  
  getPageContent: async () => {
    return window.electron.browser.getPageContent();
  },
  
  evaluate: async (script: string) => {
    return window.electron.browser.evaluate(script);
  },
  
  setCookies: async (cookies: any[], url?: string) => {
    return window.electron.browser.setCookies(cookies, url);
  },
  
  getCookies: async (url?: string) => {
    return window.electron.browser.getCookies(url);
  },
  
  checkLoginStatus: async (accountId: string) => {
    return window.electron.browser.checkLoginStatus(accountId);
  },
  
  checkAllLoginStatus: async () => {
    return window.electron.browser.checkAllLoginStatus();
  },
  
  getStatus: async () => {
    return window.electron.browser.getStatus();
  },
};

// ==================== 本地账号管理 ====================

export interface LocalAccount {
  id: string;
  userId: number;
  platform: string;
  platformId?: string;
  accountName?: string;
  realUsername?: string;
  status: 'active' | 'inactive' | 'expired' | 'unknown';
  isDefault: boolean;
  errorMessage?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountParams {
  userId: number;
  platform: string;
  platformId?: string;
  accountName?: string;
  realUsername?: string;
  cookies?: any[];
}

export const localAccountApi = {
  create: async (params: CreateAccountParams) => {
    return window.electron.localAccount.create(params);
  },
  
  findAll: async () => {
    return window.electron.localAccount.findAll();
  },
  
  findById: async (id: string) => {
    return window.electron.localAccount.findById(id);
  },
  
  findByPlatform: async (platformId: string) => {
    return window.electron.localAccount.findByPlatform(platformId);
  },
  
  update: async (id: string, params: Partial<CreateAccountParams>) => {
    return window.electron.localAccount.update(id, params);
  },
  
  delete: async (id: string) => {
    return window.electron.localAccount.delete(id);
  },
  
  setDefault: async (platformId: string, accountId: string) => {
    return window.electron.localAccount.setDefault(platformId, accountId);
  },
  
  getDefault: async (platformId: string) => {
    return window.electron.localAccount.getDefault(platformId);
  },
  
  updateLoginStatus: async (id: string, status: string, errorMessage?: string) => {
    return window.electron.localAccount.updateLoginStatus(id, status, errorMessage);
  },
  
  saveCookies: async (id: string, cookies: any[]) => {
    return window.electron.localAccount.saveCookies(id, cookies);
  },
  
  getCookies: async (id: string) => {
    return window.electron.localAccount.getCookies(id);
  },
  
  getStats: async () => {
    return window.electron.localAccount.getStats();
  },
  
  exists: async (platformId: string, platformUserId: string) => {
    return window.electron.localAccount.exists(platformId, platformUserId);
  },
};

// ==================== 本地知识库管理 ====================

export interface LocalKnowledgeBase {
  id: string;
  userId: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalKnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  content: string;
  createdAt: string;
}

export interface CreateKnowledgeBaseParams {
  userId: number;
  name: string;
  description?: string;
}

export const localKnowledgeApi = {
  create: async (params: CreateKnowledgeBaseParams) => {
    return window.electron.localKnowledge.create(params);
  },
  
  findAll: async () => {
    return window.electron.localKnowledge.findAll();
  },
  
  findById: async (id: string) => {
    return window.electron.localKnowledge.findById(id);
  },
  
  update: async (id: string, params: Partial<CreateKnowledgeBaseParams>) => {
    return window.electron.localKnowledge.update(id, params);
  },
  
  delete: async (id: string) => {
    return window.electron.localKnowledge.delete(id);
  },
  
  upload: async (kbId: string, files: any[]) => {
    return window.electron.localKnowledge.upload(kbId, files);
  },
  
  getDocuments: async (kbId: string) => {
    return window.electron.localKnowledge.getDocuments(kbId);
  },
  
  getDocument: async (docId: string) => {
    return window.electron.localKnowledge.getDocument(docId);
  },
  
  deleteDocument: async (docId: string) => {
    return window.electron.localKnowledge.deleteDocument(docId);
  },
  
  search: async (kbId: string, query: string) => {
    return window.electron.localKnowledge.search(kbId, query);
  },
  
  parse: async (filePath: string) => {
    return window.electron.localKnowledge.parse(filePath);
  },
  
  getStats: async () => {
    return window.electron.localKnowledge.getStats();
  },
};

// ==================== 本地图库管理 ====================

export interface LocalAlbum {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalImage {
  id: number;
  userId: number;
  albumId: number;
  filename: string;
  filepath: string;
  mimeType: string;
  size: number;
  usageCount: number;
  createdAt: string;
}

export interface CreateAlbumParams {
  userId: number;
  name: string;
}

export const localGalleryApi = {
  createAlbum: async (params: CreateAlbumParams) => {
    return window.electron.gallery.createAlbum(params);
  },
  
  findAlbums: async () => {
    return window.electron.gallery.findAlbums();
  },
  
  getAlbum: async (albumId: number) => {
    return window.electron.gallery.getAlbum(albumId);
  },
  
  updateAlbum: async (albumId: number, params: Partial<CreateAlbumParams>) => {
    return window.electron.gallery.updateAlbum(albumId, params);
  },
  
  deleteAlbum: async (albumId: number) => {
    return window.electron.gallery.deleteAlbum(albumId);
  },
  
  uploadImage: async (albumId: number, files: any[]) => {
    return window.electron.gallery.uploadImage(albumId, files);
  },
  
  findImages: async (albumId: number) => {
    return window.electron.gallery.findImages(albumId);
  },
  
  getImage: async (imageId: number) => {
    return window.electron.gallery.getImage(imageId);
  },
  
  deleteImage: async (imageId: number) => {
    return window.electron.gallery.deleteImage(imageId);
  },
  
  deleteImages: async (imageIds: number[]) => {
    return window.electron.gallery.deleteImages(imageIds);
  },
  
  moveImage: async (imageId: number, targetAlbumId: number) => {
    return window.electron.gallery.moveImage(imageId, targetAlbumId);
  },
  
  getStats: async () => {
    return window.electron.gallery.getStats();
  },
  
  readImageFile: async (imageId: number) => {
    return window.electron.gallery.readImageFile(imageId);
  },
};

// ==================== 数据同步 ====================

export interface SyncSnapshot {
  id: string;
  metadata: {
    version: string;
    articleCount: number;
    accountCount: number;
    createdAt: string;
  };
  uploadedAt: string;
  lastDownloadedAt?: string;
  expiresAt: string;
  size: number;
  isExpiringSoon?: boolean;
}

export const localSyncApi = {
  backup: async () => {
    return window.electron.dataSync.backup();
  },
  
  restore: async (snapshotId: number) => {
    return window.electron.dataSync.restore(snapshotId);
  },
  
  getSnapshots: async () => {
    return window.electron.dataSync.getSnapshots();
  },
  
  deleteSnapshot: async (snapshotId: number) => {
    return window.electron.dataSync.deleteSnapshot(snapshotId);
  },
  
  exportLocal: async (exportPath?: string) => {
    return window.electron.dataSync.exportLocal(exportPath);
  },
  
  importLocal: async (importPath: string) => {
    return window.electron.dataSync.importLocal(importPath);
  },
  
  getLocalStats: async () => {
    return window.electron.dataSync.getLocalStats();
  },
};
