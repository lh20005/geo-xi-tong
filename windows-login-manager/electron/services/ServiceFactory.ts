/**
 * Service Factory
 * 统一管理所有 PostgreSQL Service 实例
 * 
 * 功能：
 * 1. 单例模式管理 Service 实例
 * 2. 自动注入 user_id
 * 3. 提供统一的获取接口
 * 
 * Requirements: PostgreSQL 迁移 - 阶段 6
 */

import { ArticleServicePostgres } from './ArticleServicePostgres';
import { AlbumServicePostgres } from './AlbumServicePostgres';
import { ImageServicePostgres } from './ImageServicePostgres';
import { KnowledgeBaseServicePostgres } from './KnowledgeBaseServicePostgres';
import { PlatformAccountServicePostgres } from './PlatformAccountServicePostgres';
import { PublishingTaskServicePostgres } from './PublishingTaskServicePostgres';
import { PublishingRecordServicePostgres } from './PublishingRecordServicePostgres';
import { DistillationServicePostgres } from './DistillationServicePostgres';
import { TopicServicePostgres } from './TopicServicePostgres';
import { ConversionTargetServicePostgres } from './ConversionTargetServicePostgres';
import { ArticleSettingServicePostgres } from './ArticleSettingServicePostgres';
import { UserServicePostgres } from './UserServicePostgres';
import log from 'electron-log';

/**
 * Service Factory 类
 * 
 * 使用方法：
 * ```typescript
 * const factory = ServiceFactory.getInstance();
 * factory.setUserId(123);
 * 
 * const articleService = factory.getArticleService();
 * const albums = await articleService.findAll();
 * ```
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  private userId: number | null = null;

  // Service 实例缓存
  private articleService: ArticleServicePostgres | null = null;
  private albumService: AlbumServicePostgres | null = null;
  private imageService: ImageServicePostgres | null = null;
  private knowledgeBaseService: KnowledgeBaseServicePostgres | null = null;
  private platformAccountService: PlatformAccountServicePostgres | null = null;
  private publishingTaskService: PublishingTaskServicePostgres | null = null;
  private publishingRecordService: PublishingRecordServicePostgres | null = null;
  private distillationService: DistillationServicePostgres | null = null;
  private topicService: TopicServicePostgres | null = null;
  private conversionTargetService: ConversionTargetServicePostgres | null = null;
  private articleSettingService: ArticleSettingServicePostgres | null = null;
  private userService: UserServicePostgres | null = null;

  private constructor() {
    log.info('ServiceFactory: 初始化');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * 设置当前用户 ID
   * 
   * 必须在使用任何 Service 之前调用
   * 
   * @param userId 用户 ID（从 JWT token 获取）
   */
  public setUserId(userId: number): void {
    if (this.userId !== userId) {
      log.info(`ServiceFactory: 设置用户 ID: ${userId}`);
      this.userId = userId;
      
      // 清除所有缓存的 Service 实例
      this.clearCache();
    }
  }

  /**
   * 获取当前用户 ID
   */
  public getUserId(): number | null {
    return this.userId;
  }

  /**
   * 清除所有缓存的 Service 实例
   * 
   * 当用户切换时调用
   */
  public clearCache(): void {
    log.info('ServiceFactory: 清除 Service 缓存');
    
    this.articleService = null;
    this.albumService = null;
    this.imageService = null;
    this.knowledgeBaseService = null;
    this.platformAccountService = null;
    this.publishingTaskService = null;
    this.publishingRecordService = null;
    this.distillationService = null;
    this.topicService = null;
    this.conversionTargetService = null;
    this.articleSettingService = null;
    this.userService = null;
  }

  /**
   * 验证用户 ID 是否已设置
   */
  private validateUserId(): void {
    if (!this.userId) {
      throw new Error('用户 ID 未设置，请先调用 setUserId()');
    }
  }

  /**
   * 获取文章服务
   */
  public getArticleService(): ArticleServicePostgres {
    this.validateUserId();
    
    if (!this.articleService) {
      this.articleService = new ArticleServicePostgres();
      this.articleService.setUserId(this.userId!);
    }
    
    return this.articleService;
  }

  /**
   * 获取相册服务
   */
  public getAlbumService(): AlbumServicePostgres {
    this.validateUserId();
    
    if (!this.albumService) {
      this.albumService = new AlbumServicePostgres();
      this.albumService.setUserId(this.userId!);
    }
    
    return this.albumService;
  }

  /**
   * 获取图片服务
   */
  public getImageService(): ImageServicePostgres {
    this.validateUserId();
    
    if (!this.imageService) {
      this.imageService = new ImageServicePostgres();
      this.imageService.setUserId(this.userId!);
    }
    
    return this.imageService;
  }

  /**
   * 获取知识库服务
   */
  public getKnowledgeBaseService(): KnowledgeBaseServicePostgres {
    this.validateUserId();
    
    if (!this.knowledgeBaseService) {
      this.knowledgeBaseService = new KnowledgeBaseServicePostgres();
      this.knowledgeBaseService.setUserId(this.userId!);
    }
    
    return this.knowledgeBaseService;
  }

  /**
   * 获取平台账号服务
   */
  public getPlatformAccountService(): PlatformAccountServicePostgres {
    this.validateUserId();
    
    if (!this.platformAccountService) {
      this.platformAccountService = new PlatformAccountServicePostgres();
      this.platformAccountService.setUserId(this.userId!);
    }
    
    return this.platformAccountService;
  }

  /**
   * 获取发布任务服务
   */
  public getPublishingTaskService(): PublishingTaskServicePostgres {
    this.validateUserId();
    
    if (!this.publishingTaskService) {
      this.publishingTaskService = new PublishingTaskServicePostgres();
      this.publishingTaskService.setUserId(this.userId!);
    }
    
    return this.publishingTaskService;
  }

  /**
   * 获取发布记录服务
   */
  public getPublishingRecordService(): PublishingRecordServicePostgres {
    this.validateUserId();
    
    if (!this.publishingRecordService) {
      this.publishingRecordService = new PublishingRecordServicePostgres();
      this.publishingRecordService.setUserId(this.userId!);
    }
    
    return this.publishingRecordService;
  }

  /**
   * 获取蒸馏服务
   */
  public getDistillationService(): DistillationServicePostgres {
    this.validateUserId();
    
    if (!this.distillationService) {
      this.distillationService = new DistillationServicePostgres();
      this.distillationService.setUserId(this.userId!);
    }
    
    return this.distillationService;
  }

  /**
   * 获取话题服务
   */
  public getTopicService(): TopicServicePostgres {
    this.validateUserId();
    
    if (!this.topicService) {
      this.topicService = new TopicServicePostgres();
      this.topicService.setUserId(this.userId!);
    }
    
    return this.topicService;
  }

  /**
   * 获取转化目标服务
   */
  public getConversionTargetService(): ConversionTargetServicePostgres {
    this.validateUserId();
    
    if (!this.conversionTargetService) {
      this.conversionTargetService = new ConversionTargetServicePostgres();
      this.conversionTargetService.setUserId(this.userId!);
    }
    
    return this.conversionTargetService;
  }

  /**
   * 获取文章设置服务
   */
  public getArticleSettingService(): ArticleSettingServicePostgres {
    this.validateUserId();
    
    if (!this.articleSettingService) {
      this.articleSettingService = new ArticleSettingServicePostgres();
      this.articleSettingService.setUserId(this.userId!);
    }
    
    return this.articleSettingService;
  }

  /**
   * 获取用户服务
   */
  public getUserService(): UserServicePostgres {
    this.validateUserId();
    
    if (!this.userService) {
      this.userService = new UserServicePostgres();
      this.userService.setUserId(this.userId!);
    }
    
    return this.userService;
  }
}

// 导出单例实例
export const serviceFactory = ServiceFactory.getInstance();
