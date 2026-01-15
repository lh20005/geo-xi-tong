/**
 * 本地数据服务统一导出
 * Requirements: Phase 2 - 数据服务层
 */

export { articleService, ArticleService } from './ArticleService';
export type { Article, CreateArticleParams, UpdateArticleParams, ArticleQueryParams } from './ArticleService';

export { knowledgeBaseService, KnowledgeBaseService } from './KnowledgeBaseService';
export type { KnowledgeBase, KnowledgeDocument, CreateKnowledgeBaseParams, UpdateKnowledgeBaseParams, UploadDocumentParams } from './KnowledgeBaseService';

export { galleryService, GalleryService } from './GalleryService';
export type { Album, Image as GalleryImage, CreateAlbumParams, UploadImageParams } from './GalleryService';

export { accountService, AccountService } from './AccountService';
export type { PlatformAccount, CreateAccountParams, UpdateAccountParams } from './AccountService';

export { taskService, TaskService } from './TaskService';
export type { PublishingTask, PublishingRecord, PublishingLog, CreateTaskParams, TaskQueryParams } from './TaskService';

export { BaseService } from './BaseService';
export type { PaginationParams, SortParams, PaginatedResult } from './BaseService';
